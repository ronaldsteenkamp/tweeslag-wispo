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
// Zoveel popstates komen van ons eigen history.go(-n) (zelf gesloten): niets mee doen
let negeer = 0
let gestart = false

/*
 * Zelf gesloten vensters halen hun stap niet meteen weg, maar net daarna. Gaat in dezelfde tik een
 * nieuw venster open (bijv. "Nog een keer": het briefje sluit en het insturen opent), dan neemt
 * dat de vrijgekomen stap over. Anders zou de terug-stap van het oude venster de nieuwe stap weghalen
 * en ging het volgende sluiten één stap te ver: de app uit.
 */
let vrij = 0
let gepland = false
function ruimOp() {
  gepland = false
  if (vrij <= 0) return
  const n = vrij
  vrij = 0
  negeer++
  window.history.go(-n)
}

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
    // Een stap die net vrijkwam hergebruiken, anders een nieuwe stap
    if (vrij > 0) vrij--
    else window.history.pushState({ venster: true }, '')
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
        vrij++
        if (!gepland) {
          gepland = true
          window.setTimeout(ruimOp, 0)
        }
      }
    }
  }, [open])
}
