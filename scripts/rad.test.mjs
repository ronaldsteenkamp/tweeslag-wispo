// Tests voor het rekenwerk van het rad: `npm test` (Node 22.18 of nieuwer, leest TypeScript zelf)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doelHoek, gelijkeBuren, vakOnderPijl, vakTekst, verspreid } from '../src/lib/radwiskunde.ts'

test('het gekozen vak stopt onder de pijl, voor elk aantal vakken en elke beginhoek', () => {
  for (const n of [2, 3, 7, 12, 28, 40, 100]) {
    for (const nu of [0, 17.3, 359.9, 1234.5, 98765.4]) {
      for (let i = 0; i < n; i++) {
        for (const speling of [0, 0.5, 0.999]) {
          const doel = doelHoek(i, n, nu, speling)
          assert.equal(vakOnderPijl(doel, n), i, `n=${n} nu=${nu} i=${i} speling=${speling}`)
        }
      }
    }
  }
})

test('het rad draait altijd vooruit, minstens vier rondes en minder dan vijf', () => {
  for (const nu of [0, 45, 359, 7200.5]) {
    for (let i = 0; i < 12; i++) {
      const verschil = doelHoek(i, 12, nu, 0.5) - nu
      assert.ok(verschil >= 1440 && verschil < 1800, `verschil ${verschil}`)
    }
  }
})

test('de pijl stopt nooit vlak bij een vakgrens', () => {
  const n = 12
  const vak = 360 / n
  for (const speling of [0, 1 - 1e-9]) {
    const plek = (((-doelHoek(5, n, 0, speling)) % 360) + 360) % 360 / vak - 5
    assert.ok(plek > 0.14 && plek < 0.86, `plek in vak ${plek}`)
  }
})

test('vakOnderPijl klopt ook bij negatieve en hele grote hoeken', () => {
  assert.equal(vakOnderPijl(0, 4), 0)
  assert.equal(vakOnderPijl(-45, 4), 0)
  assert.equal(vakOnderPijl(-135, 4), 1)
  assert.equal(vakOnderPijl(360 * 1000 - 1, 4), 0)
})

/** Voorspelbaar toeval voor de test (mulberry32) */
function zaad(s) {
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('verspreid houdt alle pistes en zet gelijke kleuren zo min mogelijk naast elkaar', () => {
  const pistes = [
    ...Array.from({ length: 6 }, (_, i) => ({ naam: `g${i}`, kleur: 'groen' })),
    ...Array.from({ length: 13 }, (_, i) => ({ naam: `b${i}`, kleur: 'blauw' })),
    ...Array.from({ length: 6 }, (_, i) => ({ naam: `r${i}`, kleur: 'rood' })),
    ...Array.from({ length: 3 }, (_, i) => ({ naam: `z${i}`, kleur: 'zwart' })),
  ]
  for (let s = 1; s <= 50; s++) {
    const uit = verspreid(pistes, zaad(s))
    assert.deepEqual([...uit].map((p) => p.naam).sort(), pistes.map((p) => p.naam).sort())
    assert.equal(gelijkeBuren(uit), 0, `zaad ${s}`)
  }
})

test('tekst past in het vak: hoe meer vakken, hoe kleiner en korter', () => {
  let vorige = vakTekst(2)
  for (const n of [6, 10, 16, 28, 40]) {
    const nu = vakTekst(n)
    assert.ok(nu.letter <= vorige.letter && nu.maxTekens >= 1)
    // Aan de binnenkant van de tekst is het vak minstens zo hoog als de letters
    assert.ok(((92 - nu.ruimte) * 2 * Math.PI) / n >= nu.letter)
    vorige = nu
  }
})

// ---------- Casino ----------

const roulette = await import('../src/lib/roulette.ts')

test('casino: rood en zwart, en laag en hoog, hebben evenveel getallen en geen getal dubbel', () => {
  for (let n = 2; n <= 40; n++) {
    const tel = (s) => Array.from({ length: n + 1 }, (_, g) => roulette.uitbetaling(s, 1, g, n) > 0).filter(Boolean).length
    assert.equal(tel('rood'), tel('zwart'), `n=${n}`)
    assert.equal(tel('laag'), tel('hoog'), `n=${n}`)
    assert.equal(tel('rood'), Math.floor(n / 2), `n=${n}`)
    // Rood is niet meer hetzelfde als een van de andere inzetten (vanaf 4 spelers; daaronder is
    // er geen Laag/Hoog, want met 1 rood en 1 zwart getal valt dat altijd samen)
    if (n < 4) continue
    const winnaars = (s) => Array.from({ length: n + 1 }, (_, g) => g).filter((g) => roulette.uitbetaling(s, 1, g, n) > 0).join(',')
    assert.notEqual(winnaars('rood'), winnaars('laag'), `n=${n}`)
    assert.notEqual(winnaars('rood'), winnaars('hoog'), `n=${n}`)
  }
})

test('casino: een getal betaalt N keer de inzet, 0 betaalt alleen op 0', () => {
  assert.equal(roulette.uitbetaling('7', 10, 7, 12), 120)
  assert.equal(roulette.uitbetaling('7', 10, 8, 12), 0)
  assert.equal(roulette.uitbetaling('0', 10, 0, 12), 120)
  for (const s of ['rood', 'zwart', 'laag', 'hoog']) assert.equal(roulette.uitbetaling(s, 10, 0, 12), 0)
})

test('casino: het balletje landt altijd in het gekozen vakje', () => {
  for (const spelers of [2, 7, 12, 40]) {
    const vakken = spelers + 1
    let wiel = 0, ws = 0, bal = null, straal = roulette.R_VAKJE
    for (let k = 0; k < 40; k++) {
      const getal = k % vakken
      const w = roulette.planWorp({ wiel, wielSnelheid: ws, bal: bal ?? 180 / vakken, balStraal: straal, getal, vakken, toeval: zaad(k + 1) })
      const eind = w.stand(w.einde)
      const rel = (((eind.bal - eind.wiel) % 360) + 360) % 360
      assert.equal(Math.floor(rel / (360 / vakken)), getal, `spelers=${spelers} getal=${getal}`)
      ;({ wiel, wielSnelheid: ws, bal, straal } = { ...eind, bal: eind.bal })
    }
  }
})
