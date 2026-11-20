// node scripts/bergen/bijsturen.mjs
//
// Maakt van het echte panorama (src/lib/bergen-data.ts) een bijgestuurde versie, zoals een tekenaar
// met een foto werkt: de kleine hobbels eruit, de verre ketens iets meer reliëf, de top bij La Meije
// spitser en hoger zodat hij de hoofdrol heeft, en de schaduwen als strakke vlakken rechts van elke top.
// Uitvoer: src/lib/bergen-bijgestuurd.ts (dit gebruikt de app). Zie mockups/bergen-doorlopend.html.
import { readFileSync, writeFileSync } from 'node:fs'

const IN = new URL('../../src/lib/bergen-data.ts', import.meta.url)
const UIT = new URL('../../src/lib/bergen-bijgestuurd.ts', import.meta.url)
const MEIJE = 'Grand Pic de la Meije'

/** reliëf per laag (verste eerst): rond het eigen gemiddelde uitrekken */
const REK = [1.15, 1.12, 1.06, 1]
/** hoe grof de kam vereenvoudigd wordt (px) */
const GROF = [3.5, 3.5, 3, 2.5]
/** zoveel px gaat de top bij La Meije omhoog, en hoe breed (px) */
const TIL = 28
const TIL_BREED = 46

const bron = readFileSync(IN, 'utf8')
const P = JSON.parse(bron.match(/PANORAMA: Panorama = (\{[\s\S]*\})\s*$/)[1])

function rdp(pts, eps) {
  if (pts.length < 3) return pts
  const a = pts[0]
  const b = pts[pts.length - 1]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  let max = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / l
    if (d > max) [max, idx] = [d, i]
  }
  if (max <= eps) return [a, b]
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)]
}

/** schaduwvlak rechts van elke top tot het volgende dal (licht van linksboven) */
function facetten(kam, bodem) {
  const uit = []
  for (let i = 1; i < kam.length - 1; i++) {
    const [px, py] = kam[i]
    if (!(py < kam[i - 1][1] && py <= kam[i + 1][1])) continue
    let j = i + 1
    while (j < kam.length - 1 && kam[j + 1][1] >= kam[j][1]) j++
    const [vx, vy] = kam[j]
    if (vy - py < 10) continue
    const voet = [px + (vx - px) * 0.45, Math.min(bodem, vy + (vy - py) * 0.35)]
    uit.push('M' + [...kam.slice(i, j + 1), voet].map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L') + 'Z')
  }
  return uit.join('')
}

// waar La Meije in de tekening staat: hoogste kampunt vlak bij de OSM-top (zoals getekendeTop)
const osm = P.toppen.find((t) => t.naam === MEIJE)
let top
P.lagen.forEach((l, i) => {
  for (const [x, y] of l.kam) if (Math.abs(x - osm.x) <= 12 && (!top || y < top.y)) top = { x, y, laag: i }
})

const lagen = P.lagen.map((laag, li) => {
  const gem = laag.kam.reduce((s, p) => s + p[1], 0) / laag.kam.length
  let kam = laag.kam.map(([x, y]) => {
    const til = li === top.laag ? TIL : li === top.laag - 1 ? TIL * 0.35 : 0
    return [x, gem + (y - gem) * REK[li] - til * Math.exp(-(((x - top.x) / TIL_BREED) ** 2))]
  })
  kam = rdp(kam, GROF[li]).map(([x, y]) => [Math.round(x), Math.round(y)])
  const d = `M0 ${P.hoogte}L` + kam.map(([x, y]) => `${x} ${y}`).join('L') + `L${P.breedte} ${P.hoogte}Z`
  return { naam: laag.naam, d, schaduw: facetten(kam, P.hoogte), kam }
})

const kop = `/*
 * Het bergpanorama van bergen-data.ts, bijgestuurd: minder ruis, verre ketens iets meer reliëf, La Meije
 * spitser en hoger, strakke schaduwvlakken. Gegenereerd door scripts/bergen/bijsturen.mjs — niet met de
 * hand aanpassen. Bron en naamsvermelding: zie bergen-data.ts.
 */
import type { Panorama } from './bergen-data'

`
writeFileSync(UIT, `${kop}export const PANORAMA: Panorama = ${JSON.stringify({ ...P, lagen })}\n`)
console.log('geschreven:', UIT.pathname, 'top', JSON.stringify(top))
