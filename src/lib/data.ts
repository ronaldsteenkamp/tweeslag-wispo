import { useEffect, useState } from 'react'
import { lees, schrijf } from './opslag'

export interface PlanningItem {
  tijd: string
  titel: string
  omschrijving?: string
  locatie?: string
  /** Iedereen met meldingen aan krijgt 30 minuten van tevoren een seintje */
  melding?: boolean
}
export interface Dag {
  datum: string
  titel: string
  items: PlanningItem[]
}
export interface Planning {
  dagen: Dag[]
}

export interface Categorie {
  naam: string
  icoon?: string
  items: string[]
}
export interface Paklijst {
  categorieen: Categorie[]
}

export interface Kamer {
  nummer: string
  naam?: string
  /** Aantal bedden (mag ontbreken) */
  bedden?: number
  bewoners: string[]
}
export interface Kamers {
  verblijf?: string
  kamers: Kamer[]
  /** Deelnemers die nog geen kamer hebben (kunnen wel al hun naam kiezen) */
  zonderKamer: string[]
}

/** Iedereen die meegaat: de bewoners van alle kamers plus wie nog geen kamer heeft */
export const alleDeelnemers = (k?: Kamers | null) => [
  ...new Set([...(k?.kamers ?? []).flatMap((kamer) => kamer.bewoners), ...(k?.zonderKamer ?? [])].filter(Boolean)),
]

export interface Challenge {
  id: string
  titel: string
  omschrijving?: string
  punten: number
}
export interface ChallengeDag {
  datum: string
  openOm?: string
  items: Challenge[]
}
export interface Spel {
  punten: { bingoVakje: number; bingoRij: number; bingoVolleKaart: number }
  challenges: ChallengeDag[]
  bingo: { vrijVakje?: string; vakjes: string[] }
}

export interface Stemming {
  id: string
  datum: string
  vraag: string
  /** 'JJJJ-MM-DDTUU:MM' (Nederlandse tijd); 'UU:MM' in de JSON wordt aangevuld met de datum */
  open: string
  sluit: string
}
export interface Stemmingen {
  stemmingen: Stemming[]
}

export type PisteKleur = 'groen' | 'blauw' | 'rood' | 'zwart'
export const PISTE_KLEUREN: PisteKleur[] = ['groen', 'blauw', 'rood', 'zwart']

/** Inhoud van het rad (Spel → Rad) */
export interface Rad {
  pistes: { naam: string; kleur: PisteKleur }[]
  drankjes: string[]
  klosOpdrachten: string[]
}

interface DataTypes {
  planning: Planning
  paklijst: Paklijst
  kamers: Kamers
  spel: Spel
  stemmingen: Stemmingen
  rad: Rad
}
export type DataNaam = keyof DataTypes

export class DataFout extends Error {
  bestand: DataNaam
  soort: 'offline' | 'json'
  constructor(bestand: DataNaam, soort: 'offline' | 'json', detail = '') {
    super(detail)
    this.bestand = bestand
    this.soort = soort
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ruw = any

const lijst = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : [])

// Ontbrekende velden opvangen, zodat een typefout in de JSON de app niet laat crashen
const normaliseer: { [K in DataNaam]: (ruw: Ruw) => DataTypes[K] } = {
  planning: (r) => ({
    dagen: lijst<Ruw>(r?.dagen).map((d) => ({
      datum: String(d?.datum ?? ''),
      titel: String(d?.titel ?? ''),
      items: lijst<PlanningItem>(d?.items),
    })),
  }),
  paklijst: (r) => ({
    categorieen: lijst<Ruw>(r?.categorieen).map((c) => ({
      naam: String(c?.naam ?? ''),
      icoon: c?.icoon,
      items: lijst<unknown>(c?.items).map(String),
    })),
  }),
  kamers: (r) => ({
    verblijf: r?.verblijf,
    kamers: lijst<Ruw>(r?.kamers).map((k) => ({
      nummer: String(k?.nummer ?? ''),
      naam: k?.naam,
      bedden: Number(k?.bedden) > 0 ? Number(k.bedden) : undefined,
      bewoners: lijst<unknown>(k?.bewoners).map((b) => String(b).trim()),
    })),
    zonderKamer: lijst<unknown>(r?.zonderKamer)
      .map((b) => String(b).trim())
      .filter(Boolean),
  }),
  spel: (r) => ({
    punten: { bingoVakje: 2, bingoRij: 10, bingoVolleKaart: 50, ...(r?.punten ?? {}) },
    challenges: lijst<Ruw>(r?.challenges).map((d) => ({
      datum: String(d?.datum ?? ''),
      openOm: d?.openOm,
      items: lijst<Ruw>(d?.items).map((c) => ({
        id: String(c?.id ?? c?.titel ?? ''),
        titel: String(c?.titel ?? ''),
        omschrijving: c?.omschrijving,
        punten: Number(c?.punten) || 0,
      })),
    })),
    bingo: {
      vrijVakje: r?.bingo?.vrijVakje,
      vakjes: lijst<unknown>(r?.bingo?.vakjes).map((v) => String(v).trim()).filter(Boolean),
    },
  }),
  stemmingen: (r) => ({
    stemmingen: lijst<Ruw>(r?.stemmingen)
      .map((s) => {
        const datum = String(s?.datum ?? '')
        const tijd = (t: unknown, standaard: string) => {
          const x = String(t ?? standaard).trim()
          return x.includes('T') ? x : `${datum}T${x}`
        }
        const vraag = String(s?.vraag ?? '').trim()
        return {
          id: String(s?.id ?? `${datum}-${vraag}`).trim(),
          datum,
          vraag,
          open: tijd(s?.open, '00:00'),
          sluit: tijd(s?.sluit, '23:59'),
        }
      })
      .filter((s) => s.id && s.vraag && /^\d{4}-\d\d-\d\d$/.test(s.datum)),
  }),
  rad: (r) => {
    const teksten = (x: unknown) => lijst<unknown>(x).map((t) => String(t).trim()).filter(Boolean)
    return {
      pistes: lijst<Ruw>(r?.pistes)
        .map((p) => ({ naam: String(p?.naam ?? '').trim(), kleur: String(p?.kleur ?? '').trim().toLowerCase() as PisteKleur }))
        .filter((p) => p.naam && PISTE_KLEUREN.includes(p.kleur)),
      drankjes: teksten(r?.drankjes),
      klosOpdrachten: teksten(r?.klosOpdrachten),
    }
  },
}

export const DATA_BESTANDEN: DataNaam[] = ['planning', 'paklijst', 'kamers', 'spel', 'stemmingen', 'rad']

const cache = new Map<DataNaam, Promise<unknown>>()

// ---------- Kamerverdeling van de server ----------
// Slaat de reisleiding de kamerverdeling op in de app (zie kamerverdeling.ts), dan gaat die voor op
// kamers.json. Namen die alleen in kamers.json staan (later toegevoegd) komen onder "Nog geen kamer".

const SERVER_KAMERS = 'kamers.server'
let serverKamers: Kamers | null = lees<Kamers | null>(SERVER_KAMERS, null)
const kamersLuisteraars = new Set<() => void>()

export const normaliseerKamers = (ruw: unknown): Kamers => normaliseer.kamers(ruw)

/** De verdeling van de server (of null als er geen is); wordt ook bewaard voor gebruik zonder internet */
export function zetServerKamers(k: Kamers | null) {
  if (JSON.stringify(k) === JSON.stringify(serverKamers)) return
  serverKamers = k
  schrijf(SERVER_KAMERS, k)
  kamersLuisteraars.forEach((f) => f())
}

function combineer(json: Kamers): Kamers {
  if (!serverKamers) return json
  const bekend = new Set(alleDeelnemers(serverKamers))
  const later = alleDeelnemers(json).filter((n) => !bekend.has(n))
  return { ...serverKamers, zonderKamer: [...serverKamers.zonderKamer, ...later] }
}

async function haalOp<K extends DataNaam>(naam: K): Promise<DataTypes[K]> {
  let antwoord: Response
  try {
    // De service worker haalt eerst van internet en valt terug op de bewaarde versie
    antwoord = await fetch(`${import.meta.env.BASE_URL}data/${naam}.json`, { cache: 'no-cache' })
  } catch {
    throw new DataFout(naam, 'offline')
  }
  if (!antwoord.ok) throw new DataFout(naam, 'offline', String(antwoord.status))
  const tekst = await antwoord.text()
  try {
    return normaliseer[naam](JSON.parse(tekst))
  } catch (e) {
    throw new DataFout(naam, 'json', e instanceof Error ? e.message : String(e))
  }
}

export function laad<K extends DataNaam>(naam: K, opnieuw = false): Promise<DataTypes[K]> {
  if (opnieuw || !cache.has(naam)) {
    const belofte = haalOp(naam)
    cache.set(naam, belofte)
    belofte.catch(() => {
      if (cache.get(naam) === belofte) cache.delete(naam)
    })
  }
  const belofte = cache.get(naam) as Promise<DataTypes[K]>
  if (naam !== 'kamers') return belofte
  // Kamers: de verdeling van de server gaat voor; zonder kamers.json is die alleen ook goed
  return belofte.then(
    (json) => combineer(json as Kamers) as DataTypes[K],
    (fout) => {
      if (serverKamers) return serverKamers as DataTypes[K]
      throw fout
    },
  )
}

/** Haalt alle bestanden op, zodat ze ook offline klaarstaan als je een tabblad nog niet geopend hebt */
export function haalAllesVooraf() {
  for (const naam of DATA_BESTANDEN) laad(naam, true).catch(() => {})
}

export function useData<K extends DataNaam>(naam: K) {
  const [staat, setStaat] = useState<{ data?: DataTypes[K]; fout?: DataFout }>({})
  // Opnieuw zodra er een nieuwe kamerverdeling van de server is
  const [versie, setVersie] = useState(0)
  useEffect(() => {
    if (naam !== 'kamers') return
    const f = () => setVersie((v) => v + 1)
    kamersLuisteraars.add(f)
    return () => {
      kamersLuisteraars.delete(f)
    }
  }, [naam])
  useEffect(() => {
    let actief = true
    laad(naam).then(
      (data) => {
        if (actief) setStaat({ data })
      },
      (fout) => {
        if (actief) setStaat({ fout: fout instanceof DataFout ? fout : new DataFout(naam, 'offline') })
      },
    )
    return () => {
      actief = false
    }
  }, [naam, versie])
  return staat
}
