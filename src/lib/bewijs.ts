import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { BUCKET, LINK_GELDIG, kleinPad, meldWijziging, opFotoWijziging, type Foto } from './fotos'
import { lees, schrijf } from './opslag'
import { STUKJE_VELDEN, type Stukje } from './stukjes'

/*
 * Bewijs bij de challenges, beoordeeld door de redactie (migratie 0018). Een kiekje is
 * 'ingestuurd' (ter perse), 'goed' (geplaatst: punten en op de muur) of 'af' (briefje terug, met
 * een reden). Zonder die migratie bestaat er geen beoordeling: dan telt insturen meteen, zoals vroeger.
 */

export type Status = 'ingestuurd' | 'goed' | 'af'
/** Een kiekje, of een ingezonden stukje tekst (migratie 0019; dan `soort` = 'stukje' en geen pad) */
export type Inzending = Foto & { status: Status; soort?: 'foto' | 'stukje'; tekst?: string }

const VELDEN_BASIS =
  'id, user_id, naam, kamer, challenge_id, challenge_titel, pad, breedte, hoogte, gemaakt, genomen, jury, status, reden, zichtbaar, punten, bron, beoordeeld_op'
/** Met onderschrift (migratie 0019); zonder die migratie de basisvelden */
let VELDEN = `${VELDEN_BASIS}, onderschrift`

/** Een stukje in dezelfde vorm als een kiekje, zodat lijsten en statussen hetzelfde werken */
export function stukjeAlsInzending(s: Stukje): Inzending {
  return {
    id: s.id,
    user_id: s.user_id,
    naam: s.naam,
    kamer: s.kamer,
    challenge_id: s.challenge_id ?? '',
    challenge_titel: s.challenge_titel ?? 'Ingezonden',
    pad: '',
    breedte: null,
    hoogte: null,
    gemaakt: s.gemaakt,
    genomen: s.gemaakt,
    status: s.status,
    reden: s.reden,
    punten: s.punten,
    beoordeeld_op: s.beoordeeld_op,
    soort: 'stukje',
    tekst: s.tekst,
  }
}

async function haalFotos(q: (velden: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>) {
  let r = await q(VELDEN)
  if (r.error?.code === '42703' && VELDEN.includes('onderschrift')) {
    VELDEN = VELDEN_BASIS
    r = await q(VELDEN)
  }
  return r
}

/** Stukjes ophalen; leeg (geen fout) als de server ze nog niet kent */
async function haalStukjes(q: () => PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<Inzending[]> {
  const r = await q()
  if (r.error) return []
  return ((r.data ?? []) as Stukje[]).map(stukjeAlsInzending)
}

const RANG: Record<Status, number> = { goed: 3, ingestuurd: 2, af: 1 }

/** Per challenge de inzending die telt: geplaatst gaat voor ter perse, dat gaat voor een briefje; daarbinnen de nieuwste */
export function bestePerChallenge(lijst: Inzending[]) {
  const uit = new Map<string, Inzending>()
  for (const f of lijst) {
    // Een los stukje (zonder challenge) hoort bij geen enkele challenge
    if (!f.challenge_id) continue
    const oud = uit.get(f.challenge_id)
    if (!oud || RANG[f.status] > RANG[oud.status] || (RANG[f.status] === RANG[oud.status] && f.gemaakt > oud.gemaakt)) {
      uit.set(f.challenge_id, f)
    }
  }
  return uit
}

async function metLinks(rijen: Inzending[]) {
  const cb = supabase()
  const fotos = rijen.filter((f) => f.pad)
  if (!cb || !fotos.length) return rijen
  const { data } = await (await cb).storage.from(BUCKET).createSignedUrls(fotos.map((f) => kleinPad(f.pad)), LINK_GELDIG)
  const per = new Map((data ?? []).map((l) => [l.path, l.signedUrl]))
  return rijen.map((f) => ({ ...f, klein: per.get(kleinPad(f.pad)) ?? f.klein }))
}

/** Ververst bij wijzigingen in de tabel (live), bij eigen acties, bij nieuw bereik en elke 40 minuten (links) */
function useVerversen(ververs: () => Promise<void>, actief: boolean, kanaalNaam: string) {
  useEffect(() => {
    if (!actief || !backendIngesteld) return
    let weg = false
    let wacht: number | undefined
    let kanaal: RealtimeChannel | null = null
    const straks = () => {
      window.clearTimeout(wacht)
      wacht = window.setTimeout(() => void ververs(), 600)
    }
    void ververs()
    const id = window.setInterval(() => void ververs(), 40 * 60_000)
    let vorige = backendStand().status
    const stopBackend = abonneerBackend(() => {
      const nu = backendStand().status
      if (nu === 'verbonden' && vorige !== 'verbonden') straks()
      vorige = nu
    })
    const stopEigen = opFotoWijziging(straks)
    const cb = supabase()
    void cb?.then((c) => {
      if (weg) return
      kanaal = c.channel(`${kanaalNaam}-${Math.random().toString(36).slice(2, 7)}`)
      kanaal
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fotos' }, straks)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stukjes' }, straks)
        .subscribe()
    })
    return () => {
      weg = true
      window.clearTimeout(wacht)
      window.clearInterval(id)
      stopBackend()
      stopEigen()
      if (kanaal) void cb?.then((c) => c.removeChannel(kanaal!))
    }
  }, [ververs, actief, kanaalNaam])
}

const MIJN_CACHE = 'bewijs.mijn'

/**
 * Je eigen kiekjes (op naam, dus ook die van je vorige telefoon), met links naar de kleine versies.
 * `beschikbaar` is false als de server nog geen beoordeling kent (migratie 0018 niet gedraaid).
 */
export function useMijnBewijs(naam: string | null) {
  const [stand, setStand] = useState<{ lijst: Inzending[]; beschikbaar: boolean; geladen: boolean }>(() => {
    const c = lees<{ naam?: string; lijst?: Inzending[] } | null>(MIJN_CACHE, null)
    const lijst = c && c.naam === naam && Array.isArray(c.lijst) ? c.lijst : []
    return { lijst, beschikbaar: true, geladen: lijst.length > 0 }
  })
  const weg = useRef(false)
  useEffect(() => () => void (weg.current = true), [])

  const ververs = useCallback(async () => {
    const cb = supabase()
    if (!cb || !naam || backendStand().status !== 'verbonden') return
    const c = await cb
    const { data, error } = await haalFotos((v) => c.from('fotos').select(v).eq('naam', naam).order('gemaakt', { ascending: false }).limit(200))
    if (weg.current) return
    if (error) {
      if (error.code === '42703') setStand({ lijst: [], beschikbaar: false, geladen: true })
      return
    }
    const stukjes = await haalStukjes(() => c.from('stukjes').select(STUKJE_VELDEN).eq('naam', naam).order('gemaakt', { ascending: false }).limit(100))
    const lijst = [...(await metLinks((data ?? []) as unknown as Inzending[])), ...stukjes]
    if (weg.current) return
    schrijf(MIJN_CACHE, { naam, lijst })
    setStand({ lijst, beschikbaar: true, geladen: true })
  }, [naam])

  useVerversen(ververs, !!naam, 'bewijs-mijn')
  return { ...stand, ververs }
}

/** Voor de redactie: alles wat nog ter perse ligt, oudste eerst */
export function useRedactietafel(actief: boolean) {
  const [lijst, setLijst] = useState<Inzending[] | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const weg = useRef(false)
  useEffect(() => () => void (weg.current = true), [])

  const ververs = useCallback(async () => {
    const cb = supabase()
    if (!cb || backendStand().status !== 'verbonden') return
    const c = await cb
    const { data, error } = await haalFotos((v) => c.from('fotos').select(v).eq('status', 'ingestuurd').order('gemaakt', { ascending: true }).limit(300))
    if (weg.current) return
    if (error) {
      setFout(error.code === '42703' ? 'De server kent de redactie nog niet (migratie 0018).' : error.message)
      return
    }
    const stukjes = await haalStukjes(() => c.from('stukjes').select(STUKJE_VELDEN).eq('status', 'ingestuurd').order('gemaakt', { ascending: true }).limit(300))
    const rijen = [...(await metLinks((data ?? []) as unknown as Inzending[])), ...stukjes].sort((a, b) => a.gemaakt.localeCompare(b.gemaakt))
    if (weg.current) return
    setFout(null)
    setLijst(rijen)
  }, [])

  useVerversen(ververs, actief, 'bewijs-redactie')
  return { lijst, fout, ververs }
}

/** Aantal kiekjes op de redactietafel (voor de knop in het Spel), zonder de foto's zelf op te halen */
export function useOpTafel(actief: boolean) {
  const [aantal, setAantal] = useState<number | null>(null)
  const ververs = useCallback(async () => {
    const cb = supabase()
    if (!cb || backendStand().status !== 'verbonden') return
    const c = await cb
    const [f, s] = await Promise.all([
      c.from('fotos').select('id', { count: 'exact', head: true }).eq('status', 'ingestuurd'),
      c.from('stukjes').select('id', { count: 'exact', head: true }).eq('status', 'ingestuurd'),
    ])
    if (!f.error) setAantal((f.count ?? 0) + (s.error ? 0 : (s.count ?? 0)))
  }, [])
  useVerversen(ververs, actief, 'bewijs-teller')
  return aantal
}

const foutTekst: Record<string, string> = {
  geen_beheerder: 'Alleen de redactie kan dit.',
  reden_nodig: 'Schrijf er even een reden bij.',
  geen_foto: 'Dit kiekje bestaat niet meer.',
  geen_stukje: 'Dit stukje bestaat niet meer.',
}
const vertaal = (m: string) => foutTekst[m] ?? (/fetch|network|load failed/i.test(m) ? 'Geen verbinding. Probeer het zo nog eens.' : m)

/** Plaatsen of een briefje terugsturen (kiekje of stukje). Geeft een foutmelding, of null als het gelukt is. */
export async function beoordeel(id: string, status: Status, reden?: string, soort: 'foto' | 'stukje' = 'foto'): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding. Probeer het zo nog eens.'
  const { error } = await (await cb).rpc(soort === 'stukje' ? 'beoordeel_stukje' : 'beoordeel_foto', { p_id: id, p_status: status, p_reden: reden ?? null })
  if (error) return vertaal(error.message)
  meldWijziging()
  return null
}

/** Wie mag je kiekje zien: iedereen (zodra hij geplaatst is) of alleen de redactie */
export async function zetZichtbaar(id: string, zichtbaar: 'iedereen' | 'redactie'): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding. Probeer het zo nog eens.'
  const { error } = await (await cb).rpc('zet_zichtbaar', { p_id: id, p_zichtbaar: zichtbaar })
  if (error) return vertaal(error.message)
  meldWijziging()
  return null
}

/** Welke geplaatste kiekjes je al gevierd hebt (de beloning komt één keer) */
export const GEVIERD = 'spel.bewijs.gevierd'
