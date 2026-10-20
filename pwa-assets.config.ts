import { createAppleSplashScreens, defineConfig, type Preset } from '@vite-pwa/assets-generator/config'

// Achtergrondkleur rond het logo (app-icoon op iPhone/Android en het splashscreen)
const ACHTERGROND = '#0d0058'

const preset: Preset = {
  // padding: 0 = logo vult het hele icoon. Gebruik je een logo met transparante
  // achtergrond, zet dan bijvoorbeeld padding: 0.1.
  transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  maskable: { sizes: [512], padding: 0.1, resizeOptions: { background: ACHTERGROND } },
  apple: { sizes: [180], padding: 0.1, resizeOptions: { background: ACHTERGROND } },
  appleSplashScreens: createAppleSplashScreens({
    padding: 0.35,
    resizeOptions: { background: ACHTERGROND, fit: 'contain' },
    linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
    png: { compressionLevel: 9, quality: 70 },
    // Vaste namen, zodat de links in index.html en de bestanden altijd overeenkomen
    name: (landscape, size) =>
      `apple-splash-${landscape ? 'landscape' : 'portrait'}-${size.width}x${size.height}.png`,
  }),
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/logo.svg'],
})
