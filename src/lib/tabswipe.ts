import { useEffect, useRef } from 'react'

/** Afstand vanaf de schermrand waar we niet luisteren: daar zit "terug" van iOS/Android */
const RAND = 24
/** Minimaal zoveel pixels horizontaal vegen */
const MIN_AFSTAND = 70
/** Langer dan dit is geen veeg meer maar slepen/lezen */
const MAX_DUUR = 600

/** Elementen met een eigen veeggebaar (kaart, fotomuur, bijsnijder) of vensters */
const EIGEN_GEBAAR = '.kaartvak, .foto-groot, .bijsnijder__kader, [role="dialog"], input, textarea, select'

/** Ligt het startpunt in iets dat zelf horizontaal scrollt (zoals de dagkiezer)? */
function scrolltHorizontaal(el: Element | null): boolean {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    if (e.scrollWidth > e.clientWidth + 1) {
      const ox = getComputedStyle(e).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
  }
  return false
}

/**
 * Naar links of rechts vegen wisselt naar de volgende of vorige tab.
 * Alleen actief als `aan` waar is; `onVeeg` krijgt +1 (volgende) of -1 (vorige).
 */
export function useTabSwipe(aan: boolean, onVeeg: (richting: 1 | -1) => void) {
  const terug = useRef(onVeeg)
  terug.current = onVeeg

  useEffect(() => {
    if (!aan) return
    let start: { x: number; y: number; t: number } | null = null

    const neer = (e: TouchEvent) => {
      start = null
      if (e.touches.length !== 1) return
      const { clientX: x, clientY: y } = e.touches[0]
      if (x < RAND || x > window.innerWidth - RAND) return
      const doel = e.target as Element | null
      if (doel?.closest(EIGEN_GEBAAR) || scrolltHorizontaal(doel)) return
      start = { x, y, t: Date.now() }
    }
    const extraVinger = (e: TouchEvent) => {
      if (e.touches.length > 1) start = null
    }
    const los = (e: TouchEvent) => {
      if (!start) return
      const { clientX, clientY } = e.changedTouches[0]
      const dx = clientX - start.x
      const dy = clientY - start.y
      const duur = Date.now() - start.t
      start = null
      if (duur > MAX_DUUR || Math.abs(dx) < MIN_AFSTAND || Math.abs(dx) < 2 * Math.abs(dy)) return
      terug.current(dx < 0 ? 1 : -1)
    }

    const afgebroken = () => {
      start = null
    }

    document.addEventListener('touchstart', neer, { passive: true })
    document.addEventListener('touchmove', extraVinger, { passive: true })
    document.addEventListener('touchend', los, { passive: true })
    document.addEventListener('touchcancel', afgebroken, { passive: true })
    return () => {
      document.removeEventListener('touchstart', neer)
      document.removeEventListener('touchmove', extraVinger)
      document.removeEventListener('touchend', los)
      document.removeEventListener('touchcancel', afgebroken)
    }
  }, [aan])
}
