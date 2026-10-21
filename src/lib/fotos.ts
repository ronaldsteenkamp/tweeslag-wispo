import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'

/*
 * Fotomuur. Foto's worden in de browser verkleind (max. 1600 px, ~300 kB) plus een kleine
 * versie voor de muur (480 px), zonder EXIF-gegevens (dus ook zonder locatie). Ze staan in
 * de privé-bucket 'fotos' en zijn alleen te zien via tijdelijke links (signed URLs).
 */

const BUCKET = 'fotos'
const LINK_GELDIG = 3600 // seconden

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
  gemaakt: string
  /** Tijdelijke link naar de kleine versie */
  klein?: string
}

export const kleinPad = (pad: string) => pad.replace(/\.jpg$/, '-klein.jpg')

// ---------- Verkleinen ----------

async function laadBeeld(bestand: Blob) {
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
  return { bron: img as CanvasImageSource, b: img.naturalWidth, h: img.naturalHeight, sluit: () => URL.revokeObjectURL(url) }
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
}

/** Verkleint een gekozen foto tot max. 1600 px en ~300 kB, plus een kleine versie voor de muur */
export async function verklein(bestand: Blob): Promise<Verkleind> {
  const beeld = await laadBeeld(bestand)
  try {
    const groot = await naarJpeg(beeld.bron, beeld.b, beeld.h, 1600, 300_000)
    const klein = await naarJpeg(beeld.bron, beeld.b, beeld.h, 480, 60_000)
    return { groot: groot.blob, klein: klein.blob, breedte: groot.breedte, hoogte: groot.hoogte }
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

/** Uploadt beide versies en legt de foto vast. Geeft een foutmelding terug, of null als het gelukt is. */
export async function uploadFoto(foto: Verkleind, challenge: { id: string; titel: string }): Promise<string | null> {
  const cb = supabase()
  const b = backendStand()
  if (!cb || b.status !== 'verbonden' || !b.userId) return 'Geen verbinding. Uploaden kan alleen met internet.'
  if (!b.gekoppeld) return FOUTEN.geen_naam
  const c = await cb
  const pad = `${b.userId}/${crypto.randomUUID()}.jpg`
  const opslag = c.storage.from(BUCKET)
  try {
    const [g, k] = await Promise.all([
      opslag.upload(pad, foto.groot, { contentType: 'image/jpeg', upsert: false }),
      opslag.upload(kleinPad(pad), foto.klein, { contentType: 'image/jpeg', upsert: false }),
    ])
    if (g.error) throw g.error
    if (k.error) throw k.error
    const { error } = await c.from('fotos').insert({
      pad,
      challenge_id: challenge.id,
      challenge_titel: challenge.titel.slice(0, 120),
      breedte: foto.breedte,
      hoogte: foto.hoogte,
      // naam en kamer vult de server zelf in
    })
    if (error) throw error
    meldWijziging()
    return null
  } catch (e) {
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

/** De nieuwste foto's, met tijdelijke links naar de kleine versies. Ververst live. */
export function useFotos(aantal: number, actief = true) {
  const [fotos, setFotos] = useState<Foto[] | null>(null)
  const [mislukt, setMislukt] = useState(false)
  const [limiet, setLimiet] = useState(aantal)
  const [meer, setMeer] = useState(false)
  const weg = useRef(false)

  const ververs = useCallback(async () => {
    const cb = supabase()
    if (!cb || backendStand().status !== 'verbonden') {
      setMislukt(true)
      return
    }
    try {
      const c = await cb
      const { data, error } = await c
        .from('fotos')
        .select('id, user_id, naam, kamer, challenge_id, challenge_titel, pad, breedte, hoogte, gemaakt')
        .order('gemaakt', { ascending: false })
        .limit(limiet + 1)
      if (error) throw error
      const rijen = (data ?? []) as Foto[]
      const zichtbaar = rijen.slice(0, limiet)
      if (zichtbaar.length) {
        const { data: links, error: e2 } = await c.storage
          .from(BUCKET)
          .createSignedUrls(zichtbaar.map((f) => kleinPad(f.pad)), LINK_GELDIG)
        if (e2) throw e2
        const perPad = new Map((links ?? []).map((l) => [l.path, l.signedUrl]))
        for (const f of zichtbaar) f.klein = perPad.get(kleinPad(f.pad)) ?? undefined
      }
      if (weg.current) return
      setFotos(zichtbaar)
      setMeer(rijen.length > limiet)
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
