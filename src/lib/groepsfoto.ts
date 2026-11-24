import { useEffect, useState } from 'react'
import { abonneerBackend, backendStand, supabase } from './backend'
import { BUCKET, LINK_GELDIG, verklein } from './fotos'
import { lees, schrijfEnMeld, useOpgeslagen } from './opslag'

/*
 * De foto's van de pagina over de VakanCie (screens/VakanCie.tsx): de groepsfoto en per lid een
 * eigen foto. Die ledenfoto's staan los van de spelerskaartjes (profielen); zonder eigen foto toont
 * de pagina de profielfoto.
 *
 * Niet in de repo of in public/ (die zijn openbaar), maar in de privé-bucket 'fotos' van Supabase,
 * in de map 'vakancie/'. Net als de foto's in het clubblad alleen te zien via een tijdelijke link,
 * dus alleen in de app. Plaatsen en weghalen mag alleen een beheerder (migratie
 * 0020_vakancie_groepsfoto.sql geldt voor de hele map 'vakancie/', ook 'vakancie/leden/').
 *
 * De bestandsnamen zeggen alles wat nodig is, zodat er geen tabel bij hoeft:
 * - vakancie/groepsfoto-<tijdstip>-<breedte>x<hoogte>.jpg
 * - vakancie/leden/<naam>--<tijdstip>.jpg   (naam zoals lidSleutel() hem maakt, bijv. iepie-leah)
 * De app neemt steeds de nieuwste. Een nieuwe foto krijgt een nieuwe naam, zodat telefoons merken dat
 * hij veranderd is.
 *
 * Offline: de laatst opgehaalde foto's staan in Cache Storage ('tweeslag-vakancie'), welke dat zijn
 * in localStorage ('vakancie.groepsfoto' en 'vakancie.leden').
 */

const MAP = 'vakancie'
const LEDEN_MAP = `${MAP}/leden`
const CACHE_NAAM = 'tweeslag-vakancie'
const BEWAARD = 'vakancie.groepsfoto'
const LEDEN = 'vakancie.leden'

export interface GroepsfotoInfo {
  pad: string
  breedte: number | null
  hoogte: number | null
  /** Wanneer hij geplaatst is (ms) */
  geplaatst: number | null
}

/** Per lid (lidSleutel) het pad van de nieuwste foto */
type LedenFotos = Record<string, string>

/** groepsfoto-1764000000000-1600x1067.jpg → maten en moment */
export function leesNaam(naam: string): Omit<GroepsfotoInfo, 'pad'> | null {
  const m = /^groepsfoto-(\d+)(?:-(\d+)x(\d+))?\.jpg$/.exec(naam)
  if (!m) return null
  return { geplaatst: Number(m[1]), breedte: m[2] ? Number(m[2]) : null, hoogte: m[3] ? Number(m[3]) : null }
}

/** "Iepie Leah" → "iepie-leah" (veilig als bestandsnaam) */
export const lidSleutel = (naam: string) =>
  naam
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'lid'

/**
 * Van wie is dit bestand? "iepie-leah--1764000000000.jpg" (zo plaatst de app hem) en ook gewoon
 * "Iepie Leah.jpg" (zo kun je hem met de hand in Supabase Storage zetten) → "iepie-leah".
 */
export const lidUitNaam = (bestand: string) => {
  const m = /^(.+?)(?:--\d+)?\.jpe?g$/i.exec(bestand)
  return m ? lidSleutel(m[1]) : null
}

/**
 * Een foto heet in de app pad + versie, bijv. "vakancie/leden/Tom.jpg?v=2026-11-24T14:00:00Z".
 * Wordt een bestand met dezelfde naam vervangen, dan verandert de versie (wijzigingsdatum) en wordt
 * hij opnieuw opgehaald.
 */
const fotoId = (pad: string, versie?: string | null) => (versie ? `${pad}?v=${encodeURIComponent(versie)}` : pad)
const padVan = (id: string) => id.split('?v=')[0]

/**
 * Adres in de cache. Via new URL, zodat het precies zo geschreven wordt als cache.keys() het
 * teruggeeft (een spatie wordt %20): anders gooide het opruimen een foto als "Iepie Leah.jpg"
 * telkens weer weg.
 */
const cacheSleutel = (id: string) => new URL(`/__vakancie/${id}`, location.origin).href

// Wie wil weten dat een foto (net) in de cache staat (zie useCacheLink)
const opgehaaldLuisteraars = new Set<(id: string) => void>()

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
  await cache?.put(cacheSleutel(pad), new Response(blob, { headers: { 'content-type': 'image/jpeg' } })).catch(() => {})
  geheugen.set(pad, URL.createObjectURL(blob))
  opgehaaldLuisteraars.forEach((f) => f(pad))
}

/** Alles uit de cache weghalen wat niet meer in gebruik is */
async function ruimCacheOp() {
  const cache = await openCache()
  if (!cache) return
  const houden = new Set([
    ...Object.values(lees<LedenFotos>(LEDEN, {})),
    ...[lees<GroepsfotoInfo | null>(BEWAARD, null)?.pad].filter((p): p is string => !!p),
  ].map(cacheSleutel))
  for (const req of await cache.keys()) if (!houden.has(req.url)) await cache.delete(req)
}

/** Haalt een foto (id = pad + versie) op als hij nog niet in de cache staat. true = staat er nu. */
async function zorgVoor(c: Awaited<NonNullable<ReturnType<typeof supabase>>>, id: string) {
  if (await uitCache(id)) return true
  const { data: link } = await c.storage.from(BUCKET).createSignedUrl(padVan(id), LINK_GELDIG)
  if (!link?.signedUrl) return false
  const antwoord = await fetch(link.signedUrl)
  if (!antwoord.ok) return false
  await bewaarInCache(id, await antwoord.blob())
  return true
}

let bezig: Promise<void> | null = null
let laatst = 0

/** Kijkt op de server wat de nieuwste foto's zijn en haalt nieuwe op (hooguit eens per halve minuut) */
export function ververs(forceer = false): Promise<void> {
  if (!forceer && !bezig && Date.now() - laatst < 30_000) return Promise.resolve()
  bezig ??= verversNu().finally(() => {
    bezig = null
    laatst = Date.now()
  })
  return bezig
}

async function verversNu() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  try {
    const c = await cb
    const sorteer = { column: 'name', order: 'desc' } as const
    const [groep, leden] = await Promise.all([
      c.storage.from(BUCKET).list(MAP, { limit: 50, sortBy: sorteer }),
      c.storage.from(BUCKET).list(LEDEN_MAP, { limit: 200, sortBy: sorteer }),
    ])

    // Groepsfoto: de nieuwste (of weg, als een beheerder hem weghaalde)
    if (!groep.error) {
      const nieuwste = (groep.data ?? [])
        .filter((f) => leesNaam(f.name))
        .sort((a, b) => (a.name < b.name ? 1 : -1))[0]
      if (!nieuwste) {
        if (lees<GroepsfotoInfo | null>(BEWAARD, null)) schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, null)
      } else {
        const pad = `${MAP}/${nieuwste.name}`
        if (await zorgVoor(c, pad)) {
          if (lees<GroepsfotoInfo | null>(BEWAARD, null)?.pad !== pad)
            schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, { pad, ...leesNaam(nieuwste.name)! })
        }
      }
    }

    // Ledenfoto's: per lid de nieuwste (laatst gewijzigd)
    if (!leden.error) {
      const oud = lees<LedenFotos>(LEDEN, {})
      const nieuw: LedenFotos = {}
      const wanneer = (f: { updated_at?: string | null; created_at?: string | null }) => f.updated_at ?? f.created_at ?? ''
      const bestanden = (leden.data ?? []).sort((a, b) => wanneer(b).localeCompare(wanneer(a)) || b.name.localeCompare(a.name))
      for (const f of bestanden) {
        const lid = lidUitNaam(f.name)
        if (lid && !nieuw[lid]) nieuw[lid] = fotoId(`${LEDEN_MAP}/${f.name}`, wanneer(f))
      }
      for (const [lid, pad] of Object.entries(nieuw)) {
        // Lukt ophalen niet, dan de oude houden (als die er was)
        if (!(await zorgVoor(c, pad))) {
          if (oud[lid]) nieuw[lid] = oud[lid]
          else delete nieuw[lid]
        }
      }
      if (JSON.stringify(oud) !== JSON.stringify(nieuw)) schrijfEnMeld<LedenFotos>(LEDEN, nieuw)
    }
    await ruimCacheOp()
  } catch {
    // Dan blijven de bewaarde foto's staan
  }
}

/** Link (uit de cache) bij een pad, of null */
function useCacheLink(pad: string | null) {
  const [url, setUrl] = useState<string | null>(() => (pad ? (geheugen.get(pad) ?? null) : null))
  useEffect(() => {
    let weg = false
    if (!pad) {
      setUrl(null)
      return
    }
    setUrl(geheugen.get(pad) ?? null)
    void uitCache(pad).then((u) => !weg && u && setUrl(u))
    // Stond hij nog niet in de cache: zodra hij binnen is alsnog tonen
    const opgehaald = (id: string) => {
      if (id === pad && !weg) setUrl(geheugen.get(pad) ?? null)
    }
    opgehaaldLuisteraars.add(opgehaald)
    return () => {
      weg = true
      opgehaaldLuisteraars.delete(opgehaald)
    }
  }, [pad])
  return url
}

/** Bij openen en bij (weer) verbinding: kijken of er nieuwe foto's zijn */
function useVerversen() {
  useEffect(() => {
    void ververs()
    return abonneerBackend(() => {
      if (backendStand().status === 'verbonden') void ververs()
    })
  }, [])
}

/** De groepsfoto: link (uit de cache, of null) en maten */
export function useGroepsfoto() {
  const [info] = useOpgeslagen<GroepsfotoInfo | null>(BEWAARD, null)
  useVerversen()
  return { info, url: useCacheLink(info?.pad ?? null) }
}

/** De eigen VakanCie-foto van een lid (of null: dan toont de pagina de profielfoto) */
export function useLidFoto(naam: string) {
  const [leden] = useOpgeslagen<LedenFotos>(LEDEN, {})
  useVerversen()
  const pad = leden[lidSleutel(naam)] ?? null
  return { pad, url: useCacheLink(pad) }
}

/** Fout van de server leesbaar maken */
function foutTekst(e: { message?: string; statusCode?: string | number } | null | undefined): string {
  const m = e?.message ?? ''
  if (/row-level security|policy|unauthorized|403/i.test(m) || String(e?.statusCode) === '403')
    return 'De server laat het plaatsen niet toe. Ben je ingelogd als beheerder?'
  return m ? `Dat lukte niet: ${m}` : 'Dat lukte niet. Probeer het zo nog eens.'
}

const geenVerbinding = 'Geen verbinding met de server. Probeer het met internet nog eens.'

/**
 * Zet een foto in de bucket en haalt de oude(s) weg die `isOud` aanwijst. Geeft fout of null.
 * Een File wordt eerst verkleind; een Blob komt al klaar uit de bijsnijder (JPEG zonder EXIF).
 */
async function plaats(bestand: File | Blob, naamVoor: (v: { breedte: number; hoogte: number }) => string, map: string, isOud: (n: string) => boolean) {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return { fout: geenVerbinding }
  try {
    // Zelfde verkleining als in het clubblad: max. 1600 px, ~300 kB, zonder EXIF (dus zonder locatie)
    const v = bestand instanceof File ? await verklein(bestand) : { groot: bestand, breedte: 0, hoogte: 0 }
    const c = await cb
    const naam = naamVoor(v)
    const pad = `${map}/${naam}`
    const { error } = await c.storage.from(BUCKET).upload(pad, v.groot, { contentType: 'image/jpeg', upsert: false })
    if (error) return { fout: foutTekst(error) }
    // De vorige weghalen (lukt dat niet, dan wint de nieuwste toch)
    const { data } = await c.storage.from(BUCKET).list(map, { limit: 200 })
    const oud = (data ?? []).filter((f) => f.name !== naam && isOud(f.name)).map((f) => `${map}/${f.name}`)
    if (oud.length) await c.storage.from(BUCKET).remove(oud)
    await bewaarInCache(pad, v.groot)
    return { fout: null, pad, naam }
  } catch (e) {
    return { fout: foutTekst(e as { message?: string }) }
  }
}

/** Haalt alle bestanden in `map` weg die `isWeg` aanwijst. Geeft fout of null. */
async function haalWeg(map: string, isWeg: (n: string) => boolean): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return geenVerbinding
  try {
    const c = await cb
    const { data } = await c.storage.from(BUCKET).list(map, { limit: 200 })
    const paden = (data ?? []).filter((f) => isWeg(f.name)).map((f) => `${map}/${f.name}`)
    if (paden.length) {
      const { data: weg, error } = await c.storage.from(BUCKET).remove(paden)
      if (error) return foutTekst(error)
      // Zonder rechten geeft Supabase geen fout, maar haalt hij ook niets weg
      if (!weg?.length) return foutTekst({ statusCode: 403 })
    }
    return null
  } catch (e) {
    return foutTekst(e as { message?: string })
  }
}

/** Plaatst een nieuwe groepsfoto (alleen beheerders). Geeft een foutmelding terug, of null. */
export async function plaatsGroepsfoto(bestand: File): Promise<string | null> {
  const r = await plaats(bestand, (v) => `groepsfoto-${Date.now()}-${v.breedte}x${v.hoogte}.jpg`, MAP, (n) => !!leesNaam(n))
  if (r.fout || !r.pad) return r.fout
  schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, { pad: r.pad, ...leesNaam(r.naam!)! })
  await ruimCacheOp()
  return null
}

/** Haalt de groepsfoto weg (alleen beheerders) */
export async function haalGroepsfotoWeg(): Promise<string | null> {
  const fout = await haalWeg(MAP, (n) => !!leesNaam(n))
  if (fout) return fout
  schrijfEnMeld<GroepsfotoInfo | null>(BEWAARD, null)
  await ruimCacheOp()
  return null
}

/**
 * Plaatst de VakanCie-foto van een lid (alleen beheerders): de bijgesneden pasfoto (4:5) uit de
 * FotoBijsnijder. Geeft een foutmelding terug, of null.
 */
export async function plaatsLidFoto(lid: string, bestand: Blob): Promise<string | null> {
  const s = lidSleutel(lid)
  const r = await plaats(bestand, () => `${s}--${Date.now()}.jpg`, LEDEN_MAP, (n) => lidUitNaam(n) === s)
  if (r.fout || !r.pad) return r.fout
  // Nieuwe naam, dus geen versie nodig; bij de volgende keer verversen krijgt hij die van de server
  schrijfEnMeld<LedenFotos>(LEDEN, { ...lees<LedenFotos>(LEDEN, {}), [s]: r.pad })
  void ververs(true)
  await ruimCacheOp()
  return null
}

/** Haalt de VakanCie-foto van een lid weg; dan toont de pagina weer de profielfoto */
export async function haalLidFotoWeg(lid: string): Promise<string | null> {
  const s = lidSleutel(lid)
  const fout = await haalWeg(LEDEN_MAP, (n) => lidUitNaam(n) === s)
  if (fout) return fout
  const rest = { ...lees<LedenFotos>(LEDEN, {}) }
  delete rest[s]
  schrijfEnMeld<LedenFotos>(LEDEN, rest)
  await ruimCacheOp()
  return null
}
