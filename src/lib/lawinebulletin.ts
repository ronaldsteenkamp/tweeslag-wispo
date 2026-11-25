/*
 * Het lawinebulletin (BERA) van Météo-France uitlezen: het XML-bestand dat de Edge Function `lawine`
 * doorgeeft (zie supabase/functions/lawine). Alleen wat Météo-France zelf zegt, nooit een eigen oordeel.
 * Zonder DOM (gewone tekst), zodat het ook in de tests werkt (scripts/lawine.test.mjs).
 *
 * Opbouw (descriptif technique BRA, Météo-France):
 *   <BULLETINS_NEIGE_AVALANCHE MASSIF DATEBULLETIN DATEVALIDITE …>
 *     <CARTOUCHERISQUE>
 *       <RISQUE RISQUE1 EVOLURISQUE1 ALTITUDE RISQUE2 EVOLURISQUE2 RISQUEMAXI RISQUEMAXIJ2 COMMENTAIRE/>
 *       <PENTE N NE E SE S SW W NW/>   ("true" = daar is het risico het grootst; oud: SO, O, NO)
 *       <RESUME>…</RESUME>             (samenvatting, in het Frans)
 */

/** Windrichtingen van de hellingen, met de klok mee vanaf noord */
export const RICHTINGEN = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'] as const
export type Richting = (typeof RICHTINGEN)[number]

/** Europese schaal (EAWS), Nederlandse benamingen */
export const NIVEAUS: Record<number, string> = { 1: 'gering', 2: 'matig', 3: 'aanzienlijk', 4: 'groot', 5: 'zeer groot' }

export interface Bulletin {
  massif: string
  /** Lokale tijd in de Alpen, 'JJJJ-MM-DDTUU:MM' */
  uitgegeven: string
  geldigTot: string
  /** Hoogtegrens in meters; null als er één niveau voor de hele berg geldt */
  grens: number | null
  /** Onder de grens (of overal, zonder grens) */
  onder: number | null
  /** Boven de grens */
  boven: number | null
  /** Later op de dag (bijv. door opwarming), als Météo-France dat aangeeft */
  onderLater: number | null
  bovenLater: number | null
  max: number | null
  /** Verwachting voor de dag erna */
  morgen: number | null
  /** Korte toelichting bij het risico (Frans) */
  commentaar: string
  /** Hellingen waar het risico het grootst is */
  hellingen: Richting[]
  /** Samenvatting (Frans) */
  samenvatting: string
}

const ENTITEITEN: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
const ontsnap = (s: string) => s.replace(/&(lt|gt|amp|quot|apos);/g, (_, e: string) => ENTITEITEN[e])

/** Attributen van het eerste element met deze naam */
function attributen(xml: string, tag: string): Record<string, string> {
  const m = xml.match(new RegExp(`<${tag}\\s([^>]*?)/?>`))
  const uit: Record<string, string> = {}
  if (!m) return uit
  for (const a of m[1].matchAll(/([\w:.-]+)="([^"]*)"/g)) uit[a[1]] = ontsnap(a[2])
  return uit
}

/** Tekst van het eerste element met deze naam (met of zonder CDATA) */
function tekst(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  if (!m) return ''
  const inhoud = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (inhoud ? inhoud[1] : ontsnap(m[1])).replace(/\r\n/g, '\n').trim()
}

const niveau = (s: string | undefined): number | null => {
  const n = Number.parseInt(s ?? '', 10)
  return n >= 1 && n <= 5 ? n : null
}

const tijd = (s: string | undefined) => (s ?? '').slice(0, 16)

/** Attribuutnamen van PENTE in de volgorde van RICHTINGEN. Oudere bestanden gebruiken de Franse
 *  letters voor west (O): SO, O, NO in plaats van SW, W, NW. */
const PENTE_NIEUW = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const PENTE_OUD = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

export function leesBulletin(xml: string): Bulletin | null {
  if (!xml.includes('<BULLETINS_NEIGE_AVALANCHE')) return null
  const kop = attributen(xml, 'BULLETINS_NEIGE_AVALANCHE')
  const r = attributen(xml, 'RISQUE')
  const p = attributen(xml, 'PENTE')
  const grens = Number.parseInt(r.ALTITUDE ?? '', 10)
  const metGrens = Number.isFinite(grens) && grens > 0 && niveau(r.RISQUE2) !== null
  return {
    massif: kop.MASSIF ?? '',
    uitgegeven: tijd(kop.DATEBULLETIN),
    geldigTot: tijd(kop.DATEVALIDITE),
    grens: metGrens ? grens : null,
    onder: niveau(r.RISQUE1),
    boven: metGrens ? niveau(r.RISQUE2) : null,
    onderLater: niveau(r.EVOLURISQUE1),
    bovenLater: metGrens ? niveau(r.EVOLURISQUE2) : null,
    max: niveau(r.RISQUEMAXI),
    morgen: niveau(r.RISQUEMAXIJ2),
    commentaar: r.COMMENTAIRE?.trim() ?? '',
    hellingen: RICHTINGEN.filter((_, i) => p[('SW' in p || 'W' in p ? PENTE_NIEUW : PENTE_OUD)[i]] === 'true'),
    samenvatting: tekst(xml, 'RESUME'),
  }
}
