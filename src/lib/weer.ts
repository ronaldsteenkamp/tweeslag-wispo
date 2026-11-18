import { useEffect, useState } from 'react'
import { config } from '../config'
import { lees, schrijf } from './opslag'
import { datumISO, datumLabel, tijdUUMM } from './tijd'

export interface WeerUur {
  tijd: string // 'JJJJ-MM-DDTUU:MM', lokale tijd
  temp: number
  code: number
  sneeuw: number // cm
  wind: number // km/u
  nulgraden: number // m
  /** Ontbreken in berichten van vóór de Doorsnede (oude bewaarde berichten) */
  stoten?: number // km/u
  zicht?: number // m
  gevoel?: number // °C
  richting?: number // graden, waar de wind vandaan komt
}

export interface WeerDag {
  datum: string
  code: number
  tMin: number
  tMax: number
  sneeuw: number
  wind: number
  windstoten: number
  zonUren: number
  /** Gemiddelde nulgradengrens overdag (10–16 uur), afgerond op 50 m */
  nulgraden: number | null
  /** 'JJJJ-MM-DDTUU:MM' */
  zonOp?: string
  zonOnder?: string
}

export interface WeerLocatie {
  id: string
  naam: string
  hoogte: number
  nu: { temp: number; code: number; wind: number; isDag: boolean }
  dagen: WeerDag[]
  uren: WeerUur[]
}

export interface Weer {
  opgehaald: number
  locaties: WeerLocatie[]
}

// ---------- Weercodes (WMO) → soort icoon en tekst ----------

export type WeerSoort = 'zon' | 'maan' | 'halfzon' | 'halfmaan' | 'wolk' | 'mist' | 'motregen' | 'regen' | 'ijzel' | 'sneeuw' | 'zwaresneeuw' | 'onweer'

const CODES: [number[], WeerSoort, string][] = [
  [[0], 'zon', 'Zonnig'],
  [[1], 'halfzon', 'Overwegend zonnig'],
  [[2], 'halfzon', 'Half bewolkt'],
  [[3], 'wolk', 'Bewolkt'],
  [[45, 48], 'mist', 'Mist'],
  [[51, 53, 55], 'motregen', 'Motregen'],
  [[56, 57, 66, 67], 'ijzel', 'IJzel'],
  [[61, 63, 65, 80, 81, 82], 'regen', 'Regen'],
  [[71, 73, 77, 85], 'sneeuw', 'Sneeuw'],
  [[75, 86], 'zwaresneeuw', 'Zware sneeuw'],
  [[95, 96, 99], 'onweer', 'Onweer'],
]

/** Welk icoon bij een weercode hoort (’s nachts een maan in plaats van de zon) */
export function weerSoort(code: number, isDag = true): WeerSoort {
  const soort = CODES.find(([c]) => c.includes(code))?.[1] ?? 'wolk'
  if (!isDag && soort === 'zon') return 'maan'
  if (!isDag && soort === 'halfzon') return 'halfmaan'
  return soort
}

export function weerTekst(code: number, isDag = true): string {
  if (!isDag && code === 0) return 'Helder'
  if (!isDag && code <= 2) return 'Licht bewolkt'
  return CODES.find(([c]) => c.includes(code))?.[2] ?? 'Onbekend'
}

/** Min-teken in plaats van een streepje: −6° */
export const graden = (t: number) => {
  const r = Math.round(t)
  return `${r < 0 ? '−' : ''}${Math.abs(r)}°`
}
export const cm = (s: number) => (s >= 0.5 ? `${Math.round(s)} cm` : s > 0 ? '< 1 cm' : '0 cm')
export const meters = (m: number) => `${m.toLocaleString('nl-NL')} m`
/** Zicht: onder 1 km in meters (afgerond op 10), daarboven in hele km */
export const zichtTekst = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${Math.round(m / 1000)} km`)
const WINDSTREKEN = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW']
export const windstreek = (graden: number) => WINDSTREKEN[Math.round((((graden % 360) + 360) % 360) / 45) % 8]

/** 'Bijgewerkt om 14:05', of met datum als het bericht van een andere dag is */
export function bijgewerkt(weer: Weer, nu: Date): string {
  const op = new Date(weer.opgehaald)
  const dag = datumISO(op)
  return dag === datumISO(nu)
    ? `Bijgewerkt om ${tijdUUMM(op)}`
    : `Bijgewerkt op ${datumLabel(dag, 'kort')} om ${tijdUUMM(op)}`
}

// ---------- Ophalen en omzetten ----------

const rond50 = (m: number) => Math.round(m / 50) * 50

/* eslint-disable @typescript-eslint/no-explicit-any */
function zetOm(ruw: any, loc: (typeof config.weer.locaties)[number]): WeerLocatie {
  const h = ruw.hourly
  const uren: WeerUur[] = (h.time as string[]).map((tijd, i) => ({
    tijd,
    temp: h.temperature_2m[i],
    code: h.weather_code[i],
    sneeuw: h.snowfall[i] ?? 0,
    wind: h.wind_speed_10m[i],
    nulgraden: h.freezing_level_height[i],
    stoten: h.wind_gusts_10m?.[i] ?? undefined,
    zicht: h.visibility?.[i] ?? undefined,
    gevoel: h.apparent_temperature?.[i] ?? undefined,
    richting: h.wind_direction_10m?.[i] ?? undefined,
  }))
  const d = ruw.daily
  const dagen: WeerDag[] = (d.time as string[]).map((datum, i) => {
    const overdag = uren.filter((u) => u.tijd.startsWith(datum) && +u.tijd.slice(11, 13) >= 10 && +u.tijd.slice(11, 13) <= 16)
    const ng = overdag.map((u) => u.nulgraden).filter((x) => typeof x === 'number')
    return {
      datum,
      code: d.weather_code[i],
      tMin: d.temperature_2m_min[i],
      tMax: d.temperature_2m_max[i],
      sneeuw: d.snowfall_sum[i] ?? 0,
      wind: d.wind_speed_10m_max[i],
      windstoten: d.wind_gusts_10m_max[i],
      zonUren: (d.sunshine_duration[i] ?? 0) / 3600,
      nulgraden: ng.length ? rond50(ng.reduce((a, b) => a + b, 0) / ng.length) : null,
      zonOp: d.sunrise?.[i],
      zonOnder: d.sunset?.[i],
    }
  })
  return {
    id: loc.id,
    naam: loc.naam,
    hoogte: loc.hoogte,
    nu: {
      temp: ruw.current.temperature_2m,
      code: ruw.current.weather_code,
      wind: ruw.current.wind_speed_10m,
      isDag: ruw.current.is_day === 1,
    },
    dagen,
    uren,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function adres() {
  const l = config.weer.locaties
  const p = new URLSearchParams({
    latitude: l.map((x) => x.latitude).join(','),
    longitude: l.map((x) => x.longitude).join(','),
    elevation: l.map((x) => x.hoogte).join(','),
    timezone: config.weer.tijdzone,
    forecast_days: '16',
    current: 'temperature_2m,weather_code,wind_speed_10m,is_day',
    hourly:
      'temperature_2m,weather_code,snowfall,wind_speed_10m,freezing_level_height,wind_gusts_10m,visibility,apparent_temperature,wind_direction_10m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,sunshine_duration,sunrise,sunset',
  })
  return `https://api.open-meteo.com/v1/forecast?${p}`
}

async function haalOp(): Promise<Weer> {
  const antwoord = await fetch(adres(), { cache: 'no-store' })
  if (!antwoord.ok) throw new Error(String(antwoord.status))
  const ruw = await antwoord.json()
  const lijst = Array.isArray(ruw) ? ruw : [ruw]
  return { opgehaald: Date.now(), locaties: config.weer.locaties.map((loc, i) => zetOm(lijst[i], loc)) }
}

// ---------- Geweest: van elke dag de verwachting van die dag zelf bewaren ----------

export interface GeweestDag {
  code: number
  boven: number
  dorp: number
  vers: number
  wind: number
}

const GEWEEST = 'weer.geweest'

/** Zo staat in de reislijst bij een voorbije dag wat het werd (de laatste verwachting van die dag) */
function bewaarVandaag(weer: Weer) {
  const vandaag = datumISO(new Date(weer.opgehaald))
  const boven = weer.locaties.find((l) => l.id === 'gletsjer')?.dagen.find((d) => d.datum === vandaag)
  const dorp = weer.locaties.find((l) => l.id === 'dorp')?.dagen.find((d) => d.datum === vandaag)
  if (!boven || !dorp) return
  const oud = lees<Record<string, GeweestDag>>(GEWEEST, {})
  // Alleen de laatste 30 dagen bewaren
  const grens = datumISO(new Date(weer.opgehaald - 30 * 864e5))
  const nieuw = Object.fromEntries(Object.entries(oud).filter(([d]) => d >= grens))
  // Verse sneeuw zoals op het scherm: sinds de middag ervoor tot 12 uur (zie skidag.ts)
  const gletsjer = weer.locaties.find((l) => l.id === 'gletsjer')!
  const gist = new Date(`${vandaag}T12:00:00Z`)
  gist.setUTCDate(gist.getUTCDate() - 1)
  const g = gist.toISOString().slice(0, 10)
  const vers = gletsjer.uren
    .filter((u) => (u.tijd.startsWith(g) && +u.tijd.slice(11, 13) >= 16) || (u.tijd.startsWith(vandaag) && +u.tijd.slice(11, 13) < 12))
    .reduce((s, u) => s + u.sneeuw, 0)
  nieuw[vandaag] = { code: boven.code, boven: boven.tMax, dorp: dorp.tMax, vers, wind: boven.wind }
  schrijf(GEWEEST, nieuw)
}

export function geweest(): Record<string, GeweestDag> {
  return lees<Record<string, GeweestDag>>(GEWEEST, {})
}

// ---------- Gedeelde stand (één keer ophalen voor alle schermen) ----------

const SLEUTEL = 'weer.laatste'

function geldig(w: unknown): w is Weer {
  const x = w as Weer
  return !!x && typeof x.opgehaald === 'number' && Array.isArray(x.locaties) && x.locaties.length > 0
}

interface Stand {
  weer?: Weer
  laden: boolean
  mislukt: boolean
}

let stand: Stand = (() => {
  const bewaard = lees<unknown>(SLEUTEL, null)
  return { weer: geldig(bewaard) ? bewaard : undefined, laden: false, mislukt: false }
})()
const luisteraars = new Set<() => void>()
const zet = (s: Stand) => {
  stand = s
  luisteraars.forEach((f) => f())
}

/** Een bewaard bericht van vóór de Doorsnede (zonder halverwege) meteen vervangen */
const verouderdFormaat = (w?: Weer) => !!w && w.locaties.length < config.weer.locaties.length

/** Haalt het weer op als het laatste bericht ouder is dan een uur (of met forceer) */
export async function verversWeer(forceer = false) {
  if (stand.laden) return
  const leeftijd = stand.weer ? Date.now() - stand.weer.opgehaald : Infinity
  if (!forceer && !verouderdFormaat(stand.weer) && leeftijd < config.weer.verversMinuten * 60_000) return
  zet({ ...stand, laden: true })
  try {
    const weer = await haalOp()
    schrijf(SLEUTEL, weer)
    bewaarVandaag(weer)
    zet({ weer, laden: false, mislukt: false })
  } catch {
    // Geen bereik: het laatst bewaarde bericht blijft staan
    zet({ ...stand, laden: false, mislukt: true })
  }
}

export function useWeer() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    verversWeer()
    const id = window.setInterval(() => verversWeer(), 5 * 60_000)
    const terug = () => document.visibilityState === 'visible' && verversWeer()
    document.addEventListener('visibilitychange', terug)
    window.addEventListener('online', terug)
    return () => {
      luisteraars.delete(f)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', terug)
      window.removeEventListener('online', terug)
    }
  }, [])
  return stand
}

// ---------- Hulpjes per uur ----------

/** De uren van één datum tussen van (incl.) en tot (excl.) */
export function urenVan(loc: WeerLocatie | undefined, datum: string, van = 0, tot = 24): WeerUur[] {
  if (!loc) return []
  return loc.uren.filter((u) => {
    const uur = +u.tijd.slice(11, 13)
    return u.tijd.startsWith(datum) && uur >= van && uur < tot
  })
}

/** Het uur dat nu bezig is (of het dichtstbijzijnde) */
export function uurNu(loc: WeerLocatie | undefined, moment: Date): WeerUur | undefined {
  if (!loc) return undefined
  const sleutel = `${datumISO(moment)}T${tijdUUMM(moment).slice(0, 2)}:00`
  return loc.uren.find((u) => u.tijd === sleutel)
}
