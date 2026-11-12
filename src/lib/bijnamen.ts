import { useCallback } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { abonneer, lees, schrijfEnMeld, useOpgeslagen } from './opslag'

/*
 * Bijnamen. Iedereen kan zelf een bijnaam kiezen; de app toont die overal in plaats van de
 * gewone naam. De gewone naam blijft de sleutel voor scores, stemmen, kamers en profielen,
 * dus alleen wat er in beeld komt verandert (via toonNaam / useToonNaam).
 *
 * Net als bij het profiel: je eigen bijnaam staat op deze telefoon ('bijnaam.eigen') en gaat
 * naar de server zodra het kan. Die van iedereen worden lokaal bewaard ('bijnamen.cache'),
 * zodat ze ook zonder bereik op de berg kloppen.
 */

export const MAX_BIJNAAM = 30

export interface BijnaamRij {
  naam: string
  bijnaam: string
}

interface Eigen {
  naam: string
  /** null = geen bijnaam */
  bijnaam: string | null
  teVersturen: boolean
  /** Waarom het versturen niet lukte (bijv. bijnaam al bezet) */
  fout?: string | null
}

const EIGEN = 'bijnaam.eigen'
const CACHE = 'bijnamen.cache'

const sleutel = (naam: string) => naam.trim().toLowerCase()

const cacheRijen = () => lees<BijnaamRij[]>(CACHE, [])

function opzoeken(naam: string, eigen: Eigen | null, rijen: BijnaamRij[]): string {
  if (eigen && sleutel(eigen.naam) === sleutel(naam)) return eigen.bijnaam || naam
  return rijen.find((r) => sleutel(r.naam) === sleutel(naam))?.bijnaam || naam
}

/** Hoe iemand in beeld komt: de bijnaam als die er is, anders de gewone naam (buiten React) */
export const toonNaam = (naam: string) => opzoeken(naam, lees<Eigen | null>(EIGEN, null), cacheRijen())

/** Zoals toonNaam, maar het scherm ververst als er een bijnaam verandert */
export function useToonNaam(): (naam: string) => string {
  const [eigen] = useOpgeslagen<Eigen | null>(EIGEN, null)
  const [rijen] = useOpgeslagen<BijnaamRij[]>(CACHE, [])
  return useCallback((naam: string) => opzoeken(naam, eigen, rijen), [eigen, rijen])
}

/** "Bijnaam (Naam)", of alleen de naam als er geen bijnaam is. Voor beheerlijsten waar je moet weten wie het is. */
export function metEchteNaam(toon: (naam: string) => string, naam: string) {
  const b = toon(naam)
  return b === naam ? naam : `${b} (${naam})`
}

/** De bijnaam van iemand, of null (bijv. om de gewone naam er klein onder te zetten) */
export function useBijnaamVan(naam: string | null): string | null {
  const toon = useToonNaam()
  if (!naam) return null
  const b = toon(naam)
  return b !== naam ? b : null
}

/** Je eigen bijnaam (zoals nu op deze telefoon) en of er iets mis ging bij het versturen */
export function useEigenBijnaam(): { bijnaam: string | null; fout: string | null; teVersturen: boolean } {
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const [eigen] = useOpgeslagen<Eigen | null>(EIGEN, null)
  if (!naam || !eigen || eigen.naam !== naam) return { bijnaam: null, fout: null, teVersturen: false }
  return { bijnaam: eigen.bijnaam, fout: eigen.fout ?? null, teVersturen: eigen.teVersturen }
}

/**
 * Controleert een nieuwe bijnaam voor de eigen naam. Geeft een foutmelding of null.
 * `namen`: alle gewone namen, zodat niemand de naam van een ander als bijnaam kiest.
 */
export function bijnaamFout(bijnaam: string, naam: string, namen: string[]): string | null {
  const b = bijnaam.trim()
  if (!b) return null
  if (b.length > MAX_BIJNAAM) return `Hooguit ${MAX_BIJNAAM} tekens.`
  if (namen.some((n) => sleutel(n) === sleutel(b) && sleutel(n) !== sleutel(naam)))
    return 'Zo heet al iemand anders. Kies een andere bijnaam.'
  if (cacheRijen().some((r) => sleutel(r.bijnaam) === sleutel(b) && sleutel(r.naam) !== sleutel(naam)))
    return 'Iemand anders heeft die bijnaam al.'
  return null
}

/** Je eigen bijnaam opslaan (leeg = geen bijnaam) */
export function slaBijnaamOp(bijnaam: string) {
  const naam = lees<string | null>('naam', null)
  if (!naam) return
  const b = bijnaam.trim().slice(0, MAX_BIJNAAM)
  // Je gewone naam als bijnaam is hetzelfde als geen bijnaam
  schrijfEnMeld<Eigen>(EIGEN, { naam, bijnaam: b && b !== naam ? b : null, teVersturen: true, fout: null })
  void verstuurBijnaam()
}

/** Na het kiezen van een (andere) naam: de bijnaam van die naam erbij zoeken */
function wisselNaam(naam: string | null) {
  if (!naam || lees<Eigen | null>(EIGEN, null)?.naam === naam) return
  const rij = cacheRijen().find((r) => sleutel(r.naam) === sleutel(naam))
  schrijfEnMeld<Eigen>(EIGEN, { naam, bijnaam: rij?.bijnaam ?? null, teVersturen: false })
  void haalBijnamen()
}

// ---------- Versturen ----------

let bezig = false

export async function verstuurBijnaam() {
  const b = backendStand()
  const e = lees<Eigen | null>(EIGEN, null)
  if (!backendIngesteld || bezig || !e?.teVersturen) return
  // Alleen het apparaat dat de naam op de server heeft mag schrijven
  if (b.status !== 'verbonden' || !b.userId || b.gekoppeld?.naam !== e.naam) return
  const cb = supabase()
  if (!cb) return
  bezig = true
  let gelukt = false
  try {
    const c = await cb
    const { error } = e.bijnaam
      ? await c.from('bijnamen').upsert({ naam: e.naam, bijnaam: e.bijnaam }, { onConflict: 'naam' })
      : await c.from('bijnamen').delete().eq('naam', e.naam)
    const nu = lees<Eigen | null>(EIGEN, null)
    if (error?.code === '23505') {
      // Bijnaam al bezet: terug naar wat er op de server staat, en dat laten zien
      if (nu?.naam === e.naam && nu.bijnaam === e.bijnaam) {
        const rij = cacheRijen().find((r) => sleutel(r.naam) === sleutel(e.naam))
        schrijfEnMeld<Eigen>(EIGEN, {
          naam: e.naam,
          bijnaam: rij?.bijnaam ?? null,
          teVersturen: false,
          fout: `"${e.bijnaam}" is al de bijnaam van iemand anders.`,
        })
      }
      return
    }
    if (error) throw error
    if (nu?.naam === e.naam && nu.bijnaam === e.bijnaam) schrijfEnMeld<Eigen>(EIGEN, { ...nu, teVersturen: false, fout: null })
    gelukt = true
  } catch {
    // Volgende keer opnieuw (bij weer verbinding of bij het opnieuw openen van de app)
  } finally {
    bezig = false
  }
  if (!gelukt) return
  if (lees<Eigen | null>(EIGEN, null)?.teVersturen) void verstuurBijnaam()
  else await haalBijnamen()
}

// ---------- Bijnamen van iedereen ----------

let ophalen: Promise<void> | null = null

export function haalBijnamen(): Promise<void> {
  ophalen ??= haalBijnamenNu().finally(() => {
    ophalen = null
  })
  return ophalen
}

async function haalBijnamenNu() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  try {
    const c = await cb
    const { data, error } = await c.from('bijnamen').select('naam, bijnaam')
    if (error) throw error
    const rijen = ((data ?? []) as BijnaamRij[]).sort((a, b) => a.naam.localeCompare(b.naam))
    if (JSON.stringify(rijen) !== JSON.stringify(cacheRijen())) schrijfEnMeld(CACHE, rijen)

    // Eigen bijnaam gelijk trekken met de server (bijv. na wisselen van telefoon of na wissen
    // door een beheerder), behalve als er hier nog iets verstuurd moet worden
    const naam = lees<string | null>('naam', null)
    const eigen = lees<Eigen | null>(EIGEN, null)
    if (naam && !(eigen?.naam === naam && eigen.teVersturen)) {
      const bijnaam = rijen.find((r) => sleutel(r.naam) === sleutel(naam))?.bijnaam ?? null
      if (eigen?.naam !== naam || eigen.bijnaam !== bijnaam)
        schrijfEnMeld<Eigen>(EIGEN, { naam, bijnaam, teVersturen: false, fout: eigen?.naam === naam ? eigen.fout : null })
    }
  } catch {
    // Dan blijft de bewaarde versie staan (bijv. als migratie 0010 nog niet gedraaid is)
  }
}

/** Een beheerder wist een ongepaste bijnaam */
export async function wisBijnaam(naam: string): Promise<string | null> {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return 'Geen verbinding'
  const { error } = await (await cb).from('bijnamen').delete().eq('naam', naam)
  if (error) return `Wissen lukte niet: ${error.message}`
  await haalBijnamen()
  return null
}

// ---------- Starten ----------

let gestart = false

/** Eén keer bij het starten van de app */
export function startBijnamen() {
  if (gestart) return
  gestart = true
  wisselNaam(lees<string | null>('naam', null))
  abonneer('naam', (n) => wisselNaam(n as string | null))
  if (!backendIngesteld) return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    void verstuurBijnaam()
    void haalBijnamen()
  })
  window.addEventListener('online', () => window.setTimeout(() => void verstuurBijnaam(), 2000))
  window.setInterval(() => void verstuurBijnaam(), 60_000)
  // Elke 5 minuten de bijnamen van de anderen bijwerken
  window.setInterval(() => void haalBijnamen(), 5 * 60_000)
  let vorige = ''
  abonneerBackend(() => {
    const b = backendStand()
    if (b.status !== 'verbonden') {
      vorige = ''
      return
    }
    void verstuurBijnaam()
    const nu = `${b.status}|${b.gekoppeld?.naam ?? ''}`
    if (nu === vorige) return
    vorige = nu
    void haalBijnamen()
  })
}
