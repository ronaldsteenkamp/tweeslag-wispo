// Bepaalt welke automatische meldingen nu aan de beurt zijn. Geen Deno- of netwerkcode,
// zodat het ook los te testen is.

export interface Melding {
  /** Uniek per melding; voorkomt dat hij twee keer gaat */
  sleutel: string
  soort: 'planning' | 'challenges' | 'uitslag'
  titel: string
  tekst: string
  /** Scherm in de app, bijv. '#planning' */
  url: string
}

interface PlanningItem {
  tijd?: string
  titel?: string
  omschrijving?: string
  locatie?: string
  melding?: boolean
}
interface Planning {
  dagen?: { datum?: string; items?: PlanningItem[] }[]
}
interface Spel {
  challenges?: { datum?: string; openOm?: string; items?: unknown[] }[]
}
export interface GeslotenStemming {
  id: string
  vraag: string
  sluit: string
  uitslag: { kandidaat: string; stemmen: number }[]
}

const TZ = 'Europe/Amsterdam'
const MINUUT = 60_000
/** Zoals challengesOpenOm in src/config.ts */
const CHALLENGES_OPEN_OM = '07:00'
/** Hoe lang na het moment een gemiste melding nog mag (bijv. als de planner even niet liep) */
const CHALLENGES_VENSTER = 3 * 60 * MINUUT
const UITSLAG_VENSTER = 3 * 60 * MINUUT

const formaat = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function verschilMinuten(d: Date) {
  const p: Record<string, number> = {}
  for (const x of formaat.formatToParts(d)) if (x.type !== 'literal') p[x.type] = Number(x.value)
  if (p.hour === 24) p.hour = 0
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - d.getTime()) / MINUUT)
}

/** 'JJJJ-MM-DDTUU:MM' in Nederlandse tijd → tijdstip in ms (zelfde als src/lib/tijd.ts) */
export function lokaal(tekst: string): number {
  const [datum, tijd = '00:00'] = tekst.split('T')
  const [j, m, d] = datum.split('-').map(Number)
  const [u, min] = tijd.split(':').map(Number)
  const gok = Date.UTC(j, m - 1, d, u || 0, min || 0)
  const eerste = gok - verschilMinuten(new Date(gok)) * MINUUT
  return gok - verschilMinuten(new Date(eerste)) * MINUUT
}

const geldig = (t: number) => Number.isFinite(t)

/** 30 minuten voor elk planningsitem met "melding": true, tot het item begint */
export function planningMeldingen(nu: number, planning: Planning): Melding[] {
  const uit: Melding[] = []
  for (const dag of planning.dagen ?? []) {
    if (!dag.datum) continue
    for (const item of dag.items ?? []) {
      if (item.melding !== true || !item.tijd || !item.titel) continue
      const start = lokaal(`${dag.datum}T${item.tijd}`)
      if (!geldig(start) || nu < start - 30 * MINUUT || nu >= start) continue
      const nog = Math.max(1, Math.round((start - nu) / MINUUT))
      uit.push({
        sleutel: `planning:${dag.datum}:${item.tijd}:${item.titel}`,
        soort: 'planning',
        titel: `Over ${nog} minuten: ${item.titel}`,
        tekst: [item.tijd, item.locatie, item.omschrijving].filter(Boolean).join(' · ').slice(0, 180),
        url: '#planning',
      })
    }
  }
  return uit
}

/** Zodra de challenges van een dag opengaan */
export function challengeMeldingen(nu: number, spel: Spel): Melding[] {
  const uit: Melding[] = []
  for (const dag of spel.challenges ?? []) {
    const aantal = dag.items?.length ?? 0
    if (!dag.datum || aantal === 0) continue
    const open = lokaal(`${dag.datum}T${dag.openOm ?? CHALLENGES_OPEN_OM}`)
    if (!geldig(open) || nu < open || nu >= open + CHALLENGES_VENSTER) continue
    uit.push({
      sleutel: `challenges:${dag.datum}`,
      soort: 'challenges',
      titel: '❄️ Nieuwe challenges!',
      tekst: `${aantal} nieuwe challenge${aantal === 1 ? '' : 's'} voor vandaag. Wie pakt de punten?`,
      url: '#spel',
    })
  }
  return uit
}

/** Na de sluitingstijd: de winnaar(s). Stemmingen die tegelijk sluiten gaan in één melding. */
export function uitslagMeldingen(nu: number, stemmingen: GeslotenStemming[]): Melding[] {
  const groepen = new Map<string, GeslotenStemming[]>()
  for (const s of stemmingen) {
    const sluit = Date.parse(s.sluit)
    if (!geldig(sluit) || nu < sluit || nu >= sluit + UITSLAG_VENSTER) continue
    const sleutel = new Date(sluit).toISOString().slice(0, 16)
    groepen.set(sleutel, [...(groepen.get(sleutel) ?? []), s])
  }
  const uit: Melding[] = []
  for (const groep of groepen.values()) {
    groep.sort((a, b) => a.id.localeCompare(b.id))
    const regels = groep.map((s) => {
      const max = Math.max(0, ...s.uitslag.map((u) => u.stemmen))
      const top = max > 0 ? s.uitslag.filter((u) => u.stemmen === max).map((u) => u.kandidaat) : []
      return `${s.vraag}: ${top.length ? top.join(' & ') : 'niemand gestemd'}`
    })
    uit.push({
      sleutel: `uitslag:${groep.map((s) => s.id).join('+')}`,
      soort: 'uitslag',
      titel: groep.length === 1 ? '🏆 De uitslag is bekend!' : '🏆 De uitslagen zijn bekend!',
      tekst: regels.join('\n').slice(0, 300),
      url: '#stemmen',
    })
  }
  return uit
}

export function teVersturen(nu: number, planning: Planning, spel: Spel, stemmingen: GeslotenStemming[]): Melding[] {
  return [...planningMeldingen(nu, planning), ...challengeMeldingen(nu, spel), ...uitslagMeldingen(nu, stemmingen)]
}
