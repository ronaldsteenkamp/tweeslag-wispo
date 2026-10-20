// Maakt een QR-code (PNG en SVG) die naar de app op GitHub Pages wijst.
// Gebruik:  npm run qr                    → gebruikt "homepage" uit package.json
//           npm run qr -- https://...     → gebruikt een andere URL
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const url = process.argv[2] ?? pkg.homepage

if (!url || !/^https?:\/\//.test(url)) {
  console.error('Geen geldige URL. Zet "homepage" in package.json of geef een URL mee: npm run qr -- https://...')
  process.exit(1)
}

const opties = {
  errorCorrectionLevel: 'M',
  margin: 4,
  color: { dark: '#0d0058', light: '#ffffff' },
}

const map = new URL('../qr/', import.meta.url)
await mkdir(map, { recursive: true })
await QRCode.toFile(fileURLToPath(new URL('tweeslag-wispo-qr.png', map)), url, {
  ...opties,
  width: 1200,
})
await writeFile(new URL('tweeslag-wispo-qr.svg', map), await QRCode.toString(url, { ...opties, type: 'svg' }))

console.log(`QR-code gemaakt voor ${url}`)
console.log('  qr/tweeslag-wispo-qr.png')
console.log('  qr/tweeslag-wispo-qr.svg')
