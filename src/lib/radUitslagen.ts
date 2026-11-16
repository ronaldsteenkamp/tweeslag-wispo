import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { lees, schrijf } from './opslag'

/*
 * Wie het klos-rad koos, voor de badge 🎡 Lot uit de loterij. Het rad draait op de telefoon (ook
 * zonder bereik), dus de uitslag gaat eerst in een wachtrij en daarna naar de tabel rad_uitslagen
 * (migratie 0012). Zo telt hij voor iedereen hetzelfde, niet alleen op de telefoon die draaide.
 */

const TE_VERSTUREN = 'rad.teVersturen'
/** Meer bewaren we niet (bijv. als de migratie nog niet gedraaid is) */
const MAX_WACHTRIJ = 50

interface Wachtend {
  naam: string
  gedraaid: number
}

let bezig = false

async function verstuur() {
  const b = backendStand()
  const cb = supabase()
  const rij = lees<Wachtend[]>(TE_VERSTUREN, [])
  if (bezig || !cb || !rij.length || b.status !== 'verbonden' || !b.gekoppeld) return
  bezig = true
  try {
    const c = await cb
    const { error } = await c
      .from('rad_uitslagen')
      .insert(rij.map((r) => ({ naam: r.naam, gedraaid: new Date(r.gedraaid).toISOString() })))
    // Alleen de verstuurde eruit: er kan intussen een nieuwe bij zijn gekomen
    if (!error) schrijf(TE_VERSTUREN, lees<Wachtend[]>(TE_VERSTUREN, []).slice(rij.length))
  } catch {
    // Volgende keer opnieuw
  } finally {
    bezig = false
  }
}

/** Na een draai van het klos-rad */
export function meldKlos(naam: string) {
  if (!backendIngesteld) return
  schrijf(TE_VERSTUREN, [...lees<Wachtend[]>(TE_VERSTUREN, []), { naam, gedraaid: Date.now() }].slice(-MAX_WACHTRIJ))
  void verstuur()
}

let gestart = false

/** Eén keer bij het starten: wat er nog in de wachtrij staat versturen zodra het kan */
export function startRadUitslagen() {
  if (gestart || !backendIngesteld) return
  gestart = true
  abonneerBackend(() => void verstuur())
}
