import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages zet de site op https://<gebruiker>.github.io/<repo-naam>/.
// De workflow geeft de repo-naam mee via BASE_PATH; lokaal valt hij terug op '/tweeslag-wispo/'.
const base = process.env.BASE_PATH ?? '/tweeslag-wispo/'

export default defineConfig({
  base,
  // Versie in Instellingen: de dag van de build
  define: { __BOUWDATUM__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  plugins: [
    react(),
    {
      // Het logo rechtstreeks in het laadscherm van index.html (geen apart verzoek, dus geen leeg moment)
      name: 'logo-in-laadscherm',
      transformIndexHtml: (html) =>
        html.replace('<!--logo-->', readFileSync(new URL('./public/logo.svg', import.meta.url), 'utf8').trim()),
    },
    {
      // De lettertypes meteen meeladen met de pagina. Anders vraagt de browser ze pas aan als de
      // JavaScript draait (main.tsx wacht erop), en dat kost de eerste keer openen bijna een seconde.
      name: 'lettertypes-vooraf',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: (_html, ctx) =>
          Object.keys(ctx.bundle ?? {})
            .filter((f) => /barlow.*\.woff2$/.test(f))
            .map((f) => ({
              tag: 'link',
              attrs: { rel: 'preload', href: `${base}${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
              injectTo: 'head' as const,
            })),
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // Iconen en iOS-splashscreens worden gemaakt uit public/logo.svg (zie pwa-assets.config.ts)
      pwaAssets: { config: true, overrideManifestIcons: false },
      manifest: {
        name: 'Tweeslag Wispo – Les Deux Alpes',
        short_name: 'Tweeslag Wispo',
        description: 'Planning, paklijst, kamers, pistekaart en het spel van de Tweeslag-wintersport.',
        lang: 'nl',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        background_color: '#0d0058',
        theme_color: '#0d0058',
        // Icoon: 2slag in een sterrennacht met La Meije (public/logo.svg en maskable-wispo-*.png,
        // gemaakt met scripts/icoon/maak-icoon.mjs)
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-wispo-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-wispo-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache-first voor de app zelf, de pistekaart en de iconen (precache)
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico,woff2}'],
        // Splashscreens haalt iOS zelf op bij het installeren; data gaat via network-first hieronder
        globIgnores: ['**/apple-splash-*', 'data/**'],
        // Ruim genoeg voor een grote, officiële pistekaart
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        clientsClaim: true,
        // Pushmeldingen tonen en openen (public/push-sw.js)
        importScripts: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Network-first voor de JSON-data: nieuwe versie als er bereik is, anders de bewaarde.
            // Op de berg is het bereik vaak traag: na 2 seconden wachten de bewaarde versie (de nieuwe
            // komt dan bij een volgende keer openen). Stale-while-revalidate zou altijd eerst de oude
            // tonen, ook bij goed bereik, en dan zie je een nieuwe planning of kamerverdeling pas later.
            urlPattern: /\/data\/[^/]+\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tweeslag-data',
              networkTimeoutSeconds: 2,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Foto's van de fotomuur (privé-bucket, tijdelijke links). Een foto verandert nooit (elk
            // pad is uniek), dus cache-first op het pad zonder de token: ook met een nieuwe of
            // verlopen link staat de foto er meteen, ook bij het openen van de app en zonder bereik.
            urlPattern: /\/storage\/v1\/object\/sign\/fotos\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tweeslag-fotos',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 24 * 3600, purgeOnQuotaError: true },
              plugins: [
                {
                  // Een <img> vraagt 'no-cors' en krijgt dan een ondoorzichtig antwoord (status 0, ook
                  // bij een fout). Supabase staat CORS toe, dus zo zien we de echte status.
                  requestWillFetch: async ({ request }) =>
                    new Request(request.url, { mode: 'cors', credentials: 'omit' }),
                  // Alleen echte foto's bewaren, nooit een foutmelding (bijv. een verlopen link)
                  cacheWillUpdate: async ({ response }) =>
                    response.status === 200 && (response.headers.get('content-type') ?? '').startsWith('image/')
                      ? response
                      : null,
                },
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const u = new URL(request.url)
                    u.search = ''
                    return u.href
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
})
