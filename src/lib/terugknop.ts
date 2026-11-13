import { useEffect, useRef } from 'react'

/*
 * Terugknop (Android) of terugvegen sluit het bovenste open venster (foto, profiel) in plaats
 * van de app te verlaten. Bij openen zetten we een stap in de geschiedenis; "terug" haalt die
 * weg en sluit het venster. Sluit je het venster zelf (kruisje, Sluiten), dan halen we die stap
 * weer weg, zodat de geschiedenis klopt.
 *
 * Een stapel, zodat bij twee open vensters (bijv. een foto boven een profiel) "terug" alleen
 * het bovenste sluit.
 */

const stapel: (() => void)[] = []
// Zoveel popstates komen van ons eigen history.back() (zelf gesloten): niets mee doen
let negeer = 0
let gestart = false

function start() {
  if (gestart) return
  gestart = true
  window.addEventListener('popstate', () => {
    if (negeer > 0) {
      negeer--
      return
    }
    stapel[stapel.length - 1]?.()
  })
}

/** Zolang `open` waar is, sluit de terugknop dit venster via `onSluit` */
export function useTerugSluit(open: boolean, onSluit: () => void) {
  const sluit = useRef(onSluit)
  sluit.current = onSluit

  useEffect(() => {
    if (!open) return
    start()
    window.history.pushState({ venster: true }, '')
    let viaTerug = false
    const item = () => {
      viaTerug = true
      sluit.current()
    }
    stapel.push(item)
    return () => {
      const i = stapel.lastIndexOf(item)
      if (i >= 0) stapel.splice(i, 1)
      if (!viaTerug) {
        negeer++
        window.history.back()
      }
    }
  }, [open])
}
