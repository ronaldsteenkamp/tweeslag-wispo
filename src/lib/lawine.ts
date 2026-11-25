import { useEffect, useState } from 'react'
import { abonneerBackend, backendStand, supabase } from './backend'
import { leesBulletin, type Bulletin } from './lawinebulletin'
import { lees, schrijf } from './opslag'

/*
 * Het lawinebulletin op de Weer-pagina: ophalen via de Edge Function `lawine` (die de sleutel van
 * Météo-France heeft), het laatste bewaren op de telefoon (ook zonder bereik op de berg te zien) en
 * hooguit eens per half uur opnieuw vragen. Uitlezen: lib/lawinebulletin.ts.
 */

const BEWAARD = 'lawine.bulletin'
const OPNIEUW_NA = 30 * 60 * 1000

interface Bewaard {
  xml: string
  /** Wanneer de app het bulletin binnenkreeg (ms) */
  opgehaald: number
  /** Nederlandse vertaling van de samenvatting (van de Edge Function), als die gelukt is */
  samenvattingNl?: string | null
}

export interface LawineStand {
  bulletin: Bulletin | null
  /** De samenvatting in het Nederlands; null = alleen het Frans beschikbaar */
  samenvattingNl: string | null
  opgehaald: number | null
  laden: boolean
  /** Buiten het seizoen geeft Météo-France geen bulletin */
  geen: boolean
  fout: string | null
}

let bezig: Promise<void> | null = null
const luisteraars = new Set<() => void>()
let geen = false
let fout: string | null = null

async function haal() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  const c = await cb
  const { data, error } = await c.functions.invoke('lawine', { body: {} })
  if (error) {
    fout = 'Het bulletin kon niet worden opgehaald.'
    return
  }
  const d = data as { xml?: string; opgehaald?: number; geen?: boolean; fout?: string; samenvattingNl?: string | null }
  geen = d.geen === true
  fout = d.fout ?? null
  if (d.xml && leesBulletin(d.xml)) {
    // Is het vertalen deze keer niet gelukt, maar hadden we dezelfde tekst al vertaald: die houden
    const oud = lees<Bewaard | null>(BEWAARD, null)
    const nl = d.samenvattingNl ?? (oud?.xml === d.xml ? (oud.samenvattingNl ?? null) : null)
    schrijf<Bewaard>(BEWAARD, { xml: d.xml, opgehaald: Date.now(), samenvattingNl: nl })
  }
}

function vernieuw(forceer = false) {
  const b = lees<Bewaard | null>(BEWAARD, null)
  if (!forceer && b && Date.now() - b.opgehaald < OPNIEUW_NA) return
  if (bezig) return
  bezig = haal()
    .catch(() => {
      fout = 'Het bulletin kon niet worden opgehaald.'
    })
    .finally(() => {
      bezig = null
      luisteraars.forEach((f) => f())
    })
  luisteraars.forEach((f) => f())
}

function stand(): LawineStand {
  const b = lees<Bewaard | null>(BEWAARD, null)
  return {
    bulletin: b ? leesBulletin(b.xml) : null,
    samenvattingNl: b?.samenvattingNl ?? null,
    opgehaald: b?.opgehaald ?? null,
    laden: bezig !== null,
    geen,
    fout,
  }
}

export function useLawine(): LawineStand & { vernieuw: () => void } {
  const [s, zet] = useState(stand)
  useEffect(() => {
    const f = () => zet(stand())
    luisteraars.add(f)
    // Pas proberen zodra de verbinding met de backend er is
    const stop = abonneerBackend(() => {
      vernieuw()
      f()
    })
    vernieuw()
    f()
    return () => {
      luisteraars.delete(f)
      stop()
    }
  }, [])
  return { ...s, vernieuw: () => vernieuw(true) }
}
