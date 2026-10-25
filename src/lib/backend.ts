import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { laad } from './data'
import { abonneer, lees, schrijf, schrijfEnMeld } from './opslag'

/*
 * Koppeling met Supabase voor de gedeelde functies (scorebord, stemming, meldingen, foto's).
 *
 * De app werkt ook zonder: ontbreken de omgevingsvariabelen, of is er geen internet,
 * dan blijft de status 'uit' of 'offline' en tonen gedeelde onderdelen "Geen verbinding".
 * De Supabase-code wordt pas geladen als er een backend is ingesteld.
 */

const URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
export const backendIngesteld = URL.startsWith('https://') && KEY.length > 20

export type BackendStatus = 'uit' | 'verbinden' | 'verbonden' | 'offline'

export interface BackendStand {
  status: BackendStatus
  /** Id van dit apparaat (anoniem) of van de ingelogde beheerder */
  userId?: string
  email?: string
  anoniem: boolean
  beheerder: boolean
  /** Naam en kamer zoals ze op de server staan, of null als dat nog moet gebeuren */
  gekoppeld: { naam: string; kamer: string | null } | null
}

let stand: BackendStand = {
  status: backendIngesteld ? 'verbinden' : 'uit',
  anoniem: true,
  beheerder: false,
  gekoppeld: null,
}
const luisteraars = new Set<() => void>()
function zet(deel: Partial<BackendStand>) {
  stand = { ...stand, ...deel }
  luisteraars.forEach((f) => f())
}
export const backendStand = () => stand

/** Buiten React luisteren naar veranderingen in de verbinding */
export function abonneerBackend(f: () => void): () => void {
  luisteraars.add(f)
  return () => {
    luisteraars.delete(f)
  }
}

// ---------- Client ----------

let clientBelofte: Promise<SupabaseClient> | null = null

/** De Supabase-client, of null als er geen backend is ingesteld */
export function supabase(): Promise<SupabaseClient> | null {
  if (!backendIngesteld) return null
  clientBelofte ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const c = createClient(URL, KEY, {
      // fetch pas op het moment zelf opzoeken (zo is een storing ook na te bootsen bij het testen)
      global: { fetch: (...args: Parameters<typeof fetch>) => window.fetch(...args) },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // 'implicit' zodat de inloglink ook werkt als hij in een andere browser opent
        flowType: 'implicit',
        storageKey: 'tweeslag-wispo.auth',
      },
    })
    c.auth.onAuthStateChange((_gebeurtenis, sessie) => {
      // Buiten de callback afhandelen; Supabase raadt aan hier niet te wachten op andere aanroepen
      window.setTimeout(() => verwerkSessie(c, sessie), 0)
    })
    return c
  })
  return clientBelofte
}

async function verwerkSessie(c: SupabaseClient, sessie: Session | null) {
  if (!sessie) {
    zet({ userId: undefined, email: undefined, anoniem: true, beheerder: false, gekoppeld: null })
    return
  }
  const anoniem = sessie.user.is_anonymous ?? !sessie.user.email
  const nieuweGebruiker = sessie.user.id !== stand.userId
  zet({ userId: sessie.user.id, email: sessie.user.email ?? undefined, anoniem, ...(nieuweGebruiker ? { gekoppeld: null } : {}) })
  if (!anoniem) {
    const { data, error } = await c.rpc('is_beheerder')
    zet({ beheerder: !error && data === true })
  } else {
    zet({ beheerder: false })
  }
  if (nieuweGebruiker) void stuurProfiel()
}

// ---------- Verbinden ----------

let bezig = false

/** Zorgt voor een (anonieme) sessie en controleert of de server bereikbaar is */
export async function verbind() {
  const cb = supabase()
  if (!cb || bezig) return
  bezig = true
  try {
    const c = await cb
    if (!navigator.onLine) {
      zet({ status: 'offline' })
      return
    }
    if (stand.status !== 'verbonden') zet({ status: 'verbinden' })
    let {
      data: { session },
    } = await c.auth.getSession()
    if (!session) {
      // Geen inlogscherm: elk apparaat krijgt stil een eigen anonieme gebruiker
      const { data, error } = await c.auth.signInAnonymously()
      if (error) throw error
      session = data.session
    }
    // Controle of de server bereikbaar is én of de eigen rij er nog staat
    const eigenRij = (uid: string) => c.from('deelnemers').select('naam').eq('user_id', uid).maybeSingle()
    let { data: eigen, error } = await eigenRij(session!.user.id)
    if (error && isSessieWeg(error)) {
      // Sessie niet meer geldig: opnieuw beginnen met een nieuwe anonieme gebruiker
      await c.auth.signOut({ scope: 'local' })
      schrijf('backend.profiel', '')
      const nieuw = await c.auth.signInAnonymously()
      if (nieuw.error) throw nieuw.error
      session = nieuw.data.session
      ;({ data: eigen, error } = await eigenRij(session!.user.id))
    }
    if (error) throw error
    // Rij verdwenen (bijv. door een beheerder verwijderd): naam opnieuw versturen
    if (!eigen) schrijf('backend.profiel', '')
    await verwerkSessie(c, session)
    zet({ status: 'verbonden' })
    await stuurProfiel()
  } catch {
    zet({ status: 'offline' })
  } finally {
    bezig = false
  }
}

/** Fout omdat de sessie niet (meer) geldig is, in plaats van een netwerkprobleem */
function isSessieWeg(fout: { code?: string; message?: string; status?: number }): boolean {
  const tekst = `${fout.code ?? ''} ${fout.message ?? ''}`.toLowerCase()
  return fout.status === 401 || fout.code === 'PGRST301' || tekst.includes('jwt') || tekst.includes('not found')
}

// ---------- Naam en kamer koppelen ----------

async function kamerVan(naam: string): Promise<string | null> {
  try {
    const kamers = await laad('kamers')
    return kamers.kamers.find((k) => k.bewoners.includes(naam))?.nummer ?? null
  } catch {
    return null
  }
}

let profielBezig: Promise<void> | null = null
let profielNogmaals = false
let nogmaalsOvernemen = false

/** Deze naam is door een ander apparaat overgenomen (zie stuurProfiel), of null */
export const NAAM_OVERGENOMEN = 'naam.overgenomen'

/**
 * Stuurt de gekozen naam (en de kamer uit kamers.json) naar de server, als dat nog niet gebeurd is.
 * Nooit twee tegelijk: komt er een verzoek bij terwijl er één loopt, dan volgt er daarna nog één.
 *
 * `overnemen`: alleen als iemand op dit apparaat zelf de naam kiest, mag het de naam van een
 * ander apparaat afpakken. Anders pakken Safari en de app op het beginscherm van dezelfde iPhone
 * (elk met een eigen opslag) elkaar bij elk openen de naam af, en springt de score heen en weer.
 */
export function stuurProfiel(forceer = false, overnemen = false): Promise<void> {
  if (profielBezig) {
    profielNogmaals = true
    nogmaalsOvernemen ||= overnemen
    return profielBezig
  }
  profielBezig = stuurProfielNu(forceer, overnemen).finally(() => {
    profielBezig = null
    if (profielNogmaals) {
      const o = nogmaalsOvernemen
      profielNogmaals = false
      nogmaalsOvernemen = false
      void stuurProfiel(false, o)
    }
  })
  return profielBezig
}

async function stuurProfielNu(forceer: boolean, overnemen: boolean) {
  const cb = supabase()
  const naam = lees<string | null>('naam', null)
  if (!cb || !naam || !stand.userId || stand.status === 'offline') return
  const kamer = await kamerVan(naam)
  const sleutel = `${stand.userId}|${naam}|${kamer ?? ''}`
  if (!forceer && lees('backend.profiel', '') === sleutel) {
    zet({ gekoppeld: { naam, kamer } })
    return
  }
  try {
    const c = await cb
    if (!overnemen) {
      // Hoort de naam inmiddels bij een ander apparaat? Dan niet terugpakken, maar loslaten
      const { data: anderen, error } = await c.from('deelnemers').select('user_id, naam').neq('user_id', stand.userId)
      if (error) throw error
      if ((anderen ?? []).some((d) => d.naam.trim().toLowerCase() === naam.trim().toLowerCase())) {
        if (lees<string | null>('naam', null) === naam) {
          schrijf('backend.profiel', '')
          zet({ gekoppeld: null })
          schrijfEnMeld('naam', null)
          schrijfEnMeld(NAAM_OVERGENOMEN, naam)
        }
        return
      }
    }
    const { error } = await c.rpc('kies_naam', { p_naam: naam, p_kamer: kamer })
    if (error?.code === '23503') {
      // Deze gebruiker bestaat niet meer op de server (bijv. na opruimen): opnieuw aanmelden
      await c.auth.signOut({ scope: 'local' })
      schrijf('backend.profiel', '')
      zet({ status: 'verbinden', userId: undefined, gekoppeld: null })
      window.setTimeout(() => void verbind(), 0)
      return
    }
    if (error) throw error
    schrijf('backend.profiel', sleutel)
    zet({ gekoppeld: { naam, kamer } })
  } catch {
    // Volgende keer opnieuw (bij weer verbinding)
    zet({ gekoppeld: null })
  }
}

// ---------- Beheerders: inloggen met e-mail ----------

/** Stuurt een e-mail met inloglink (en code) naar de beheerder */
export async function stuurInlogmail(email: string): Promise<string | null> {
  const cb = supabase()
  if (!cb) return 'Er is geen backend ingesteld.'
  const c = await cb
  const { error } = await c.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    // Zonder #: Supabase zet de inloggegevens zelf achter een # in de link
    options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
  })
  return error ? error.message : null
}

/** Inloggen met de code uit de e-mail (handig in de app op het beginscherm van een iPhone) */
export async function controleerCode(email: string, code: string): Promise<string | null> {
  const cb = supabase()
  if (!cb) return 'Er is geen backend ingesteld.'
  const c = await cb
  const { error } = await c.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' })
  return error ? error.message : null
}

/** Uitloggen als beheerder: dit apparaat wordt weer een gewone (anonieme) deelnemer */
export async function uitloggen() {
  const cb = supabase()
  if (!cb) return
  const c = await cb
  await c.auth.signOut()
  schrijf('backend.profiel', '')
  await verbind()
}

// ---------- Starten ----------

let gestart = false

/** Eén keer aanroepen bij het starten van de app */
export function startBackend() {
  if (gestart || !backendIngesteld) return
  gestart = true
  void verbind()
  window.addEventListener('online', () => void verbind())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verbind()
  })
  // Zolang er geen verbinding is, elke minuut opnieuw proberen
  window.setInterval(() => {
    if (stand.status !== 'verbonden') void verbind()
  }, 60_000)
  // Zelf een (andere) naam gekozen: meteen doorgeven, ook als een ander apparaat hem had
  abonneer('naam', (n) => {
    if (n === null) return
    schrijfEnMeld(NAAM_OVERGENOMEN, null)
    void stuurProfiel(false, true)
  })
}

export function useBackend(): BackendStand {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])
  return stand
}
