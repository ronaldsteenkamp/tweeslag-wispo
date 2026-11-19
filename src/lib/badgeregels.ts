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
/** 🌅 Eerste lift: de app open tussen deze tijden (lokale tijd) op een skidag */
export const EERSTE_LIFT_VAN = '05:00'
export const EERSTE_LIFT_TOT = '09:00'
/** 🦉 Nachtuil: de app open tussen deze tijden (tijdens de reis) */
export const NACHTUIL_VAN = '02:00'
export const NACHTUIL_TOT = '05:00'
/** 🥶 IJskonijn: zo koud (of kouder) op de berg volgens het weerbericht */
export const IJSKONIJN_GRADEN = -10
/** ⛰️ Bergbeklimmer: een GPS-positie die onnauwkeuriger is dan dit telt niet */
export const BERG_NAUWKEURIGHEID_M = 500

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
  | 'bergbeklimmer'
  | 'eerste-lift'
  | 'ijskonijn'
  | 'koploper'
  | 'kamerkampioen'
  | 'blut'
  | 'nachtuil'

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
  bergbeklimmer: boolean
  eersteLift: boolean
  ijskonijn: boolean
  totaal: number
  /** Je kamer heeft samen de meeste punten (zie kamerKampioenen) */
  kamerkampioen: boolean
  blut: boolean
  nachtuil: boolean
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
  bergbeklimmer: false,
  eersteLift: false,
  ijskonijn: false,
  totaal: 0,
  kamerkampioen: false,
  blut: false,
  nachtuil: false,
}

/** Soort badge: bepaalt de kleur van het stickertje (het icoon staat in components/BadgeIcoon.tsx) */
export type BadgeSoort = 'voorbereiding' | 'spel' | 'eer' | 'berg'

export interface BadgeDef {
  id: BadgeId
  soort: BadgeSoort
  naam: string
  /** Waarvoor je hem krijgt */
  uitleg: string
  /** Wat je nog moet doen (met je eigen voortgang erbij) */
  nogTeDoen: (f: Feiten) => string
  /** Gaat naar wie voorop staat */
  wisselt?: boolean
  /** Kan alleen met de server (fotomuur, stemmingen, klassement, meldingen) */
  server?: boolean
  /** Alleen te halen tijdens de reis (tussen vertrek en thuiskomst) */
  reis?: boolean
}

const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`

/** De volgorde hier is de volgorde op het profiel. De lachbadges staan achteraan. */
export const BADGES: BadgeDef[] = [
  {
    id: 'open-boek',
    soort: 'voorbereiding',
    naam: 'Open boek',
    uitleg: 'Profiel helemaal ingevuld, met foto',
    nogTeDoen: () => 'Vul je profiel helemaal in, met een foto',
  },
  {
    id: 'bijnaam',
    soort: 'voorbereiding',
    naam: 'Bijnaam',
    uitleg: 'Een bijnaam gekozen',
    nogTeDoen: () => 'Kies een bijnaam in Jouw profiel',
  },
  {
    id: 'vaste-gast',
    soort: 'voorbereiding',
    naam: 'Vaste gast',
    uitleg: 'De app staat op het beginscherm',
    nogTeDoen: () => 'Zet de app op je beginscherm en open hem daar',
  },
  {
    id: 'wekker',
    soort: 'voorbereiding',
    naam: 'Wekker',
    uitleg: 'Meldingen van de app staan aan',
    nogTeDoen: () => 'Zet meldingen aan op Home',
    server: true,
  },
  {
    id: 'ingepakt',
    soort: 'voorbereiding',
    naam: 'Ingepakt',
    uitleg: 'De hele paklijst afgevinkt',
    nogTeDoen: () => 'Vink je hele paklijst af',
  },
  {
    id: 'vroege-vogel',
    soort: 'voorbereiding',
    naam: 'Vroege vogel',
    uitleg: 'Als eerste van de groep de hele paklijst afgevinkt',
    nogTeDoen: () => 'Vink als eerste van de groep je hele paklijst af',
    server: true,
  },
  {
    id: 'challenge-jager',
    soort: 'spel',
    naam: 'Challenge-jager',
    uitleg: `${CHALLENGES_NODIG} challenges gedaan`,
    nogTeDoen: (f) => `Doe ${CHALLENGES_NODIG} challenges (nu ${f.challenges})`,
  },
  {
    id: 'bingo',
    soort: 'spel',
    naam: 'Bingo!',
    uitleg: 'Een rij op de busbingo',
    nogTeDoen: () => 'Haal een rij op de busbingo',
  },
  {
    id: 'volle-kaart',
    soort: 'spel',
    naam: 'Volle kaart',
    uitleg: 'De hele busbingokaart vol',
    nogTeDoen: () => 'Maak je busbingokaart helemaal vol',
  },
  {
    id: 'stem-van-de-dag',
    soort: 'eer',
    naam: 'Stem van de dag',
    uitleg: 'Een dagelijkse stemming gewonnen',
    nogTeDoen: () => 'Win een dagelijkse stemming',
    server: true,
  },
  {
    id: 'stemvee',
    soort: 'eer',
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
    soort: 'eer',
    naam: 'Waarzegger',
    uitleg: `Minstens ${WAARZEGGER_NODIG} keer gestemd op wie de stemming won`,
    nogTeDoen: (f) => `Stem ${WAARZEGGER_NODIG} keer op de winnaar van een stemming (nu ${f.waarzegger})`,
    server: true,
  },
  {
    id: 'fotograaf',
    soort: 'eer',
    naam: 'Fotograaf',
    uitleg: "De meeste foto's in het clubblad",
    nogTeDoen: (f) => `Krijg de meeste foto's in het clubblad, minstens ${FOTOS_NODIG} (nu ${f.fotos})`,
    wisselt: true,
    server: true,
  },
  {
    id: 'high-roller',
    soort: 'spel',
    naam: 'High roller',
    uitleg: `${CASINO_FICHES_NODIG.toLocaleString('nl-NL')} fiches gehaald in het casino`,
    nogTeDoen: (f) =>
      `Kom in het casino op ${CASINO_FICHES_NODIG.toLocaleString('nl-NL')} fiches (nu ${f.casinoFiches.toLocaleString('nl-NL')})`,
  },
  {
    id: 'lot',
    soort: 'spel',
    naam: 'Lot uit de loterij',
    uitleg: `${RAD_NODIG} keer door het klos-rad gekozen`,
    nogTeDoen: (f) => `Word ${RAD_NODIG} keer door het klos-rad gekozen (nu ${f.radGekozen})`,
    server: true,
  },
  {
    id: 'bergbeklimmer',
    soort: 'berg',
    naam: 'Bergbeklimmer',
    uitleg: 'Op de gletsjer geweest (boven 3000 m), met je plek op de pistekaart',
    nogTeDoen: () => 'Zet op de gletsjer je plek aan op de pistekaart',
    reis: true,
  },
  {
    id: 'eerste-lift',
    soort: 'berg',
    naam: 'Eerste lift',
    uitleg: `De app geopend vóór ${EERSTE_LIFT_TOT} op een skidag`,
    nogTeDoen: () => `Open de app op een skidag vóór ${EERSTE_LIFT_TOT}`,
    reis: true,
  },
  {
    id: 'ijskonijn',
    soort: 'berg',
    naam: 'IJskonijn',
    uitleg: `De app geopend toen het op de berg ${IJSKONIJN_GRADEN}° of kouder was`,
    nogTeDoen: () => `Open de app als het op de berg ${IJSKONIJN_GRADEN}° of kouder is`,
    reis: true,
  },
  {
    id: 'koploper',
    soort: 'eer',
    naam: 'Koploper',
    uitleg: 'Nu de nummer 1 van het klassement',
    nogTeDoen: () => 'Sta bovenaan in het klassement',
    wisselt: true,
    server: true,
  },
  {
    id: 'kamerkampioen',
    soort: 'eer',
    naam: 'Kamerkampioen',
    uitleg: 'Je kamer heeft samen de meeste punten',
    nogTeDoen: () => 'Zorg dat je kamer samen de meeste punten heeft',
    wisselt: true,
    server: true,
  },
  {
    id: 'blut',
    soort: 'spel',
    naam: 'Blut',
    uitleg: 'Fiches moeten lenen bij de bank van het casino',
    nogTeDoen: () => 'Speel in het casino al je fiches kwijt (of liever niet)',
  },
  {
    id: 'nachtuil',
    soort: 'berg',
    naam: 'Nachtuil',
    uitleg: `De app geopend tussen ${NACHTUIL_VAN} en ${NACHTUIL_TOT} 's nachts`,
    nogTeDoen: () => `Open de app tussen ${NACHTUIL_VAN} en ${NACHTUIL_TOT} 's nachts (en ga daarna slapen)`,
    reis: true,
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
  if (f.bergbeklimmer) geef('bergbeklimmer')
  if (f.eersteLift) geef('eerste-lift')
  if (f.ijskonijn) geef('ijskonijn')
  if (f.totaal > 0 && f.totaal === leiders.totaal) geef('koploper')
  if (f.kamerkampioen) geef('kamerkampioen')
  if (f.blut) geef('blut')
  if (f.nachtuil) geef('nachtuil')
  return BADGES.flatMap((d) => (heeft[d.id] ? [heeft[d.id]!] : []))
}

// ---------- Badges die alleen de telefoon ziet ----------
// Die gaan als { badge: aantal } mee naar de server (voortgang.badges), zodat anderen ze ook zien.

/**
 * Eigenaar van de telefoon: alleen die krijgt de badges die de telefoon zelf ziet (beginscherm,
 * meldingen, vroeg/laat open, op de gletsjer, ijskoud) en die uit de stemmen van dit apparaat.
 * Dat is de eerste naam die op de telefoon gekozen is. Kiest iemand een andere naam, dan wordt die
 * pas eigenaar als die naam een dag lang gekozen blijft (even wisselen om te kijken telt niet).
 */
export interface Eigenaar {
  naam: string
  kandidaat?: { naam: string; sinds: number }
}

export const EIGENAAR_NA_MS = 24 * 60 * 60 * 1000

const zelfdeNaam = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function volgendeEigenaar(e: Eigenaar | null, naam: string | null, nu: number): Eigenaar | null {
  if (!naam) return e
  if (!e) return { naam }
  if (zelfdeNaam(e.naam, naam)) return e.kandidaat ? { naam: e.naam } : e
  if (e.kandidaat && zelfdeNaam(e.kandidaat.naam, naam)) return nu - e.kandidaat.sinds >= EIGENAAR_NA_MS ? { naam } : e
  return { naam: e.naam, kandidaat: { naam, sinds: nu } }
}

export const isEigenaar = (e: Eigenaar | null, naam: string | null) => !!e && !!naam && zelfdeNaam(e.naam, naam)

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
  if (f.bergbeklimmer) uit.bergbeklimmer = 1
  if (f.eersteLift) uit['eerste-lift'] = 1
  if (f.ijskonijn) uit.ijskonijn = 1
  if (f.nachtuil) uit.nachtuil = 1
  return uit
}

export type TelefoonFeiten = Pick<
  Feiten,
  'vasteGast' | 'wekker' | 'highRoller' | 'blut' | 'stemvee' | 'waarzegger' | 'bergbeklimmer' | 'eersteLift' | 'ijskonijn' | 'nachtuil'
>

/** Wat de server van een ander weet → de feiten die daarbij horen */
export function feitenUitTelefoon(t: TelefoonBadges | null | undefined): TelefoonFeiten {
  const getal = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0)
  return {
    vasteGast: getal(t?.['vaste-gast']) > 0,
    wekker: getal(t?.wekker) > 0,
    highRoller: getal(t?.['high-roller']) > 0,
    blut: getal(t?.blut) > 0,
    stemvee: getal(t?.stemvee) > 0,
    waarzegger: getal(t?.waarzegger),
    bergbeklimmer: getal(t?.bergbeklimmer) > 0,
    eersteLift: getal(t?.['eerste-lift']) > 0,
    ijskonijn: getal(t?.ijskonijn) > 0,
    nachtuil: getal(t?.nachtuil) > 0,
  }
}

// ---------- Tijdens de reis ----------

/** Momenten van de reis in ms (uit config, omgerekend in badgesTelefoon.ts) */
export interface Reis {
  vertrek: number
  thuiskomst: number
  /** Begin van het echte spel; daarvoor is het testperiode (als die aan staat) */
  spelBegint: number
  testperiode: boolean
  tijdzone: string
}

const formaten = new Map<string, Intl.DateTimeFormat>()

/** Datum ('JJJJ-MM-DD') en minuten na middernacht in een tijdzone */
export function klok(moment: number, tijdzone: string): { datum: string; minuten: number } {
  let f = formaten.get(tijdzone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tijdzone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    formaten.set(tijdzone, f)
  }
  const p: Record<string, string> = {}
  for (const x of f.formatToParts(new Date(moment))) p[x.type] = x.value
  const uur = Number(p.hour) % 24
  return { datum: `${p.year}-${p.month}-${p.day}`, minuten: uur * 60 + Number(p.minute) }
}

const minutenVan = (uumm: string) => {
  const [u, m] = uumm.split(':').map(Number)
  return u * 60 + m
}

/** Tussen vertrek en thuiskomst, en niet in de testperiode */
export const opReis = (moment: number, r: Reis) =>
  moment >= r.vertrek && moment < r.thuiskomst && !(r.testperiode && moment < r.spelBegint)

/** Een skidag: na de dag van vertrek (nachtbus) en vóór de dag van thuiskomst */
export function isSkidag(datum: string, r: Reis) {
  return datum > klok(r.vertrek, r.tijdzone).datum && datum < klok(r.thuiskomst, r.tijdzone).datum
}

export function isEersteLift(moment: number, r: Reis) {
  if (!opReis(moment, r)) return false
  const { datum, minuten } = klok(moment, r.tijdzone)
  return isSkidag(datum, r) && minuten >= minutenVan(EERSTE_LIFT_VAN) && minuten < minutenVan(EERSTE_LIFT_TOT)
}

export function isNachtuil(moment: number, r: Reis) {
  if (!opReis(moment, r)) return false
  const { minuten } = klok(moment, r.tijdzone)
  return minuten >= minutenVan(NACHTUIL_VAN) && minuten < minutenVan(NACHTUIL_TOT)
}

/**
 * 🥶 IJskonijn: de temperatuur van dit uur in het weerbericht van de berg. uren: zoals in
 * weer.ts ('JJJJ-MM-DDTUU:MM' in de tijdzone van het weerbericht).
 */
export function kouAanBerg(uren: { tijd: string; temp: number }[], moment: number, tijdzone: string, grens = IJSKONIJN_GRADEN) {
  const { datum, minuten } = klok(moment, tijdzone)
  const uur = `${datum}T${String(Math.floor(minuten / 60)).padStart(2, '0')}:00`
  const nu = uren.find((u) => u.tijd === uur)
  return !!nu && typeof nu.temp === 'number' && nu.temp <= grens
}

/** Een cirkel op de kaart */
export interface Gebied {
  lat: number
  lon: number
  straalMeter: number
}

/** Ligt dit punt in het gebied? (Vlakke benadering; prima voor een paar kilometer) */
export function inGebied(lat: number, lon: number, g: Gebied) {
  const m = 111_320
  const dy = (lat - g.lat) * m
  const dx = (lon - g.lon) * m * Math.cos((g.lat * Math.PI) / 180)
  return Math.hypot(dx, dy) <= g.straalMeter
}

// ---------- Kamers ----------

/**
 * 🛌 Kamerkampioen: de kamer(s) met samen de meeste punten (bij gelijke stand allemaal).
 * totaalVan: de punten van iemand in het klassement (gewone naam).
 */
export function kamerKampioenen(kamers: { nummer: string; bewoners: string[] }[], totaalVan: (naam: string) => number): Set<string> {
  const stand = kamers
    .filter((k) => k.bewoners.some(Boolean))
    .map((k) => ({ nummer: k.nummer, punten: k.bewoners.filter(Boolean).reduce((s, n) => s + totaalVan(n), 0) }))
  const max = Math.max(0, ...stand.map((k) => k.punten))
  return new Set(max > 0 ? stand.filter((k) => k.punten === max).map((k) => k.nummer) : [])
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
 * Wat de telefoon voor 🎒 Ingepakt en 🐦 Vroege vogel naar de server stuurt. Altijd allebei, ook
 * als je (nog) niet ingepakt hebt: de rij op de server hoort bij het apparaat, en na het wisselen
 * van naam mag de stand van de vorige naam er niet blijven staan. Nooit een moment in de toekomst.
 */
export function paklijstVoorServer(ingepakt: boolean, op: number | null, nu: number): { ingepakt: boolean; ingepakt_op: string | null } {
  return {
    ingepakt,
    ingepakt_op: ingepakt && typeof op === 'number' && Number.isFinite(op) ? new Date(Math.min(op, nu)).toISOString() : null,
  }
}

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
