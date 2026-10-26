import { useEffect, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { isGeinstalleerd, platform } from './installatie'
import { lees, schrijf } from './opslag'

/*
 * Pushmeldingen. Pas na een tik op "Meldingen aanzetten" wordt om toestemming gevraagd.
 * Het abonnement (endpoint + sleutels) gaat naar de tabel push_abonnementen; de Edge
 * Function `meldingen` verstuurt. Op een iPhone kan het alleen in de app op het
 * beginscherm (iOS 16.4 of nieuwer).
 *
 * Eén keer aanzetten is genoeg: zolang er toestemming is en je ze niet zelf uitzet, staan ze aan.
 * Is de browser het abonnement kwijt of heeft hij het vernieuwd, dan meldt de app zich
 * vanzelf opnieuw aan en zet het nieuwe abonnement op de server (zie herstel).
 */

export type MeldingStatus =
  | 'geen-backend'
  | 'ios-beginscherm'
  | 'niet-ondersteund'
  | 'geblokkeerd'
  | 'uit'
  | 'aan'

/** Van een eerdere versie: waar = aan. Alleen nog gebruikt om 'uitgezet' te bepalen. */
const AAN = 'meldingen.aan'
/** Zelf op Uitzetten getikt (of nog nooit aangezet) */
const UITGEZET = 'meldingen.uitgezet'
/** Welk abonnement van welke gebruiker op de server staat, en wanneer dat voor het laatst is doorgegeven */
const GEKOPPELD = 'meldingen.gekoppeld'
/** Zo vaak het abonnement opnieuw doorgeven, voor als de server het intussen kwijt is */
const OPNIEUW_MS = 12 * 60 * 60 * 1000

function uitgezet(): boolean {
  const v = lees<boolean | null>(UITGEZET, null)
  if (v !== null) return v
  // Eerdere versie: de app zette 'aan' zelf uit als de browser het abonnement kwijt was. Alleen wie
  // zelf op Uitzetten tikte (dan is 'gekoppeld' leeg) of nooit aanzette, blijft uit.
  const oud = !lees(AAN, false) && !lees(GEKOPPELD, '')
  schrijf(UITGEZET, oud)
  return oud
}

/** Opnieuw aanmelden zonder tik lukte niet (sommige browsers willen een tik): dan de knop tonen */
let herstelMislukt = false

const ondersteund = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function meldingStatus(): MeldingStatus {
  if (!backendIngesteld) return 'geen-backend'
  if (!ondersteund()) return platform() === 'ios' && !isGeinstalleerd() ? 'ios-beginscherm' : 'niet-ondersteund'
  if (Notification.permission === 'denied') return 'geblokkeerd'
  return Notification.permission === 'granted' && !uitgezet() && !herstelMislukt ? 'aan' : 'uit'
}

const luisteraars = new Set<() => void>()
const meld = () => luisteraars.forEach((f) => f())

export function useMeldingen() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])
  return meldingStatus()
}

/** Foutmelding uit de Edge Function halen */
async function functieFout(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  try {
    const j = await ctx?.json()
    if (j?.fout) return String(j.fout)
  } catch {
    // geen JSON
  }
  return error instanceof Error ? error.message : String(error)
}

async function roepAan<T>(body: Record<string, unknown>): Promise<{ data?: T; fout?: string }> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return { fout: 'Geen verbinding' }
  const c = await cb
  const { data, error } = await c.functions.invoke('meldingen', { body })
  if (error) return { fout: await functieFout(error) }
  return { data: data as T }
}

function naarBytes(base64url: string) {
  const b = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
}

async function publiekeSleutel(): Promise<string> {
  const bewaard = lees<string | null>('meldingen.sleutel', null)
  if (bewaard) return bewaard
  const { data, fout } = await roepAan<{ publiek: string }>({ soort: 'sleutel' })
  if (fout || !data?.publiek) throw new Error(fout ?? 'Geen sleutel ontvangen')
  schrijf('meldingen.sleutel', data.publiek)
  return data.publiek
}

async function bewaarOpServer(sub: PushSubscription) {
  const j = sub.toJSON()
  const cb = supabase()
  if (!cb || !j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error('Onvolledig abonnement')
  const c = await cb
  const { error } = await c.rpc('bewaar_abonnement', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
  if (error) throw error
  schrijf(GEKOPPELD, { sleutel: `${backendStand().userId}|${j.endpoint}`, tijd: Date.now() })
}

/** Het abonnement van deze browser, met de goede sleutel; maakt er een als dat zonder tik kan */
async function abonnement(maakAan: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  const sleutel = naarBytes(await publiekeSleutel())
  let sub = await reg.pushManager.getSubscription()
  if (sub) {
    // Aangemeld met een andere sleutel (bijv. ander project)? Dan opnieuw.
    const huidig = sub.options.applicationServerKey
    const zelfde = huidig && new Uint8Array(huidig).every((b, i) => b === sleutel[i])
    if (!zelfde) {
      await sub.unsubscribe()
      sub = null
    }
  }
  if (!sub && maakAan) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: sleutel })
  return sub
}

/** Na een tik op de knop: toestemming vragen, aanmelden en op de server zetten. Geeft een fout terug of null. */
export async function zetMeldingenAan(): Promise<string | null> {
  if (!ondersteund()) return 'Deze browser ondersteunt geen meldingen.'
  // Eerst de vraag om toestemming, direct na de tik (iPhone wil dat zo)
  const toestemming = await Notification.requestPermission()
  meld()
  if (toestemming !== 'granted') {
    return toestemming === 'denied'
      ? 'Je hebt meldingen geblokkeerd. Zet ze aan in de instellingen van je telefoon.'
      : 'Geen toestemming gekregen.'
  }
  if (backendStand().status !== 'verbonden') return 'Geen verbinding. Probeer het zo opnieuw.'
  try {
    const sub = await abonnement(true)
    if (!sub) throw new Error('Geen abonnement gekregen')
    await bewaarOpServer(sub)
    schrijf(UITGEZET, false)
    herstelMislukt = false
    meld()
    return null
  } catch (e) {
    return `Aanzetten lukte niet: ${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}`
  }
}

export async function zetMeldingenUit(): Promise<void> {
  schrijf(UITGEZET, true)
  schrijf(GEKOPPELD, null)
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      const cb = supabase()
      if (cb) await (await cb).from('push_abonnementen').delete().eq('endpoint', endpoint)
    }
  } catch {
    // Lukt het niet, dan ruimt de server het later zelf op (410 bij versturen)
  }
  meld()
}

/** Testmelding naar je eigen apparaat */
export async function stuurTestmelding(): Promise<string> {
  // Eerst zeker weten dat dit apparaat (nog) goed op de server staat
  await herstel(true)
  const { data, fout } = await roepAan<{ gelukt: number; mislukt: number; opgeruimd: number; fouten?: string[] }>({
    soort: 'test',
  })
  if (fout === 'geen_abonnement') return 'Dit apparaat staat nog niet op de server. Zet meldingen uit en weer aan.'
  if (fout) return `Lukte niet: ${fout}`
  if (data && data.gelukt > 0) return 'Testmelding verstuurd. Hij komt zo binnen.'
  const reden = data?.fouten?.[0] ?? (data?.opgeruimd ? 'het abonnement was verlopen' : 'onbekend')
  return `Versturen lukte niet (${reden}). Zet meldingen uit en weer aan.`
}

// ---------- Beheer ----------

export async function stuurBericht(titel: string, tekst: string, url: string) {
  return roepAan<{ gelukt: number; mislukt: number; opgeruimd: number }>({ soort: 'bericht', titel, tekst, url })
}

export interface LogRegel {
  id: number
  soort: string
  titel: string
  tekst: string | null
  aantal: number
  gemaakt: string
}

export async function haalLogboek(): Promise<{ regels: LogRegel[]; apparaten: number; personen: number } | null> {
  const cb = supabase()
  if (!cb) return null
  const c = await cb
  const [l, s] = await Promise.all([
    c.from('meldingen').select('id, soort, titel, tekst, aantal, gemaakt').order('gemaakt', { ascending: false }).limit(15),
    c.rpc('meldingen_statistiek'),
  ])
  if (l.error || s.error) return null
  const st = (s.data as { apparaten: number; personen: number }[])[0] ?? { apparaten: 0, personen: 0 }
  return { regels: (l.data ?? []) as LogRegel[], ...st }
}

// ---------- Starten ----------

/**
 * Houdt meldingen aan zonder dat je opnieuw hoeft te tikken: is de browser het abonnement kwijt,
 * dan meldt hij zich opnieuw aan; is het abonnement nieuw, van een andere gebruiker, of al een
 * tijdje niet doorgegeven, dan gaat het (opnieuw) naar de server.
 */
async function herstel(altijd = false) {
  const b = backendStand()
  if (b.status !== 'verbonden' || !b.userId || !ondersteund()) return
  if (Notification.permission !== 'granted' || uitgezet()) return
  let sub: PushSubscription | null
  try {
    sub = await abonnement(true)
  } catch {
    // Opnieuw aanmelden kan hier alleen na een tik: de knop "Meldingen aanzetten" komt terug
    if (!herstelMislukt) {
      herstelMislukt = true
      meld()
    }
    return
  }
  if (!sub) return
  if (herstelMislukt) {
    herstelMislukt = false
    meld()
  }
  const g = lees<{ sleutel?: string; tijd?: number } | string | null>(GEKOPPELD, null)
  const opServer = typeof g === 'object' && g?.sleutel === `${b.userId}|${sub.endpoint}` && Date.now() - (g.tijd ?? 0) < OPNIEUW_MS
  if (!altijd && opServer) return
  try {
    await bewaarOpServer(sub)
  } catch {
    // Volgende keer opnieuw
  }
}

let gestart = false

export function startMeldingen() {
  if (gestart || !backendIngesteld || !ondersteund()) return
  gestart = true
  let vorige = ''
  abonneerBackend(() => {
    const b = backendStand()
    const nu = `${b.status}|${b.userId}`
    if (nu !== vorige) {
      vorige = nu
      void herstel()
    }
  })
  // Ook bij terugkomen in de app en af en toe, zodat een vernieuwd abonnement snel weer op de server staat
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void herstel()
  })
  window.setInterval(() => void herstel(), 60 * 60 * 1000)
}
