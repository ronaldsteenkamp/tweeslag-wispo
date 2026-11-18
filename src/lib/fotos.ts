import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { leesExifDatum } from './exifdatum'
import { lees, schrijf } from './opslag'
import { lokaalNaarDate } from './tijd'

/*
 * Fotomuur. Foto's worden in de browser verkleind (max. 1600 px, ~300 kB) plus een kleine
 * versie voor de muur (480 px), zonder EXIF-gegevens (dus ook zonder locatie). Alleen het
 * opnamemoment wordt vooraf uitgelezen en apart meegestuurd ('genomen'), zodat een foto die
 * later verstuurd wordt toch op de goede dag staat. Ze staan in de privé-bucket 'fotos' en zijn
 * alleen te zien via tijdelijke links (signed URLs).
 */

export const BUCKET = 'fotos'
export const LINK_GELDIG = 3600 // seconden

export interface Foto {
  id: string
  user_id: string
  naam: string
  kamer: string | null
  challenge_id: string
  challenge_titel: string
  pad: string
  breedte: number | null
  hoogte: number | null
  /** Moment van uploaden */
  gemaakt: string
  /** Moment dat de foto genomen is (sinds migratie 0015; anders gelijk aan gemaakt) */
  genomen?: string | null
  /** Tijdelijke link naar de kleine versie */
  klein?: string
}

/** Wanneer de foto genomen is: daarop staat hij op de muur */
export const momentVan = (f: Foto) => new Date(f.genomen ?? f.gemaakt)

export const kleinPad = (pad: string) => pad.replace(/\.jpg$/, '-klein.jpg')

// ---------- Verkleinen ----------

export async function laadBeeld(bestand: Blob) {
  if ('createImageBitmap' in window) {
    try {
      const bm = await createImageBitmap(bestand, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      return { bron: bm as CanvasImageSource, b: bm.width, h: bm.height, sluit: () => bm.close() }
    } catch {
      // Valt terug op <img> hieronder
    }
  }
  const url = URL.createObjectURL(bestand)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('Dit bestand kan de app niet lezen. Kies een foto (JPEG of PNG).')
  }
  return {
    bron: img as CanvasImageSource,
    b: img.naturalWidth,
    h: img.naturalHeight,
    sluit: () => URL.revokeObjectURL(url),
  }
}

async function naarJpeg(bron: CanvasImageSource, b: number, h: number, maxZijde: number, maxBytes: number) {
  let schaal = Math.min(1, maxZijde / Math.max(b, h))
  for (let poging = 0; poging < 6; poging++) {
    const w = Math.max(1, Math.round(b * schaal))
    const hh = Math.max(1, Math.round(h * schaal))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = hh
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Verkleinen lukt niet in deze browser')
    ctx.drawImage(bron, 0, 0, w, hh)
    for (const kwaliteit of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', kwaliteit))
      if (blob && blob.size <= maxBytes) return { blob, breedte: w, hoogte: hh }
    }
    schaal *= 0.8
  }
  throw new Error('De foto kon niet klein genoeg gemaakt worden')
}

export interface Verkleind {
  groot: Blob
  klein: Blob
  breedte: number
  hoogte: number
  /** Wanneer de foto genomen is (ISO), zie opnamemoment(). Ontbreekt bij oudere wachtende foto's. */
  genomen?: string
}

/**
 * Wanneer is de foto genomen? Eerst uit de EXIF van de foto zelf, anders de datum van het bestand,
 * anders nu (bij een foto die je net maakt klopt dat). Nooit in de toekomst.
 */
export async function opnamemoment(bestand: Blob, nu = Date.now()): Promise<Date> {
  let t: number | null = null
  try {
    const exif = leesExifDatum(await bestand.slice(0, 256 * 1024).arrayBuffer())
    if (exif) {
      // Met tijdzone als de telefoon die meeschreef, anders als tijd in Nederland/Frankrijk
      t = exif.offset ? new Date(`${exif.lokaal}${exif.offset}`).getTime() : lokaalNaarDate(exif.lokaal).getTime()
    }
  } catch {
    // Geen leesbare EXIF: dan de terugval hieronder
  }
  if ((t === null || Number.isNaN(t)) && bestand instanceof File && bestand.lastModified > 0) t = bestand.lastModified
  if (t === null || Number.isNaN(t) || t > nu) t = nu
  return new Date(t)
}

/** Verkleint een gekozen foto tot max. 1600 px en ~300 kB, plus een kleine versie voor de muur */
export async function verklein(bestand: Blob): Promise<Verkleind> {
  const genomen = (await opnamemoment(bestand)).toISOString()
  const beeld = await laadBeeld(bestand)
  try {
    const groot = await naarJpeg(beeld.bron, beeld.b, beeld.h, 1600, 300_000)
    const klein = await naarJpeg(beeld.bron, beeld.b, beeld.h, 480, 60_000)
    return { groot: groot.blob, klein: klein.blob, breedte: groot.breedte, hoogte: groot.hoogte, genomen }
  } finally {
    beeld.sluit()
  }
}

/**
 * Snijdt een vierkant uit de foto (in pixels van de foto, na draaien volgens EXIF) en maakt er
 * een JPEG van max. `uit` px van (voor de profielfoto).
 */
export async function snijUit(
  bestand: Blob,
  uitsnede: { x: number; y: number; zijde: number },
  uit = 512,
  maxBytes = 90_000,
): Promise<Blob> {
  const beeld = await laadBeeld(bestand)
  try {
    let doel = Math.max(1, Math.round(Math.min(uit, uitsnede.zijde)))
    for (let poging = 0; poging < 5; poging++) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = doel
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Verkleinen lukt niet in deze browser')
      ctx.drawImage(beeld.bron, uitsnede.x, uitsnede.y, uitsnede.zijde, uitsnede.zijde, 0, 0, doel, doel)
      for (const kwaliteit of [0.82, 0.72, 0.62]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', kwaliteit))
        if (blob && blob.size <= maxBytes) return blob
      }
      doel = Math.round(doel * 0.8)
    }
    throw new Error('De foto kon niet klein genoeg gemaakt worden')
  } finally {
    beeld.sluit()
  }
}

// ---------- Uploaden en verwijderen ----------

const FOUTEN: Record<string, string> = {
  geen_naam: 'Je naam is nog niet doorgegeven aan de server. Kies je naam op Home en probeer het zo opnieuw.',
}

const foutTekst = (e: unknown) => {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  return FOUTEN[m] ?? m
}

/** Bestaat dit bestand of deze foto al? (een eerdere poging die toch gelukt was) */
const bestaatAl = (e: unknown) => {
  const f = e as { message?: string; statusCode?: string | number; code?: string; error?: string }
  return (
    String(f?.statusCode) === '409' ||
    f?.code === '23505' ||
    /already exists|duplicate/i.test(`${f?.message ?? ''} ${f?.error ?? ''}`)
  )
}

/**
 * Uploadt beide versies en legt de foto vast. Geeft een foutmelding terug, of null als het gelukt is.
 * `id` hoort vast bij deze ene foto: een nieuwe poging met hetzelfde id (na een time-out of als de
 * app halverwege dichtging) zet hem er nooit twee keer op.
 */
export async function uploadFoto(
  foto: Verkleind,
  challenge: { id: string; titel: string },
  id: string = crypto.randomUUID(),
): Promise<string | null> {
  const cb = supabase()
  const b = backendStand()
  if (!cb || b.status !== 'verbonden' || !b.userId) return 'Geen verbinding. Uploaden kan alleen met internet.'
  if (!b.gekoppeld) return FOUTEN.geen_naam
  const c = await cb
  const pad = `${b.userId}/${id}.jpg`
  const opslag = c.storage.from(BUCKET)
  try {
    const [g, k] = await Promise.all([
      opslag.upload(pad, foto.groot, { contentType: 'image/jpeg', upsert: false }),
      opslag.upload(kleinPad(pad), foto.klein, { contentType: 'image/jpeg', upsert: false }),
    ])
    if (g.error && !bestaatAl(g.error)) throw g.error
    if (k.error && !bestaatAl(k.error)) throw k.error
    const rij: Record<string, unknown> = {
      pad,
      challenge_id: challenge.id,
      challenge_titel: challenge.titel.slice(0, 120),
      breedte: foto.breedte,
      hoogte: foto.hoogte,
      // naam en kamer vult de server zelf in
    }
    // 'genomen' neemt de server alleen over als het geloofwaardig is (zie migratie 0015)
    let { error } = await c.from('fotos').insert(foto.genomen ? { ...rij, genomen: foto.genomen } : rij)
    // Migratie 0015 nog niet gedraaid: dan zonder (de foto komt op het uploadmoment)
    if (error && foto.genomen && /genomen/.test(error.message ?? '')) ({ error } = await c.from('fotos').insert(rij))
    // Staat er al: een eerdere poging is toch aangekomen
    if (error && !bestaatAl(error)) throw error
    meldWijziging()
    return null
  } catch (e) {
    // Bestanden van een foto die al op de muur staat, laat de server hier niet weghalen (0009)
    await opslag.remove([pad, kleinPad(pad)]).catch(() => {})
    return `Uploaden lukte niet: ${foutTekst(e)}`
  }
}

export async function verwijderFoto(f: Foto): Promise<string | null> {
  const cb = supabase()
  if (!cb) return 'Geen verbinding'
  const c = await cb
  const { error: e1 } = await c.storage.from(BUCKET).remove([f.pad, kleinPad(f.pad)])
  if (e1) return `Verwijderen lukte niet: ${e1.message}`
  const { error: e2 } = await c.from('fotos').delete().eq('id', f.id)
  if (e2) return `Verwijderen lukte niet: ${e2.message}`
  meldWijziging()
  return null
}

/** Tijdelijke link naar de grote versie (bij het openen van een foto) */
export async function grooteLink(f: Foto): Promise<string | null> {
  const cb = supabase()
  if (!cb) return null
  const { data } = await (await cb).storage.from(BUCKET).createSignedUrl(f.pad, LINK_GELDIG)
  return data?.signedUrl ?? null
}

// ---------- Ophalen ----------

const wijzigingLuisteraars = new Set<() => void>()
const meldWijziging = () => wijzigingLuisteraars.forEach((f) => f())

/*
 * Onthouden, zodat foto's er direct staan als je terugkomt op een scherm (Home wordt bij elke
 * tabwissel opnieuw opgebouwd) en bij het openen van de app:
 * - de laatst opgehaalde lijst per aantal;
 * - de tijdelijke links per foto. Een nieuwe link is voor de browser een nieuwe afbeelding (die
 *   dan opnieuw laadt), dus een link wordt pas vervangen als hij bijna verloopt.
 */
type Lijst = { fotos: Foto[]; meer: boolean }
type Link = { url: string; tot: number }

/*
 * Ook bewaard op het apparaat, zodat de foto's er bij het openen van de app meteen staan. De
 * afbeeldingen zelf bewaart de service worker (op pad, los van de link; zie vite.config.ts), dus
 * ook een verlopen link toont de foto nog uit de cache tot de nieuwe lijst binnen is.
 */
const BEWAAR_SLEUTEL = 'fotocache'
const BEWAAR_MAX = 60

const bewaard = lees<{ lijsten?: [number, Lijst][]; links?: [string, Link][] }>(BEWAAR_SLEUTEL, {})
const lijstCache = new Map<number, Lijst>(Array.isArray(bewaard?.lijsten) ? bewaard.lijsten : [])
const linkCache = new Map<string, Link>(Array.isArray(bewaard?.links) ? bewaard.links : [])
/** Een link die korter dan dit nog geldig is, wordt vernieuwd (ruim binnen het verversen elke 45 min) */
const LINK_MARGE = 20 * 60_000

function bewaarCache() {
  const lijsten = [...lijstCache].filter(([n]) => n <= BEWAAR_MAX)
  const nodig = new Set(lijsten.flatMap(([, l]) => l.fotos.map((f) => kleinPad(f.pad))))
  for (const p of linkCache.keys()) if (!nodig.has(p)) linkCache.delete(p)
  schrijf(BEWAAR_SLEUTEL, { lijsten, links: [...linkCache] })
}

/** De nieuwste foto's, met tijdelijke links naar de kleine versies. Ververst live. */
export function useFotos(aantal: number, actief = true) {
  const [fotos, setFotos] = useState<Foto[] | null>(() => lijstCache.get(aantal)?.fotos ?? null)
  const [mislukt, setMislukt] = useState(false)
  const [limiet, setLimiet] = useState(aantal)
  const [meer, setMeer] = useState(() => lijstCache.get(aantal)?.meer ?? false)
  const weg = useRef(false)

  const ververs = useCallback(async () => {
    const cb = supabase()
    if (!cb || backendStand().status !== 'verbonden') {
      setMislukt(true)
      return
    }
    try {
      const c = await cb
      const velden = 'id, user_id, naam, kamer, challenge_id, challenge_titel, pad, breedte, hoogte, gemaakt'
      // Op volgorde van het moment dat de foto genomen is
      let { data, error } = await c
        .from('fotos')
        .select(`${velden}, genomen`)
        .order('genomen', { ascending: false })
        .order('gemaakt', { ascending: false })
        .limit(limiet + 1)
      // Migratie 0015 nog niet gedraaid (kolom 'genomen' bestaat niet): zoals vroeger
      if (error?.code === '42703') {
        const oud = await c.from('fotos').select(velden).order('gemaakt', { ascending: false }).limit(limiet + 1)
        data = oud.data as typeof data
        error = oud.error
      }
      if (error) throw error
      const rijen = (data ?? []) as Foto[]
      const zichtbaar = rijen.slice(0, limiet)
      // Alleen nieuwe links vragen voor foto's zonder (nog lang genoeg) geldige link
      const t = Date.now()
      const nodig = zichtbaar.map((f) => kleinPad(f.pad)).filter((p) => (linkCache.get(p)?.tot ?? 0) - t < LINK_MARGE)
      if (nodig.length) {
        const { data: links, error: e2 } = await c.storage.from(BUCKET).createSignedUrls(nodig, LINK_GELDIG)
        if (e2) throw e2
        for (const l of links ?? []) {
          if (l.path && l.signedUrl) linkCache.set(l.path, { url: l.signedUrl, tot: t + LINK_GELDIG * 1000 })
        }
      }
      for (const f of zichtbaar) f.klein = linkCache.get(kleinPad(f.pad))?.url
      const heeftMeer = rijen.length > limiet
      lijstCache.set(limiet, { fotos: zichtbaar, meer: heeftMeer })
      bewaarCache()
      if (weg.current) return
      setFotos(zichtbaar)
      setMeer(heeftMeer)
      setMislukt(false)
    } catch {
      if (!weg.current) setMislukt(true)
    }
  }, [limiet])

  useEffect(() => {
    weg.current = false
    if (!actief || !backendIngesteld) return
    let wacht: number | undefined
    let kanaal: RealtimeChannel | null = null
    const straks = () => {
      window.clearTimeout(wacht)
      wacht = window.setTimeout(() => void ververs(), 800)
    }
    void ververs()
    // Links verlopen na een uur: ruim daarvoor verversen
    const id = window.setInterval(() => void ververs(), 45 * 60_000)
    let vorige = backendStand().status
    const stop = abonneerBackend(() => {
      const nu = backendStand().status
      if (nu === 'verbonden' && vorige !== 'verbonden') straks()
      if (nu !== 'verbonden') setMislukt(true)
      vorige = nu
    })
    wijzigingLuisteraars.add(straks)
    const cb = supabase()
    void cb?.then((c) => {
      if (weg.current) return
      kanaal = c.channel(`fotos-${aantal}-${Math.random().toString(36).slice(2, 7)}`)
      kanaal.on('postgres_changes', { event: '*', schema: 'public', table: 'fotos' }, straks).subscribe()
    })
    return () => {
      weg.current = true
      window.clearTimeout(wacht)
      window.clearInterval(id)
      stop()
      wijzigingLuisteraars.delete(straks)
      if (kanaal) void cb?.then((c) => c.removeChannel(kanaal!))
    }
  }, [actief, ververs, aantal])

  return { fotos, mislukt, meer, laadMeer: () => setLimiet((l) => l + aantal) }
}
