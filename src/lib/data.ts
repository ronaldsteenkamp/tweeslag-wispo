import { useEffect, useState } from 'react'

export interface PlanningItem {
  tijd: string
  titel: string
  omschrijving?: string
  locatie?: string
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
}

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

interface DataTypes {
  planning: Planning
  paklijst: Paklijst
  kamers: Kamers
  spel: Spel
  stemmingen: Stemmingen
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
}

export const DATA_BESTANDEN: DataNaam[] = ['planning', 'paklijst', 'kamers', 'spel', 'stemmingen']

const cache = new Map<DataNaam, Promise<unknown>>()

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
  return cache.get(naam) as Promise<DataTypes[K]>
}

/** Haalt alle bestanden op, zodat ze ook offline klaarstaan als je een tabblad nog niet geopend hebt */
export function haalAllesVooraf() {
  for (const naam of DATA_BESTANDEN) laad(naam, true).catch(() => {})
}

export function useData<K extends DataNaam>(naam: K) {
  const [staat, setStaat] = useState<{ data?: DataTypes[K]; fout?: DataFout }>({})
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
  }, [naam])
  return staat
}
