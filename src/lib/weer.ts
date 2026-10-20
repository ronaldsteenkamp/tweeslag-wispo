import { useEffect, useState } from 'react'
import { config } from '../config'
import { lees, schrijf } from './opslag'

export interface WeerUur {
  tijd: string // 'JJJJ-MM-DDTUU:MM', lokale tijd
  temp: number
  code: number
  sneeuw: number // cm
  wind: number // km/u
  nulgraden: number // m
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

// ---------- Weercodes (WMO) → icoon en tekst ----------

const CODES: [number[], string, string][] = [
  [[0], '☀️', 'Zonnig'],
  [[1], '🌤️', 'Overwegend zonnig'],
  [[2], '⛅', 'Half bewolkt'],
  [[3], '☁️', 'Bewolkt'],
  [[45, 48], '🌫️', 'Mist'],
  [[51, 53, 55], '🌦️', 'Motregen'],
  [[56, 57, 66, 67], '🧊', 'IJzel'],
  [[61, 63, 65], '🌧️', 'Regen'],
  [[71, 73, 77], '🌨️', 'Sneeuw'],
  [[75], '❄️', 'Zware sneeuw'],
  [[80, 81, 82], '🌦️', 'Buien'],
  [[85, 86], '🌨️', 'Sneeuwbuien'],
  [[95, 96, 99], '⛈️', 'Onweer'],
]

export function weerIcoon(code: number, isDag = true): string {
  if (!isDag && code <= 1) return '🌙'
  return CODES.find(([c]) => c.includes(code))?.[1] ?? '🌡️'
}

export function weerTekst(code: number): string {
  return CODES.find(([c]) => c.includes(code))?.[2] ?? 'Onbekend'
}

export const graden = (t: number) => `${Math.round(t)}°`
export const cm = (s: number) => (s >= 0.5 ? `${Math.round(s)} cm` : s > 0 ? '< 1 cm' : '0 cm')
export const meters = (m: number) => `${m.toLocaleString('nl-NL')} m`

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
    hourly: 'temperature_2m,weather_code,snowfall,wind_speed_10m,freezing_level_height',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,sunshine_duration',
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

/** Haalt het weer op als het laatste bericht ouder is dan een uur (of met forceer) */
export async function verversWeer(forceer = false) {
  if (stand.laden) return
  const leeftijd = stand.weer ? Date.now() - stand.weer.opgehaald : Infinity
  if (!forceer && leeftijd < config.weer.verversMinuten * 60_000) return
  zet({ ...stand, laden: true })
  try {
    const weer = await haalOp()
    schrijf(SLEUTEL, weer)
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

// ---------- Dagdelen ----------

export interface Dagdeel {
  naam: string
  code: number
  tMin: number
  tMax: number
  sneeuw: number
  wind: number
}

const DELEN = [
  { naam: 'Ochtend', van: 6, tot: 12 },
  { naam: 'Middag', van: 12, tot: 18 },
  { naam: 'Avond', van: 18, tot: 24 },
]

/** Verwachting per dagdeel voor één datum; het 'zwaarste' weer van dat dagdeel bepaalt het icoon */
export function dagdelen(loc: WeerLocatie, datum: string): Dagdeel[] {
  return DELEN.flatMap((d) => {
    const u = loc.uren.filter((x) => {
      const uur = +x.tijd.slice(11, 13)
      return x.tijd.startsWith(datum) && uur >= d.van && uur < d.tot
    })
    if (!u.length) return []
    return [
      {
        naam: d.naam,
        code: Math.max(...u.map((x) => x.code)),
        tMin: Math.min(...u.map((x) => x.temp)),
        tMax: Math.max(...u.map((x) => x.temp)),
        sneeuw: u.reduce((s, x) => s + x.sneeuw, 0),
        wind: Math.max(...u.map((x) => x.wind)),
      },
    ]
  })
}
