// Zet de bars, pubs en nachtclubs uit OpenStreetMap als pins op de dorpskaart (public/data/plekken.json).
//
// Gebruik (vanuit de projectmap, na npm run dorpskaart):  npm run bars
// Plekken met een id die begint met "osm-" worden vervangen; je eigen plekken blijven staan.
// Gebruikt hetzelfde kader als teken.mjs, zodat de pins precies op de kaart kloppen.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const map = dirname(fileURLToPath(import.meta.url))
const plekkenPad = join(map, '..', '..', 'public', 'data', 'plekken.json')
const el = JSON.parse(readFileSync(join(map, 'osm.json'), 'utf8')).elements

// Moet gelijk zijn aan het kader in teken.mjs
const Z = 45.0, N = 45.0242, W = 6.1148, O = 6.1338
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const procent = (lat, lon) => ({
  x: Math.round(((lon - W) / (O - W)) * 10000) / 100,
  y: Math.round(((merc(N) - merc(lat)) / (merc(N) - merc(Z))) * 10000) / 100,
})

const SOORT = { bar: 'Bar', pub: 'Pub', biergarten: 'Biertuin', nightclub: 'Nachtclub' }
const slug = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** OSM-openingstijden leesbaar maken (alleen de eenvoudige gevallen) */
function tijden(oh) {
  if (!oh) return undefined
  return oh
    .replace(/\bMo-Su\b/g, 'elke dag')
    .replace(/\bMo\b/g, 'ma').replace(/\bTu\b/g, 'di').replace(/\bWe\b/g, 'wo').replace(/\bTh\b/g, 'do')
    .replace(/\bFr\b/g, 'vr').replace(/\bSa\b/g, 'za').replace(/\bSu\b/g, 'zo')
    .replace(/(\d\d:\d\d)-(\d\d:\d\d)/g, '$1–$2')
    .replace(/^elke dag/, 'Elke dag')
}

const gezien = new Set()
const bars = el
  .filter((e) => e.type === 'node' && SOORT[e.tags?.amenity] && e.tags.name && e.lat > Z && e.lat < N && e.lon > W && e.lon < O)
  .sort((a, b) => b.lat - a.lat)
  .flatMap((e) => {
    let id = `osm-${slug(e.tags.name)}`
    if (gezien.has(id)) id += `-${e.id}`
    gezien.add(id)
    const { x, y } = procent(e.lat, e.lon)
    const plek = {
      id,
      naam: e.tags.name,
      soort: 'apres',
      kaart: 'dorp',
      x,
      y,
      omschrijving: `${SOORT[e.tags.amenity]}. Bron: OpenStreetMap; controleer ter plekke of hij open is.`,
      tijden: tijden(e.tags.opening_hours),
      route: `https://www.google.com/maps/search/?api=1&query=${e.lat.toFixed(5)},${e.lon.toFixed(5)}`,
    }
    if (!plek.tijden) delete plek.tijden
    return [plek]
  })

// Bars in hetzelfde gebouw (een paar meter uit elkaar) zouden elkaars pin bedekken.
// Schuif ze een stukje opzij (ca. 13 m), zodat ze ingezoomd allebei aan te tikken zijn.
for (let i = 0; i < bars.length; i++) {
  while (bars.slice(0, i).some((q) => Math.hypot(q.x - bars[i].x, q.y - bars[i].y) < 0.6)) {
    bars[i].x = Math.round((bars[i].x + 0.9) * 100) / 100
  }
}

const json = JSON.parse(readFileSync(plekkenPad, 'utf8'))
const eigen = json.plekken.filter((p) => !String(p.id).startsWith('osm-'))
json.plekken = [...eigen, ...bars]

// Zelfde opmaak als de andere JSON-bestanden: één plek per regel
const regels = json.plekken.map((p) => `    ${JSON.stringify(p).replace(/","/g, '", "').replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }')}`)
writeFileSync(plekkenPad, `{\n  "_uitleg": ${JSON.stringify(json._uitleg)},\n  "plekken": [\n${regels.join(',\n')}\n  ]\n}\n`)
console.log(`${bars.length} bars/pubs/clubs gezet, ${eigen.length} eigen plekken behouden`)
