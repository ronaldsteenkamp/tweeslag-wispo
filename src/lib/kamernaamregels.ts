/*
 * Regels voor de eigen naam van een kamer (zie kamernamen.ts). Zonder imports, zodat ze met
 * `npm test` te testen zijn (scripts/kamernamen.test.mjs).
 */

export const MAX_KAMERNAAM = 30

export interface KamernaamRij {
  nummer: string
  naam: string
}

const sleutel = (s: string) => s.trim().toLowerCase()

/**
 * De naam waarmee een kamer in beeld komt: de eigen naam van de bewoners, anders die van de
 * reisleiding (kamerverdeling), anders geen.
 */
export function kamerNaamVan(k: { nummer: string; naam?: string }, eigen: KamernaamRij[]): string | undefined {
  return eigen.find((r) => r.nummer === k.nummer)?.naam || k.naam || undefined
}

/**
 * Controleert een nieuwe naam voor kamer `nummer`. Geeft een foutmelding of null. Leeg mag:
 * dan geldt weer de naam van de reisleiding. `kamers`: alle kamers met hun naam van de reisleiding.
 */
export function kamernaamFout(
  naam: string,
  nummer: string,
  kamers: { nummer: string; naam?: string }[],
  eigen: KamernaamRij[],
): string | null {
  const n = naam.trim()
  if (!n) return null
  if (n.length > MAX_KAMERNAAM) return `Hooguit ${MAX_KAMERNAAM} tekens.`
  const bezet = kamers.some((k) => k.nummer !== nummer && sleutel(kamerNaamVan(k, eigen) ?? '') === sleutel(n))
  return bezet ? 'Een andere kamer heet al zo. Kies een andere naam.' : null
}
