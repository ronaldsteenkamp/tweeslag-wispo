import { useEffect, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { isGeinstalleerd, platform } from './installatie'
import { lees, schrijf } from './opslag'

/*
 * Pushmeldingen. Pas na een tik op "Meldingen aanzetten" wordt om toestemming gevraagd.
 * Het abonnement (endpoint + sleutels) gaat naar de tabel push_abonnementen; de Edge
 * Function `meldingen` verstuurt. Op een iPhone kan het alleen in de app op het
 * beginscherm (iOS 16.4 of nieuwer).
 */

export type MeldingStatus =
  | 'geen-backend'
  | 'ios-beginscherm'
  | 'niet-ondersteund'
  | 'geblokkeerd'
  | 'uit'
  | 'aan'

const AAN = 'meldingen.aan'
const GEKOPPELD = 'meldingen.gekoppeld'

const ondersteund = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function meldingStatus(): MeldingStatus {
  if (!backendIngesteld) return 'geen-backend'
  if (!ondersteund()) return platform() === 'ios' && !isGeinstalleerd() ? 'ios-beginscherm' : 'niet-ondersteund'
  if (Notification.permission === 'denied') return 'geblokkeerd'
  return Notification.permission === 'granted' && lees(AAN, false) ? 'aan' : 'uit'
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
  schrijf(GEKOPPELD, `${backendStand().userId}|${j.endpoint}`)
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
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: sleutel })
    await bewaarOpServer(sub)
    schrijf(AAN, true)
    meld()
    return null
  } catch (e) {
    return `Aanzetten lukte niet: ${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}`
  }
}

export async function zetMeldingenUit(): Promise<void> {
  schrijf(AAN, false)
  schrijf(GEKOPPELD, '')
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

/** Na wisselen van gebruiker (of opnieuw aanmelden) het abonnement opnieuw aan de juiste gebruiker koppelen */
async function herstel(altijd = false) {
  const b = backendStand()
  if (b.status !== 'verbonden' || !b.userId || meldingStatus() !== 'aan') return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) {
      // De browser is het abonnement kwijt: opnieuw aanzetten via de knop
      schrijf(AAN, false)
      meld()
      return
    }
    if (altijd || lees(GEKOPPELD, '') !== `${b.userId}|${sub.endpoint}`) await bewaarOpServer(sub)
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
}
