// Tests voor het uitlezen van het lawinebulletin (lib/lawinebulletin.ts): `npm test`
// Voorbeeld: het echte bulletin voor Oisans van 10 maart 2026 (Météo-France, Licence Ouverte, via data.gouv.fr)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leesBulletin } from '../src/lib/lawinebulletin.ts'

const xml = readFileSync(new URL('./voorbeelden/bera-oisans-2026-03-10.xml', import.meta.url), 'utf8')

test('bulletin Oisans: niveaus, grens, tijden', () => {
  const b = leesBulletin(xml)
  assert.ok(b)
  assert.equal(b.massif, 'Oisans')
  assert.equal(b.uitgegeven, '2026-03-10T15:00')
  assert.equal(b.geldigTot, '2026-03-11T18:00')
  assert.equal(b.grens, 2400)
  assert.equal(b.onder, 1)
  assert.equal(b.boven, 2)
  assert.equal(b.onderLater, null)
  assert.equal(b.max, 2)
  assert.equal(b.morgen, 2)
  assert.match(b.commentaar, /Au-dessus de 2400m/)
})

test('bulletin Oisans: hellingen en samenvatting', () => {
  const b = leesBulletin(xml)
  assert.deepEqual(b.hellingen, ['N', 'NO', 'NW'])
  assert.match(b.samenvatting, /^Départs spontanés/)
  assert.ok(!b.samenvatting.includes('CDATA'))
})

test('één niveau voor de hele berg (geen hoogtegrens)', () => {
  const een = xml.replace(/<RISQUE [^>]*\/>/, '<RISQUE RISQUE1="3" EVOLURISQUE1="4" LOC1="" ALTITUDE="" RISQUE2="" EVOLURISQUE2="" LOC2="" RISQUEMAXI="4" COMMENTAIRE="" RISQUEMAXIJ2="3"/>')
  const b = leesBulletin(een)
  assert.equal(b.grens, null)
  assert.equal(b.onder, 3)
  assert.equal(b.boven, null)
  assert.equal(b.onderLater, 4)
})

test('oude Franse letters voor west', () => {
  const oud = xml.replace(/<PENTE [^>]*\/>/, '<PENTE N="false" NE="false" E="false" SE="false" S="false" SO="true" O="true" NO="false"/>')
  assert.deepEqual(leesBulletin(oud).hellingen, ['ZW', 'W'])
})

test('geen bulletin', () => {
  assert.equal(leesBulletin('<html>niet gevonden</html>'), null)
})
