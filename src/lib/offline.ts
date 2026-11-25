import { useCallback, useEffect, useState } from 'react'
import { isGeinstalleerd } from './installatie'
import { meldingStatus } from './meldingen'
import { lees } from './opslag'

/*
 * "Klaar voor de berg?" in Instellingen: wat staat er op deze telefoon, zodat de app ook zonder
 * bereik werkt? Leest alleen wat de service worker al bewaard heeft (vite.config.ts): de app en
 * de pistekaart (precache), de gegevens ('tweeslag-data') en de foto's ('tweeslag-fotos').
 * Plus "App verversen": de nieuwste versie ophalen en de bewaarde gegevens en foto's opnieuw laden.
 */

const BASE = import.meta.env.BASE_URL
const DATA_CACHE = 'tweeslag-data'
const FOTO_CACHE = 'tweeslag-fotos'

export interface Controle {
  id: 'app' | 'planning' | 'paklijst' | 'kamers' | 'kaart' | 'weer' | 'fotos' | 'beginscherm' | 'meldingen'
  naam: string
  ok: boolean
  /** Korte toelichting, bijv. het tijdstip van het weer of het aantal foto's */
  extra?: string
}

const heeftCaches = () => typeof caches !== 'undefined'

async function gegevensBewaard(): Promise<Set<string>> {
  if (!heeftCaches()) return new Set()
  try {
    const c = await caches.open(DATA_CACHE)
    const sleutels = await c.keys()
    return new Set(sleutels.map((r) => new URL(r.url).pathname.split('/').pop() ?? ''))
  } catch {
    return new Set()
  }
}

async function kaartBewaard(): Promise<boolean> {
  if (!heeftCaches()) return false
  try {
    // De precache bewaart de kaart met een versie achter het adres: daarom ignoreSearch
    return !!(await caches.match(`${BASE}img/pistekaart.webp`, { ignoreSearch: true }))
  } catch {
    return false
  }
}

async function aantalFotos(): Promise<number> {
  if (!heeftCaches()) return 0
  try {
    if (!(await caches.has(FOTO_CACHE))) return 0
    return (await (await caches.open(FOTO_CACHE)).keys()).length
  } catch {
    return 0
  }
}

const uurMinuut = (ms: number) => new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
const dagEnTijd = (ms: number) => {
  const d = new Date(ms)
  const vandaag = new Date().toDateString() === d.toDateString()
  return vandaag ? uurMinuut(ms) : `${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${uurMinuut(ms)}`
}

export async function controleer(): Promise<Controle[]> {
  const [data, kaart, fotos] = await Promise.all([gegevensBewaard(), kaartBewaard(), aantalFotos()])
  const weer = lees<{ opgehaald?: number } | null>('weer.laatste', null)
  const meldingen = meldingStatus()
  const lijst: Controle[] = [
    { id: 'app', naam: 'De app zelf', ok: !!navigator.serviceWorker?.controller },
    { id: 'planning', naam: 'Planning', ok: data.has('planning.json') },
    { id: 'paklijst', naam: 'Paklijst', ok: data.has('paklijst.json') },
    { id: 'kamers', naam: 'Kamers', ok: data.has('kamers.json') },
    { id: 'kaart', naam: 'Pistekaart', ok: kaart },
    {
      id: 'weer',
      naam: 'Weer',
      ok: typeof weer?.opgehaald === 'number',
      extra: typeof weer?.opgehaald === 'number' ? `van ${dagEnTijd(weer.opgehaald)}` : undefined,
    },
    { id: 'fotos', naam: "Foto's", ok: fotos > 0, extra: fotos > 0 ? `${fotos} bewaard` : undefined },
    { id: 'beginscherm', naam: 'Op je beginscherm', ok: isGeinstalleerd() },
  ]
  // Meldingen alleen als ze hier kunnen (zonder server of in een browser zonder push: weglaten)
  if (meldingen !== 'geen-backend' && meldingen !== 'niet-ondersteund') {
    lijst.push({ id: 'meldingen', naam: 'Meldingen', ok: meldingen === 'aan' })
  }
  return lijst
}

/** De controle, opnieuw bij terugkomen in de app en na `opnieuw()` */
export function useKlaarVoorDeBerg() {
  const [lijst, setLijst] = useState<Controle[] | null>(null)
  const opnieuw = useCallback(() => {
    void controleer().then(setLijst)
  }, [])
  useEffect(() => {
    opnieuw()
    const opZichtbaar = () => document.visibilityState === 'visible' && opnieuw()
    document.addEventListener('visibilitychange', opZichtbaar)
    return () => document.removeEventListener('visibilitychange', opZichtbaar)
  }, [opnieuw])
  return { lijst, opnieuw }
}

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
  if (heeftCaches()) {
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
