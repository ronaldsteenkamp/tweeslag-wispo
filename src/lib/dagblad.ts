import type { Foto } from './fotos'

/*
 * Zetwerk van het clubblad als dagblad (gekozen uit mockups/clubblad-a.html): elke reisdag een
 * voorpagina. Hier alleen de keuzes (welke foto opent, welke foto's samen een blok vormen, waar de
 * stukjes komen); de weergave staat in screens/Fotomuur.tsx, de opmaak in styles/fotomuur.css.
 *
 * Alles volgt uit de foto's zelf (vorm, volgorde, datum): dezelfde foto's geven altijd dezelfde
 * opmaak, dus er verspringt niets bij herladen, maar twee dagen zien er zelden hetzelfde uit.
 * Bewust zonder React of Supabase, zodat `npm test` het los kan testen.
 */

/** Breder dan dit = panorama: altijd over de hele breedte */
export const PANORAMA = 2.2
/** Zoveel foto's (na de opening) in de kolommen; daarna de rubriek Gespot */
export const MAX_KOLOM = 9
/** Een stukje tot zoveel tekens wordt een grote quote tussen de foto's */
export const QUOTE_MAX = 120

export type Vorm = 'pano' | 'liggend' | 'vierkant' | 'staand'
type MetMaat = Pick<Foto, 'breedte' | 'hoogte'>

export const verhouding = (f: MetMaat) => (f.breedte && f.hoogte ? f.breedte / f.hoogte : 4 / 3)

export function vorm(f: MetMaat): Vorm {
  const r = verhouding(f)
  return r >= PANORAMA ? 'pano' : r >= 1.15 ? 'liggend' : r > 0.87 ? 'vierkant' : 'staand'
}

/** Uitsnijpunt bij bijsnijden: bij staande en vierkante foto's de bovenkant (hoofden), anders het midden */
export const uitsnijpunt = (f: MetMaat) => (vorm(f) === 'staand' || vorm(f) === 'vierkant' ? '50% 22%' : '50% 50%')

/** Vast getal uit een tekst (FNV-1a), voor keuzes die niet uit de foto's volgen; gelijk bij herladen */
export function zaad(tekst: string) {
  let h = 2166136261
  for (let i = 0; i < tekst.length; i++) h = Math.imul(h ^ tekst.charCodeAt(i), 16777619)
  return h >>> 0
}

type DagFoto = Pick<Foto, 'id' | 'breedte' | 'hoogte' | 'jury' | 'onderschrift' | 'gemaakt' | 'genomen'>
const moment = (f: DagFoto) => f.genomen ?? f.gemaakt

/** Foto's van één dag op tijd, van de ochtend naar de avond (bij gelijke tijd op id) */
export function opTijd<F extends DagFoto>(fotos: F[]): F[] {
  return [...fotos].sort((a, b) => Date.parse(moment(a)) - Date.parse(moment(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Foto van de dag: de jurykeuze (de laatste, als er meer zijn), anders de eerste liggende met
 * onderschrift, anders de eerste liggende, anders de eerste. `fotos` op tijd.
 */
export function kiesOpening<F extends DagFoto>(fotos: F[]): F | undefined {
  const jury = fotos.filter((f) => f.jury)
  return (
    jury[jury.length - 1] ??
    fotos.find((f) => vorm(f) === 'liggend' && !!f.onderschrift) ??
    fotos.find((f) => vorm(f) === 'liggend') ??
    fotos[0]
  )
}

/** Verdeelt de foto's na de opening: de eerste in de kolommen, de rest (vanaf 12) in Gespot */
export function verdeel<F>(rest: F[]): { kolom: F[]; gespot: F[] } {
  const kolom = rest.length > MAX_KOLOM + 2 ? rest.slice(0, MAX_KOLOM) : rest
  return { kolom, gespot: rest.slice(kolom.length) }
}

export type Module<F> =
  | { soort: 'pano'; fotos: [F] }
  /** Twee foto's naast elkaar met een kolomlijn, bijgesneden tot dezelfde verhouding */
  | { soort: 'duo'; fotos: [F, F]; snij: string }
  /** Eén foto met een tekstkolom ernaast (om = tekst links) */
  | { soort: 'zij'; fotos: [F]; snij: string; om: boolean }

/**
 * Zetwerk van de kolommen. Panorama's over de hele breedte; twee staande/vierkante naast elkaar
 * (4:5); twee liggende zonder onderschrift naast elkaar (4:3); anders één foto met een tekstkolom,
 * die afwisselend links en rechts staat. Aan welke kant de eerste begint, volgt uit `zaad`.
 */
export function modules<F extends DagFoto>(fotos: F[], zaadGetal: number): Module<F>[] {
  const uit: Module<F>[] = []
  let om = zaadGetal % 2 === 1
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i]
    const v = vorm(f)
    const volgende = fotos[i + 1]
    const vv = volgende ? vorm(volgende) : null
    if (v === 'pano') {
      uit.push({ soort: 'pano', fotos: [f] })
    } else if (volgende && v !== 'liggend' && (vv === 'staand' || vv === 'vierkant')) {
      uit.push({ soort: 'duo', fotos: [f, volgende], snij: '4 / 5' })
      i++
    } else if (volgende && v === 'liggend' && vv === 'liggend' && !f.onderschrift) {
      uit.push({ soort: 'duo', fotos: [f, volgende], snij: '4 / 3' })
      i++
    } else {
      uit.push({ soort: 'zij', fotos: [f], snij: v === 'liggend' ? '4 / 3' : '3 / 4', om })
      om = !om
    }
  }
  return uit
}

/**
 * Stukjes tussen de foto's: het kortste stukje (tot QUOTE_MAX tekens) wordt een grote quote, de
 * rest brieven (in de volgorde waarin ze binnenkwamen).
 */
export function verdeelStukjes<S extends { tekst: string }>(stukjes: S[]): { quote: S | null; brieven: S[] } {
  let quote: S | null = null
  for (const s of stukjes) if (s.tekst.trim().length <= QUOTE_MAX && (!quote || s.tekst.length < quote.tekst.length)) quote = s
  return { quote, brieven: stukjes.filter((s) => s !== quote) }
}

/** Kamer van de dag: de kamer met de meeste foto's, minstens 3 (anders geen rubriek). Gelijk: laagste nummer. */
export function kamerVanDeDag<F extends Pick<Foto, 'kamer'>>(fotos: F[]): { kamer: string; aantal: number; fotos: F[] } | null {
  const tel = new Map<string, number>()
  for (const f of fotos) if (f.kamer) tel.set(f.kamer, (tel.get(f.kamer) ?? 0) + 1)
  const [kamer, aantal] = [...tel].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? []
  return kamer && aantal && aantal >= 3 ? { kamer, aantal, fotos: fotos.filter((f) => f.kamer === kamer) } : null
}

/** '1 foto', '3 foto's', '1 stukje · 2 stukjes' */
export const telling = (fotos: number, stukjes: number) =>
  [fotos ? `${fotos} ${fotos === 1 ? 'foto' : "foto's"}` : '', stukjes ? `${stukjes} ${stukjes === 1 ? 'stukje' : 'stukjes'}` : '']
    .filter(Boolean)
    .join(' · ')
