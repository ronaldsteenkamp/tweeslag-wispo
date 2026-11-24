import { useEffect, useState } from 'react'
import { abonneerBackend, backendStand, supabase } from './backend'
import { BUCKET, LINK_GELDIG, verklein } from './fotos'
import { lees, schrijfEnMeld, useOpgeslagen } from './opslag'

/*
 * De groepsfoto van de VakanCie (pagina screens/VakanCie.tsx).
 *
 * Niet in de repo of in public/ (die zijn openbaar), maar in de privé-bucket 'fotos' van Supabase,
 * in de map 'vakancie/'. Net als de foto's in het clubblad alleen te zien via een tijdelijke link,
 * dus alleen in de app. Uploaden en weghalen mag alleen een beheerder (migratie
 * 0020_vakancie_groepsfoto.sql).
 *
 * De bestandsnaam zegt alles wat nodig is: groepsfoto-<tijdstip>-<breedte>x<hoogte>.jpg. Zo hoeft er
 * geen tabel bij: de app kijkt welke foto in de map de nieuwste is. Een nieuwe foto krijgt een
 * nieuwe naam, zodat telefoons merken dat hij veranderd is.
 *
 * Offline: de laatst opgehaalde foto staat in Cache Storage ('tweeslag-vakancie'), welke dat is in
 * localStorage ('vakancie.groepsfoto').
 */

const MAP = 'vakancie'
const CACHE_NAAM = 'tweeslag-vakancie'
const BEWAARD = 'vakancie.groepsfoto'

export interface GroepsfotoInfo {
  pad: string
  breedte: number | null
  hoogte: number | null
  /** Wanneer hij geplaatst is (ms) */
  geplaatst: number | null
}

/** groepsfoto-1764000000000-1600x1067.jpg → maten en moment */
export function leesNaam(naam: string): Omit<GroepsfotoInfo, 'pad'> | null {
  const m = /^groepsfoto-(\d+)(?:-(\d+)x(\d+))?\.jpg$/.exec(naam)
  if (!m) return null
  return { geplaatst: Number(m[1]), breedte: m[2] ? Number(m[2]) : null, hoogte: m[3] ? Number(m[3]) : null }
}

const cacheSleutel = (pad: string) => `${location.origin}/__vakancie/${pad}`

async function openCache() {
  try {
    return 'caches' in window ? await caches.open(CACHE_NAAM) : null
  } catch {
    return null
  }
}

// Eén link per pad in het geheugen, zodat heen en weer gaan niet opnieuw laadt
const geheugen = new Map<string, string>()

async function uitCache(pad: string): Promise<string | null> {
  const bekend = geheugen.get(pad)
  if (bekend) return bekend
  const cache = await openCache()
  const r = await cache?.match(cacheSleutel(pad))
  if (!r) return null
  const url = URL.createObjectURL(await r.blob())
  geheugen.set(pad, url)
  return url
}

async function bewaarInCache(pad: string, blob: Blob) {
  const cache = await openCache()
  if (cache) {
    // Alleen de nieuwste bewaren
    for (const req of await cache.keys()) await cache.delete(req)
    await cache.put(cacheSleutel(pad), new Response(blob, { headers: { 'content-type': 'image/jpeg' } })).catch(() => {})
  }
  const url = URL.createObjectURL(blob)
  geheugen.set(pad, url)
  return url
}

let bezig: Promise<void> | null = null

/** Kijkt op de server wat de nieuwste groepsfoto is en haalt hem op als hij nieuw is */
export function ververs(): Promise<void> {
  bezig ??= verversNu().finally(() => {
    bezig = null
  })
  return bezig
}

async function verversNu() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  try {
    const c = await cb
    const { data, error } = await c.storage
      .from(BUCKET)
      .list(MAP, { limit: 20, sortBy: { column: 'name', order: 'desc' } })
    if (error) return
    const nieuwste = (data ?? []).filter((f) => leesNaam(f.name)).sort((a, b) => (a.name < b.name ? 1 : -1))[0]
    if (!nieuwste) {
      // Weggehaald door een beheerder: ook hier weg
      if (lees<GroepsfotoInfo | null>(BEWAARD, null)) {
        schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, null)
        const cache = await openCache()
        for (const req of (await cache?.keys()) ?? []) await cache?.delete(req)
      }
      return
    }
    const pad = `${MAP}/${nieuwste.name}`
    const oud = lees<GroepsfotoInfo | null>(BEWAARD, null)
    if (oud?.pad === pad && (await uitCache(pad))) return
    const { data: link } = await c.storage.from(BUCKET).createSignedUrl(pad, LINK_GELDIG)
    if (!link?.signedUrl) return
    const antwoord = await fetch(link.signedUrl)
    if (!antwoord.ok) return
    await bewaarInCache(pad, await antwoord.blob())
    schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, { pad, ...leesNaam(nieuwste.name)! })
  } catch {
    // Dan blijft de bewaarde foto staan
  }
}

/** De groepsfoto: link (uit de cache, of null) en maten. Haalt een nieuwe op als er verbinding is. */
export function useGroepsfoto() {
  const [info] = useOpgeslagen<GroepsfotoInfo | null>(BEWAARD, null)
  const [url, setUrl] = useState<string | null>(() => (info ? (geheugen.get(info.pad) ?? null) : null))
  const pad = info?.pad ?? null

  useEffect(() => {
    let weg = false
    if (!pad) {
      setUrl(null)
      return
    }
    void uitCache(pad).then((u) => !weg && setUrl(u))
    return () => {
      weg = true
    }
  }, [pad])

  useEffect(() => {
    void ververs()
    return abonneerBackend(() => {
      if (backendStand().status === 'verbonden') void ververs()
    })
  }, [])

  return { info, url }
}

/** Fout van de server leesbaar maken */
function foutTekst(e: { message?: string; statusCode?: string | number } | null | undefined): string {
  const m = e?.message ?? ''
  if (/row-level security|policy|unauthorized|403/i.test(m) || String(e?.statusCode) === '403')
    return 'De server laat het plaatsen nog niet toe. Is migratie 0020_vakancie_groepsfoto.sql al gedraaid, en ben je ingelogd als beheerder?'
  return m ? `Dat lukte niet: ${m}` : 'Dat lukte niet. Probeer het zo nog eens.'
}

/** Plaatst een nieuwe groepsfoto (alleen beheerders). Geeft een foutmelding terug, of null. */
export async function plaatsGroepsfoto(bestand: File): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding met de server. Probeer het met internet nog eens.'
  try {
    // Zelfde verkleining als in het clubblad: max. 1600 px, ~300 kB, zonder EXIF (dus zonder locatie)
    const v = await verklein(bestand)
    const c = await cb
    const naam = `groepsfoto-${Date.now()}-${v.breedte}x${v.hoogte}.jpg`
    const pad = `${MAP}/${naam}`
    const { error } = await c.storage.from(BUCKET).upload(pad, v.groot, { contentType: 'image/jpeg', upsert: false })
    if (error) return foutTekst(error)
    // De vorige weghalen (lukt dat niet, dan wint de nieuwste toch)
    const { data } = await c.storage.from(BUCKET).list(MAP, { limit: 50 })
    const oud = (data ?? []).filter((f) => f.name !== naam).map((f) => `${MAP}/${f.name}`)
    if (oud.length) await c.storage.from(BUCKET).remove(oud)
    await bewaarInCache(pad, v.groot)
    schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, { pad, ...leesNaam(naam)! })
    return null
  } catch (e) {
    return foutTekst(e as { message?: string })
  }
}

/** Haalt de groepsfoto weg (alleen beheerders) */
export async function haalGroepsfotoWeg(): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding met de server. Probeer het met internet nog eens.'
  try {
    const c = await cb
    const { data } = await c.storage.from(BUCKET).list(MAP, { limit: 50 })
    const paden = (data ?? []).map((f) => `${MAP}/${f.name}`)
    if (paden.length) {
      const { data: weg, error } = await c.storage.from(BUCKET).remove(paden)
      if (error) return foutTekst(error)
      // Zonder rechten geeft Supabase geen fout, maar haalt hij ook niets weg
      if (!weg?.length) return foutTekst({ statusCode: 403 })
    }
    schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, null)
    const cache = await openCache()
    for (const req of (await cache?.keys()) ?? []) await cache?.delete(req)
    return null
  } catch (e) {
    return foutTekst(e as { message?: string })
  }
}
