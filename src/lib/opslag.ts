import { useEffect, useState } from 'react'

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

/** useState dat in localStorage bewaard wordt */
export function useOpgeslagen<T>(sleutel: string, standaard: T) {
  const [waarde, setWaarde] = useState<T>(() => lees(sleutel, standaard))
  useEffect(() => {
    schrijf(sleutel, waarde)
  }, [sleutel, waarde])
  return [waarde, setWaarde] as const
}
