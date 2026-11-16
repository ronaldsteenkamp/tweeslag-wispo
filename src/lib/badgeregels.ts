/*
 * De regels van de badges: welke er zijn, wanneer je ze krijgt en wat je er nog voor moet doen.
 * Dit bestand gebruikt geen React, browser of server, zodat de regels met `npm test` te testen
 * zijn (scripts/badges.test.mjs). Het ophalen en bijhouden staat in badges.ts en badgesTelefoon.ts.
 *
 * Drempels staan hieronder als constanten: aanpassen kan zonder iets anders te veranderen.
 */

// ---------- Drempels ----------

export const CHALLENGES_NODIG = 10
export const FOTOS_NODIG = 3
/** 🎰 High roller: zoveel fiches in het casino (je begint met 1000; een bak geeft er 500) */
export const CASINO_FICHES_NODIG = 5000
/** 🔮 Waarzegger: zo vaak gestemd op wie de stemming won */
export const WAARZEGGER_NODIG = 3
/** 🎡 Lot uit de loterij: zo vaak door het klos-rad gekozen */
export const RAD_NODIG = 3

export type BadgeId =
  | 'open-boek'
  | 'bijnaam'
  | 'vaste-gast'
  | 'wekker'
  | 'ingepakt'
  | 'vroege-vogel'
  | 'challenge-jager'
  | 'bingo'
  | 'volle-kaart'
  | 'stem-van-de-dag'
  | 'stemvee'
  | 'waarzegger'
  | 'fotograaf'
  | 'high-roller'
  | 'lot'
  | 'koploper'
  | 'blut'

/** Alles wat er over iemand bekend is, om de badges uit te rekenen */
export interface Feiten {
  profielVol: boolean
  bijnaam: boolean
  vasteGast: boolean
  wekker: boolean
  ingepakt: boolean
  /** Als eerste van de groep ingepakt (zie vroegsteVogels) */
  vroegeVogel: boolean
  challenges: number
  bingoLijnen: number
  volleKaart: boolean
  stemWinst: number
  /** Op elke stemming gestemd die er tot nu toe was (en er was er minstens één) */
  stemvee: boolean
  /** Zoveel stemmingen gemist (alleen van jezelf bekend) */
  stemmingenGemist: number
  /** Zo vaak gestemd op de winnaar */
  waarzegger: number
  fotos: number
  highRoller: boolean
  /** Fiches in het casino nu (alleen van jezelf bekend) */
  casinoFiches: number
  radGekozen: number
  totaal: number
  blut: boolean
}

export const geenFeiten: Feiten = {
  profielVol: false,
  bijnaam: false,
  vasteGast: false,
  wekker: false,
  ingepakt: false,
  vroegeVogel: false,
  challenges: 0,
  bingoLijnen: 0,
  volleKaart: false,
  stemWinst: 0,
  stemvee: false,
  stemmingenGemist: 0,
  waarzegger: 0,
  fotos: 0,
  highRoller: false,
  casinoFiches: 0,
  radGekozen: 0,
  totaal: 0,
  blut: false,
}

export interface BadgeDef {
  id: BadgeId
  emoji: string
  naam: string
  /** Waarvoor je hem krijgt */
  uitleg: string
  /** Wat je nog moet doen (met je eigen voortgang erbij) */
  nogTeDoen: (f: Feiten) => string
  /** Gaat naar wie voorop staat */
  wisselt?: boolean
  /** Kan alleen met de server (fotomuur, stemmingen, klassement, meldingen) */
  server?: boolean
}

const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`

/** De volgorde hier is de volgorde op het profiel. De lachbadges staan achteraan. */
export const BADGES: BadgeDef[] = [
  {
    id: 'open-boek',
    emoji: '✍️',
    naam: 'Open boek',
    uitleg: 'Profiel helemaal ingevuld, met foto',
    nogTeDoen: () => 'Vul je profiel helemaal in, met een foto',
  },
  {
    id: 'bijnaam',
    emoji: '🏷️',
    naam: 'Bijnaam',
    uitleg: 'Een bijnaam gekozen',
    nogTeDoen: () => 'Kies een bijnaam in Jouw profiel',
  },
  {
    id: 'vaste-gast',
    emoji: '📲',
    naam: 'Vaste gast',
    uitleg: 'De app staat op het beginscherm',
    nogTeDoen: () => 'Zet de app op je beginscherm en open hem daar',
  },
  {
    id: 'wekker',
    emoji: '🔔',
    naam: 'Wekker',
    uitleg: 'Meldingen van de app staan aan',
    nogTeDoen: () => 'Zet meldingen aan op Home',
    server: true,
  },
  {
    id: 'ingepakt',
    emoji: '🎒',
    naam: 'Ingepakt',
    uitleg: 'De hele paklijst afgevinkt',
    nogTeDoen: () => 'Vink je hele paklijst af',
  },
  {
    id: 'vroege-vogel',
    emoji: '🐦',
    naam: 'Vroege vogel',
    uitleg: 'Als eerste van de groep de hele paklijst afgevinkt',
    nogTeDoen: () => 'Vink als eerste van de groep je hele paklijst af',
    server: true,
  },
  {
    id: 'challenge-jager',
    emoji: '🎯',
    naam: 'Challenge-jager',
    uitleg: `${CHALLENGES_NODIG} challenges gedaan`,
    nogTeDoen: (f) => `Doe ${CHALLENGES_NODIG} challenges (nu ${f.challenges})`,
  },
  {
    id: 'bingo',
    emoji: '🚌',
    naam: 'Bingo!',
    uitleg: 'Een rij op de busbingo',
    nogTeDoen: () => 'Haal een rij op de busbingo',
  },
  {
    id: 'volle-kaart',
    emoji: '🏆',
    naam: 'Volle kaart',
    uitleg: 'De hele busbingokaart vol',
    nogTeDoen: () => 'Maak je busbingokaart helemaal vol',
  },
  {
    id: 'stem-van-de-dag',
    emoji: '👑',
    naam: 'Stem van de dag',
    uitleg: 'Een dagelijkse stemming gewonnen',
    nogTeDoen: () => 'Win een dagelijkse stemming',
    server: true,
  },
  {
    id: 'stemvee',
    emoji: '🗳️',
    naam: 'Stemvee',
    uitleg: 'Op elke stemming gestemd',
    nogTeDoen: (f) =>
      f.stemmingenGemist > 0
        ? `Stem op elke stemming (nog ${meervoud(f.stemmingenGemist, 'stemming', 'stemmingen')} gemist)`
        : 'Stem op elke dagelijkse stemming',
    server: true,
  },
  {
    id: 'waarzegger',
    emoji: '🔮',
    naam: 'Waarzegger',
    uitleg: `Minstens ${WAARZEGGER_NODIG} keer gestemd op wie de stemming won`,
    nogTeDoen: (f) => `Stem ${WAARZEGGER_NODIG} keer op de winnaar van een stemming (nu ${f.waarzegger})`,
    server: true,
  },
  {
    id: 'fotograaf',
    emoji: '📸',
    naam: 'Fotograaf',
    uitleg: "De meeste foto's op de fotomuur",
    nogTeDoen: (f) => `Zet de meeste foto's op de fotomuur, minstens ${FOTOS_NODIG} (nu ${f.fotos})`,
    wisselt: true,
    server: true,
  },
  {
    id: 'high-roller',
    emoji: '🎰',
    naam: 'High roller',
    uitleg: `${CASINO_FICHES_NODIG.toLocaleString('nl-NL')} fiches gehaald in het casino`,
    nogTeDoen: (f) =>
      `Kom in het casino op ${CASINO_FICHES_NODIG.toLocaleString('nl-NL')} fiches (nu ${f.casinoFiches.toLocaleString('nl-NL')})`,
  },
  {
    id: 'lot',
    emoji: '🎡',
    naam: 'Lot uit de loterij',
    uitleg: `${RAD_NODIG} keer door het klos-rad gekozen`,
    nogTeDoen: (f) => `Word ${RAD_NODIG} keer door het klos-rad gekozen (nu ${f.radGekozen})`,
    server: true,
  },
  {
    id: 'koploper',
    emoji: '🥇',
    naam: 'Koploper',
    uitleg: 'Nu de nummer 1 van het klassement',
    nogTeDoen: () => 'Sta bovenaan in het klassement',
    wisselt: true,
    server: true,
  },
  {
    id: 'blut',
    emoji: '💸',
    naam: 'Blut',
    uitleg: 'Fiches moeten lenen bij de bank van het casino',
    nogTeDoen: () => 'Speel in het casino al je fiches kwijt (of liever niet)',
  },
]

export const badgeDef = (id: BadgeId) => BADGES.find((b) => b.id === id)!

export interface Badge {
  id: BadgeId
  /** Aantal keer (bij Stem van de dag en Waarzegger) */
  aantal?: number
}

/** Feiten → badges, in de volgorde van BADGES. leiders: de hoogste stand van iedereen (voor de badges die wisselen). */
export function badgesUit(f: Feiten, leiders: { fotos: number; totaal: number }): Badge[] {
  const heeft: Partial<Record<BadgeId, Badge>> = {}
  const geef = (id: BadgeId, aantal?: number) => (heeft[id] = aantal === undefined ? { id } : { id, aantal })
  if (f.profielVol) geef('open-boek')
  if (f.bijnaam) geef('bijnaam')
  if (f.vasteGast) geef('vaste-gast')
  if (f.wekker) geef('wekker')
  if (f.ingepakt) geef('ingepakt')
  if (f.vroegeVogel) geef('vroege-vogel')
  if (f.challenges >= CHALLENGES_NODIG) geef('challenge-jager')
  if (f.bingoLijnen > 0) geef('bingo')
  if (f.volleKaart) geef('volle-kaart')
  if (f.stemWinst > 0) geef('stem-van-de-dag', f.stemWinst)
  if (f.stemvee) geef('stemvee')
  if (f.waarzegger >= WAARZEGGER_NODIG) geef('waarzegger', f.waarzegger)
  if (f.fotos >= FOTOS_NODIG && f.fotos === leiders.fotos) geef('fotograaf')
  if (f.highRoller) geef('high-roller')
  if (f.radGekozen >= RAD_NODIG) geef('lot')
  if (f.totaal > 0 && f.totaal === leiders.totaal) geef('koploper')
  if (f.blut) geef('blut')
  return BADGES.flatMap((d) => (heeft[d.id] ? [heeft[d.id]!] : []))
}

// ---------- Badges die alleen de telefoon ziet ----------
// Die gaan als { badge: aantal } mee naar de server (voortgang.badges), zodat anderen ze ook zien.

export type TelefoonBadges = Partial<Record<BadgeId, number>>

/** Wat deze telefoon over zichzelf naar de server stuurt */
export function telefoonUitFeiten(f: Feiten): TelefoonBadges {
  const uit: TelefoonBadges = {}
  if (f.vasteGast) uit['vaste-gast'] = 1
  if (f.wekker) uit.wekker = 1
  if (f.highRoller) uit['high-roller'] = 1
  if (f.blut) uit.blut = 1
  if (f.stemvee) uit.stemvee = 1
  if (f.waarzegger > 0) uit.waarzegger = f.waarzegger
  return uit
}

/** Wat de server van een ander weet → de feiten die daarbij horen */
export function feitenUitTelefoon(t: TelefoonBadges | null | undefined): Pick<
  Feiten,
  'vasteGast' | 'wekker' | 'highRoller' | 'blut' | 'stemvee' | 'waarzegger'
> {
  const getal = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0)
  return {
    vasteGast: getal(t?.['vaste-gast']) > 0,
    wekker: getal(t?.wekker) > 0,
    highRoller: getal(t?.['high-roller']) > 0,
    blut: getal(t?.blut) > 0,
    stemvee: getal(t?.stemvee) > 0,
    waarzegger: getal(t?.waarzegger),
  }
}

// ---------- Stemmingen ----------

export const isTestStemmingId = (id: string) => id.startsWith('test-')

/** Winnaar(s) van een uitslag (meeste stemmen eerst): iedereen met het hoogste aantal */
export function winnaarsVan(uitslag: { kandidaat: string; stemmen: number }[] | undefined): string[] {
  if (!uitslag?.length) return []
  const max = Math.max(...uitslag.map((u) => u.stemmen))
  return max > 0 ? uitslag.filter((u) => u.stemmen === max).map((u) => u.kandidaat) : []
}

/**
 * 🗳️ Stemvee en 🔮 Waarzegger uit je eigen stemmen. Alleen echte stemmingen (geen teststemmingen)
 * die al gesloten zijn tellen. mijn: op wie jij stemde, per stemming.
 */
export function eigenStemmen(
  stemmingen: { id: string; sluit: number }[],
  mijn: Record<string, string>,
  uitslagen: Record<string, { kandidaat: string; stemmen: number }[]>,
  moment: number,
): { geweest: number; gemist: number; stemvee: boolean; waarzegger: number } {
  const geweest = stemmingen.filter((s) => !isTestStemmingId(s.id) && s.sluit <= moment)
  const gemist = geweest.filter((s) => !mijn[s.id]).length
  const sleutel = (n: string) => n.trim().toLowerCase()
  const waarzegger = geweest.filter((s) => {
    const keus = mijn[s.id]
    return !!keus && winnaarsVan(uitslagen[s.id]).some((w) => sleutel(w) === sleutel(keus))
  }).length
  return { geweest: geweest.length, gemist, stemvee: geweest.length > 0 && gemist === 0, waarzegger }
}

// ---------- Paklijst ----------

/**
 * 🐦 Vroege vogel: wie als eerste helemaal ingepakt had (ingepakt_op). Bij precies hetzelfde
 * moment allebei. Geeft de sleutels (naam in kleine letters) terug.
 */
export function vroegsteVogels(lijst: { naam: string; op: number | null | undefined }[]): Set<string> {
  const met = lijst.filter((x): x is { naam: string; op: number } => typeof x.op === 'number' && Number.isFinite(x.op))
  if (!met.length) return new Set()
  const eerste = Math.min(...met.map((x) => x.op))
  return new Set(met.filter((x) => x.op === eerste).map((x) => x.naam.trim().toLowerCase()))
}

// ---------- Klos-rad ----------

/** Hoe vaak iedereen door het klos-rad gekozen is (sleutel: naam in kleine letters), zonder de testperiode */
export function radTelling(uitslagen: { naam: string; gedraaid: number }[], vanaf: number): Map<string, number> {
  const uit = new Map<string, number>()
  for (const u of uitslagen) {
    if (!(u.gedraaid >= vanaf)) continue
    const s = u.naam.trim().toLowerCase()
    uit.set(s, (uit.get(s) ?? 0) + 1)
  }
  return uit
}
