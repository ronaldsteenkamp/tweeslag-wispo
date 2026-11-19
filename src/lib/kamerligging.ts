import type { Kamer } from './data'

/*
 * Op welke verdieping ligt een appartement? De data kent alleen nummers, dus we lezen het af uit het
 * nummer, zoals in de meeste hotels: 104 = 1e verdieping. Kan dat niet (een nummer als "A" of "12"),
 * dan is de verdieping onbekend en blijven de appartementen in de volgorde van de lijst.
 */

export interface Plek {
  kamer: Kamer
  /** null = onbekend (nummers zijn niet te lezen) */
  verdieping: number | null
  bedden: number
  vrij: number
}

const LEESBAAR = /^\d{3,4}$/

export function plaatsKamers(kamers: Kamer[]): Plek[] {
  const viaNummer = kamers.length > 0 && kamers.every((k) => LEESBAAR.test(k.nummer.trim()))
  const plekken = kamers.map((kamer): Plek => {
    const bedden = Math.max(kamer.bedden ?? 0, kamer.bewoners.length)
    return {
      kamer,
      verdieping: viaNummer ? Math.floor(Number(kamer.nummer.trim()) / 100) : null,
      bedden,
      vrij: bedden - kamer.bewoners.length,
    }
  })
  return viaNummer ? plekken.sort((a, b) => Number(a.kamer.nummer) - Number(b.kamer.nummer)) : plekken
}

/** Verdiepingen van hoog naar laag, zoals je een gebouw tekent */
export const verdiepingen = (plekken: Plek[]) => [...new Set(plekken.map((p) => p.verdieping))].sort((a, b) => (b ?? 0) - (a ?? 0))

export const verdiepingNaam = (v: number) => (v === 0 ? 'begane grond' : `${v}e verdieping`)

/** "Anna, Bram en Cas" */
export const opsomming = (namen: string[]) =>
  namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`
