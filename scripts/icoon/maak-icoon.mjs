// App-icoon C3 "Sterrennacht, hoge berg": het 2slag-woordmerk midden in een sterrennacht, La Meije rechts
// boven het logo uit met het rode vlaggetje, en onderaan een bergengordel met een witte sneeuwgolf.
// Berg en logo komen uit mockups/icoon/panorama/icoon.svg (richting C).
//
// Maakt:  public/logo.svg                    (bron voor app-iconen, favicon en iOS-splash bij de build)
//         public/maskable-wispo-192x192.png  (Android, rond/afgerond gesneden: zelfde tekening met meer rand)
//         public/maskable-wispo-512x512.png
// Gebruik: node scripts/icoon/maak-icoon.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const root = new URL('../../', import.meta.url)
const bron = readFileSync(new URL('mockups/icoon/panorama/icoon.svg', root), 'utf8')
const regels = bron.split('\n')
const meije = regels[4].replace(/M-60 /g, 'M-260 ') // voorste sneeuwlaag met La Meije
const logoBinnen = regels.slice(9, 18).join('\n')

// Logo precies in het midden. Groter dan 0,66 past het logo niet meer in de veilige cirkel van het
// maskable-icoon (Android snijdt het dan aan de hoeken af).
const S = 0.66, LB = 687, LH = 309 // logo-kader in eigen eenheden (y van -2 tot 307)
const tx = 256 - (LB * S) / 2, ty = 256 - (LH * S) / 2 + 2 * S
// La Meije: top van (253.2, 300) naar (400, 150), verticaal 2,6× opgerekt
const PX = 253.2, PY = 300
const TOPX = 400, TOPY = 150, REK = 2.6

const ster = (x, y, r, o = 1) => {
  const k = r * 0.16
  return `<path d="M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z" fill="#fff" opacity="${o}"/>`
}
const stip = (x, y, r, o) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`
const sterren = [
  ster(92, 78, 16), ster(418, 58, 12, 0.95), ster(296, 108, 8, 0.85), ster(186, 38, 7, 0.8),
  ster(472, 140, 7, 0.8), ster(36, 118, 6, 0.7), ster(60, 372, 8, 0.85),
  stip(140, 120, 2.6, 0.7), stip(240, 66, 2.2, 0.6), stip(350, 30, 2.6, 0.7), stip(366, 132, 2, 0.5),
  stip(30, 40, 2.2, 0.55), stip(490, 92, 2.4, 0.6), stip(20, 300, 2.4, 0.55), stip(150, 368, 2, 0.55),
  stip(494, 262, 2.2, 0.55), stip(-30, 220, 2.4, 0.6), stip(-20, 360, 2, 0.5),
  stip(540, 200, 2.4, 0.6), stip(220, -30, 2.2, 0.55), stip(120, -20, 2, 0.5),
].join('')

// Eigen id: logo.svg staat ook inline in het laadscherm van index.html
const lucht = `<defs><linearGradient id="wispo-icoon-lucht" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07003a"/><stop offset="1" stop-color="#1a1078"/></linearGradient></defs>
<rect x="-60" y="-60" width="632" height="632" fill="url(#wispo-icoon-lucht)"/>`

// Sneeuwkapje op een top (x,y) met linker- en rechterhelling (dx per dy)
const kap = (x, y, l, r, h, kleur = '#dfe6f3') => {
  const yb = y + h
  return `<path d="M${x} ${y}L${x - l * h} ${yb}L${x - l * h * 0.55} ${yb - 3}L${x - l * h * 0.2} ${yb + 2}L${x + r * h * 0.15} ${yb - 4}L${x + r * h * 0.55} ${yb + 1}L${x + r * h} ${yb}Z" fill="${kleur}"/>`
}
const pad = (punten, kleur) => `<path d="M${punten.map((p) => p.join(' ')).join('L')}V640H-80Z" fill="${kleur}"/>`
// Bergengordel achter La Meije: verre rug (donker) en nabije rug met sneeuwkapjes
const verre = pad([[-80, 420], [-40, 404], [-10, 412], [22, 386], [48, 398], [70, 380], [104, 402], [130, 392], [168, 414], [196, 400], [236, 420], [600, 420]], '#2c2878')
const nabij = pad([[-80, 452], [-36, 436], [-4, 444], [34, 414], [62, 428], [92, 420], [128, 446], [164, 432], [206, 452], [600, 452]], '#3d4793')
const kapjes = [
  kap(22, 386, 32 / 26, 26 / 12, 10, '#8e97c4'), kap(70, 380, 22 / 18, 34 / 22, 10, '#8e97c4'),
  kap(34, 414, 38 / 22, 28 / 14, 12), kap(92, 420, 30 / 8, 36 / 26, 10), kap(-36, 436, 44 / 16, 32 / 8, 9),
].join('')
// Witte sneeuwgolf vooraan, over de voet van La Meije
const golf = `<path d="M-80 486C20 470 110 484 200 476S380 462 470 474S560 484 600 478V640H-80Z" fill="#fff"/>`

// Vlag op de vlakke top, voet in de sneeuw (getekend vóór de sneeuwlaag)
const VX = TOPX + 3, STOK = 66
const vlag = `<path d="M${VX} ${TOPY + 16}V${TOPY - STOK}" stroke="#cfd7f0" stroke-width="6" stroke-linecap="round"/>
<path d="M${VX + 2} ${TOPY - STOK}h40l-11 13 11 13h-40z" fill="#c4212f"/>`

const inhoud = `${lucht}
${sterren}
${verre}
${nabij}
${kapjes}
${vlag}
<g transform="translate(${TOPX} ${TOPY}) scale(1 ${REK}) translate(${-PX} ${-PY})">
${meije}
</g>
${golf}
<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${S})">
${logoBinnen}
</g>`

const icoon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" overflow="hidden">\n${inhoud}\n</svg>\n`
// Maskable: zelfde tekening met 60 eenheden extra rand, zodat het logo in de veilige cirkel valt
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 632 632" overflow="hidden">\n${inhoud}\n</svg>\n`

writeFileSync(new URL('public/logo.svg', root), icoon)
for (const n of [192, 512]) {
  await sharp(Buffer.from(maskable), { density: (72 * n * 4) / 512 })
    .resize(n, n)
    .png({ compressionLevel: 9 })
    .toFile(new URL(`public/maskable-wispo-${n}x${n}.png`, root).pathname.slice(1))
}
console.log('public/logo.svg en public/maskable-wispo-*.png gemaakt')
