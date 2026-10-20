import { config } from '../config'

const TZ = config.tijdzone

const onderdelenFormaat = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function onderdelen(d: Date) {
  const p: Record<string, number> = {}
  for (const x of onderdelenFormaat.formatToParts(d)) {
    if (x.type !== 'literal') p[x.type] = Number(x.value)
  }
  if (p.hour === 24) p.hour = 0
  return p
}

/** Verschil tussen de klok in Amsterdam en UTC, in minuten */
function verschilMinuten(d: Date) {
  const p = onderdelen(d)
  const alsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((alsUtc - d.getTime()) / 60000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 'JJJJ-MM-DDTUU:MM' in Amsterdamse tijd → Date */
export function lokaalNaarDate(tekst: string): Date {
  const [datum, tijd = '00:00'] = tekst.split('T')
  const [j, m, d] = datum.split('-').map(Number)
  const [u, min] = tijd.split(':').map(Number)
  const gok = Date.UTC(j, m - 1, d, u || 0, min || 0)
  const eerste = gok - verschilMinuten(new Date(gok)) * 60000
  return new Date(gok - verschilMinuten(new Date(eerste)) * 60000)
}

/** Datum in Amsterdam als 'JJJJ-MM-DD' */
export function datumISO(d: Date): string {
  const p = onderdelen(d)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Tijd in Amsterdam als 'UU:MM' */
export function tijdUUMM(d: Date): string {
  const p = onderdelen(d)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

const labelFormaten = {
  lang: new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }),
  kort: new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }),
}

/** '2027-03-06' → 'zaterdag 6 maart' (lang) of 'za 6' (kort) */
export function datumLabel(iso: string, soort: keyof typeof labelFormaten = 'lang'): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return labelFormaten[soort].format(d).replace('.', '')
}

export function resterend(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    dagen: Math.floor(s / 86400),
    uren: Math.floor((s % 86400) / 3600),
    minuten: Math.floor((s % 3600) / 60),
    seconden: s % 60,
  }
}
