// Tests voor de eigen namen van kamers: `npm test` (Node 22.18 of nieuwer, leest TypeScript zelf)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_KAMERNAAM, kamerNaamVan, kamernaamFout } from '../src/lib/kamernaamregels.ts'

const kamers = [
  { nummer: '101', naam: 'Gletsjer' },
  { nummer: '102', naam: 'Lawine' },
  { nummer: '103' },
]

test('de eigen naam gaat voor de naam van de reisleiding', () => {
  const eigen = [{ nummer: '102', naam: 'De Sneeuwpoppen' }]
  assert.equal(kamerNaamVan(kamers[1], eigen), 'De Sneeuwpoppen')
  assert.equal(kamerNaamVan(kamers[0], eigen), 'Gletsjer')
  assert.equal(kamerNaamVan(kamers[2], eigen), undefined)
  assert.equal(kamerNaamVan(kamers[2], [{ nummer: '103', naam: 'Hok' }]), 'Hok')
})

test('leeg mag: dan geldt weer de naam van de reisleiding', () => {
  assert.equal(kamernaamFout('', '101', kamers, []), null)
  assert.equal(kamernaamFout('   ', '101', kamers, []), null)
})

test('niet langer dan het maximum', () => {
  assert.equal(kamernaamFout('x'.repeat(MAX_KAMERNAAM), '101', kamers, []), null)
  assert.match(kamernaamFout('x'.repeat(MAX_KAMERNAAM + 1), '101', kamers, []), /Hooguit/)
})

test('niet dezelfde naam als een andere kamer, ook niet met andere hoofdletters', () => {
  assert.match(kamernaamFout('lawine', '101', kamers, []), /andere kamer/)
  assert.match(kamernaamFout(' De Sneeuwpoppen ', '101', kamers, [{ nummer: '102', naam: 'De Sneeuwpoppen' }]), /andere kamer/)
})

test('de eigen kamer mag haar huidige naam houden, en een vrijgekomen naam mag weer', () => {
  assert.equal(kamernaamFout('Gletsjer', '101', kamers, []), null)
  // 102 heet nu anders, dus "Lawine" is vrij
  assert.equal(kamernaamFout('Lawine', '101', kamers, [{ nummer: '102', naam: 'Hok' }]), null)
})
