import { useEffect, useState } from 'react'
import { lees, schrijf } from './opslag'

/*
 * Zuinig op de berg (Instellingen). Zet de sneeuw in de koppen uit, maakt animaties zo kort
 * mogelijk (zoals 'minder beweging' van de telefoon) en laat het scherm niet meer vanzelf aan
 * staan op Kaart, Rad en Busbingo. Staat op <html data-zuinig> (index.html zet hem al vóór het
 * tekenen als je hem zelf aanzette), zodat CSS en alle schermen hem kunnen lezen.
 *
 * Bij weinig batterij (20% of minder, niet aan de lader) gaat hij vanzelf aan. Alleen waar de
 * browser de batterij laat zien (Chrome op Android); een iPhone kan dat niet. Zet je hem dan zelf
 * uit, dan blijft hij uit tot de telefoon weer aan de lader hangt of boven de 20% komt.
 */

/** Zelf aangezet in Instellingen */
const AAN = 'zuinig'
/** Zelf uitgezet terwijl hij vanzelf aan stond (geldt tot de batterij weer goed is) */
const NIET_VANZELF = 'zuinig.nietVanzelf'
/** Vanaf dit percentage (en lager) gaat Zuinig vanzelf aan */
export const ZUINIG_ONDER = 0.2

interface Batterij extends EventTarget {
  level: number
  charging: boolean
}

export interface ZuinigStand {
  /** Staat Zuinig nu aan (zelf of vanzelf)? */
  aan: boolean
  /** Waarom: zelf aangezet, of vanzelf door de batterij */
  door: 'zelf' | 'batterij' | null
  /** Kan deze telefoon de batterij laten zien (dan kan hij vanzelf aan)? */
  batterijBekend: boolean
  /** Batterijpercentage (0-100) als dat bekend is */
  procent: number | null
}

let batterij: Batterij | null = null
const luisteraars = new Set<() => void>()

const batterijLaag = () => !!batterij && !batterij.charging && batterij.level <= ZUINIG_ONDER

export function zuinigStand(): ZuinigStand {
  const zelf = lees(AAN, false)
  const vanzelf = batterijLaag() && !lees(NIET_VANZELF, false)
  return {
    aan: zelf || vanzelf,
    door: zelf ? 'zelf' : vanzelf ? 'batterij' : null,
    batterijBekend: !!batterij,
    procent: batterij ? Math.round(batterij.level * 100) : null,
  }
}

/** Is Zuinig aan? (snel, voor overal: leest het attribuut op <html>) */
export const isZuinig = () => document.documentElement.hasAttribute('data-zuinig')

/** Minder beweging: de instelling van de telefoon, of Zuinig */
export const minderBeweging = () =>
  isZuinig() || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

function bijwerken() {
  const { aan } = zuinigStand()
  document.documentElement.toggleAttribute('data-zuinig', aan)
  luisteraars.forEach((f) => f())
}

/** De schakelaar in Instellingen */
export function zetZuinig(aan: boolean) {
  if (aan) {
    schrijf(AAN, true)
    schrijf(NIET_VANZELF, false)
  } else {
    schrijf(AAN, false)
    // Stond hij vanzelf aan: niet meteen weer aanzetten
    if (batterijLaag()) schrijf(NIET_VANZELF, true)
  }
  bijwerken()
}

let gestart = false

/** Bij het opstarten: de batterij volgen (waar dat kan) */
export function startZuinig() {
  if (gestart) return
  gestart = true
  bijwerken()
  const nav = navigator as Navigator & { getBattery?: () => Promise<Batterij> }
  if (typeof nav.getBattery !== 'function') return
  nav
    .getBattery()
    .then((b) => {
      batterij = b
      const opWijziging = () => {
        // Weer aan de lader of boven de grens: de eigen keuze 'niet vanzelf' vervalt
        if (!batterijLaag() && lees(NIET_VANZELF, false)) schrijf(NIET_VANZELF, false)
        bijwerken()
      }
      b.addEventListener('levelchange', opWijziging)
      b.addEventListener('chargingchange', opWijziging)
      opWijziging()
    })
    .catch(() => {})
}

export function useZuinig(): ZuinigStand {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])
  return zuinigStand()
}
