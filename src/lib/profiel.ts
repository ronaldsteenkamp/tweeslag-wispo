import { useEffect, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { BUCKET, LINK_GELDIG } from './fotos'
import { abonneer, lees, schrijfEnMeld, useOpgeslagen } from './opslag'

/*
 * Profielen. Je eigen profiel staat op deze telefoon ('profiel') en gaat naar de server zodra
 * er verbinding is, met dezelfde "nog versturen"-markering als de spelstand. De profielen van
 * iedereen worden lokaal bewaard ('profielen.cache'), hun foto's in de Cache Storage, zodat
 * ze ook zonder bereik op de berg te zien zijn.
 *
 * Een profiel hangt aan de naam (zoals de correcties), niet aan het apparaat: kiest iemand
 * zijn naam op een nieuwe telefoon, dan komt het profiel van de server mee.
 */

export type Ski = 'ski' | 'board' | 'allebei' | 'nooit'

export const SKI_KEUZES: { waarde: Ski; label: string }[] = [
  { waarde: 'ski', label: 'Ski' },
  { waarde: 'board', label: 'Board' },
  { waarde: 'allebei', label: 'Allebei' },
  { waarde: 'nooit', label: 'Nog nooit gedaan' },
]

export const NIVEAUS = [
  'Waar zit de rem?',
  'Blauw met beleid',
  'Rood is prima',
  'Zwart als het moet',
  'Zwarte piste voor ontbijt',
]

export const MAX = { feitje: 140, karaoke: 60, artiest: 60, angst: 80 }

/** Zoals de rij op de server */
export interface ProfielRij {
  naam: string
  ski: Ski
  niveau: number
  feitje: string
  karaoke: string
  artiest: string
  angst: string
  foto_pad: string | null
  bijgewerkt?: string
}

/** Je eigen profiel op deze telefoon */
export interface Profiel {
  naam: string
  ski: Ski | null
  niveau: number | null
  feitje: string
  karaoke: string
  artiest: string
  angst: string
  /** Pad van de foto op de server */
  foto: string | null
  /** Nieuwe foto (data-URL) die nog geüpload moet worden */
  fotoLokaal: string | null
  /** Staat (een versie van) dit profiel al op de server? */
  verstuurd?: boolean
}

const PROFIEL = 'profiel'
const TE_VERSTUREN = 'profiel.teVersturen'
const CACHE = 'profielen.cache'
const FOTO_CACHE = 'tweeslag-profielfotos'

interface Cache {
  rijen: ProfielRij[]
  opgehaald: number
}

export const sleutel = (naam: string) => naam.trim().toLowerCase()

export const leegProfiel = (naam: string): Profiel => ({
  naam,
  ski: null,
  niveau: null,
  feitje: '',
  karaoke: '',
  artiest: '',
  angst: '',
  foto: null,
  fotoLokaal: null,
})

const vanRij = (r: ProfielRij): Profiel => ({
  naam: r.naam,
  ski: r.ski,
  niveau: r.niveau,
  feitje: r.feitje,
  karaoke: r.karaoke ?? '',
  artiest: r.artiest ?? '',
  angst: r.angst ?? '',
  foto: r.foto_pad,
  fotoLokaal: null,
  verstuurd: true,
})

/** Alle vragen zijn verplicht (alleen de foto niet) */
export const isAf = (
  p: Pick<Profiel, 'ski' | 'niveau' | 'feitje' | 'karaoke' | 'artiest' | 'angst'> | null | undefined,
) => !!p && !!p.ski && !!p.niveau && [p.feitje, p.karaoke, p.artiest, p.angst].every((t) => (t ?? '').trim().length > 0)

/** Heeft deze naam al een volledig profiel (hier of op de server)? */
export function profielAfVoor(naam: string) {
  const p = lees<Profiel | null>(PROFIEL, null)
  return (p?.naam === naam && isAf(p)) || !!cacheRij(naam)
}

const cacheRij = (naam: string) => lees<Cache | null>(CACHE, null)?.rijen.find((r) => sleutel(r.naam) === sleutel(naam))

// ---------- Eigen profiel ----------

/** Het profiel bij de gekozen naam op deze telefoon */
export function useMijnProfiel(): Profiel | null {
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const [profiel] = useOpgeslagen<Profiel | null>(PROFIEL, null)
  if (!naam) return null
  // Aanvullen: een profiel van een eerdere versie van de app mist misschien velden (zoals artiest)
  return profiel?.naam === naam ? { ...leegProfiel(naam), ...profiel } : leegProfiel(naam)
}

export function slaProfielOp(p: Profiel) {
  schrijfEnMeld(PROFIEL, {
    ...p,
    feitje: p.feitje.trim(),
    karaoke: p.karaoke.trim(),
    artiest: p.artiest.trim(),
    angst: p.angst.trim(),
  })
  schrijfEnMeld(TE_VERSTUREN, true)
  void verstuurProfiel()
}

/** Na het kiezen van een (andere) naam: het profiel van die naam erbij zoeken */
function wisselNaam(naam: string | null) {
  if (!naam || lees<Profiel | null>(PROFIEL, null)?.naam === naam) return
  const rij = cacheRij(naam)
  schrijfEnMeld(PROFIEL, rij ? vanRij(rij) : leegProfiel(naam))
  schrijfEnMeld(TE_VERSTUREN, false)
  void haalProfielen()
}

// ---------- Versturen ----------

let bezig = false

/** Verstuurt het eigen profiel (en eerst een nieuwe foto) als dat nog moet en het kan */
export async function verstuurProfiel() {
  const b = backendStand()
  let p = lees<Profiel | null>(PROFIEL, null)
  if (!backendIngesteld || bezig || !lees(TE_VERSTUREN, false) || !p || !isAf(p)) return
  // Alleen het apparaat dat de naam op de server heeft mag schrijven
  if (b.status !== 'verbonden' || !b.userId || b.gekoppeld?.naam !== p.naam) return
  const cb = supabase()
  if (!cb) return
  bezig = true
  let gelukt = false
  try {
    const c = await cb
    const opslag = c.storage.from(BUCKET)
    let pad = p.foto
    if (p.fotoLokaal) {
      const blob = await (await fetch(p.fotoLokaal)).blob()
      pad = `${b.userId}/profiel-${crypto.randomUUID()}.jpg`
      const { error } = await opslag.upload(pad, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      await bewaarFoto(pad, blob)
      // Meteen onthouden, zodat een volgende poging (als het profiel hieronder mislukt)
      // de foto niet nog een keer uploadt
      const nu = lees<Profiel | null>(PROFIEL, null)
      if (nu?.naam === p.naam && nu.fotoLokaal === p.fotoLokaal) {
        p = { ...nu, foto: pad, fotoLokaal: null }
        schrijfEnMeld(PROFIEL, p)
      }
    }
    const { error } = await c.from('profielen').upsert(
      {
        naam: p.naam,
        ski: p.ski,
        niveau: p.niveau,
        feitje: p.feitje.slice(0, MAX.feitje),
        karaoke: p.karaoke.slice(0, MAX.karaoke),
        artiest: p.artiest.slice(0, MAX.artiest),
        angst: p.angst.slice(0, MAX.angst),
        foto_pad: pad,
      },
      { onConflict: 'naam' },
    )
    if (error) throw error
    // Oude foto opruimen, als die van dit apparaat was
    const oud = cacheRij(p.naam)?.foto_pad
    if (oud && oud !== pad && oud.startsWith(`${b.userId}/`)) await opslag.remove([oud]).catch(() => {})

    // Is er intussen niets veranderd, dan is alles verstuurd
    const nu = lees<Profiel | null>(PROFIEL, null)
    if (nu && nu.naam === p.naam) {
      const zelfde = JSON.stringify(nu) === JSON.stringify(p)
      schrijfEnMeld(PROFIEL, {
        ...nu,
        verstuurd: true,
        ...(nu.fotoLokaal === p.fotoLokaal ? { foto: pad, fotoLokaal: null } : {}),
      })
      if (zelfde) schrijfEnMeld(TE_VERSTUREN, false)
    }
    gelukt = true
  } catch {
    // Volgende keer opnieuw (bij weer verbinding of bij het opnieuw openen van de app)
  } finally {
    bezig = false
  }
  if (!gelukt) return
  // Tijdens het versturen nog iets aangepast: dat ook meteen sturen
  if (lees(TE_VERSTUREN, false)) void verstuurProfiel()
  else await haalProfielen()
}

// ---------- Profielen van iedereen ----------

let ophalen: Promise<void> | null = null

/** Haalt alle profielen op en bewaart ze lokaal */
export function haalProfielen(): Promise<void> {
  ophalen ??= haalProfielenNu().finally(() => {
    ophalen = null
  })
  return ophalen
}

async function haalProfielenNu() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  try {
    const c = await cb
    const { data, error } = await c
      .from('profielen')
      .select('naam, ski, niveau, feitje, karaoke, artiest, angst, foto_pad, bijgewerkt')
    if (error) throw error
    const rijen = (data ?? []) as ProfielRij[]
    schrijfEnMeld<Cache>(CACHE, { rijen, opgehaald: Date.now() })

    // Eigen profiel gelijk trekken met de server (bijv. na wisselen van telefoon of na
    // wissen door een beheerder), behalve als er hier nog iets verstuurd moet worden
    const naam = lees<string | null>('naam', null)
    if (naam && !lees(TE_VERSTUREN, false)) {
      const rij = rijen.find((r) => sleutel(r.naam) === sleutel(naam))
      const eigen = lees<Profiel | null>(PROFIEL, null)
      if (rij) schrijfEnMeld(PROFIEL, vanRij(rij))
      else if (eigen?.naam === naam && eigen.verstuurd) schrijfEnMeld(PROFIEL, leegProfiel(naam))
    }
    void ruimFotosOp(new Set(rijen.map((r) => r.foto_pad).filter((x): x is string => !!x)))
  } catch {
    // Dan blijft de bewaarde versie staan
  }
}

/** Alle bewaarde profielen, per naam. Haalt ze opnieuw op als er verbinding is. */
export function useProfielen() {
  const [cache] = useOpgeslagen<Cache | null>(CACHE, null)
  useEffect(() => {
    void haalProfielen()
  }, [])
  const perNaam = new Map((cache?.rijen ?? []).map((r) => [sleutel(r.naam), r]))
  return { perNaam, opgehaald: cache?.opgehaald ?? null }
}

/** Een beheerder wist een ongepast profiel (en de foto, als die er is) */
export async function wisProfiel(rij: ProfielRij): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding'
  const c = await cb
  const { error } = await c.from('profielen').delete().eq('naam', rij.naam)
  if (error) return `Wissen lukte niet: ${error.message}`
  if (rij.foto_pad)
    await c.storage
      .from(BUCKET)
      .remove([rij.foto_pad])
      .catch(() => {})
  await haalProfielen()
  return null
}

// ---------- Foto's (ook offline) ----------

const fotoSleutel = (pad: string) => `${location.origin}/__profielfoto/${pad}`
const geheugen = new Map<string, Promise<string | null>>()

async function fotoCache() {
  try {
    return 'caches' in window ? await caches.open(FOTO_CACHE) : null
  } catch {
    return null
  }
}

async function bewaarFoto(pad: string, blob: Blob) {
  const cache = await fotoCache()
  await cache?.put(fotoSleutel(pad), new Response(blob, { headers: { 'content-type': 'image/jpeg' } })).catch(() => {})
  geheugen.set(pad, Promise.resolve(URL.createObjectURL(blob)))
}

async function ruimFotosOp(houden: Set<string>) {
  const cache = await fotoCache()
  if (!cache) return
  const voorvoegsel = fotoSleutel('')
  for (const req of await cache.keys()) {
    const pad = req.url.startsWith(voorvoegsel) ? decodeURI(req.url.slice(voorvoegsel.length)) : null
    if (pad && !houden.has(pad)) await cache.delete(req)
  }
}

async function laadFoto(pad: string): Promise<string | null> {
  const cache = await fotoCache()
  const bewaard = await cache?.match(fotoSleutel(pad))
  if (bewaard) return URL.createObjectURL(await bewaard.blob())
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return null
  const { data } = await (await cb).storage.from(BUCKET).createSignedUrl(pad, LINK_GELDIG)
  if (!data?.signedUrl) return null
  const antwoord = await fetch(data.signedUrl)
  if (!antwoord.ok) return null
  const blob = await antwoord.blob()
  await cache?.put(fotoSleutel(pad), new Response(blob, { headers: { 'content-type': 'image/jpeg' } })).catch(() => {})
  return URL.createObjectURL(blob)
}

/** Link naar een profielfoto: eerst uit de bewaarde foto's, anders van de server */
export function useProfielFoto(pad: string | null, lokaal?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    if (lokaal || !pad) return
    let weg = false
    const probeer = () => {
      let belofte = geheugen.get(pad)
      if (!belofte) {
        belofte = laadFoto(pad).catch(() => null)
        geheugen.set(pad, belofte)
      }
      void belofte.then((u) => {
        if (u === null) geheugen.delete(pad) // later opnieuw proberen
        if (!weg) setUrl(u)
      })
    }
    probeer()
    // Zonder bereik nog niet bewaard: opnieuw proberen zodra er verbinding is
    const stop = abonneerBackend(() => {
      if (backendStand().status === 'verbonden' && !geheugen.has(pad)) probeer()
    })
    return () => {
      weg = true
      stop()
    }
  }, [pad, lokaal])
  return lokaal ?? url
}

// ---------- Starten ----------

let gestart = false

/** Eén keer bij het starten van de app */
export function startProfielen() {
  if (gestart) return
  gestart = true
  wisselNaam(lees<string | null>('naam', null))
  abonneer('naam', (n) => wisselNaam(n as string | null))
  if (!backendIngesteld) return
  // Alsnog versturen wat er nog ligt: terug in de app, weer internet, en elke minuut als vangnet
  // (verstuurProfiel doet niets als er niets te versturen is)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verstuurProfiel()
  })
  window.addEventListener('online', () => window.setTimeout(() => void verstuurProfiel(), 2000))
  window.setInterval(() => void verstuurProfiel(), 60_000)
  let vorige = ''
  abonneerBackend(() => {
    const b = backendStand()
    if (b.status !== 'verbonden') {
      vorige = ''
      return
    }
    void verstuurProfiel()
    const nu = `${b.status}|${b.gekoppeld?.naam ?? ''}`
    if (nu === vorige) return
    vorige = nu
    void haalProfielen()
  })
}
