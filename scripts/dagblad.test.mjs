// Tests voor het zetwerk van het clubblad (lib/dagblad.ts): `npm test`
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_KOLOM,
  kamerVanDeDag,
  kiesOpening,
  modules,
  opTijd,
  telling,
  uitsnijpunt,
  verdeel,
  verdeelStukjes,
  vorm,
  zaad,
} from '../src/lib/dagblad.ts'

const MATEN = { L: [480, 360], S: [360, 480], V: [480, 480], P: [480, 160], T: [270, 480] }
let n = 0
const foto = (v, extra = {}) => {
  n++
  const [breedte, hoogte] = MATEN[v]
  const uur = String(8 + (n % 12)).padStart(2, '0')
  return { id: `f${String(n).padStart(3, '0')}`, breedte, hoogte, gemaakt: `2027-03-08T${uur}:00:00+01:00`, genomen: null, jury: false, onderschrift: null, kamer: '101', ...extra }
}
const reeks = (vormen) => vormen.split('').map((v) => foto(v))

test('vorm: panorama, liggend, vierkant, staand (en zonder maat liggend)', () => {
  assert.equal(vorm(foto('P')), 'pano')
  assert.equal(vorm(foto('L')), 'liggend')
  assert.equal(vorm(foto('V')), 'vierkant')
  assert.equal(vorm(foto('S')), 'staand')
  assert.equal(vorm(foto('T')), 'staand')
  assert.equal(vorm({ breedte: null, hoogte: null }), 'liggend')
})

test('uitsnijpunt: bovenkant bij staand en vierkant, midden bij liggend', () => {
  assert.equal(uitsnijpunt(foto('S')), '50% 22%')
  assert.equal(uitsnijpunt(foto('V')), '50% 22%')
  assert.equal(uitsnijpunt(foto('L')), '50% 50%')
})

test('opTijd: van de ochtend naar de avond, genomen gaat voor gemaakt', () => {
  const a = foto('L', { gemaakt: '2027-03-08T18:00:00+01:00', genomen: '2027-03-08T09:00:00+01:00' })
  const b = foto('L', { gemaakt: '2027-03-08T12:00:00+01:00' })
  assert.deepEqual(opTijd([b, a]).map((f) => f.id), [a.id, b.id])
})

test('kiesOpening: jurykeuze, dan liggend met onderschrift, dan liggend, dan de eerste', () => {
  const s = foto('S')
  const l = foto('L')
  const lo = foto('L', { onderschrift: 'Hoi' })
  const j = foto('S', { jury: true })
  assert.equal(kiesOpening([s, l, lo, j]), j)
  assert.equal(kiesOpening([s, l, lo]), lo)
  assert.equal(kiesOpening([s, l]), l)
  assert.equal(kiesOpening([s]), s)
  assert.equal(kiesOpening([]), undefined)
})

test('verdeel: tot en met 11 alles in de kolommen, vanaf 12 de rest in Gespot', () => {
  const elf = reeks('LLLLLLLLLLL')
  assert.deepEqual(verdeel(elf), { kolom: elf, gespot: [] })
  const dertig = reeks('L'.repeat(29))
  const { kolom, gespot } = verdeel(dertig)
  assert.equal(kolom.length, MAX_KOLOM)
  assert.equal(gespot.length, 29 - MAX_KOLOM)
  assert.deepEqual([...kolom, ...gespot], dertig)
})

test('modules: elke foto precies één keer, in dezelfde volgorde', () => {
  const fotos = reeks('LSPLVSLLSTLVPL')
  const m = modules(fotos, 7)
  assert.deepEqual(m.flatMap((x) => x.fotos), fotos)
})

test('modules: panorama breed, staand+vierkant samen, liggend met tekstkolom die van kant wisselt', () => {
  const [p, s, v, l1, l2] = reeks('PSVLL')
  l1.onderschrift = 'met onderschrift: krijgt een tekstkolom'
  const m = modules([p, s, v, l1, l2], 0)
  assert.deepEqual(m.map((x) => x.soort), ['pano', 'duo', 'zij', 'zij'])
  assert.equal(m[1].snij, '4 / 5')
  assert.equal(m[2].om, false)
  assert.equal(m[3].om, true)
})

test('modules: twee liggende zonder onderschrift naast elkaar (4:3)', () => {
  const m = modules(reeks('LL'), 0)
  assert.deepEqual(m.map((x) => [x.soort, x.snij]), [['duo', '4 / 3']])
})

test('modules: zelfde foto\'s geven altijd hetzelfde; een andere dag kan de andere kant op beginnen', () => {
  const fotos = reeks('LSLLS')
  fotos.forEach((f) => (f.onderschrift = 'x'))
  assert.deepEqual(modules(fotos, zaad('2027-03-08')), modules(fotos, zaad('2027-03-08')))
  assert.notEqual(modules(fotos, 0)[0].om, modules(fotos, 1)[0].om)
})

test('zaad: vast getal per tekst', () => {
  assert.equal(zaad('2027-03-08'), zaad('2027-03-08'))
  assert.notEqual(zaad('2027-03-08'), zaad('2027-03-09'))
})

test('verdeelStukjes: kortste (tot 120 tekens) als quote, de rest als brief in volgorde', () => {
  const lang = { id: 'a', tekst: 'x'.repeat(300) }
  const kort = { id: 'b', tekst: 'Comté, Reblochon en Beaufort.' }
  const middel = { id: 'c', tekst: 'y'.repeat(100) }
  assert.deepEqual(verdeelStukjes([lang, kort, middel]), { quote: kort, brieven: [lang, middel] })
  assert.deepEqual(verdeelStukjes([lang]), { quote: null, brieven: [lang] })
  assert.deepEqual(verdeelStukjes([]), { quote: null, brieven: [] })
})

test('kamerVanDeDag: minstens 3 foto\'s, bij gelijkspel het laagste nummer', () => {
  const k = (kamer) => foto('L', { kamer })
  assert.equal(kamerVanDeDag([k('101'), k('101'), k('102')]), null)
  const r = kamerVanDeDag([k('202'), k('202'), k('202'), k('101'), k('101'), k('101'), k(null)])
  assert.equal(r.kamer, '101')
  assert.equal(r.aantal, 3)
})

test('telling: enkelvoud en meervoud', () => {
  assert.equal(telling(1, 0), '1 foto')
  assert.equal(telling(15, 2), "15 foto’s · 2 stukjes")
  assert.equal(telling(0, 1), '1 stukje')
  assert.equal(telling(0, 0), '')
})
