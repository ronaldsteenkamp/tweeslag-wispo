import { useEffect, useState } from 'react'
import { abonneerBackend, backendIngesteld, backendStand } from './backend'
import { uploadFoto, type Verkleind } from './fotos'

/*
 * Foto's die zonder bereik als bewijs zijn gemaakt. Ze staan (verkleind) in IndexedDB op deze
 * telefoon en gaan vanzelf naar de fotomuur zodra er verbinding is en de naam gekoppeld is.
 * De challenge telt meteen als gedaan; alleen de foto komt later.
 */

interface Wachtend {
  id: string
  foto: Verkleind
  challenge: { id: string; titel: string }
  pogingen: number
}

/** Na zoveel mislukte pogingen (met verbinding) geven we het op, anders blijft hij eeuwig hangen */
const MAX_POGINGEN = 5

const DB = 'tweeslag-wispo'
const WINKEL = 'fotowachtrij'

function open(): Promise<IDBDatabase> {
  return new Promise((ok, mis) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(WINKEL, { keyPath: 'id' })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mis(r.error)
  })
}

async function metWinkel<T>(modus: IDBTransactionMode, f: (w: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((ok, mis) => {
      const r = f(db.transaction(WINKEL, modus).objectStore(WINKEL))
      r.onsuccess = () => ok(r.result)
      r.onerror = () => mis(r.error)
    })
  } finally {
    db.close()
  }
}

const alle = () => metWinkel<Wachtend[]>('readonly', (w) => w.getAll() as IDBRequest<Wachtend[]>)

/** Wat de Fotomuur van een wachtende foto laat zien ("Ter perse") */
export interface WachtendeFoto {
  id: string
  titel: string
  pogingen: number
  /** Wordt nu verstuurd */
  bezig: boolean
  /** Tijdelijke link naar de kleine versie op deze telefoon */
  klein: string
}

let aantal = 0
let lijst: Wachtend[] = []
let bezigMet: string | null = null
const voorbeelden = new Map<string, string>()
const luisteraars = new Set<() => void>()
const meld = () => luisteraars.forEach((f) => f())
async function telOpnieuw() {
  try {
    lijst = await alle()
  } catch {
    lijst = []
  }
  aantal = lijst.length
  // Voorbeeldjes opruimen van foto's die er niet meer zijn
  for (const [id, url] of voorbeelden) {
    if (!lijst.some((r) => r.id === id)) {
      URL.revokeObjectURL(url)
      voorbeelden.delete(id)
    }
  }
  meld()
}

function alsLijst(): WachtendeFoto[] {
  return lijst.map((r) => {
    if (!voorbeelden.has(r.id)) voorbeelden.set(r.id, URL.createObjectURL(r.foto.klein))
    return { id: r.id, titel: r.challenge.titel, pogingen: r.pogingen, bezig: r.id === bezigMet, klein: voorbeelden.get(r.id)! }
  })
}

/** Bewaart een foto om later te versturen. Geeft een foutmelding, of null als het gelukt is. */
export async function bewaarVoorLater(foto: Verkleind, challenge: { id: string; titel: string }): Promise<string | null> {
  try {
    const rij: Wachtend = { id: crypto.randomUUID(), foto, challenge, pogingen: 0 }
    await metWinkel('readwrite', (w) => w.put(rij))
    void telOpnieuw()
    return null
  } catch {
    return 'Bewaren op deze telefoon lukte niet (opslag vol of privémodus).'
  }
}

let bezig = false

/** Verstuurt wat er klaarstaat, als het kan */
export async function verstuurWachtrij() {
  const b = backendStand()
  if (bezig || b.status !== 'verbonden' || !b.gekoppeld) return
  bezig = true
  try {
    for (const rij of await alle()) {
      if (backendStand().status !== 'verbonden') break
      bezigMet = rij.id
      meld()
      const fout = await uploadFoto(rij.foto, rij.challenge)
      if (!fout || rij.pogingen + 1 >= MAX_POGINGEN) await metWinkel('readwrite', (w) => w.delete(rij.id))
      else await metWinkel('readwrite', (w) => w.put({ ...rij, pogingen: rij.pogingen + 1 }))
    }
  } catch {
    // Volgende keer opnieuw
  } finally {
    bezig = false
    bezigMet = null
    void telOpnieuw()
  }
}

/** De foto's die nog op verbinding wachten, voor het blok "Ter perse" op de Fotomuur */
export function useFotoWachtrijLijst(): WachtendeFoto[] {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])
  return alsLijst()
}

/** Aantal foto's dat nog op verbinding wacht */
export function useFotoWachtrij() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    luisteraars.add(f)
    return () => {
      luisteraars.delete(f)
    }
  }, [])
  return aantal
}

let gestart = false

/** Eén keer bij het starten van de app */
export function startFotoWachtrij() {
  if (gestart || !backendIngesteld || !('indexedDB' in window)) return
  gestart = true
  void telOpnieuw()
  abonneerBackend(() => void verstuurWachtrij())
  window.addEventListener('online', () => window.setTimeout(() => void verstuurWachtrij(), 2000))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verstuurWachtrij()
  })
}
