import { useEffect, useRef, useState } from 'react'

// Alles wat de gebruiker zelf doet (vinkjes, naam, spel) staat alleen op dit apparaat.
const VOORVOEGSEL = 'tweeslag-wispo.'

export function lees<T>(sleutel: string, standaard: T): T {
  try {
    const ruw = window.localStorage.getItem(VOORVOEGSEL + sleutel)
    return ruw === null ? standaard : (JSON.parse(ruw) as T)
  } catch {
    return standaard
  }
}

export function schrijf<T>(sleutel: string, waarde: T): void {
  try {
    window.localStorage.setItem(VOORVOEGSEL + sleutel, JSON.stringify(waarde))
  } catch {
    // Privémodus of opslag vol: de app werkt door, alleen zonder bewaren
  }
}

// Zodat bijvoorbeeld een naam die je in het welkomstscherm kiest meteen ook op Home staat
const luisteraars = new Map<string, Set<(waarde: unknown) => void>>()

/** Bewaren buiten React, en schermen en abonnees meteen laten meekijken */
export function schrijfEnMeld<T>(sleutel: string, waarde: T): void {
  schrijf(sleutel, waarde)
  luisteraars.get(sleutel)?.forEach((f) => f(waarde))
}

/** Buiten React luisteren naar wijzigingen van een bewaarde waarde (bijv. de naam) */
export function abonneer(sleutel: string, f: (waarde: unknown) => void): () => void {
  const set = luisteraars.get(sleutel) ?? new Set()
  luisteraars.set(sleutel, set)
  set.add(f)
  return () => {
    set.delete(f)
  }
}

/** useState dat in localStorage bewaard wordt en gelijk blijft tussen schermen */
export function useOpgeslagen<T>(sleutel: string, standaard: T) {
  const [waarde, setWaarde] = useState<T>(() => lees(sleutel, standaard))
  const huidig = useRef<T>(waarde)
  huidig.current = waarde
  // Waarden die van een ander scherm kwamen (daar al bewaard): nooit terugschrijven. Een set,
  // omdat er twee meldingen kort na elkaar kunnen komen voordat dit scherm opnieuw tekent.
  const vanElders = useRef(new Set<unknown>())

  useEffect(() => {
    const set = luisteraars.get(sleutel) ?? new Set()
    luisteraars.set(sleutel, set)
    const luister = (w: unknown) => {
      if (Object.is(w, huidig.current)) return
      vanElders.current.add(w)
      setWaarde(w as T)
    }
    set.add(luister)
    // Bijwerken als de waarde veranderde tussen het lezen bij het openen en nu (bijv. een naam
    // die net op een ander scherm gekozen is terwijl dit scherm openging)
    const nu = lees(sleutel, standaard)
    if (JSON.stringify(nu) !== JSON.stringify(huidig.current)) luister(nu)
    return () => {
      set.delete(luister)
    }
    // standaard hoort bij de sleutel; niet bij elke render opnieuw abonneren
  }, [sleutel])

  // De beginwaarde komt uit de opslag: bij het openen van het scherm nooit terugschrijven. Een
  // net geopend scherm kan namelijk een verouderde waarde hebben gelezen (bijv. de oude naam,
  // als de nieuwe in hetzelfde moment op een ander scherm gekozen is).
  const geopend = useRef(false)
  useEffect(() => {
    if (!geopend.current) {
      geopend.current = true
      return
    }
    if (vanElders.current.has(waarde)) {
      vanElders.current.clear()
      return
    }
    // Staat dit al zo bewaard: niet opnieuw schrijven en melden
    if (ruw(sleutel) === JSON.stringify(waarde)) return
    schrijf(sleutel, waarde)
    luisteraars.get(sleutel)?.forEach((f) => f(waarde))
  }, [sleutel, waarde])

  return [waarde, setWaarde] as const
}

function ruw(sleutel: string): string | null {
  try {
    return window.localStorage.getItem(VOORVOEGSEL + sleutel)
  } catch {
    return null
  }
}
