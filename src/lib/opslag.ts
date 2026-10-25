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
const GEEN = Symbol('geen')

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
  const vanElders = useRef<unknown>(GEEN)

  useEffect(() => {
    const set = luisteraars.get(sleutel) ?? new Set()
    luisteraars.set(sleutel, set)
    const luister = (w: unknown) => {
      if (Object.is(w, huidig.current)) return
      vanElders.current = w
      setWaarde(w as T)
    }
    set.add(luister)
    return () => {
      set.delete(luister)
    }
  }, [sleutel])

  useEffect(() => {
    // Een waarde die van een ander scherm kwam is daar al bewaard
    if (Object.is(vanElders.current, waarde)) {
      vanElders.current = GEEN
      return
    }
    schrijf(sleutel, waarde)
    luisteraars.get(sleutel)?.forEach((f) => f(waarde))
  }, [sleutel, waarde])

  return [waarde, setWaarde] as const
}
