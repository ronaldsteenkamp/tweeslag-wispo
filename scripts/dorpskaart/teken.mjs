// Tekent de plattegrond van het dorp (public/img/dorpskaart.jpg) uit OpenStreetMap-gegevens.
//
// Gebruik (vanuit de projectmap):  npm run dorpskaart
//   - haalt de straten, gebouwen, liften en herkenningspunten op via de Overpass-API
//     (één verzoek; bewaard in scripts/dorpskaart/osm.json, dat niet in git staat)
//   - tekent een SVG in de Tweeslag-stijl en zet die met sharp om naar JPG
// Opnieuw ophalen: verwijder osm.json of geef --opnieuw mee.
// Kaartgegevens © OpenStreetMap-bijdragers, licentie ODbL (vermelding staat op de kaart en in de app).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const map = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(map, '..', '..', 'package.json'))
const sharp = require('sharp')

const bron = join(map, 'osm.json')
const uitJpg = join(map, '..', '..', 'public', 'img', 'dorpskaart.jpg')
const uitSvg = process.argv.includes('--svg') ? join(map, 'dorpskaart.svg') : null

// Kader van de kaart (met wat ruimte rond de bebouwing). Pas je dit aan, dan verschuiven
// de x/y-percentages in plekken.json: controleer ze daarna met de plaatsmodus (?plaats=1).
const Z = 45.0, N = 45.0242, W = 6.1148, O = 6.1338

if (!existsSync(bron) || process.argv.includes('--opnieuw')) {
  // Ophaalgebied iets ruimer dan het kader, zodat straten en liften aan de rand doorlopen
  const bb = `${Z - 0.007},${W - 0.011},${N + 0.002},${O + 0.006}`
  const q = `[out:json][timeout:60];(way["highway"](${bb});way["building"](${bb});way["aerialway"](${bb});way["landuse"](${bb});way["natural"="water"](${bb});way["leisure"](${bb});node["amenity"](${bb});node["tourism"](${bb});node["shop"](${bb});node["aerialway"="station"](${bb});node["place"](${bb}););out geom tags;`
  console.log('OpenStreetMap-gegevens ophalen…')
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'tweeslag-wispo-dorpskaart/1.0' },
    body: 'data=' + encodeURIComponent(q),
  })
  if (!r.ok) throw new Error(`Overpass gaf ${r.status}. Probeer het over een paar minuten opnieuw.`)
  writeFileSync(bron, await r.text())
}
const el = JSON.parse(readFileSync(bron, 'utf8')).elements
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const B = 1600
const H = Math.round((B * (merc(N) - merc(Z))) / (((O - W) * Math.PI) / 180))
const px = (lon) => ((lon - W) / (O - W)) * B
const py = (lat) => ((merc(N) - merc(lat)) / (merc(N) - merc(Z))) * H
const meterPerPx = ((O - W) * 111320 * Math.cos((45.012 * Math.PI) / 180)) / B

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const pad = (g) => g.map((p, i) => `${i ? 'L' : 'M'}${px(p.lon).toFixed(1)} ${py(p.lat).toFixed(1)}`).join('')
const ways = (f) => el.filter((e) => e.type === 'way' && e.geometry && f(e.tags ?? {}))

const KLEUR = {
  achtergrond: '#eef3f7', bos: '#dce9e0', groen: '#e3eedb', water: '#b9dcef', gebouw: '#d4dee8', gebouwRand: '#bfccd9',
  weg: '#ffffff', wegRand: '#b7c5d3', pad: '#9db0c3', lift: '#0d0058', accent: '#099fc4', tekst: '#0d0058', tekstZacht: '#3d4a6b',
}
const FONT = "Trebuchet MS, Verdana, Arial, sans-serif"

const delen = []
const vlak = (lijst, kleur, rand) => lijst.forEach((e) => delen.push(`<path d="${pad(e.geometry)}Z" fill="${kleur}"${rand ? ` stroke="${rand}" stroke-width="0.8"` : ''}/>`))

// Ondergrond
vlak(ways((t) => t.landuse === 'forest' || t.natural === 'wood'), KLEUR.bos)
vlak(ways((t) => ['grass', 'meadow', 'allotments'].includes(t.landuse) || ['park', 'pitch', 'garden', 'playground', 'sports_centre'].includes(t.leisure)), KLEUR.groen)
vlak(ways((t) => t.natural === 'water'), KLEUR.water)
vlak(ways((t) => t.building), KLEUR.gebouw, KLEUR.gebouwRand)

// Wegen: eerst randen, dan vulling (zodat kruisingen mooi aansluiten)
const KLASSE = { secondary: 16, tertiary: 14, unclassified: 10, residential: 10, pedestrian: 10, living_street: 9, service: 5 }
const wegen = ways((t) => KLASSE[t.highway])
for (const e of wegen) delen.push(`<path d="${pad(e.geometry)}" fill="none" stroke="${KLEUR.wegRand}" stroke-width="${KLASSE[e.tags.highway] + 3}" stroke-linecap="round" stroke-linejoin="round"/>`)
for (const e of wegen) delen.push(`<path d="${pad(e.geometry)}" fill="none" stroke="${e.tags.highway === 'pedestrian' ? '#fbf6e9' : KLEUR.weg}" stroke-width="${KLASSE[e.tags.highway]}" stroke-linecap="round" stroke-linejoin="round"/>`)
for (const e of ways((t) => ['footway', 'path', 'steps', 'track'].includes(t.highway)))
  delen.push(`<path d="${pad(e.geometry)}" fill="none" stroke="${KLEUR.pad}" stroke-width="${e.tags.highway === 'track' ? 2.2 : 1.6}" stroke-dasharray="${e.tags.highway === 'steps' ? '2 3' : '6 4'}" stroke-linecap="round"/>`)

// Liften (lijn met stations)
const liften = ways((t) => t.aerialway && t.aerialway !== 'station' && t.aerialway !== 'magic_carpet')
for (const e of liften) {
  const g = e.geometry
  delen.push(`<path d="${pad(g)}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>`)
  delen.push(`<path d="${pad(g)}" fill="none" stroke="${KLEUR.lift}" stroke-width="3" stroke-linecap="round"/>`)
  for (const p of [g[0], g[g.length - 1]]) delen.push(`<circle cx="${px(p.lon).toFixed(1)}" cy="${py(p.lat).toFixed(1)}" r="6" fill="${KLEUR.lift}" stroke="#fff" stroke-width="2"/>`)
}

// ---------- Labels ----------
const labels = []
const bezet = [] // rechthoeken die al een label hebben
// Noordpijl, schaal en bronvermelding vrijhouden
bezet.push({ x: B - 120, y: 26, b: 100, h: 104 }, { x: 0, y: H - 110, b: 420, h: 110 }, { x: B - 380, y: H - 60, b: 380, h: 60 })
// Legenda in het lege stuk links van het dorp (tussen de liftlijnen Vallée Blanche en Super Venosc)
const LEGENDA = { x: 24, y: 1290, b: 470, h: 740 }
bezet.push({ x: LEGENDA.x, y: LEGENDA.y, b: LEGENDA.b, h: LEGENDA.h })
const botst = (r) => r.x < 0 || r.y < 0 || r.x + r.b > B || r.y + r.h > H || bezet.some((q) => r.x < q.x + q.b && q.x < r.x + r.b && r.y < q.y + q.h && q.y < r.y + r.h)
const tekstBreedte = (s, grootte) => s.length * grootte * 0.56
const halo = 'paint-order="stroke" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"'

// Straatnamen langs het langste (bijna) rechte stuk van elke straat, over meerdere punten heen
const perNaam = new Map()
for (const e of wegen) {
  const n = e.tags.name
  if (!n || e.tags.highway === 'service') continue
  const p = e.geometry.map((q) => ({ x: px(q.lon), y: py(q.lat) }))
  const opKaart = (q) => q.x > 20 && q.x < B - 20 && q.y > 20 && q.y < H - 20
  for (let i = 0; i < p.length - 1; i++) {
    if (!opKaart(p[i]) || !opKaart(p[i + 1])) continue
    const r0 = Math.atan2(p[i + 1].y - p[i].y, p[i + 1].x - p[i].x)
    let j = i + 1
    // Verleng zolang elk volgend stuk minder dan 20° afwijkt van de beginrichting
    while (j < p.length - 1 && opKaart(p[j + 1])) {
      const r = Math.atan2(p[j + 1].y - p[j].y, p[j + 1].x - p[j].x)
      let v = Math.abs(r - r0)
      if (v > Math.PI) v = 2 * Math.PI - v
      if (v > ((e.tags.highway === 'secondary' || e.tags.highway === 'tertiary' ? 32 : 20) * Math.PI) / 180) break
      j++
    }
    const l = Math.hypot(p[j].x - p[i].x, p[j].y - p[i].y)
    const best = perNaam.get(n)
    if (!best || l > best.l) perNaam.set(n, { l, x1: p[i].x, y1: p[i].y, x2: p[j].x, y2: p[j].y, klasse: e.tags.highway })
  }
}
const volgorde = [...perNaam.entries()].sort((a, b) => (KLASSE[b[1].klasse] ?? 0) - (KLASSE[a[1].klasse] ?? 0) || b[1].l - a[1].l)
let straten = 0
const HOOFD = ['secondary', 'tertiary']
function plaatsStraten(hoofd) {
for (const [naam, s] of volgorde) {
  if (HOOFD.includes(s.klasse) !== hoofd) continue
  const gr = s.klasse === 'secondary' || s.klasse === 'tertiary' ? 18 : 15
  const b = tekstBreedte(naam, gr)
  if (b > s.l * 0.92) continue
  let hoek = (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI
  if (hoek > 90) hoek -= 180
  if (hoek < -90) hoek += 180
  const c = Math.abs(Math.cos((hoek * Math.PI) / 180)), si = Math.abs(Math.sin((hoek * Math.PI) / 180))
  const bb = b * c + gr * si, hh = b * si + gr * c
  // Probeer het midden van het rechte stuk, en schuif anders op langs de straat
  const ruimte = (s.l - b) / 2 / s.l
  for (const f of [0, -0.5, 0.5, -0.9, 0.9]) {
    const t = 0.5 + f * ruimte
    const cx = s.x1 + (s.x2 - s.x1) * t, cy = s.y1 + (s.y2 - s.y1) * t
    const r = { x: cx - bb / 2, y: cy - hh / 2, b: bb, h: hh }
    if (botst(r)) continue
    bezet.push(r)
    straten++
    labels.push(`<text transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${hoek.toFixed(1)})" y="${(gr * 0.35).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${gr}" font-weight="${gr > 16 ? 700 : 600}" fill="${KLEUR.tekstZacht}" ${halo}>${esc(naam)}</text>`)
    break
  }
}
}
plaatsStraten(true)

// Herkenningspunten (vóór straatnamen, die zijn belangrijker voor oriëntatie)
const pois = [
  ['information', 'Office de tourisme'], ['townhall', 'Mairie'], ['post_office', 'La Poste'], ['pharmacy', 'Pharmacie'],
  ['cinema', 'Cinéma'], ['police', 'Police'],
]
const gekozen = new Map()
for (const e of el) {
  if (e.type !== 'node' || !e.tags || e.lat < Z || e.lat > N || e.lon < W || e.lon > O) continue
  const soort = e.tags.amenity ?? e.tags.tourism
  const p = pois.find(([s]) => s === soort)
  if (!p || (soort === 'information' && !/tourisme/i.test(e.tags.name ?? ''))) continue
  const sleutel = p[1] + Math.round(e.lat * 300)
  if (!gekozen.has(sleutel)) gekozen.set(sleutel, { ...e, label: p[1] })
}
for (const e of gekozen.values()) {
  const x = px(e.lon), y = py(e.lat), g = 19
  const r = { x: x + 9, y: y - g / 2 - 2, b: tekstBreedte(e.label, g) + 6, h: g + 4 }
  labels.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${KLEUR.accent}" stroke="#fff" stroke-width="2"/>`)
  if (botst(r)) continue
  bezet.push(r)
  labels.push(`<text x="${(x + 11).toFixed(1)}" y="${(y + 6).toFixed(1)}" font-family="${FONT}" font-size="${g}" font-weight="700" fill="${KLEUR.tekstZacht}" ${halo}>${esc(e.label)}</text>`)
}

// Pleinen en wijken
for (const e of el) {
  if (e.type !== 'node' || !e.tags?.place || e.tags.place === 'village' || e.lat < Z || e.lat > N) continue
  const x = px(e.lon), y = py(e.lat), g = 22, b = tekstBreedte(e.tags.name, g)
  const r = { x: x - b / 2, y: y - g, b, h: g + 6 }
  if (botst(r)) continue
  bezet.push(r)
  labels.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${g}" font-style="italic" font-weight="700" fill="${KLEUR.tekstZacht}" ${halo}>${esc(e.tags.name)}</text>`)
}

// Liftnamen bij het dalstation: in OSM loopt een lift van dal naar berg, dus het eerste punt.
// Ligt dat buiten de kaart, dan bij het andere station. Belangrijke liften eerst.
const binnen = (p) => p.lat > Z && p.lat < N && p.lon > W && p.lon < O
const LIFTRANG = { gondola: 0, cable_car: 0, mixed_lift: 1, chair_lift: 2, drag_lift: 3, 't-bar': 3, platter: 3 }
for (const e of [...liften].sort((a, b) => (LIFTRANG[a.tags.aerialway] ?? 5) - (LIFTRANG[b.tags.aerialway] ?? 5))) {
  if (!e.tags.name) continue
  const g = e.geometry
  const dal = binnen(g[0]) ? g[0] : binnen(g[g.length - 1]) ? g[g.length - 1] : null
  if (!dal) continue
  const x = px(dal.lon), y = py(dal.lat), gr = LIFTRANG[e.tags.aerialway] <= 1 ? 20 : 17, tekst = e.tags.name, b = tekstBreedte(tekst, gr) + 8
  // Eerst de kant waar de kabel níet heen loopt, zodat de naam niet door de lijn gaat
  const ander = dal === g[0] ? g[1] : g[g.length - 2]
  const naarRechts = px(ander.lon) > x, naarBeneden = py(ander.lat) > y
  const rechts = [[10, -10], [10, gr + 8]], links = [[-b - 10, -10], [-b - 10, gr + 8]]
  let opties = naarRechts ? [...links, ...rechts] : [...rechts, ...links]
  opties = opties.sort((a, c) => ((a[1] > 0) === naarBeneden ? 1 : 0) - ((c[1] > 0) === naarBeneden ? 1 : 0))
  for (const [dx, dy] of [...opties, [-b / 2, -16], [-b / 2, gr + 18]]) {
    const r = { x: x + dx, y: y + dy - gr, b, h: gr + 6 }
    if (botst(r)) continue
    bezet.push(r)
    labels.push(`<text x="${(x + dx + 4).toFixed(1)}" y="${(y + dy).toFixed(1)}" font-family="${FONT}" font-size="${gr}" font-weight="800" fill="${KLEUR.lift}" ${halo}>${esc(tekst)}</text>`)
    break
  }
}
plaatsStraten(false)
console.log('straatnamen:', straten, 'van', perNaam.size)
// ---------- Legenda (in het lege stuk links van het dorp) ----------
function maakLegenda() {
  const x0 = LEGENDA.x, y0 = LEGENDA.y, br = LEGENDA.b, rij = 44, gr = 23
  const tx = x0 + 104 // tekstkolom
  const d = []
  let y = y0 + 52
  const kop = (t) => {
    d.push(`<text x="${x0 + 24}" y="${y}" font-size="27" font-weight="800" fill="${KLEUR.tekst}">${esc(t)}</text>`)
    y += 30
  }
  const regel = (symbool, tekst, klein) => {
    const m = y + rij / 2 // midden van de rij
    d.push(symbool(x0 + 24, m))
    d.push(`<text x="${tx}" y="${m + 8}" font-size="${gr}" fill="${KLEUR.tekst}">${esc(tekst)}${klein ? `<tspan dx="8" font-size="17" fill="${KLEUR.tekstZacht}">${esc(klein)}</tspan>` : ''}</text>`)
    y += rij
  }
  const lijn = (breed, rand, kleur, extra = '') => (x, m) =>
    `<path d="M${x} ${m} H${x + 62}" stroke="${rand}" stroke-width="${breed + 3}" stroke-linecap="round"/><path d="M${x} ${m} H${x + 62}" stroke="${kleur}" stroke-width="${breed}" stroke-linecap="round" ${extra}/>`
  const pin = (kleur) => (x, m) =>
    `<path transform="translate(${x + 18} ${m - 20})" d="M13 38 C13 38 0 24 0 13 A13 13 0 0 1 26 13 C26 24 13 38 13 38 Z" fill="${kleur}" stroke="#fff" stroke-width="3"/>`

  kop('Legenda')
  regel(lijn(16, KLEUR.wegRand, KLEUR.weg), 'Hoofdweg')
  regel(lijn(10, KLEUR.wegRand, KLEUR.weg), 'Straat')
  regel((x, m) => `<path d="M${x} ${m} H${x + 62}" stroke="${KLEUR.pad}" stroke-width="2.2" stroke-dasharray="6 4"/>`, 'Pad of wandelroute')
  regel((x, m) => `<rect x="${x + 8}" y="${m - 13}" width="46" height="26" fill="${KLEUR.gebouw}" stroke="${KLEUR.gebouwRand}"/>`, 'Gebouw')
  regel((x, m) => `<rect x="${x + 2}" y="${m - 13}" width="28" height="26" fill="${KLEUR.bos}"/><rect x="${x + 34}" y="${m - 13}" width="28" height="26" fill="${KLEUR.groen}"/>`, 'Bos en groen')
  regel((x, m) => `<path d="M${x + 6} ${m} H${x + 56}" stroke="${KLEUR.lift}" stroke-width="3"/><circle cx="${x + 6}" cy="${m}" r="6" fill="${KLEUR.lift}" stroke="#fff" stroke-width="2"/><circle cx="${x + 56}" cy="${m}" r="6" fill="${KLEUR.lift}" stroke="#fff" stroke-width="2"/>`, 'Skilift', '(naam bij dalstation)')
  regel((x, m) => `<circle cx="${x + 31}" cy="${m}" r="7" fill="${KLEUR.accent}" stroke="#fff" stroke-width="2"/>`, 'Herkenningspunt')
  regel((x, m) => `<text x="${x + 31}" y="${m + 8}" text-anchor="middle" font-size="22" font-style="italic" font-weight="700" fill="${KLEUR.tekstZacht}">Abc</text>`, 'Wijk of plein')
  y += 14
  d.push(`<path d="M${x0 + 24} ${y} H${x0 + br - 24}" stroke="#d5dee8" stroke-width="2"/>`)
  y += 40
  kop('Pins in de app')
  y -= 4
  d.push(`<text x="${x0 + 24}" y="${y}" font-size="17" fill="${KLEUR.tekstZacht}">Tik op een pin voor naam, tijden en route</text>`)
  y += 8
  regel(pin('#8e24aa'), 'Bier, bar en après-ski')
  regel(pin('#d62839'), 'Eten')
  regel(pin('#0d0058'), 'Afspreken')
  regel(pin('#1b8a5a'), 'Handig')
  y += 22
  d.push(`<text x="${x0 + 24}" y="${y + 6}" font-size="17" fill="${KLEUR.tekstZacht}">Inzoomen: knijpen of dubbeltikken</text>`)
  const hoogte = y + 30 - y0
  return `<g font-family="${FONT}"><rect x="${x0}" y="${y0}" width="${br}" height="${hoogte}" rx="22" fill="#ffffff" opacity="0.94" stroke="#cfd9e3" stroke-width="2"/>${d.join('')}</g>`
}
const legenda = maakLegenda()

// Schaal, noordpijl en bronvermelding (geen titel: die zou in de app achter de schakelaar vallen)
const schaalM = 200, schaalPx = schaalM / meterPerPx
const kader = `
<g font-family="${FONT}">
  <g transform="translate(${B - 70} 78)">
    <circle r="40" fill="#ffffff" opacity="0.92" stroke="#bfccd9"/>
    <path d="M0 -28 L11 8 L0 2 L-11 8 Z" fill="#0d0058"/>
    <text y="27" text-anchor="middle" font-size="18" font-weight="800" fill="#0d0058">N</text>
  </g>
  <g transform="translate(32 ${H - 70})">
    <rect x="-10" y="-30" width="${(schaalPx + 90).toFixed(0)}" height="56" rx="12" fill="#ffffff" opacity="0.9"/>
    <path d="M0 10 V18 H${schaalPx.toFixed(1)} V10" fill="none" stroke="#0d0058" stroke-width="3"/>
    <text x="${(schaalPx + 10).toFixed(1)}" y="20" font-size="18" font-weight="700" fill="#0d0058">${schaalM} m</text>
    <text x="0" y="-8" font-size="15" fill="#3d4a6b">schaal</text>
  </g>
  <rect x="${B - 360}" y="${H - 44}" width="340" height="30" rx="8" fill="#ffffff" opacity="0.9"/>
  <text x="${B - 30}" y="${H - 23}" text-anchor="end" font-size="17" fill="#3d4a6b">© OpenStreetMap-bijdragers (ODbL)</text>
</g>
${legenda}`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${B}" height="${H}" viewBox="0 0 ${B} ${H}">
<rect width="${B}" height="${H}" fill="${KLEUR.achtergrond}"/>
${delen.join('\n')}
${labels.join('\n')}
${kader}
</svg>`
if (uitSvg) writeFileSync(uitSvg, svg)
await sharp(Buffer.from(svg), { density: 72 }).flatten({ background: KLEUR.achtergrond }).jpeg({ quality: 82, mozjpeg: true }).toFile(uitJpg)
console.log(`${B}x${H}px, ${meterPerPx.toFixed(2)} m/px, ${delen.length} vormen, ${labels.length} labels`)







