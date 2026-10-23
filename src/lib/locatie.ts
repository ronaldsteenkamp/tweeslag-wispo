import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { lees, schrijf } from './opslag'

/*
 * Live locatie delen. Alleen na een tik op "Deel mijn locatie". Zolang het aan staat en de
 * app open is, gaat je positie naar de tabel locaties; uitzetten verwijdert hem meteen.
 * Browsers geven geen locatie als de app op de achtergrond staat: dan blijft de laatste staan
 * (met de tijd erbij) en na een uur verdwijnt hij.
 */

const AAN = 'locatie.delen'
/** Minstens zo vaak versturen, ook als je stilstaat (zodat "x min geleden" klopt) */
const ELKE_MS = 60_000
/** Bij beweging: niet vaker dan dit */
const MIN_MS = 10_000
/** ...en alleen als je zoveel meter bent verplaatst */
const MIN_METER = 15

export type DeelStatus = 'geen-backend' | 'niet-ondersteund' | 'uit' | 'zoeken' | 'aan' | 'geweigerd' | 'fout'

interface Stand {
  status: DeelStatus
  fout?: string
  /** Laatst gemeten eigen positie */
  positie?: { lat: number; lon: number; nauwkeurigheid: number; tijd: number }
}

let stand: Stand = {
  status: !backendIngesteld ? 'geen-backend' : 'geolocation' in navigator ? 'uit' : 'niet-ondersteund',
}
const luisteraars = new Set<() => void>()
const zet = (deel: Partial<Stand>) => {
  stand = { ...stand, ...deel }
  luisteraars.forEach((f) => f())
}

let watchId: number | null = null
let laatstVerstuurd: { tijd: number; lat: number; lon: number } | null = null
let hartslag: number | undefined

function afstand(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const m = 111_320
  return Math.hypot((a.lat - b.lat) * m, (a.lon - b.lon) * m * Math.cos((a.lat * Math.PI) / 180))
}

async function verstuur(forceer = false) {
  const p = stand.positie
  const b = backendStand()
  const cb = supabase()
  if (!p || !cb || b.status !== 'verbonden' || !b.gekoppeld) return
  const nu = Date.now()
  if (!forceer && laatstVerstuurd) {
    const verplaatst = afstand(p, laatstVerstuurd)
    if (nu - laatstVerstuurd.tijd < MIN_MS) return
    if (verplaatst < MIN_METER && nu - laatstVerstuurd.tijd < ELKE_MS) return
  }
  laatstVerstuurd = { tijd: nu, lat: p.lat, lon: p.lon }
  const c = await cb
  const { error } = await c
    .from('locaties')
    .upsert({ lat: p.lat, lon: p.lon, nauwkeurigheid: Math.round(Math.min(p.nauwkeurigheid, 100000)) }, { onConflict: 'user_id' })
  if (error) {
    laatstVerstuurd = null
    zet({ fout: error.message === 'geen_naam' ? 'Kies eerst je naam op Home.' : 'Versturen lukte niet; de app probeert het zo opnieuw.' })
  } else if (stand.fout) zet({ fout: undefined })
}

function startMeten() {
  if (watchId !== null || !('geolocation' in navigator)) return
  zet({ status: stand.positie ? 'aan' : 'zoeken', fout: undefined })
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      zet({
        status: 'aan',
        positie: { lat: pos.coords.latitude, lon: pos.coords.longitude, nauwkeurigheid: pos.coords.accuracy, tijd: pos.timestamp },
      })
      void verstuur()
    },
    (e) => {
      if (e.code === e.PERMISSION_DENIED) {
        // Geen toestemming (meer): ook de oude positie van de server halen
        void stopDelen().then(() => zet({ status: 'geweigerd' }))
      } else zet({ fout: 'Je locatie is even niet te bepalen.' })
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
  )
  window.clearInterval(hartslag)
  hartslag = window.setInterval(() => void verstuur(), ELKE_MS)
}

function stopMeten() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  watchId = null
  window.clearInterval(hartslag)
  laatstVerstuurd = null
}

/** Na een tik op "Deel mijn locatie" (en de bevestiging) */
export function startDelen() {
  if (stand.status === 'geen-backend' || stand.status === 'niet-ondersteund') return
  schrijf(AAN, true)
  startMeten()
}

/** Uitzetten: stoppen met meten en de eigen locatie van de server halen */
export async function stopDelen() {
  schrijf(AAN, false)
  stopMeten()
  zet({ status: 'uit', positie: undefined, fout: undefined })
  const cb = supabase()
  const id = backendStand().userId
  if (cb && id) await (await cb).from('locaties').delete().eq('user_id', id)
  meldWijziging()
}

export function useDelen() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])
  return stand
}

let gestart = false

/** Bij het starten van de app: stond delen aan, dan weer verder (met de eerdere toestemming) */
export function startLocatie() {
  if (gestart || !backendIngesteld || !('geolocation' in navigator)) return
  gestart = true
  if (lees(AAN, false)) startMeten()
  // Verbinding terug of net gekoppeld: meteen de laatste positie sturen
  abonneerBackend(() => {
    const b = backendStand()
    if (lees(AAN, false) && b.status === 'verbonden' && b.gekoppeld) void verstuur(true)
  })
  // Terug in de app: direct een verse positie
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && lees(AAN, false)) void verstuur(true)
  })
}

// ---------- Locaties van iedereen ----------

export interface GedeeldeLocatie {
  user_id: string
  naam: string
  kamer: string | null
  lat: number
  lon: number
  nauwkeurigheid: number | null
  bijgewerkt: string
}

/** Klok van deze telefoon min die van de server (ms) */
let klokVerschil = 0

const wijzigingLuisteraars = new Set<() => void>()
const meldWijziging = () => wijzigingLuisteraars.forEach((f) => f())

/** Alle gedeelde locaties van het afgelopen uur, live bijgewerkt */
export function useLocaties(actief: boolean) {
  const [locaties, setLocaties] = useState<GedeeldeLocatie[]>([])
  const [mislukt, setMislukt] = useState(false)

  useEffect(() => {
    if (!actief || !backendIngesteld) return
    let weg = false
    let wacht: number | undefined
    let kanaal: RealtimeChannel | null = null
    const haal = async () => {
      const cb = supabase()
      if (!cb || backendStand().status !== 'verbonden') {
        setMislukt(true)
        return
      }
      const c = await cb
      const voor = Date.now()
      // De server filtert zelf al op het afgelopen uur (en geeft zijn eigen tijd mee)
      const [l, t] = await Promise.all([
        c.from('locaties').select('user_id, naam, kamer, lat, lon, nauwkeurigheid, bijgewerkt'),
        c.rpc('server_tijd'),
      ])
      if (weg) return
      if (l.error) {
        setMislukt(true)
        return
      }
      // Verschil tussen de klok van deze telefoon en die van de server
      if (!t.error && t.data) klokVerschil = (voor + Date.now()) / 2 - Date.parse(t.data as string)
      // Tijden omrekenen naar de klok van deze telefoon, zodat "x minuten geleden" klopt
      setLocaties(
        ((l.data ?? []) as GedeeldeLocatie[]).map((r) => ({ ...r, bijgewerkt: new Date(Date.parse(r.bijgewerkt) + klokVerschil).toISOString() })),
      )
      setMislukt(false)
    }
    const straks = () => {
      window.clearTimeout(wacht)
      wacht = window.setTimeout(() => void haal(), 400)
    }
    void haal()
    // Vangnet (en om oude stippen te laten verdwijnen)
    const id = window.setInterval(() => void haal(), 30_000)
    const stop = abonneerBackend(() => backendStand().status === 'verbonden' && straks())
    wijzigingLuisteraars.add(straks)
    const cb = supabase()
    void cb?.then((c) => {
      if (weg) return
      kanaal = c.channel(`locaties-${Math.random().toString(36).slice(2, 7)}`)
      kanaal.on('postgres_changes', { event: '*', schema: 'public', table: 'locaties' }, straks).subscribe()
    })
    return () => {
      weg = true
      window.clearTimeout(wacht)
      window.clearInterval(id)
      stop()
      wijzigingLuisteraars.delete(straks)
      if (kanaal) void cb?.then((c) => c.removeChannel(kanaal!))
    }
  }, [actief])

  return { locaties, mislukt }
}
