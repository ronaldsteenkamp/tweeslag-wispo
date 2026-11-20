// Maakt van de hoogtedata (Copernicus DEM GLO-90 via Open-Meteo) een gelaagd panorama in de stijl
// van de witte bergen op Home: rechte lijnen, vlakke kleuren, schaduwvlakken rechts van elke top.
// Uitvoer: src/lib/bergen-data.ts (lagen, schaduwen, toppen) en scripts/bergen/bergen-panorama.svg.
//
// Opnieuw maken (bijv. om het laatste stuk 187,5°–200° aan te vullen):
//   node scripts/bergen/punten.mjs            meetpunten langs stralen vanaf Le Jandri (geen netwerk)
//   powershell scripts/bergen/haal.ps1        hoogtes ophalen bij Open-Meteo (elk coördinaat = 1 aanroep:
//                                             max 600/min en 5000/uur; het script wacht en hervat)
//   node scripts/bergen/panorama.mjs          dit script
// punten.json en stukken/ zijn tussenbestanden (staan in .gitignore).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const MAP = new URL('.', import.meta.url)
const UIT_TS = new URL('../../src/lib/bergen-data.ts', MAP)
const UIT_SVG = new URL('bergen-panorama.svg', MAP)
const alles = JSON.parse(readFileSync(new URL('punten.json', MAP)))
const { afst, punten } = alles
const hoogtes = []
const stukken = readdirSync(new URL('stukken/', MAP)).map((f) => +f.replace('.json', '')).sort((a, b) => a - b)
for (const s of stukken) hoogtes.push(...JSON.parse(readFileSync(new URL(`stukken/${s}.json`, MAP))).elevation)
// Alleen richtingen waarvan alle afstanden binnen zijn (de API-limiet kan de laatste afkappen)
const volledig = Math.floor((hoogtes.length - 1) / afst.length)
const azimuts = alles.azimuts.slice(0, volledig)
console.log(`hoogtes ${hoogtes.length} van ${punten.length}; richtingen ${azimuts.length} (tot ${azimuts.at(-1)}°)`)

const R = 6371000
const oog = hoogtes[0] + 2
// Banden (m): elke band wordt een laag; nabij = voorgrond (onderaan, voor de sneeuw)
// De helling direct onder Le Jandri (< 3,5 km) laten we weg: die is een grote bult die La Meije
// verbergt. De voorste laag is de bergkam aan de overkant (Râteau, La Meije, Pic de la Grave).
const BANDEN = [
  { naam: 'ver', van: 21000, tot: 60000 },
  { naam: 'midden', van: 11500, tot: 21000 },
  { naam: 'dichtbij', van: 7000, tot: 11500 },
  { naam: 'voor', van: 3500, tot: 7000 },
]
const PX_PER_GRAAD = 8 // 200° → 1600 px ≈ 4 schermbreedtes van 390 px
const OVERDRIJVING = 2.6 // verticaal uitvergroten, zoals bij elke panoramatekening

const hoek = (h, d) => Math.atan((h - oog - (0.87 * d * d) / (2 * R)) / d) * (180 / Math.PI)

const profielen = BANDEN.map((b) =>
  azimuts.map((az, i) => {
    let max = -90
    afst.forEach((d, j) => {
      if (d < b.van || d >= b.tot) return
      max = Math.max(max, hoek(hoogtes[1 + i * afst.length + j], d))
    })
    return max
  }),
)
// Licht gladstrijken langs de horizon (1-2-1), tegen trapjes van de grove afstandsstappen; toppen
// blijven toppen omdat we daarna de max nemen met het origineel min een klein beetje.
for (const prof of profielen) {
  const kopie = [...prof]
  for (let i = 1; i < prof.length - 1; i++) {
    const glad = (kopie[i - 1] + 2 * kopie[i] + kopie[i + 1]) / 4
    prof[i] = Math.max(glad, kopie[i] - 0.12)
  }
}
// (Geen kunstmatig optillen van verdere lagen: dat gaf randjes die op contourlijnen lijken. Een verre
// laag is alleen te zien waar hij echt boven de nabije uitsteekt.)

const alleHoeken = profielen.flat().filter((a) => a > -60)
const maxHoek = Math.max(...alleHoeken)
const minZichtbaar = Math.min(...profielen[profielen.length - 1])
const MARGE_BOVEN = 70
const horizonY = MARGE_BOVEN + maxHoek * PX_PER_GRAAD * OVERDRIJVING
const breedte = Math.round((azimuts.at(-1) - azimuts[0]) * PX_PER_GRAAD)
// onderkant: iets onder de laagste rand van de voorste laag
const hoogte = Math.round(horizonY - Math.max(-7, minZichtbaar) * PX_PER_GRAAD * OVERDRIJVING + 40)

function rdp(pts, eps) {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts.at(-1)]
  let max = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.hypot(b[1] - a[1], b[0] - a[0])
    if (d > max) {
      max = d
      idx = i
    }
  }
  if (max <= eps) return [a, b]
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)]
}

const EPS = [1.6, 1.8, 2.0, 2.4]
const r1 = (v) => Math.round(v)
const lagen = profielen.map((prof, li) => {
  const pts = prof.map((a, i) => [(azimuts[i] - azimuts[0]) * PX_PER_GRAAD, horizonY - a * PX_PER_GRAAD * OVERDRIJVING])
  const lijn = rdp(pts, EPS[li]).map(([x, y]) => [r1(x), r1(Math.min(y, hoogte))])
  // schaduwvlakken: rechts van elke top tot het volgende dal (licht van linksboven, zoals op Home)
  const schaduwen = []
  for (let i = 1; i < lijn.length - 1; i++) {
    const [px, py] = lijn[i]
    if (!(py < lijn[i - 1][1] && py < lijn[i + 1][1])) continue
    let j = i + 1
    while (j < lijn.length - 1 && lijn[j + 1][1] >= lijn[j][1] && j - i < 4) j++
    const [vx, vy] = lijn[j]
    const w = vx - px
    const h = vy - py
    if (h < 7 || w < 6) continue
    const rand = lijn.slice(i, j + 1)
    const diep = Math.min(h * 1.25, 46)
    schaduwen.push([...rand, [r1(vx - w * 0.3), r1(Math.min(hoogte, vy + diep * 0.45))], [r1(px - Math.min(w * 0.12, 10)), r1(Math.min(hoogte, py + diep))]])
  }
  return { naam: BANDEN[li].naam, lijn, schaduwen }
})

// Toppen voor de oriëntatietafel (alleen als ze echt op de kam van hun laag liggen)
const OSM = JSON.parse(readFileSync(new URL('toppen-osm.json', MAP), 'utf8').replace(/^\uFEFF/, ''))
const KIES = ['Grand Pic de la Meije', 'Pic Ouest du Râteau', 'Dôme de la Lauze', 'Barre des Écrins', 'Pic de la Grave', 'La Grande Ruine', 'Le Jandri', 'Tête de la Toura', 'Pic du Diable', 'Roche Faurio', 'Pic Gaspard']
const [lat0, lon0] = punten[0]
const toppen = []
for (const t of OSM) {
  const naam = Buffer.from(t.naam, 'latin1').toString('utf8').includes('�') ? t.naam : Buffer.from(t.naam, 'latin1').toString('utf8')
  const echte = KIES.find((k) => k === t.naam || k === naam)
  if (!echte || !t.ele || echte === 'Le Jandri') continue
  const f1 = (lat0 * Math.PI) / 180
  const f2 = (t.lat * Math.PI) / 180
  const dl = ((t.lon - lon0) * Math.PI) / 180
  const az = ((Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) * 180) / Math.PI + 360) % 360
  const d = 2 * R * Math.asin(Math.sqrt(Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2))
  if (az < azimuts[0] || az > azimuts.at(-1)) continue
  const a = hoek(+t.ele, d)
  toppen.push({ naam: echte, hoogte: +t.ele, km: +(d / 1000).toFixed(1), az: +az.toFixed(1), x: r1((az - azimuts[0]) * PX_PER_GRAAD), y: r1(horizonY - a * PX_PER_GRAAD * OVERDRIJVING) })
}

const pad = (pts) => 'M' + pts.map((p) => p.join(' ')).join('L')
const laagPad = (l) => `M0 ${hoogte}L${l.lijn.map((p) => p.join(' ')).join('L')}L${breedte} ${hoogte}Z`
const data = {
  bron: 'Afgeleid van Copernicus DEM GLO-90 (© DLR e.V. 2010–2014 en © Airbus Defence and Space GmbH 2014–2018, geleverd onder COPERNICUS door de Europese Unie en ESA), via de Open-Meteo Elevation API',
  standpunt: { naam: 'Le Jandri', hoogte: Math.round(oog - 2), lat: lat0, lon: lon0 },
  azimut: [azimuts[0], azimuts.at(-1)],
  breedte,
  hoogte,
  horizonY: r1(horizonY),
  lagen: lagen.map((l) => ({ naam: l.naam, d: laagPad(l), schaduw: l.schaduwen.map(pad).join('Z') + (l.schaduwen.length ? 'Z' : ''), kam: l.lijn })),
  toppen,
}
// Het TS-bestand: de kop (uitleg + types) blijft staan, alleen de data erachter wordt vervangen
const oud = readFileSync(UIT_TS, 'utf8')
const kop = oud.slice(0, oud.indexOf('export const PANORAMA: Panorama = '))
writeFileSync(UIT_TS, `${kop}export const PANORAMA: Panorama = ${JSON.stringify(data)}\n`)

// Losse SVG (voor gebruik als bestand/achtergrond): kleuren als klassen met standaardwaarden
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breedte} ${hoogte}"><title>Panorama vanaf Le Jandri</title><style>.l0{fill:#5f6aa8}.l1{fill:#8e97c4}.l2{fill:#c3cbe0}.l3{fill:#e9f1f5}.s0{fill:#4f5893}.s1{fill:#7881b3}.s2{fill:#a9b4d0}.s3{fill:#cfdee8}</style>${data.lagen
  .map((l, i) => `<path class="l${i}" d="${l.d}"/>${l.schaduw ? `<path class="s${i}" d="${l.schaduw}"/>` : ''}`)
  .join('')}</svg>`
writeFileSync(UIT_SVG, svg)
console.log({ breedte, hoogte, horizonY: r1(horizonY), maxHoek: maxHoek.toFixed(2), punten: lagen.map((l) => l.lijn.length), schaduwen: lagen.map((l) => l.schaduwen.length), svgBytes: svg.length, toppen: toppen.map((t) => `${t.naam} ${t.az}° ${t.km}km`) })
