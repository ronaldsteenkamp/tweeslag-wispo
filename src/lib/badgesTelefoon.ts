import { useMemo } from 'react'
import { abonneer, lees, schrijfEnMeld, useOpgeslagen } from './opslag'
import { CASINO_FICHES_NODIG, type BadgeId } from './badgeregels'
import { isGeinstalleerd } from './installatie'
import { abonneerMeldingen, meldingStatus } from './meldingen'

/*
 * Badges die alleen deze telefoon kan zien (app op het beginscherm, meldingen aan, casino).
 * Ze worden hier bewaard met het moment waarop je ze haalde, zodat ze meteen op je profiel staan,
 * ook zonder bereik. Daarna blijven ze, ook als het niet meer zo is (meldingen weer uit,
 * fiches kwijt). BadgeMelding zet ze in 'badges.telefoon', en dat gaat mee naar de server.
 *
 * Twee bakjes:
 *  - 'badges.lokaal': blijft altijd staan (beginscherm, meldingen);
 *  - 'badges.spel': hoort bij het spel (casino) en wordt net als de fiches gewist als het echte
 *    spel begint (zie testperiode.ts).
 */

export type Verdiend = Partial<Record<BadgeId, number>>

const LOKAAL = 'badges.lokaal'
export const SPEL_BADGES = 'badges.spel'

/** Badge halen (als je hem nog niet had), met het moment erbij */
export function verdien(id: BadgeId, bakje: 'lokaal' | 'spel' = 'lokaal', moment = Date.now()) {
  const sleutel = bakje === 'spel' ? SPEL_BADGES : LOKAAL
  const nu = lees<Verdiend>(sleutel, {})
  if (nu[id]) return
  schrijfEnMeld<Verdiend>(sleutel, { ...nu, [id]: moment })
}

/** Alles wat deze telefoon zelf verdiend heeft */
export function useVerdiend(): Verdiend {
  const [lokaal] = useOpgeslagen<Verdiend>(LOKAAL, {})
  const [spel] = useOpgeslagen<Verdiend>(SPEL_BADGES, {})
  return useMemo(() => ({ ...lokaal, ...spel }), [lokaal, spel])
}

function kijk() {
  if (isGeinstalleerd()) verdien('vaste-gast')
  if (meldingStatus() === 'aan') verdien('wekker')
  if (lees('casino.fiches', 0) >= CASINO_FICHES_NODIG) verdien('high-roller', 'spel')
  if (lees('casino.geleend', 0) > 0) verdien('blut', 'spel')
  // Al ingepakt vóór deze versie van de app: dan is het moment onbekend, nu dus
  if (lees('paklijst.ingepakt', false) && lees<number | null>('paklijst.ingepaktOp', null) === null) {
    schrijfEnMeld('paklijst.ingepaktOp', Date.now())
  }
}

let gestart = false

/** Eén keer bij het starten van de app */
export function startBadges() {
  if (gestart) return
  gestart = true
  kijk()
  abonneerMeldingen(kijk)
  abonneer('casino.fiches', kijk)
  abonneer('casino.geleend', kijk)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kijk()
  })
  window.setInterval(kijk, 60_000)
}
