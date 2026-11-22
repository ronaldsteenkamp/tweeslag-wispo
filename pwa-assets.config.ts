import { createAppleSplashScreens, defineConfig, type Preset } from '@vite-pwa/assets-generator/config'

// Achtergrondkleur rond het logo (app-icoon op iPhone/Android en het splashscreen)
const ACHTERGROND = '#0d0058'

// iPhone 16 Pro en 16 Pro Max (en nieuwer met dezelfde maat) staan nog niet in de lijst van de generator
const splash = createAppleSplashScreens({
  padding: 0.35,
  resizeOptions: { background: ACHTERGROND, fit: 'contain' },
  linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
  png: { compressionLevel: 9, quality: 70 },
  // Vaste namen, zodat de links in index.html en de bestanden altijd overeenkomen
  name: (landscape, size) =>
    `apple-splash-${landscape ? 'landscape' : 'portrait'}-${size.width}x${size.height}.png`,
})
splash.sizes.push({ width: 1206, height: 2622, scaleFactor: 3 }, { width: 1320, height: 2868, scaleFactor: 3 })

const preset: Preset = {
  // padding: 0 = logo vult het hele icoon. Gebruik je een logo met transparante
  // achtergrond, zet dan bijvoorbeeld padding: 0.1.
  transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  // Maskable staat als eigen bestand in public/ (maskable-wispo-*.png): het woordmerk moet binnen de
  // veilige cirkel blijven en de sneeuw moet tot de rand doorlopen, en dat kan de generator niet
  maskable: { sizes: [], padding: 0 },
  // iOS rondt de hoeken zelf af: het icoon vult het hele vlak
  apple: { sizes: [180], padding: 0, resizeOptions: { background: ACHTERGROND } },
  appleSplashScreens: splash,
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/logo.svg'],
})
