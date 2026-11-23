import { useCallback, useEffect, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { meldWijziging } from './fotos'
import { lees, schrijf } from './opslag'

/*
 * Ingezonden stukjes voor het clubblad (migratie 0019): een korte tekst, los (rubriek "Ingezonden",
 * geen punten) of bij een challenge (telt als bewijs zodra de redactie hem plaatst). Zelfde
 * redactie als de foto's: ingestuurd → goed of af met een reden.
 *
 * Zonder bereik gaat een stukje in een kleine wachtrij op de telefoon (localStorage) en wordt hij
 * vanzelf verstuurd. Elk stukje heeft een vast id, dus het komt er nooit twee keer op.
 */

export const STUKJE_MAX = 600
export const ONDERSCHRIFT_MAX = 140

export interface Stukje {
  id: string
  user_id: string
  naam: string
  kamer: string | null
  challenge_id: string | null
  challenge_titel: string | null
  tekst: string
  punten: number
  status: 'ingestuurd' | 'goed' | 'af'
  reden: string | null
  gemaakt: string
  beoordeeld_op: string | null
}

export const STUKJE_VELDEN = 'id, user_id, naam, kamer, challenge_id, challenge_titel, tekst, punten, status, reden, gemaakt, beoordeeld_op'

export interface StukjeIn {
  id: string
  tekst: string
  challenge?: { id: string; titel: string; punten: number } | null
}

const bestaatAl = (e: { code?: string; message?: string }) => e.code === '23505' || /duplicate/i.test(e.message ?? '')
const lijktBereik = (m: string) => /fetch|network|netwerk|load failed|time-?out|abort|verbinding/i.test(m)

async function verstuur(s: StukjeIn): Promise<string | null> {
  const cb = supabase()
  const b = backendStand()
  if (!cb || b.status !== 'verbonden') return 'Geen verbinding'
  if (!b.gekoppeld) return 'Je naam is nog niet doorgegeven aan de server.'
  const rij: Record<string, unknown> = { id: s.id, tekst: s.tekst.trim().slice(0, STUKJE_MAX) }
  if (s.challenge) Object.assign(rij, { challenge_id: s.challenge.id, challenge_titel: s.challenge.titel.slice(0, 120), punten: s.challenge.punten })
  try {
    const { error } = await (await cb).from('stukjes').insert(rij)
    if (error && !bestaatAl(error)) return error.message
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  meldWijziging()
  return null
}

// ---------- Wachtrij (zonder bereik) ----------

const WACHTRIJ = 'stukjes.wachtrij'
const luisteraars = new Set<() => void>()
const meld = () => luisteraars.forEach((f) => f())
const leesRij = () => {
  const r = lees<StukjeIn[]>(WACHTRIJ, [])
  return Array.isArray(r) ? r : []
}
const zetRij = (r: StukjeIn[]) => {
  schrijf(WACHTRIJ, r)
  meld()
}

/**
 * Stuurt een stukje naar de redactie. Zonder bereik (of als het halverwege wegvalt) komt hij in de
 * wachtrij: `later` = true. Een andere fout komt terug als tekst.
 */
export async function stuurStukje(s: StukjeIn): Promise<{ later: boolean; fout: string | null }> {
  const f = await verstuur(s)
  if (!f) return { later: false, fout: null }
  if (f === 'Geen verbinding' || lijktBereik(f)) {
    zetRij([...leesRij().filter((x) => x.id !== s.id), s])
    return { later: true, fout: null }
  }
  return { later: false, fout: f }
}

let bezig = false
export async function verstuurStukjesWachtrij() {
  if (bezig || backendStand().status !== 'verbonden' || !backendStand().gekoppeld) return
  bezig = true
  try {
    for (const s of leesRij()) {
      const f = await verstuur(s)
      if (f && (f === 'Geen verbinding' || lijktBereik(f))) break
      // Gelukt, of een fout die niet van het bereik komt (dan blijft hij niet eeuwig hangen)
      zetRij(leesRij().filter((x) => x.id !== s.id))
    }
  } finally {
    bezig = false
  }
}

export function gooiStukjeWeg(id: string) {
  zetRij(leesRij().filter((x) => x.id !== id))
}

/** Stukjes die nog op deze telefoon wachten */
export function useStukjesWachtrij(): StukjeIn[] {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => void luisteraars.delete(f)
  }, [])
  return leesRij()
}

let gestart = false
/** Eén keer bij het starten van de app */
export function startStukjesWachtrij() {
  if (gestart || !backendIngesteld) return
  gestart = true
  abonneerBackend(() => void verstuurStukjesWachtrij())
  window.addEventListener('online', () => window.setTimeout(() => void verstuurStukjesWachtrij(), 2000))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verstuurStukjesWachtrij()
  })
}

// ---------- Ophalen, beoordelen, weghalen ----------

/*
 * De laatst opgehaalde stukjes onthouden (in het geheugen en op het apparaat), net als de foto's
 * (zie useFotos): dan staan ze er bij het openen van het clubblad meteen, tegelijk met de foto's,
 * in plaats van een tel later (waardoor de pagina verschoof). Daarna wordt de lijst ververst.
 */
const STUKJES_CACHE = 'stukjescache'
let laatsteStukjes: Stukje[] | null = (() => {
  const l = lees<Stukje[] | null>(STUKJES_CACHE, null)
  return Array.isArray(l) ? l : null
})()
const bewaarStukjes = (l: Stukje[]) => {
  laatsteStukjes = l
  schrijf(STUKJES_CACHE, l)
}

/** Geplaatste stukjes voor het clubblad, nieuwste eerst. `null` zolang ze (de eerste keer) laden; leeg als de server ze nog niet kent. */
export function useGeplaatsteStukjes(actief: boolean) {
  const [lijst, setLijst] = useState<Stukje[] | null>(() => (actief ? laatsteStukjes : null))
  const ververs = useCallback(async () => {
    const cb = supabase()
    if (!cb || backendStand().status !== 'verbonden') return
    const { data, error } = await (await cb).from('stukjes').select(STUKJE_VELDEN).eq('status', 'goed').order('gemaakt', { ascending: false }).limit(200)
    if (error) {
      // Migratie 0019 nog niet gedraaid: geen rubriek
      if (error.code === '42P01' || error.code === 'PGRST205') {
        bewaarStukjes([])
        setLijst([])
      }
      return
    }
    const nieuw = (data ?? []) as Stukje[]
    bewaarStukjes(nieuw)
    // Niets veranderd: dezelfde lijst houden, dan rekent het blad niets opnieuw uit
    setLijst((oud) => (oud && JSON.stringify(oud) === JSON.stringify(nieuw) ? oud : nieuw))
  }, [])
  useEffect(() => {
    if (!actief || !backendIngesteld) return
    let weg = false
    let kanaal: { unsubscribe: () => void } | null = null
    void ververs()
    const stop = abonneerBackend(() => backendStand().status === 'verbonden' && void ververs())
    const cb = supabase()
    void cb?.then((c) => {
      if (weg) return
      const k = c.channel(`stukjes-${Math.random().toString(36).slice(2, 7)}`)
      k.on('postgres_changes', { event: '*', schema: 'public', table: 'stukjes' }, () => void ververs()).subscribe()
      kanaal = { unsubscribe: () => void c.removeChannel(k) }
    })
    return () => {
      weg = true
      stop()
      kanaal?.unsubscribe()
    }
  }, [actief, ververs])
  return lijst
}

export async function verwijderStukje(id: string): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding. Weghalen kan alleen met internet.'
  const { data, error } = await (await cb).from('stukjes').delete().eq('id', id).select('id')
  if (error) return `Weghalen lukte niet: ${error.message}`
  if (!data?.length) return 'Weghalen lukte niet: dit stukje is niet (meer) van jou.'
  meldWijziging()
  return null
}
