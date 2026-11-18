// Tests voor het samenvoegen van persoonsdata: `npm test` (Node 22.18 of nieuwer, leest TypeScript zelf)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PERSOONLIJK, unie, voegAllesSamen, voegSamen } from '../src/lib/persoonsdataregels.ts'

const v = (waarde, bijgewerkt) => ({ waarde, bijgewerkt })
const NU = Date.parse('2027-02-01T12:00:00Z')
const opties = { nu: NU, spelBegint: null }

// ---------- Optellen (unie) ----------

test('lijsten worden bij elkaar opgeteld, zonder dubbele', () => {
  const uit = voegSamen('unie', v(['a', 'b'], 5), v(['b', 'c'], 9))
  assert.deepEqual(uit, v(['a', 'b', 'c'], 9))
})

test('eigen paklijstitems tellen op id', () => {
  const uit = unie([{ id: 'x', naam: 'Muts' }], [{ id: 'x', naam: 'Muts' }, { id: 'y', naam: 'Sjaal' }])
  assert.deepEqual(uit, [
    { id: 'x', naam: 'Muts' },
    { id: 'y', naam: 'Sjaal' },
  ])
})

test('behaalde badges: alle badges van beide kanten, met het vroegste moment', () => {
  const uit = unie({ wekker: 300, 'vaste-gast': 100 }, { wekker: 200, nachtuil: 400 })
  assert.deepEqual(uit, { wekker: 200, 'vaste-gast': 100, nachtuil: 400 })
})

test('badges.gezien: id\'s opgeteld, hoogste versie', () => {
  const uit = unie({ naam: 'Tom', ids: ['a'], versie: 1 }, { naam: 'Tom', ids: ['b'], versie: 2 })
  assert.deepEqual(uit, { naam: 'Tom', ids: ['a', 'b'], versie: 2 })
})

test('optellen werkt ook als de lokale kant nog geen moment heeft', () => {
  assert.deepEqual(voegSamen('unie', v(['nieuw'], 0), v(['oud'], 50)).waarde, ['nieuw', 'oud'])
})

// ---------- Vroegste tijdstip ----------

test('ingepaktOp: het vroegste moment blijft', () => {
  assert.equal(voegSamen('vroegste', v(2000, 2000), v(1000, 1000)).waarde, 1000)
  assert.equal(voegSamen('vroegste', v(1000, 1000), v(2000, 2000)).waarde, 1000)
  // Ook een lokaal moment van vóór het ophalen telt
  assert.equal(voegSamen('vroegste', v(500, 0), v(1000, 1000)).waarde, 500)
})

// ---------- Nieuwste wint ----------

test('nieuwste bijgewerkt wint', () => {
  assert.equal(voegSamen('nieuwste', v(1500, 20), v(800, 10)).waarde, 1500)
  assert.equal(voegSamen('nieuwste', v(1500, 10), v(800, 20)).waarde, 800)
})

test('een lokale waarde zonder moment (van vóór het ophalen) wint nooit van de server', () => {
  assert.equal(voegSamen('nieuwste', v(1000, 0), v(4200, 10)).waarde, 4200)
})

test('alleen lokaal of alleen op de server: die waarde', () => {
  assert.deepEqual(voegSamen('nieuwste', v(1, 0), null), v(1, 0))
  assert.deepEqual(voegSamen('nieuwste', null, v(2, 5)), v(2, 5))
  assert.equal(voegSamen('nieuwste', null, null), null)
})

test('bingokaart: de kaart die er het eerst was blijft', () => {
  assert.deepEqual(voegSamen('eerste', v(['a'], 0), v(['b'], 10)).waarde, ['b'])
  assert.deepEqual(voegSamen('eerste', v(['a'], 5), v(['b'], 10)).waarde, ['a'])
  assert.deepEqual(voegSamen('eerste', v(['a'], 5), v(null, 1)).waarde, ['a'])
})

// ---------- Alles samen ----------

const serverStand = {
  'paklijst.vinkjes': v(['muts', 'sjaal'], 100),
  'paklijst.ingepakt': v(true, 120),
  'paklijst.ingepaktOp': v(120, 120),
  'spel.challenges': v(['c1', 'c2'], 200),
  'spel.bingo.kaart': v(['k1', 'k2', 'k3'], 50),
  'spel.bingo.vinkjes': v(['k2'], 210),
  'casino.fiches': v(4200, 300),
  'casino.reset': v('2026-11-12', 40),
  'badges.lokaal': v({ wekker: 90 }, 90),
  'fotos.gezien': v(['f1'], 95),
}

test('nieuwe telefoon met lege stand overschrijft niets', () => {
  // Wat een nieuwe telefoon vanzelf schrijft vóór het ophalen: casino-reset, een net geschudde
  // bingokaart, lege lijsten. Allemaal met moment 0.
  const nieuw = {
    'casino.fiches': v(1000, 0),
    'casino.reset': v('2026-11-12', 0),
    'casino.inzet': v({}, 0),
    'spel.bingo.kaart': v(['k9', 'k8', 'k7'], 0),
    'spel.challenges': v([], 0),
    'spel.bingo.vinkjes': v([], 0),
    'badges.gezien': v({ naam: 'Tom', ids: [], versie: 2 }, 0),
  }
  const { stand, teVersturen } = voegAllesSamen(nieuw, serverStand, opties)
  for (const [sleutel, s] of Object.entries(serverStand)) {
    assert.deepEqual(stand[sleutel].waarde, s.waarde, `${sleutel} moet de waarde van de server houden`)
  }
  // Wat de server al had wordt niet opnieuw (of leeg) verstuurd; alleen wat er nog niet was
  for (const sleutel of teVersturen) assert.ok(!(sleutel in serverStand), `${sleutel} mag niet over de server heen`)
  assert.deepEqual(teVersturen.sort(), ['badges.gezien', 'casino.inzet'])
})

test('nieuwe telefoon zonder enige lokale stand: precies de server, niets te versturen', () => {
  const { stand, teVersturen } = voegAllesSamen({}, serverStand, opties)
  assert.deepEqual(Object.fromEntries(Object.entries(stand).map(([k, x]) => [k, x.waarde])), Object.fromEntries(Object.entries(serverStand).map(([k, x]) => [k, x.waarde])))
  assert.deepEqual(teVersturen, [])
})

test('bestaande gebruiker, lege server: alles gaat naar de server, met een moment', () => {
  const lokaal = { 'paklijst.vinkjes': v(['muts'], 0), 'casino.fiches': v(2500, 0) }
  const { stand, teVersturen } = voegAllesSamen(lokaal, {}, opties)
  assert.deepEqual(teVersturen.sort(), ['casino.fiches', 'paklijst.vinkjes'])
  assert.equal(stand['casino.fiches'].bijgewerkt, NU)
})

test('offline aangevinkt op een nieuwe telefoon: opgeteld en verstuurd', () => {
  const { stand, teVersturen } = voegAllesSamen({ 'paklijst.vinkjes': v(['skibril'], 0) }, serverStand, opties)
  assert.deepEqual(stand['paklijst.vinkjes'].waarde, ['skibril', 'muts', 'sjaal'])
  assert.deepEqual(teVersturen, ['paklijst.vinkjes'])
})

test('na de start van het spel telt oefendata van de server niet meer', () => {
  const spelBegint = 1000
  const server = { 'spel.challenges': v(['oefen'], 500), 'paklijst.vinkjes': v(['muts'], 500) }
  const { stand } = voegAllesSamen({}, server, { nu: 2000, spelBegint })
  assert.equal(stand['spel.challenges'], undefined)
  assert.deepEqual(stand['paklijst.vinkjes'].waarde, ['muts'])
  // Vóór de start telt het wel
  assert.deepEqual(voegAllesSamen({}, server, { nu: 900, spelBegint }).stand['spel.challenges'].waarde, ['oefen'])
})

test('alleen bekende sleutels, en apparaatinstellingen blijven lokaal', () => {
  for (const s of ['rad.geluid', 'weer.plek', 'installatie.verborgen', 'welkom.gehad', 'meldingen.sleutel', 'rad.soort', 'naam']) {
    assert.ok(!(s in PERSOONLIJK), s)
  }
  const { stand } = voegAllesSamen({}, { 'rad.geluid': v(true, 1) }, opties)
  assert.deepEqual(stand, {})
})
