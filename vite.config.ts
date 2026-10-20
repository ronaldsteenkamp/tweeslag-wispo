import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages zet de site op https://<gebruiker>.github.io/<repo-naam>/.
// De workflow geeft de repo-naam mee via BASE_PATH; lokaal valt hij terug op '/tweeslag-wispo/'.
const base = process.env.BASE_PATH ?? '/tweeslag-wispo/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // Iconen en iOS-splashscreens worden gemaakt uit public/logo.svg (zie pwa-assets.config.ts)
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Tweeslag Wispo – Les Deux Alpes',
        short_name: 'Tweeslag Wispo',
        description: 'Planning, paklijst, kamers, pistekaart en het spel van de Tweeslag-wintersport.',
        lang: 'nl',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        background_color: '#0d0058',
        theme_color: '#0d0058',
      },
      workbox: {
        // Cache-first voor de app zelf, de pistekaart en de iconen (precache)
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico}'],
        // Splashscreens haalt iOS zelf op bij het installeren; data gaat via network-first hieronder
        globIgnores: ['**/apple-splash-*', 'data/**'],
        // Ruim genoeg voor een grote, officiële pistekaart
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Network-first voor de JSON-data: nieuwe versie als er bereik is, anders de bewaarde
            urlPattern: /\/data\/[^/]+\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tweeslag-data',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
