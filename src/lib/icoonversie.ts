import { bewaard, schrijf } from './opslag'

/*
 * Welk app-icoon staat er op het beginscherm? Android werkt het icoon zelf bij (zie ICOON_VERSIE in
 * vite.config.ts), maar een iPhone bewaart het icoon van het moment dat Wispo op het beginscherm
 * werd gezet. De app kan het icoon zelf niet zien, dus we onthouden bij de eerste start met deze
 * code of de app al eerder gebruikt was (dan staat er het oude icoon) of net nieuw is.
 *
 * Nieuw icoon: ICOON hieronder én ICOON_VERSIE in vite.config.ts ophogen. Alleen een kleine
 * aanpassing (bijv. het logo iets groter): alleen ICOON_VERSIE, zodat iPhones geen nieuwe melding krijgen.
 */
export const ICOON = 'c3'
export const ICOON_SLEUTEL = 'icoon.versie'
/** Waarde als iemand de melding wegklikt */
export const ICOON_GENEGEERD = 'genegeerd'

/** Eén keer bij het starten, vóór het welkomstscherm iets bewaart */
export function bepaalIcoonVersie() {
  if (bewaard(ICOON_SLEUTEL)) return
  // Al eerder gebruikt (naam of welkomstscherm gehad): deze app staat er al van vóór het nieuwe icoon
  const eerderGebruikt = bewaard('naam') || bewaard('welkom.gehad')
  schrijf(ICOON_SLEUTEL, eerderGebruikt ? 'oud' : ICOON)
}
