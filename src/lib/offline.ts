import { useEffect, useState } from 'react'

/*
 * "App verversen" in Instellingen: de nieuwste versie ophalen en de bewaarde gegevens en foto's
 * opnieuw laden (de caches uit vite.config.ts: 'tweeslag-data' en 'tweeslag-fotos').
 */

const DATA_CACHE = 'tweeslag-data'
const FOTO_CACHE = 'tweeslag-fotos'

/**
 * App verversen: de nieuwste versie ophalen (en meteen gebruiken), de bewaarde gegevens en foto's
 * weggooien en de app opnieuw laden. Naam, paklijst, spel en raderen staan in localStorage en
 * blijven dus staan; de lijst met foto-adressen ('fotocache') ook, de foto's zelf komen opnieuw.
 * Alleen met bereik (anders zou de app na het herladen leeg kunnen zijn).
 */
export async function verversApp(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  if (reg) {
    await reg.update().catch(() => {})
    // Er staat een nieuwe versie klaar: die nu gebruiken (zelfde als "Vernieuw" in de melding)
    const wacht = reg.waiting ?? (reg.installing ? await nieuweKlaar(reg) : null)
    if (wacht) {
      const overgenomen = new Promise<void>((klaar) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => klaar(), { once: true })
        window.setTimeout(klaar, 4000)
      })
      wacht.postMessage({ type: 'SKIP_WAITING' })
      await overgenomen
    }
  }
  if (typeof caches !== 'undefined') {
    await Promise.all([caches.delete(DATA_CACHE), caches.delete(FOTO_CACHE)]).catch(() => {})
  }
  window.location.reload()
}

/** Wacht (hooguit 15 s) tot een net gevonden nieuwe versie klaar is met installeren */
function nieuweKlaar(reg: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  return new Promise((klaar) => {
    const sw = reg.installing
    if (!sw) return klaar(reg.waiting)
    const t = window.setTimeout(() => klaar(reg.waiting), 15_000)
    sw.addEventListener('statechange', () => {
      if (sw.state === 'installed' || sw.state === 'redundant') {
        window.clearTimeout(t)
        klaar(reg.waiting)
      }
    })
  })
}

/** Is er (waarschijnlijk) bereik? */
export function useBereik() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const aan = () => setOnline(true)
    const uit = () => setOnline(false)
    window.addEventListener('online', aan)
    window.addEventListener('offline', uit)
    return () => {
      window.removeEventListener('online', aan)
      window.removeEventListener('offline', uit)
    }
  }, [])
  return online
}
