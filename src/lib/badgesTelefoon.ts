import { useMemo } from 'react'
import { abonneer, lees, schrijfEnMeld, useOpgeslagen } from './opslag'
import { config } from '../config'
import {
  BERG_NAUWKEURIGHEID_M,
  CASINO_FICHES_NODIG,
  inGebied,
  isEersteLift,
  isEigenaar,
  isNachtuil,
  kouAanBerg,
  opReis,
  volgendeEigenaar,
  type BadgeId,
  type Eigenaar,
  type Reis,
} from './badgeregels'
import { isGeinstalleerd } from './installatie'
import { abonneerMeldingen, meldingStatus } from './meldingen'
import { nu } from './nu'
import { spelBegint } from './testperiode'
import { lokaalNaarDate } from './tijd'
import type { Weer } from './weer'

/*
 * Badges die alleen deze telefoon kan zien (app op het beginscherm, meldingen aan, casino, en tijdens\n * de reis: op de gletsjer, vroeg of midden in de nacht open, ijskoud op de berg).
 * Ze worden hier bewaard met het moment waarop je ze haalde, zodat ze meteen op je profiel staan,
 * ook zonder bereik. Daarna blijven ze, ook als het niet meer zo is (meldingen weer uit,
 * fiches kwijt). BadgeMelding zet ze in 'badges.telefoon', en dat gaat mee naar de server.
 *
 * Twee bakjes:
 *  - 'badges.lokaal': blijft altijd staan (beginscherm, meldingen, de reis);
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

const REIS: Reis = {
  vertrek: lokaalNaarDate(config.vertrek).getTime(),
  thuiskomst: lokaalNaarDate(config.thuiskomst).getTime(),
  spelBegint: spelBegint.getTime(),
  testperiode: config.spelTestperiode,
  tijdzone: config.tijdzone,
}

/** Is het nu (of op dit moment) de reis? Vóór vertrek staat bij deze badges "Te halen tijdens de reis". */
export const isOpReis = (moment = nu().getTime()) => opReis(moment, REIS)
export const voorVertrek = (moment = nu().getTime()) => moment < REIS.vertrek

/** Badges die horen bij het moment waarop de app open is */
function kijkNaarTijd() {
  const moment = nu().getTime()
  if (!opReis(moment, REIS)) return
  if (isEersteLift(moment, REIS)) verdien('eerste-lift')
  if (isNachtuil(moment, REIS)) verdien('nachtuil')
  const weer = lees<Weer | null>('weer.laatste', null)
  const berg = weer?.locaties?.find((l) => l.id === 'gletsjer')
  if (berg && kouAanBerg(berg.uren, moment, config.weer.tijdzone)) verdien('ijskonijn')
}

/**
 * ⛰️ Bergbeklimmer: de pistekaart geeft door waar je bent, maar alleen als je dat daar zelf
 * hebt aangezet ("Waar ben ik?" of je locatie delen). Hier wordt niet extra om gevraagd.
 */
export function kijkNaarPlek(p: { lat: number; lon: number; nauwkeurigheid?: number | null }) {
  if (!opReis(nu().getTime(), REIS) || !eigenaarGekozen()) return
  if ((p.nauwkeurigheid ?? 0) > BERG_NAUWKEURIGHEID_M) return
  if (inGebied(p.lat, p.lon, config.badges.gletsjer)) verdien('bergbeklimmer')
}

/** Zie volgendeEigenaar in badgeregels.ts */
export const EIGENAAR = 'apparaat.eigenaar'

/** Bijwerken wie de eigenaar is; geeft true als de gekozen naam de eigenaar is */
function eigenaarGekozen(): boolean {
  const naam = lees<string | null>('naam', null)
  const oud = lees<Eigenaar | null>(EIGENAAR, null)
  const nieuw = volgendeEigenaar(oud, naam, Date.now())
  if (JSON.stringify(nieuw) !== JSON.stringify(oud)) schrijfEnMeld(EIGENAAR, nieuw)
  return isEigenaar(nieuw, naam)
}

function kijk() {
  // Badges die de telefoon zelf ziet alleen voor de eigenaar, anders krijgt elke naam die je
  // hier even kiest ze ook
  if (!eigenaarGekozen()) return kijkNaarSpel()
  kijkNaarTijd()
  if (isGeinstalleerd()) verdien('vaste-gast')
  if (meldingStatus() === 'aan') verdien('wekker')
  kijkNaarSpel()
}

/** Casino en paklijst horen bij de naam (persoonsdata): die gelden voor elke naam */
function kijkNaarSpel() {
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
  abonneer('naam', kijk)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kijk()
  })
  window.setInterval(kijk, 60_000)
}
