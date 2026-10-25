import { config } from '../config'
import { nu } from './nu'
import { abonneer, lees, schrijf, schrijfEnMeld } from './opslag'
import { lokaalNaarDate } from './tijd'

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

function wisAlsBegonnen() {
  if (nu() < spelBegint || lees<number | null>(TESTMOMENT, null) === null) return
  schrijfEnMeld('spel.challenges', [])
  schrijfEnMeld('spel.bingo.vinkjes', [])
  schrijf('spel.bingo.kaart', null) // nieuwe, geschudde busbingokaart
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
