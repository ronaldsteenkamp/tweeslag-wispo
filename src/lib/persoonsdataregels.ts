/*
 * Regels voor het samenvoegen van persoonsdata (zie persoonsdata.ts). Zonder imports, zodat
 * scripts/persoonsdata.test.mjs dit bestand rechtstreeks in Node kan laden.
 *
 * Elke waarde heeft een moment 'bijgewerkt' (ms). Bijgewerkt 0 betekent: lokaal ontstaan vóórdat
 * deze telefoon de gegevens van de naam van de server had (een nieuwe telefoon, of de eerste start
 * na de update). Zo'n waarde wint nooit van de server, behalve bij optellen (lijsten en sets) en
 * bij het vroegste moment. Zo kan een lege of net geschudde stand van een nieuwe telefoon de
 * server niet overschrijven.
 */

export type Strategie =
  /** Lijsten en sets bij elkaar optellen (bij objecten per sleutel; getallen: de kleinste, 'versie': de grootste) */
  | 'unie'
  /** Het vroegste getal (bijv. het moment van inpakken) */
  | 'vroegste'
  /** De waarde die het eerst bestond blijft (bijv. de geschudde bingokaart) */
  | 'eerste'
  /** De laatst bijgewerkte waarde wint */
  | 'nieuwste'

/** Alle sleutels die per naam op de server staan, met hoe ze worden samengevoegd */
export const PERSOONLIJK: Readonly<Record<string, Strategie>> = {
  // Paklijst
  'paklijst.vinkjes': 'unie',
  'paklijst.eigen': 'unie',
  'paklijst.ingepakt': 'nieuwste',
  'paklijst.ingepaktOp': 'vroegste',
  // Badges
  'badges.lokaal': 'unie',
  'badges.spel': 'unie',
  'badges.telefoon': 'unie',
  'badges.gezien': 'unie',
  // Foto's die je groot hebt geopend
  'fotos.gezien': 'unie',
  // Spel
  'spel.challenges': 'unie',
  'spel.bingo.kaart': 'eerste',
  'spel.bingo.vinkjes': 'unie',
  'spel.bingo.gevierd': 'unie',
  'spel.dagkaarten': 'unie',
  'spel.gekrast': 'unie',
  // Casino
  'casino.fiches': 'nieuwste',
  'casino.geleend': 'nieuwste',
  'casino.inzet': 'nieuwste',
  'casino.reset': 'nieuwste',
  // Eigen raderen (lijsten waar je ook uit weghaalt: dus niet optellen, de laatste wint)
  'rad.eigenLijsten': 'nieuwste',
  'rad.eigenLijst': 'nieuwste',
  'rad.eigen': 'nieuwste',
  'rad.drankjes.uit': 'nieuwste',
  'rad.drankjes.eigen': 'nieuwste',
  'rad.kleuren': 'nieuwste',
  'rad.deelnemers': 'nieuwste',
}

/**
 * Ophogen als er sleutels bij PERSOONLIJK komen: dan haalt elke telefoon de stand van zijn naam
 * nog een keer op en voegt samen, zodat de nieuwe sleutels (die hier al stonden) naar de server gaan.
 * 2: eigen raderen erbij.
 */
export const REGELS_VERSIE = 2

export const PERSOONLIJKE_SLEUTELS = Object.keys(PERSOONLIJK)

/**
 * Hoort bij het oefenen in de testperiode (zie testperiode.ts). Is het echte spel begonnen, dan
 * telt een waarde op de server die van vóór de start is niet meer mee.
 */
export const TESTDATA = new Set([
  'spel.challenges',
  'spel.bingo.kaart',
  'spel.bingo.vinkjes',
  'spel.bingo.gevierd',
  'spel.dagkaarten',
  'spel.gekrast',
  'casino.fiches',
  'casino.geleend',
  'casino.inzet',
  'badges.spel',
])

/** Langste lijst die we bewaren (fotos.gezien houdt er ook 1000) */
const MAX_LIJST = 1000

export interface Versie {
  waarde: unknown
  bijgewerkt: number
}

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const gelijk = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function lijstUnie(a: unknown[], b: unknown[]): unknown[] {
  const uit = [...a]
  const gezien = new Set(a.map(id))
  for (const x of b) {
    const k = id(x)
    if (!gezien.has(k)) {
      gezien.add(k)
      uit.push(x)
    }
  }
  return uit.slice(0, MAX_LIJST)
}

/** Items met een id (bijv. eigen paklijstitems) op id, de rest op hun inhoud */
const id = (x: unknown) => (isObject(x) && typeof x.id === 'string' ? `id:${x.id}` : JSON.stringify(x))

/** Twee waarden optellen. Bij een conflict dat niet op te tellen is wint `a`. */
export function unie(a: unknown, b: unknown): unknown {
  if (a === null || a === undefined) return b
  if (b === null || b === undefined) return a
  if (Array.isArray(a) && Array.isArray(b)) return lijstUnie(a, b)
  if (isObject(a) && isObject(b)) {
    const uit: Record<string, unknown> = { ...b, ...a }
    for (const k of Object.keys(a)) {
      if (!(k in b)) continue
      const x = a[k]
      const y = b[k]
      if (typeof x === 'number' && typeof y === 'number') uit[k] = k === 'versie' ? Math.max(x, y) : Math.min(x, y)
      else uit[k] = unie(x, y)
    }
    return uit
  }
  return a
}

/**
 * Voegt de lokale en de serverversie van één sleutel samen. `null` als er van geen van beide
 * iets is. De lokale versie wint bij gelijke momenten.
 */
export function voegSamen(strategie: Strategie, lokaal: Versie | null, server: Versie | null): Versie | null {
  if (!lokaal) return server
  if (!server) return lokaal
  const laatst = Math.max(lokaal.bijgewerkt, server.bijgewerkt)
  switch (strategie) {
    case 'unie':
      return { waarde: unie(lokaal.waarde, server.waarde), bijgewerkt: laatst }
    case 'vroegste': {
      const a = lokaal.waarde
      const b = server.waarde
      if (typeof a !== 'number') return server
      if (typeof b !== 'number') return lokaal
      return { waarde: Math.min(a, b), bijgewerkt: laatst }
    }
    case 'eerste':
      // Een lokale waarde zonder bevestigd moment (0) was er niet eerst
      if (server.waarde === null || server.waarde === undefined) return lokaal
      if (lokaal.waarde === null || lokaal.waarde === undefined) return server
      return lokaal.bijgewerkt > 0 && lokaal.bijgewerkt < server.bijgewerkt ? lokaal : server
    case 'nieuwste':
      return lokaal.bijgewerkt > 0 && lokaal.bijgewerkt >= server.bijgewerkt ? lokaal : server
  }
}

export interface Uitkomst {
  /** De samengevoegde stand per sleutel (alleen sleutels waarvan er ergens iets is) */
  stand: Record<string, Versie>
  /** Sleutels waarvan de samengevoegde stand nog naar de server moet */
  teVersturen: string[]
}

/**
 * Voegt alles samen bij het (opnieuw) kiezen van een naam.
 * `lokaal`: wat er op deze telefoon bewaard staat; `server`: de rijen van deze naam.
 * `spelBegint`: begin van het echte spel als er een testperiode is, anders null.
 * Waarden die verstuurd moeten worden en nog geen moment hebben (0) krijgen `nu`.
 */
export function voegAllesSamen(
  lokaal: Record<string, Versie>,
  server: Record<string, Versie>,
  opties: { nu: number; spelBegint: number | null },
): Uitkomst {
  const stand: Record<string, Versie> = {}
  const teVersturen: string[] = []
  for (const [sleutel, strategie] of Object.entries(PERSOONLIJK)) {
    let s: Versie | null = server[sleutel] ?? null
    if (s && opties.spelBegint !== null && opties.nu >= opties.spelBegint && TESTDATA.has(sleutel) && s.bijgewerkt < opties.spelBegint) {
      s = null // oefendata uit de testperiode
    }
    const l = lokaal[sleutel] ?? null
    const uit = voegSamen(strategie, l, s)
    if (!uit) continue
    if (s && gelijk(uit.waarde, s.waarde)) {
      stand[sleutel] = { waarde: uit.waarde, bijgewerkt: Math.max(uit.bijgewerkt, s.bijgewerkt) }
      continue
    }
    stand[sleutel] = { waarde: uit.waarde, bijgewerkt: uit.bijgewerkt || opties.nu }
    teVersturen.push(sleutel)
  }
  return { stand, teVersturen }
}
