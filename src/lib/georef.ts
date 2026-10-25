// Zet een GPS-positie om naar een plek op de getekende pistekaart.
//
// De pistekaart is een panoramatekening, geen kaart op schaal. Daarom gebruiken we ijkpunten:
// liftstations waarvan we de echte coördinaten kennen (OpenStreetMap) én de plek op de tekening.
// Een thin-plate spline buigt de tekening zo vloeiend mogelijk tussen die punten. Precies op
// een ijkpunt klopt het; ertussen is het "ongeveer op de goede piste".
//
// Nieuwe pistekaart? Zoek dezelfde stations op de nieuwe tekening op en pas x/y hieronder aan
// (pixels in public/img/pistekaart.webp).

export const KAART_PX = { b: 2126, h: 3543 }

/** [naam, breedte, lengte, x-pixel, y-pixel op de pistekaart] */
export const IJKPUNTEN: [string, number, number, number, number][] = [
  ['Puy Salié 3400', 44.9973, 6.2246, 1001, 331],
  ['Jandri 3200', 44.9966, 6.2047, 1142, 822],
  ['Signal (noord)', 45.0105, 6.2094, 580, 905],
  ['Signal (zuid)', 45.002, 6.2002, 935, 945],
  ['Jandri 2600', 44.9976, 6.1721, 1278, 1650],
  ['Toura (dal)', 44.9938, 6.1733, 1470, 1607],
  ['Toura 2900', 44.9858, 6.1787, 1755, 1373],
  ['Diable 2400', 44.9981, 6.148, 1415, 2240],
  ['Belle Étoile 2100', 45.0094, 6.1437, 950, 2442],
  ['Fée (dal)', 45.0189, 6.1624, 445, 2133],
  ['Jandri (dorp)', 45.0098, 6.1265, 1050, 2983],
  ['Diable (dorp)', 45.0044, 6.1248, 1298, 2978],
  ['Belle Étoile (dorp)', 45.015, 6.127, 822, 3010],
]

// Lokale vlakke coördinaten in meters rond het skigebied
const LAT0 = 45.0, LON0 = 6.17
const M_LAT = 111_320
const M_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180)
const meters = (lat: number, lon: number) => [(lon - LON0) * M_LON, (lat - LAT0) * M_LAT]

const U = (r2: number) => (r2 === 0 ? 0 : 0.5 * r2 * Math.log(r2)) // r² log r, met r² als invoer

/** Lost A·x = b op (Gauss met pivot); klein stelsel, dus prima */
function los(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((rij, i) => [...rij, b[i]])
  for (let k = 0; k < n; k++) {
    let p = k
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i
    ;[M[k], M[p]] = [M[p], M[k]]
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k]
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]
    x[i] = s / M[i][i]
  }
  return x
}

export interface Omzetter {
  /** GPS → pixel op de pistekaart */
  naarKaart: (lat: number, lon: number) => { x: number; y: number }
  /** Afstand (m) tot het dichtstbijzijnde ijkpunt: ver weg = buiten het skigebied */
  afstandTotGebied: (lat: number, lon: number) => number
}

/** Bouwt de omrekening (thin-plate spline) uit een lijst ijkpunten */
export function maakOmzetter(punten = IJKPUNTEN): Omzetter {
  const p = punten.map(([, lat, lon]) => meters(lat, lon))
  const n = p.length
  // Stelsel [K P; Pᵀ 0] voor beide uitkomsten tegelijk (zelfde matrix)
  const A: number[][] = []
  for (let i = 0; i < n; i++) {
    const rij = p.map((q) => U((p[i][0] - q[0]) ** 2 + (p[i][1] - q[1]) ** 2))
    A.push([...rij, 1, p[i][0], p[i][1]])
  }
  for (let k = 0; k < 3; k++) A.push([...p.map((q) => (k === 0 ? 1 : q[k - 1])), 0, 0, 0])
  const nul = [0, 0, 0]
  const wx = los(A, [...punten.map((q) => q[3]), ...nul])
  const wy = los(A, [...punten.map((q) => q[4]), ...nul])
  const eval_ = (w: number[], x: number, y: number) => {
    let s = w[n] + w[n + 1] * x + w[n + 2] * y
    for (let i = 0; i < n; i++) s += w[i] * U((x - p[i][0]) ** 2 + (y - p[i][1]) ** 2)
    return s
  }
  return {
    naarKaart(lat, lon) {
      const [x, y] = meters(lat, lon)
      return { x: eval_(wx, x, y), y: eval_(wy, x, y) }
    },
    afstandTotGebied(lat, lon) {
      const [x, y] = meters(lat, lon)
      return Math.min(...p.map((q) => Math.hypot(x - q[0], y - q[1])))
    },
  }
}
