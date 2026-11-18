import type { Kamer } from './data'

/*
 * Waar ligt een appartement in het gebouw? De data kent alleen nummers, dus we lezen het af uit het
 * nummer, zoals in de meeste hotels: 104 = 1e verdieping, deur 4. Oneven links van de gang, even
 * rechts; 101 en 102 liggen tegenover elkaar, 103 naast 101, enzovoort.
 *
 * Kan dat niet (een nummer als "A" of "12"), dan komen alle appartementen op één gang in de volgorde
 * van de lijst, zonder verdieping.
 */

export interface Plek {
  kamer: Kamer
  /** null = onbekend (nummers zijn niet te lezen) */
  verdieping: number | null
  kant: 'links' | 'rechts'
  /** Rij langs de gang, vanaf 1 */
  rij: number
  bedden: number
  vrij: number
}

const LEESBAAR = /^\d{3,4}$/

export function plaatsKamers(kamers: Kamer[]): Plek[] {
  const viaNummer = kamers.length > 0 && kamers.every((k) => LEESBAAR.test(k.nummer.trim()))
  const bedden = (k: Kamer) => Math.max(k.bedden ?? 0, k.bewoners.length)
  const plekken = kamers.map((kamer, i): Plek => {
    const b = bedden(kamer)
    const vrij = b - kamer.bewoners.length
    if (!viaNummer) return { kamer, verdieping: null, kant: i % 2 ? 'rechts' : 'links', rij: Math.floor(i / 2) + 1, bedden: b, vrij }
    const n = Number(kamer.nummer.trim())
    const deur = n % 100
    return { kamer, verdieping: Math.floor(n / 100), kant: deur % 2 ? 'links' : 'rechts', rij: Math.max(1, Math.ceil(deur / 2)), bedden: b, vrij }
  })
  return viaNummer ? plekken.sort((a, b) => Number(a.kamer.nummer) - Number(b.kamer.nummer)) : plekken
}

/** Verdiepingen van hoog naar laag, zoals je een gebouw tekent */
export const verdiepingen = (plekken: Plek[]) => [...new Set(plekken.map((p) => p.verdieping))].sort((a, b) => (b ?? 0) - (a ?? 0))

export const verdiepingNaam = (v: number | null) => (v === null ? 'de gang' : v === 0 ? 'begane grond' : `${v}e verdieping`)
export const verdiepingKort = (v: number | null) => (v === null ? '' : v === 0 ? 'bg' : `${v}e`)

/** Waar ligt p ten opzichte van jouw appartement? null = dat is het jouwe (of je hebt er geen) */
export function ligging(p: Plek, van: Plek | null): string | null {
  if (!van || p === van) return null
  const verschil = (p.verdieping ?? 0) - (van.verdieping ?? 0)
  if (verschil) {
    const recht = p.rij === van.rij && p.kant === van.kant
    const hoeveel = Math.abs(verschil) === 1 ? 'een verdieping' : `${Math.abs(verschil)} verdiepingen`
    return `${hoeveel} ${verschil > 0 ? 'hoger' : 'lager'}${recht ? `, recht ${verschil > 0 ? 'boven' : 'onder'} je` : ''}`
  }
  const afstand = Math.abs(p.rij - van.rij)
  if (p.kant !== van.kant) return afstand === 0 ? 'tegenover je' : afstand === 1 ? 'schuin tegenover je' : `aan de overkant, ${afstand} deuren verder`
  return afstand === 1 ? 'naast je' : `${afstand} deuren verder`
}

/** "Anna, Bram en Cas" */
export const opsomming = (namen: string[]) =>
  namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`
