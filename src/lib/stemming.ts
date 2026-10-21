import { useEffect, useMemo, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { laad, useData } from './data'
import { lees, schrijf } from './opslag'
import { lokaalNaarDate } from './tijd'

/*
 * Dagelijkse stemming. De vragen staan in stemmingen.json; de app van een ingelogde
 * beheerder zet ze in de database (met de namen uit kamers.json als kandidaten).
 * De database bewaakt de regels: alleen stemmen als hij open is, niet op jezelf,
 * één stem per naam, en de uitslag pas na de sluitingstijd.
 */

export interface StemmingInfo {
  id: string
  datum: string
  vraag: string
  open: number
  sluit: number
  /** Kandidaten volgens de server; leeg = de namen uit kamers.json */
  kandidaten: string[]
  /** Staat (nog) niet op de server */
  alleenLokaal: boolean
}

export interface Uitslag {
  kandidaat: string
  stemmen: number
}

export interface StemStand {
  /** Stemmingen zoals ze op de server staan */
  server: { id: string; datum: string; vraag: string; open: string; sluit: string; kandidaten: string[] }[]
  /** Aantal stemmen per stemming */
  totalen: Record<string, number>
  /** Pas na sluiting: stemmen per kandidaat, meeste eerst */
  uitslagen: Record<string, Uitslag[]>
  /** Op wie jij stemde, per stemming */
  mijn: Record<string, string>
  opgehaald: number
}

const CACHE = 'stemming.stand'

let stand: StemStand | null = lees<StemStand | null>(CACHE, null)
let mislukt = false
const luisteraars = new Set<() => void>()
const meld = () => luisteraars.forEach((f) => f())

let lopend: Promise<void> | null = null

/** Haalt stemmingen, tellingen, uitslagen en je eigen stemmen op */
export function verversStemstand(): Promise<void> {
  lopend ??= haal().finally(() => {
    lopend = null
  })
  return lopend
}

async function haal() {
  const cb = supabase()
  const b = backendStand()
  if (!cb || b.status !== 'verbonden') {
    mislukt = true
    meld()
    return
  }
  try {
    const c = await cb
    const [s, t, m] = await Promise.all([
      c.from('stemmingen').select('id, datum, vraag, open, sluit, kandidaten'),
      c.rpc('stemstand'),
      c.from('stemmen').select('stemming_id, kandidaat'),
    ])
    const fout = s.error ?? t.error ?? m.error
    if (fout) throw fout
    const totalen: StemStand['totalen'] = {}
    const uitslagen: StemStand['uitslagen'] = {}
    for (const r of (t.data ?? []) as { stemming_id: string; kandidaat: string | null; stemmen: number }[]) {
      if (r.kandidaat === null) totalen[r.stemming_id] = r.stemmen
      else (uitslagen[r.stemming_id] ??= []).push({ kandidaat: r.kandidaat, stemmen: r.stemmen })
    }
    for (const lijst of Object.values(uitslagen)) {
      lijst.sort((a, b) => b.stemmen - a.stemmen || a.kandidaat.localeCompare(b.kandidaat, 'nl'))
    }
    const mijn: StemStand['mijn'] = {}
    for (const r of (m.data ?? []) as { stemming_id: string; kandidaat: string }[]) mijn[r.stemming_id] = r.kandidaat
    stand = { server: (s.data ?? []) as StemStand['server'], totalen, uitslagen, mijn, opgehaald: Date.now() }
    mislukt = false
    schrijf(CACHE, stand)
  } catch {
    mislukt = true
  }
  meld()
}

/**
 * Stemmingen (JSON + server samengevoegd) en de laatst bekende stand.
 * Ververst bij openen, elke 30 seconden en zodra de verbinding terugkomt.
 */
export function useStemmingen(actief = true) {
  const [, ververs] = useState(0)
  const { data: json } = useData('stemmingen')

  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])

  useEffect(() => {
    if (!actief || !backendIngesteld) return
    void verversStemstand()
    const id = window.setInterval(() => void verversStemstand(), 30_000)
    let vorige = backendStand().status
    const stop = abonneerBackend(() => {
      const nu = backendStand().status
      if (nu === 'verbonden' && vorige !== 'verbonden') void verversStemstand()
      vorige = nu
    })
    return () => {
      window.clearInterval(id)
      stop()
    }
  }, [actief])

  const lijst = useMemo<StemmingInfo[]>(() => {
    const map = new Map<string, StemmingInfo>()
    for (const s of json?.stemmingen ?? []) {
      map.set(s.id, {
        id: s.id,
        datum: s.datum,
        vraag: s.vraag,
        open: lokaalNaarDate(s.open).getTime(),
        sluit: lokaalNaarDate(s.sluit).getTime(),
        kandidaten: [],
        alleenLokaal: true,
      })
    }
    // De server is leidend voor de tijden: daar wordt het gecontroleerd
    for (const s of stand?.server ?? []) {
      map.set(s.id, {
        id: s.id,
        datum: s.datum,
        vraag: s.vraag,
        open: Date.parse(s.open),
        sluit: Date.parse(s.sluit),
        kandidaten: s.kandidaten ?? [],
        alleenLokaal: false,
      })
    }
    return [...map.values()].sort((a, b) => a.open - b.open || a.sluit - b.sluit || a.id.localeCompare(b.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, stand?.opgehaald])

  return { stemmingen: lijst, stand, mislukt }
}

/** Winnaar(s): iedereen met het hoogste aantal stemmen */
export function winnaars(uitslag: Uitslag[] | undefined): Uitslag[] {
  if (!uitslag?.length) return []
  const max = uitslag[0].stemmen
  return max > 0 ? uitslag.filter((u) => u.stemmen === max) : []
}

const FOUTEN: Record<string, string> = {
  geen_naam: 'Je naam is nog niet doorgegeven aan de server. Kies je naam op Home en probeer het zo opnieuw.',
  onbekend: 'Deze stemming staat nog niet op de server. Vraag de reisleiding de app even te openen.',
  nog_niet_open: 'Deze stemming is nog niet open.',
  gesloten: 'Deze stemming is al gesloten.',
  geen_kandidaat: 'Deze naam staat niet in de kandidatenlijst op de server. Vraag de reisleiding de app even te openen.',
  niet_op_jezelf: 'Je kunt niet op jezelf stemmen 😉',
  al_gestemd: 'Je hebt al gestemd op deze vraag.',
}

/** Stemmen; geeft een foutmelding terug, of null als het gelukt is */
export async function stem(stemmingId: string, kandidaat: string): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding. Stemmen kan alleen met internet.'
  try {
    const c = await cb
    const { error } = await c.rpc('stem', { p_stemming: stemmingId, p_kandidaat: kandidaat })
    if (error) {
      void verversStemstand()
      return FOUTEN[error.message] ?? `Stemmen lukte niet: ${error.message}`
    }
    if (stand) {
      stand = {
        ...stand,
        mijn: { ...stand.mijn, [stemmingId]: kandidaat },
        totalen: { ...stand.totalen, [stemmingId]: (stand.totalen[stemmingId] ?? 0) + 1 },
      }
      schrijf(CACHE, stand)
      meld()
    }
    void verversStemstand()
    return null
  } catch {
    return 'Geen verbinding. Probeer het zo opnieuw.'
  }
}

// ---------- Beheer ----------

export interface SyncResultaat {
  tijd: number
  aantal: number
  bijgewerkt: number
  /** Van de server gehaald omdat ze niet meer in de JSON staan (en nog geen stemmen hadden) */
  verwijderd: number
  fouten: string[]
  /** Op de server en niet meer in stemmingen.json, maar er is al op gestemd (blijft staan) */
  extra: string[]
}

let syncResultaat: SyncResultaat | null = null
let syncBezig = false
const syncLuisteraars = new Set<() => void>()
const meldSync = () => syncLuisteraars.forEach((f) => f())

/** Zet stemmingen.json (met de namen uit kamers.json) in de database. Alleen voor beheerders. */
export async function synchroniseerStemmingen(): Promise<SyncResultaat | null> {
  const cb = supabase()
  const b = backendStand()
  if (!cb || syncBezig || b.status !== 'verbonden' || !b.beheerder) return null
  syncBezig = true
  meldSync()
  const fouten: string[] = []
  try {
    const [json, kamers, c] = await Promise.all([laad('stemmingen', true), laad('kamers', true), cb])
    const kandidaten = [...new Set(kamers.kamers.flatMap((k) => k.bewoners).filter(Boolean))]
    const rijen = json.stemmingen.flatMap((s) => {
      const open = lokaalNaarDate(s.open)
      const sluit = lokaalNaarDate(s.sluit)
      if (Number.isNaN(open.getTime()) || Number.isNaN(sluit.getTime()) || sluit <= open) {
        fouten.push(`${s.id}: open/sluit klopt niet`)
        return []
      }
      return [{ id: s.id, datum: s.datum, vraag: s.vraag, open: open.toISOString(), sluit: sluit.toISOString(), kandidaten }]
    })
    const { data: bestaand, error } = await c.from('stemmingen').select('id, datum, vraag, open, sluit, kandidaten')
    if (error) throw error
    const opServer = new Map((bestaand ?? []).map((r) => [r.id as string, r]))
    const gelijk = (a: (typeof rijen)[number], b: (typeof bestaand & object)[number] | undefined) =>
      !!b &&
      a.datum === b.datum &&
      a.vraag === b.vraag &&
      Date.parse(a.open) === Date.parse(b.open) &&
      Date.parse(a.sluit) === Date.parse(b.sluit) &&
      a.kandidaten.join('|') === (b.kandidaten ?? []).join('|')
    const gewijzigd = rijen.filter((r) => !gelijk(r, opServer.get(r.id)))
    if (gewijzigd.length) {
      const { error: e2 } = await c.from('stemmingen').upsert(gewijzigd, { onConflict: 'id' })
      if (e2) throw e2
    }
    // Uit de JSON gehaald: van de server af, maar alleen als er nog niet op gestemd is
    const inJson = new Set(rijen.map((r) => r.id))
    let extra = [...opServer.keys()].filter((id) => !inJson.has(id))
    let verwijderd = 0
    if (extra.length) {
      const { data: tellingen, error: e3 } = await c.rpc('stemstand')
      if (e3) throw e3
      const metStemmen = new Set(
        ((tellingen ?? []) as { stemming_id: string; kandidaat: string | null; stemmen: number }[])
          .filter((t) => t.kandidaat === null && t.stemmen > 0)
          .map((t) => t.stemming_id),
      )
      const weg = extra.filter((id) => !metStemmen.has(id))
      if (weg.length) {
        const { error: e4 } = await c.from('stemmingen').delete().in('id', weg)
        if (e4) throw e4
        verwijderd = weg.length
      }
      extra = extra.filter((id) => metStemmen.has(id))
    }
    syncResultaat = {
      tijd: Date.now(),
      aantal: rijen.length,
      bijgewerkt: gewijzigd.length,
      verwijderd,
      fouten,
      extra,
    }
    if (gewijzigd.length || verwijderd) void verversStemstand()
  } catch (e) {
    syncResultaat = {
      tijd: Date.now(),
      aantal: 0,
      bijgewerkt: 0,
      verwijderd: 0,
      fouten: [...fouten, `Bijwerken lukte niet: ${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}`],
      extra: [],
    }
  } finally {
    syncBezig = false
    meldSync()
  }
  return syncResultaat
}

export function useStemmingSync() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    syncLuisteraars.add(f)
    return () => {
      syncLuisteraars.delete(f)
    }
  }, [])
  return { resultaat: syncResultaat, bezig: syncBezig }
}

/** Beheerder haalt iemands stem weg, zodat diegene opnieuw kan stemmen */
export async function trekStemIn(stemmingId: string, kiezer: string): Promise<string | null> {
  const cb = supabase()
  if (!cb) return 'Geen verbinding'
  const c = await cb
  const { data, error } = await c.rpc('stem_intrekken', { p_stemming: stemmingId, p_kiezer: kiezer })
  if (error) return error.message
  void verversStemstand()
  return data === true ? null : `${kiezer} had op deze vraag nog niet gestemd.`
}

let gestart = false

/** Eén keer bij het starten: is dit apparaat een ingelogde beheerder, dan de stemmingen bijwerken */
export function startStemming() {
  if (gestart || !backendIngesteld) return
  gestart = true
  let gedaan = false
  abonneerBackend(() => {
    const b = backendStand()
    if (!gedaan && b.status === 'verbonden' && b.beheerder) {
      gedaan = true
      void synchroniseerStemmingen()
    }
    if (!b.beheerder) gedaan = false
  })
}
