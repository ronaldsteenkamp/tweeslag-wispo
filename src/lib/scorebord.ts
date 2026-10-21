import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { bingoScore, maakKaart } from './bingo'
import { laad } from './data'
import { abonneer, lees, schrijf } from './opslag'

/*
 * Scorebord: de spelvoortgang van deze telefoon gaat naar de server, het klassement komt terug.
 *
 * Wachtrij: in plaats van losse wijzigingen bewaren we alleen "er moet nog iets verstuurd
 * worden". Bij versturen gaat altijd de volledige, actuele stand mee. Dat is vanzelf in orde
 * na offline afvinken, na dubbel versturen en na het wisselen van telefoon.
 */

const TE_VERSTUREN = 'scorebord.teVersturen'
const LAATST_VERSTUURD = 'scorebord.verstuurdOp'

export type SyncStatus = 'uit' | 'wacht' | 'bezig' | 'verstuurd' | 'fout'

let syncStatus: SyncStatus = backendIngesteld ? (lees(TE_VERSTUREN, true) ? 'wacht' : 'verstuurd') : 'uit'
const syncLuisteraars = new Set<() => void>()
const zetSync = (s: SyncStatus) => {
  syncStatus = s
  syncLuisteraars.forEach((f) => f())
}

interface Voortgang {
  challenges: string[]
  bingo: string[]
  challenge_punten: number
  bingo_punten: number
}

/** Dezelfde berekening als het scherm "Jouw score" */
async function huidigeVoortgang(): Promise<Voortgang | null> {
  const spel = await laad('spel').catch(() => null)
  if (!spel) return null
  const gedaan = new Set(lees<string[]>('spel.challenges', []))
  const vinkjes = new Set(lees<string[]>('spel.bingo.vinkjes', []))
  const alle = spel.challenges.flatMap((d) => d.items)
  const challenges = alle.filter((c) => gedaan.has(c.id))
  // Zonder bewaarde kaart (spel nooit geopend) zijn er ook geen bingovinkjes
  const bewaard = lees<unknown>('spel.bingo.kaart', null)
  const kaart = bewaard ? maakKaart(spel.bingo.vakjes, bewaard) : []
  const bingo = bingoScore(kaart, vinkjes, spel.punten)
  const grens = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)))
  return {
    challenges: challenges.map((c) => c.id).slice(0, 200),
    bingo: kaart.filter((t) => t && vinkjes.has(t)).slice(0, 25),
    challenge_punten: grens(
      challenges.reduce((s, c) => s + c.punten, 0),
      5000,
    ),
    bingo_punten: kaart.length ? grens(bingo.totaal, 1000) : 0,
  }
}

let bezig = false

/** Verstuurt de stand als er iets te versturen is en de verbinding er is */
export async function verstuurVoortgang() {
  const b = backendStand()
  if (!backendIngesteld || bezig || !lees(TE_VERSTUREN, true)) return
  if (b.status !== 'verbonden' || !b.gekoppeld || !b.userId) {
    zetSync('wacht')
    return
  }
  const cb = supabase()
  if (!cb) return
  bezig = true
  zetSync('bezig')
  try {
    const voortgang = await huidigeVoortgang()
    if (!voortgang) throw new Error('spel.json niet beschikbaar')
    const c = await cb
    // Eerst "klaar" zetten: komt er tijdens het versturen een nieuw vinkje bij, dan staat de vlag weer aan
    schrijf(TE_VERSTUREN, false)
    const { error } = await c.from('voortgang').upsert({ user_id: b.userId, ...voortgang }, { onConflict: 'user_id' })
    if (error) throw error
    schrijf(LAATST_VERSTUURD, Date.now())
    zetSync(lees(TE_VERSTUREN, false) ? 'wacht' : 'verstuurd')
  } catch {
    schrijf(TE_VERSTUREN, true)
    zetSync('fout')
  } finally {
    bezig = false
    // Er kwam iets bij terwijl we bezig waren
    if (lees(TE_VERSTUREN, false) && syncStatus !== 'fout') void verstuurVoortgang()
  }
}

function markeer() {
  schrijf(TE_VERSTUREN, true)
  zetSync('wacht')
  void verstuurVoortgang()
}

let gestart = false

/** Eén keer bij het starten: elk afvinkje of bingovakje komt in de wachtrij */
export function startScorebord() {
  if (gestart || !backendIngesteld) return
  gestart = true
  // Bij elke start één keer de volledige stand sturen (herstelt zich na wisselen van telefoon)
  schrijf(TE_VERSTUREN, true)
  abonneer('spel.challenges', markeer)
  abonneer('spel.bingo.vinkjes', markeer)
  abonneerBackend(() => {
    const b = backendStand()
    if (b.status === 'verbonden' && b.gekoppeld) void verstuurVoortgang()
  })
}

export function useSyncStatus() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    syncLuisteraars.add(f)
    return () => {
      syncLuisteraars.delete(f)
    }
  }, [])
  return { status: syncStatus, verstuurdOp: lees<number | null>(LAATST_VERSTUURD, null) }
}

// ---------- Klassement ----------

export interface PersoonScore {
  naam: string
  kamer: string | null
  challenge_punten: number
  bingo_punten: number
  correcties: number
  totaal: number
}

export interface KamerScore {
  kamer: string
  aantal: number
  personen_punten: number
  kamer_bonus: number
  totaal: number
}

export interface Correctie {
  id: number
  naam: string | null
  kamer: string | null
  punten: number
  reden: string
  gemaakt: string
}

export interface Klassement {
  personen: PersoonScore[]
  kamers: KamerScore[]
  correcties: Correctie[]
  opgehaald: number
}

async function haalKlassement(): Promise<Klassement> {
  const cb = supabase()
  if (!cb) throw new Error('geen backend')
  const c = await cb
  const [p, k, cor] = await Promise.all([
    c.from('klassement_personen').select('naam, kamer, challenge_punten, bingo_punten, correcties, totaal').order('totaal', { ascending: false }).order('naam'),
    c.from('klassement_kamers').select('kamer, aantal, personen_punten, kamer_bonus, totaal').order('totaal', { ascending: false }).order('kamer'),
    c.from('correcties').select('id, naam, kamer, punten, reden, gemaakt').order('gemaakt', { ascending: false }).limit(30),
  ])
  const fout = p.error ?? k.error ?? cor.error
  if (fout) throw fout
  return {
    personen: (p.data ?? []) as PersoonScore[],
    kamers: (k.data ?? []) as KamerScore[],
    correcties: (cor.data ?? []) as Correctie[],
    opgehaald: Date.now(),
  }
}

const KLASSEMENT_CACHE = 'scorebord.klassement'

/** Klassement met live verversen (Realtime) en elke 30 seconden als vangnet */
export function useKlassement(actief: boolean) {
  const [klassement, setKlassement] = useState<Klassement | null>(() => lees<Klassement | null>(KLASSEMENT_CACHE, null))
  const [mislukt, setMislukt] = useState(false)

  useEffect(() => {
    if (!actief || !backendIngesteld) return
    let weg = false
    let wacht: number | undefined
    let kanaal: RealtimeChannel | null = null

    const ververs = async () => {
      if (backendStand().status !== 'verbonden') {
        setMislukt(true)
        return
      }
      try {
        const k = await haalKlassement()
        if (weg) return
        setKlassement(k)
        setMislukt(false)
        schrijf(KLASSEMENT_CACHE, k)
      } catch {
        if (!weg) setMislukt(true)
      }
    }
    // Meerdere wijzigingen kort na elkaar: één keer ophalen
    const straks = () => {
      window.clearTimeout(wacht)
      wacht = window.setTimeout(() => void ververs(), 800)
    }

    void ververs()
    const id = window.setInterval(() => void ververs(), 30_000)
    const stop = abonneerBackend(() => {
      if (backendStand().status === 'verbonden') straks()
    })
    const cb = supabase()
    void cb?.then((c) => {
      if (weg) return
      kanaal = c.channel('klassement')
      for (const tabel of ['voortgang', 'correcties', 'deelnemers']) {
        kanaal.on('postgres_changes', { event: '*', schema: 'public', table: tabel }, straks)
      }
      kanaal.subscribe()
    })

    return () => {
      weg = true
      window.clearInterval(id)
      window.clearTimeout(wacht)
      stop()
      if (kanaal) void cb?.then((c) => c.removeChannel(kanaal!))
    }
  }, [actief])

  return { klassement, mislukt }
}

// ---------- Beheer: correcties en bonuspunten ----------

export async function voegCorrectieToe(c: { naam?: string; kamer?: string; punten: number; reden: string }): Promise<string | null> {
  const cb = supabase()
  if (!cb) return 'Geen verbinding'
  const client = await cb
  const { error } = await client.from('correcties').insert({
    naam: c.naam ?? null,
    kamer: c.kamer ?? null,
    punten: Math.round(c.punten),
    reden: c.reden.trim(),
  })
  return error ? error.message : null
}

export async function verwijderCorrectie(id: number): Promise<string | null> {
  const cb = supabase()
  if (!cb) return 'Geen verbinding'
  const client = await cb
  const { error } = await client.from('correcties').delete().eq('id', id)
  return error ? error.message : null
}
