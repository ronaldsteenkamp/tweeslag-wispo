// Maakt de meetpunten langs stralen vanuit het standpunt (node, geen netwerk).
// Open-Meteo telt elk coördinaat als één aanroep: houd het onder ~4000.
import { writeFileSync } from 'node:fs'
const [lat0, lon0] = [44.9927481, 6.2044788] // Le Jandri (OSM)
const R = 6371000
const afst = []
for (let d = 300; d < 52000; d *= 1.19) afst.push(Math.round(d))
const azimuts = []
for (let az = 0; az <= 200; az += 1.5) azimuts.push(az)
const punten = [[lat0, lon0]]
for (const az of azimuts) {
  for (const d of afst) {
    const b = (az * Math.PI) / 180
    const f1 = (lat0 * Math.PI) / 180
    const l1 = (lon0 * Math.PI) / 180
    const dr = d / R
    const f2 = Math.asin(Math.sin(f1) * Math.cos(dr) + Math.cos(f1) * Math.sin(dr) * Math.cos(b))
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(f1), Math.cos(dr) - Math.sin(f1) * Math.sin(f2))
    punten.push([+((f2 * 180) / Math.PI).toFixed(5), +((l2 * 180) / Math.PI).toFixed(5)])
  }
}
writeFileSync(new URL('./punten.json', import.meta.url), JSON.stringify({ afst, azimuts, punten }))
console.log(afst.length, 'afstanden,', azimuts.length, 'richtingen,', punten.length, 'punten')
