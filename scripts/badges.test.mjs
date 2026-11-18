// Tests voor de regels van de badges: `npm test` (Node 22.18 of nieuwer, leest TypeScript zelf)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BADGES,
  CASINO_FICHES_NODIG,
  RAD_NODIG,
  WAARZEGGER_NODIG,
  badgesUit,
  eigenStemmen,
  feitenUitTelefoon,
  geenFeiten,
  inGebied,
  isEersteLift,
  isNachtuil,
  kamerKampioenen,
  klok,
  kouAanBerg,
  opReis,
  radTelling,
  telefoonUitFeiten,
  vroegsteVogels,
  winnaarsVan,
} from '../src/lib/badgeregels.ts'

// In maart is het in Amsterdam UTC+1 (zomertijd begint pas eind maart)
const ams = (j, m, d, u, min = 0) => Date.UTC(j, m - 1, d, u - 1, min)

/** Zoals in config.ts: vertrek 5 maart 19:30, thuis 14 maart 12:00, spel open 5 maart 18:00 */
const REIS = {
  vertrek: ams(2027, 3, 5, 19, 30),
  thuiskomst: ams(2027, 3, 14, 12),
  spelBegint: ams(2027, 3, 5, 18),
  testperiode: true,
  tijdzone: 'Europe/Amsterdam',
}

const ids = (f, leiders = { fotos: 0, totaal: 0 }) => badgesUit({ ...geenFeiten, ...f }, leiders).map((b) => b.id)

// ---------- badgesUit ----------

test('zonder feiten geen badges', () => {
  assert.deepEqual(ids({}), [])
})

test('de nieuwe badges uit de feiten, in de volgorde van BADGES', () => {
  const uit = ids({
    bijnaam: true,
    vasteGast: true,
    wekker: true,
    vroegeVogel: true,
    stemvee: true,
    highRoller: true,
    radGekozen: RAD_NODIG,
    bergbeklimmer: true,
    eersteLift: true,
    ijskonijn: true,
    kamerkampioen: true,
    blut: true,
    nachtuil: true,
  })
  assert.deepEqual(uit, [
    'bijnaam',
    'vaste-gast',
    'wekker',
    'vroege-vogel',
    'stemvee',
    'high-roller',
    'lot',
    'bergbeklimmer',
    'eerste-lift',
    'ijskonijn',
    'kamerkampioen',
    'blut',
    'nachtuil',
  ])
  const volgorde = BADGES.map((b) => b.id)
  assert.deepEqual(uit, [...uit].sort((a, b) => volgorde.indexOf(a) - volgorde.indexOf(b)))
})

test('de lachbadges staan achteraan', () => {
  assert.deepEqual(BADGES.slice(-2).map((b) => b.id), ['blut', 'nachtuil'])
})

test('elke badge heeft een unieke id, emoji, naam, uitleg en nogTeDoen', () => {
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length)
  for (const b of BADGES) {
    assert.ok(b.emoji && b.naam && b.uitleg, b.id)
    assert.equal(typeof b.nogTeDoen(geenFeiten), 'string', b.id)
  }
})

test('drempels: Waarzegger en Lot pas vanaf het benodigde aantal; Waarzegger met ×N', () => {
  assert.ok(!ids({ waarzegger: WAARZEGGER_NODIG - 1 }).includes('waarzegger'))
  const w = badgesUit({ ...geenFeiten, waarzegger: WAARZEGGER_NODIG + 2 }, { fotos: 0, totaal: 0 })
  assert.deepEqual(w, [{ id: 'waarzegger', aantal: WAARZEGGER_NODIG + 2 }])
  assert.ok(!ids({ radGekozen: RAD_NODIG - 1 }).includes('lot'))
  assert.ok(ids({ radGekozen: RAD_NODIG }).includes('lot'))
})

test('nogTeDoen laat je eigen voortgang zien', () => {
  const def = (id) => BADGES.find((b) => b.id === id)
  assert.match(def('stemvee').nogTeDoen({ ...geenFeiten, stemmingenGemist: 2 }), /2 stemmingen gemist/)
  assert.match(def('stemvee').nogTeDoen({ ...geenFeiten, stemmingenGemist: 1 }), /1 stemming gemist/)
  assert.match(def('waarzegger').nogTeDoen({ ...geenFeiten, waarzegger: 1 }), /nu 1\)/)
  assert.match(def('high-roller').nogTeDoen({ ...geenFeiten, casinoFiches: 1250 }), /1\.250/)
  assert.match(def('high-roller').nogTeDoen(geenFeiten), new RegExp(CASINO_FICHES_NODIG.toLocaleString('nl-NL').replace('.', '\\.')))
})

// ---------- Telefoon ↔ server ----------

test('wat de telefoon meestuurt komt bij een ander weer als dezelfde badges terug', () => {
  const f = { ...geenFeiten, vasteGast: true, blut: true, waarzegger: 4, eersteLift: true, nachtuil: true }
  const terug = { ...geenFeiten, ...feitenUitTelefoon(JSON.parse(JSON.stringify(telefoonUitFeiten(f)))) }
  assert.deepEqual(ids(terug), ids(f))
})

test('rommel van de server geeft geen badges', () => {
  assert.deepEqual(ids(feitenUitTelefoon(null)), [])
  assert.deepEqual(ids(feitenUitTelefoon({ 'vaste-gast': 'ja', wekker: -1, waarzegger: Number.NaN })), [])
})

// ---------- Tijdvensters ----------

test('klok rekent in Amsterdamse tijd', () => {
  assert.deepEqual(klok(ams(2027, 3, 8, 7, 30), 'Europe/Amsterdam'), { datum: '2027-03-08', minuten: 7 * 60 + 30 })
  assert.deepEqual(klok(ams(2027, 3, 9, 0, 15), 'Europe/Amsterdam'), { datum: '2027-03-09', minuten: 15 })
})

test('alleen tijdens de reis: tussen vertrek en thuiskomst', () => {
  assert.equal(opReis(ams(2027, 3, 5, 19, 29), REIS), false)
  assert.equal(opReis(ams(2027, 3, 5, 19, 30), REIS), true)
  assert.equal(opReis(ams(2027, 3, 14, 11, 59), REIS), true)
  assert.equal(opReis(ams(2027, 3, 14, 12), REIS), false)
  assert.equal(opReis(ams(2026, 12, 1, 8), REIS), false)
})

test('nooit in de testperiode, ook niet als die tot na vertrek zou duren', () => {
  const laat = { ...REIS, spelBegint: ams(2027, 3, 7, 0) }
  assert.equal(opReis(ams(2027, 3, 6, 8), laat), false)
  assert.equal(opReis(ams(2027, 3, 6, 8), { ...laat, testperiode: false }), true)
})

test('Eerste lift: vóór 09:00 op een skidag', () => {
  assert.equal(isEersteLift(ams(2027, 3, 8, 7, 30), REIS), true)
  assert.equal(isEersteLift(ams(2027, 3, 6, 8, 59), REIS), true) // eerste skidag
  assert.equal(isEersteLift(ams(2027, 3, 13, 5), REIS), true) // laatste skidag
  assert.equal(isEersteLift(ams(2027, 3, 8, 9), REIS), false)
  assert.equal(isEersteLift(ams(2027, 3, 8, 4, 59), REIS), false) // dat is nog nacht
  assert.equal(isEersteLift(ams(2027, 3, 14, 8), REIS), false) // dag van thuiskomst
  assert.equal(isEersteLift(ams(2027, 2, 8, 7), REIS), false) // vóór de reis
})

test('Nachtuil: tussen 02:00 en 05:00, ook in de bus', () => {
  assert.equal(isNachtuil(ams(2027, 3, 9, 3), REIS), true)
  assert.equal(isNachtuil(ams(2027, 3, 6, 2), REIS), true) // nachtbus
  assert.equal(isNachtuil(ams(2027, 3, 9, 1, 59), REIS), false)
  assert.equal(isNachtuil(ams(2027, 3, 9, 5), REIS), false)
  assert.equal(isNachtuil(ams(2027, 3, 1, 3), REIS), false) // vóór de reis
})

test('IJskonijn: de temperatuur van dit uur op de berg', () => {
  const uren = [
    { tijd: '2027-03-08T07:00', temp: -12 },
    { tijd: '2027-03-08T08:00', temp: -9.5 },
  ]
  assert.equal(kouAanBerg(uren, ams(2027, 3, 8, 7, 45), 'Europe/Paris'), true)
  assert.equal(kouAanBerg(uren, ams(2027, 3, 8, 8, 10), 'Europe/Paris'), false)
  assert.equal(kouAanBerg(uren, ams(2027, 3, 8, 9), 'Europe/Paris'), false) // geen gegevens
  assert.equal(kouAanBerg([{ tijd: '2027-03-08T08:00', temp: -10 }], ams(2027, 3, 8, 8), 'Europe/Paris'), true)
})

test('Bergbeklimmer: binnen de cirkel van de gletsjer', () => {
  const gletsjer = { lat: 44.9975, lon: 6.215, straalMeter: 1300 }
  assert.equal(inGebied(44.9966, 6.2047, gletsjer), true) // Jandri 3200
  assert.equal(inGebied(44.9973, 6.2246, gletsjer), true) // Puy Salié 3400
  assert.equal(inGebied(44.9976, 6.1721, gletsjer), false) // Jandri 2600
  assert.equal(inGebied(45.0098, 6.1265, gletsjer), false) // dorp
})

// ---------- Kamerkampioen ----------

test('Kamerkampioen: de kamer met samen de meeste punten', () => {
  const kamers = [
    { nummer: '101', bewoners: ['Anna', 'Bas'] },
    { nummer: '102', bewoners: ['Cas', 'Dirk', ''] },
  ]
  const punten = { Anna: 10, Bas: 30, Cas: 20, Dirk: 15 }
  assert.deepEqual([...kamerKampioenen(kamers, (n) => punten[n] ?? 0)], ['101'])
})

test('Kamerkampioen: bij gelijke stand krijgen beide kamers hem', () => {
  const kamers = [
    { nummer: '101', bewoners: ['Anna', 'Bas'] },
    { nummer: '102', bewoners: ['Cas'] },
    { nummer: '103', bewoners: ['Dirk'] },
  ]
  const punten = { Anna: 10, Bas: 30, Cas: 40, Dirk: 5 }
  assert.deepEqual([...kamerKampioenen(kamers, (n) => punten[n] ?? 0)].sort(), ['101', '102'])
})

test('Kamerkampioen: niemand zolang er geen punten zijn, en lege kamers tellen niet', () => {
  assert.equal(kamerKampioenen([{ nummer: '101', bewoners: ['Anna'] }], () => 0).size, 0)
  assert.deepEqual([...kamerKampioenen([{ nummer: '101', bewoners: [] }, { nummer: '102', bewoners: ['Bo'] }], () => 5)], ['102'])
})

// ---------- Vroege vogel ----------

test('Vroege vogel: wie als eerste ingepakt had', () => {
  const v = vroegsteVogels([
    { naam: 'Anna', op: 300 },
    { naam: 'Bas', op: 100 },
    { naam: 'Cas', op: null },
    { naam: 'Dirk', op: undefined },
  ])
  assert.deepEqual([...v], ['bas'])
})

test('Vroege vogel: niemand ingepakt = niemand; precies tegelijk = allebei', () => {
  assert.equal(vroegsteVogels([{ naam: 'Anna', op: null }]).size, 0)
  assert.deepEqual([...vroegsteVogels([{ naam: 'Anna', op: 5 }, { naam: ' Bas ', op: 5 }])].sort(), ['anna', 'bas'])
})

// ---------- Stemmen en rad ----------

test('Stemvee en Waarzegger tellen alleen gesloten, echte stemmingen', () => {
  const stemmingen = [
    { id: 'dag1', sluit: 100 },
    { id: 'dag2', sluit: 200 },
    { id: 'dag3', sluit: 900 }, // nog open
    { id: 'test-2026-12-01', sluit: 50 }, // teststemming
  ]
  const uitslagen = {
    dag1: [
      { kandidaat: 'Anna', stemmen: 4 },
      { kandidaat: 'Bas', stemmen: 4 },
    ],
    dag2: [{ kandidaat: 'Cas', stemmen: 3 }],
  }
  const alles = eigenStemmen(stemmingen, { dag1: 'bas', dag2: 'Cas' }, uitslagen, 500)
  assert.deepEqual(alles, { geweest: 2, gemist: 0, stemvee: true, waarzegger: 2 })
  const gemist = eigenStemmen(stemmingen, { dag1: 'Anna' }, uitslagen, 500)
  assert.deepEqual(gemist, { geweest: 2, gemist: 1, stemvee: false, waarzegger: 1 })
  assert.equal(eigenStemmen(stemmingen, {}, uitslagen, 60).stemvee, false) // nog geen echte stemming geweest
})

test('winnaarsVan: iedereen met de meeste stemmen, niemand bij nul', () => {
  assert.deepEqual(winnaarsVan([{ kandidaat: 'A', stemmen: 2 }, { kandidaat: 'B', stemmen: 2 }, { kandidaat: 'C', stemmen: 1 }]), ['A', 'B'])
  assert.deepEqual(winnaarsVan([{ kandidaat: 'A', stemmen: 0 }]), [])
  assert.deepEqual(winnaarsVan(undefined), [])
})

test('radTelling: per naam, zonder de testperiode', () => {
  const t = radTelling(
    [
      { naam: 'Anna', gedraaid: 50 },
      { naam: 'anna ', gedraaid: 150 },
      { naam: 'Anna', gedraaid: 200 },
      { naam: 'Bas', gedraaid: Number.NaN },
    ],
    100,
  )
  assert.deepEqual([...t], [['anna', 2]])
})

// ---------- Eigenaar van de telefoon ----------
import { EIGENAAR_NA_MS, isEigenaar, volgendeEigenaar } from '../src/lib/badgeregels.ts'

test('de eerste gekozen naam is de eigenaar van de telefoon', () => {
  assert.deepEqual(volgendeEigenaar(null, 'Ronald', 0), { naam: 'Ronald' })
  assert.equal(volgendeEigenaar(null, null, 0), null)
})

test('even een andere naam kiezen maakt die niet de eigenaar (geen telefoonbadges voor iedereen)', () => {
  let e = volgendeEigenaar(null, 'Ronald', 0)
  e = volgendeEigenaar(e, 'Tom', 1000)
  assert.equal(isEigenaar(e, 'Tom'), false)
  assert.equal(isEigenaar(e, 'Ronald'), true)
  e = volgendeEigenaar(e, 'Tom', 1000 + EIGENAAR_NA_MS - 1)
  assert.equal(isEigenaar(e, 'Tom'), false)
  // Terug naar de eigen naam: het wachten begint opnieuw
  e = volgendeEigenaar(e, 'Ronald', 2000)
  assert.deepEqual(e, { naam: 'Ronald' })
})

test('een naam die een dag gekozen blijft wordt eigenaar (verkeerde naam eerst gekozen)', () => {
  let e = volgendeEigenaar({ naam: 'Bas' }, 'Tom', 0)
  e = volgendeEigenaar(e, 'tom', EIGENAAR_NA_MS)
  assert.equal(isEigenaar(e, 'Tom'), true)
})