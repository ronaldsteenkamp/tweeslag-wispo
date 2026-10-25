import { config } from '../config'
import type { Stemming } from './data'
import { nu } from './nu'
import { abonneer, lees, schrijf, schrijfEnMeld } from './opslag'
import { datumISO, lokaalNaarDate } from './tijd'

/*
 * Testperiode: met config.spelTestperiode staat het spel al open vóór config.spelOpen.
 * Wat iemand in die tijd doet (challenges, busbingo, casino) is om te oefenen: zodra het echte
 * spel begint wordt het op de telefoon gewist, en daarmee ook de punten in het klassement
 * (de telefoon stuurt dan meteen een lege stand).
 *
 * Alleen wat deze versie van de app vóór de start zag gebeuren wordt gewist ('spel.testmoment'),
 * zodat een telefoon die pas tijdens de reis bijwerkt nooit echte voortgang kwijtraakt.
 */

const TESTMOMENT = 'spel.testmoment'
const TESTSLEUTELS = ['spel.challenges', 'spel.bingo.vinkjes', 'casino.fiches', 'casino.geleend']

export const spelBegint = lokaalNaarDate(config.spelOpen)
export const isTestperiode = (moment = nu()) => config.spelTestperiode && moment < spelBegint

// ---------- Teststemmingen ----------
// De echte stemmingen beginnen pas op de reis. In de testperiode is er elke dag een teststemming
// (00:00 tot 23:59), zodat je kunt stemmen en de dag erna de uitslag ziet. Ze hebben een id die
// met 'test-' begint; een beheerder zet ze vanzelf op de server (zie stemming.ts) en ruimt ze
// daar weer op, en vanaf de start laat de app ze niet meer zien.

export const isTestStemming = (id: string) => id.startsWith('test-')

const TESTVRAGEN = [
  '🧪 Test: mooiste skipak',
  '🧪 Test: wie valt het vaakst?',
  '🧪 Test: beste après-ski-danser',
  '🧪 Test: wie is er altijd te laat?',
  '🧪 Test: grootste snoepkoning(in)',
]

/** Teststemmingen van gisteren tot over een week (alleen dagen vóór de start) */
export function testStemmingen(moment = nu()): Stemming[] {
  if (!config.testStemmingen || !isTestperiode(moment)) return []
  const dag = 24 * 60 * 60 * 1000
  const eersteEchteDag = config.spelOpen.slice(0, 10)
  const uit: Stemming[] = []
  for (let i = -1; i <= 6; i++) {
    const datum = datumISO(new Date(moment.getTime() + i * dag))
    if (datum >= eersteEchteDag) break
    const dagnummer = Math.floor(lokaalNaarDate(datum).getTime() / dag)
    uit.push({
      id: `test-${datum}`,
      datum,
      vraag: TESTVRAGEN[((dagnummer % TESTVRAGEN.length) + TESTVRAGEN.length) % TESTVRAGEN.length],
      open: `${datum}T00:00`,
      sluit: `${datum}T23:59`,
    })
  }
  return uit
}

function wisAlsBegonnen() {
  if (nu() < spelBegint || lees<number | null>(TESTMOMENT, null) === null) return
  schrijfEnMeld('spel.challenges', [])
  schrijfEnMeld('spel.bingo.vinkjes', [])
  schrijfEnMeld('spel.bingo.kaart', null) // nieuwe, geschudde busbingokaart (ook op een open scherm)
  schrijfEnMeld('casino.fiches', 1000)
  schrijfEnMeld('casino.geleend', 0)
  schrijf(TESTMOMENT, null)
}

let gestart = false

/** Eén keer bij het starten van de app */
export function startTestperiode() {
  if (gestart) return
  gestart = true
  wisAlsBegonnen()
  for (const sleutel of TESTSLEUTELS) {
    abonneer(sleutel, () => {
      if (nu() < spelBegint) schrijf(TESTMOMENT, Date.now())
    })
  }
  // De app kan openstaan als het spel begint (in de bus om 18:00)
  window.setInterval(wisAlsBegonnen, 30_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wisAlsBegonnen()
  })
}
