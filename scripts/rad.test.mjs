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
