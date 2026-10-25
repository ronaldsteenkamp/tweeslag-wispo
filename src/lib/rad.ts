import { useOpgeslagen } from './opslag'
import { alleDeelnemers, type Kamers } from './data'

/*
 * Toeval voor het rad en de roulette: altijd op de telefoon zelf (ook offline) en met
 * crypto.getRandomValues in plaats van Math.random. Geeft geen punten.
 */

/** Eerlijk geheel getal van 0 t/m n-1 (zonder voorkeur voor lage getallen) */
export function willekeurig(n: number): number {
  if (n <= 1) return 0
  const grens = Math.floor(0x1_0000_0000 / n) * n
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= grens)
  return buf[0] % n
}

/** Getal tussen 0 en 1 (voor kleine variatie in de animatie) */
export const fractie = () => willekeurig(1_000_000) / 1_000_000

export function kies<T>(lijst: T[]): T {
  return lijst[willekeurig(lijst.length)]
}

export function schud<T>(lijst: T[]): T[] {
  const a = [...lijst]
  for (let i = a.length - 1; i > 0; i--) {
    const j = willekeurig(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- Wie doen er mee? ----------

export type DeelnemersSoort = 'iedereen' | 'kamer' | 'kamers' | 'zelf'

export interface DeelnemersKeuze {
  soort: DeelnemersSoort
  /** Gekozen kamernummers (bij 'kamers') */
  kamers: string[]
  /** Aangevinkte namen (bij 'zelf') */
  namen: string[]
}

const STANDAARD: DeelnemersKeuze = { soort: 'iedereen', kamers: [], namen: [] }

/** De keuze wie er meedoet, bewaard op de telefoon (gedeeld door het rad en de roulette) */
export function useDeelnemersKeuze() {
  return useOpgeslagen<DeelnemersKeuze>('rad.deelnemers', STANDAARD)
}

/** De namen die meedoen volgens de keuze; namen die niet meer in kamers.json staan vallen weg */
export function deelnemers(k: DeelnemersKeuze, kamers: Kamers | undefined, mijnNaam: string | null): string[] {
  if (!kamers) return []
  const iedereen = alleDeelnemers(kamers)
  if (k.soort === 'kamer') {
    const eigen = kamers.kamers.find((kamer) => mijnNaam && kamer.bewoners.includes(mijnNaam))
    return eigen ? eigen.bewoners.filter(Boolean) : []
  }
  if (k.soort === 'kamers') return kamers.kamers.filter((kamer) => k.kamers.includes(kamer.nummer)).flatMap((kamer) => kamer.bewoners)
  if (k.soort === 'zelf') return iedereen.filter((n) => k.namen.includes(n))
  return iedereen
}

/** "Tom" → "T", "Lisa 2" → "L2", "Anne-Fleur" → "AF" */
export function initialen(naam: string): string {
  const delen = naam.split(/[\s-]+/).filter(Boolean)
  return delen.map((d) => (/^\d+$/.test(d) ? d : d[0].toLocaleUpperCase('nl'))).join('').slice(0, 3)
}
