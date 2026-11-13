import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

/*
 * Vegen tussen tabs, met een overgang in de stijl van Material "shared axis (X)":
 * tijdens het vegen volgt het scherm je vinger; loslaten voorbij de drempel (of een snelle
 * flick) schuift het weg en het nieuwe scherm schuift een klein stukje in terwijl het
 * opkomt. Niet ver genoeg: het scherm veert terug.
 */

/** Afstand vanaf de schermrand waar we niet luisteren: daar zit "terug" van iOS/Android */
const RAND = 24
/** Zoveel pixels bewegen voordat we beslissen of het horizontaal of verticaal is */
const BESLIS = 10
/** Loslaten voorbij dit deel van de breedte: wisselen */
const DREMPEL = 0.25
/** Of sneller dan dit (px/ms) wegflicken */
const FLICK = 0.4
/** Hoe ver het nieuwe scherm inschuift (px) */
const INSCHUIF = 48

/** Material "emphasized" easings */
const AFREMMEN = 'cubic-bezier(0.05, 0.7, 0.1, 1)'
const OPTREKKEN = 'cubic-bezier(0.3, 0, 0.8, 0.15)'

/** Elementen met een eigen veeggebaar of vensters. De kaart alleen als je ingezoomd bent. */
const EIGEN_GEBAAR =
  '.kaartvak:not([data-uitgezoomd]), .foto-groot, .bijsnijder__kader, [role="dialog"], input, textarea, select'

function minderBeweging() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Het element dat meeschuift: de inhoud, of op de kaart het vaste kaartscherm */
export function wisselPaneel(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main .kaartscherm') ?? document.querySelector<HTMLElement>('main.inhoud')
}

/** Nieuw scherm laten inschuiven vanaf de kant waar het vandaan komt (+1 = van rechts) */
export function schuifIn(richting: 1 | -1) {
  const el = wisselPaneel()
  if (!el || minderBeweging()) return
  el.getAnimations().forEach((a) => a.cancel())
  el.animate(
    [
      { transform: `translateX(${richting * INSCHUIF}px)`, opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 260, easing: AFREMMEN },
  )
}

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

interface Opties {
  aan: boolean
  /** Is er een tab in die richting (+1 = volgende, -1 = vorige)? */
  kan: (richting: 1 | -1) => boolean
  /** Wissel naar de tab in die richting (het inschuiven doet de aanroeper met schuifIn) */
  onWissel: (richting: 1 | -1) => void
}

export function useTabSwipe({ aan, kan, onWissel }: Opties) {
  const opties = useRef({ kan, onWissel })
  opties.current = { kan, onWissel }

  useEffect(() => {
    if (!aan) return
    let start: { x: number; y: number } | null = null
    let modus: 'twijfel' | 'veeg' = 'twijfel'
    let paneel: HTMLElement | null = null
    let dx = 0
    // Laatste paar posities, voor de snelheid bij loslaten
    let spoor: { x: number; t: number }[] = []
    let bezig = false // een wissel-animatie loopt nog

    const stop = () => {
      start = null
      modus = 'twijfel'
      spoor = []
    }

    const zetPositie = (x: number) => {
      if (!paneel) return
      const breedte = window.innerWidth
      paneel.style.transform = `translateX(${x}px)`
      paneel.style.opacity = String(1 - Math.min(Math.abs(x) / breedte, 1) * 0.5)
    }

    const neer = (e: TouchEvent) => {
      stop()
      if (bezig || e.touches.length !== 1) return
      const { clientX: x, clientY: y } = e.touches[0]
      if (x < RAND || x > window.innerWidth - RAND) return
      const doel = e.target as Element | null
      if (doel?.closest(EIGEN_GEBAAR) || scrolltHorizontaal(doel)) return
      start = { x, y }
      spoor = [{ x, t: e.timeStamp }]
    }

    const beweeg = (e: TouchEvent) => {
      if (!start) return
      if (e.touches.length > 1) {
        // Tweede vinger (knijpen): terugzetten en stoppen
        if (modus === 'veeg') veerTerug()
        stop()
        return
      }
      const { clientX, clientY } = e.touches[0]
      const ruw = clientX - start.x
      const dy = clientY - start.y
      if (modus === 'twijfel') {
        if (Math.hypot(ruw, dy) < BESLIS) return
        if (Math.abs(ruw) < 1.5 * Math.abs(dy)) {
          stop() // verticaal: gewoon scrollen
          return
        }
        modus = 'veeg'
        paneel = wisselPaneel()
        paneel?.getAnimations().forEach((a) => a.cancel())
        if (paneel) paneel.style.willChange = 'transform, opacity'
      }
      // Horizontaal: de pagina niet ook laten scrollen
      if (e.cancelable) e.preventDefault()
      // Geen tab in die richting (Home naar rechts, Spel naar links): het scherm blijft staan
      dx = opties.current.kan(ruw < 0 ? 1 : -1) ? ruw : 0
      zetPositie(dx)
      spoor.push({ x: clientX, t: e.timeStamp })
      if (spoor.length > 5) spoor.shift()
    }

    const opruimen = (el: HTMLElement | null) => {
      if (!el) return
      el.style.transform = ''
      el.style.opacity = ''
      el.style.willChange = ''
    }

    function veerTerug() {
      const el = paneel
      if (!el) return
      const van = { transform: el.style.transform, opacity: el.style.opacity || '1' }
      opruimen(el)
      if (!minderBeweging()) {
        el.animate([van, { transform: 'none', opacity: 1 }], { duration: 220, easing: AFREMMEN })
      }
    }

    const los = (e: TouchEvent) => {
      if (!start || modus !== 'veeg') return stop()
      const eerste = spoor[0]
      const laatste = spoor[spoor.length - 1]
      const snelheid = laatste && eerste && laatste.t > eerste.t ? (laatste.x - eerste.x) / (laatste.t - eerste.t) : 0
      const richting: 1 | -1 = dx < 0 ? 1 : -1
      const breedte = window.innerWidth
      const ver = Math.abs(dx) > breedte * DREMPEL
      const flick = Math.abs(snelheid) > FLICK && Math.sign(snelheid) === Math.sign(dx)
      stop()
      if (e.type === 'touchcancel' || !opties.current.kan(richting) || !(ver || flick)) {
        veerTerug()
        return
      }
      // Wegschuiven, dan wisselen (het nieuwe scherm schuift in via schuifIn)
      const el = paneel
      if (!el || minderBeweging()) {
        opruimen(el)
        opties.current.onWissel(richting)
        return
      }
      bezig = true
      const van = { transform: el.style.transform, opacity: el.style.opacity || '1' }
      const anim = el.animate(
        [van, { transform: `translateX(${-richting * breedte * 0.35}px)`, opacity: 0 }],
        { duration: 140, easing: OPTREKKEN, fill: 'forwards' },
      )
      let klaar = false
      const afronden = () => {
        if (klaar) return
        klaar = true
        opruimen(el)
        // Meteen renderen (en schuifIn starten), anders flitst het oude scherm nog even terug
        flushSync(() => opties.current.onWissel(richting))
        anim.cancel()
        bezig = false
      }
      anim.onfinish = afronden
      // Vangnet: als de app net naar de achtergrond gaat, loopt de animatie niet af
      setTimeout(afronden, 400)
    }

    document.addEventListener('touchstart', neer, { passive: true })
    document.addEventListener('touchmove', beweeg, { passive: false })
    document.addEventListener('touchend', los, { passive: true })
    document.addEventListener('touchcancel', los, { passive: true })
    return () => {
      document.removeEventListener('touchstart', neer)
      document.removeEventListener('touchmove', beweeg)
      document.removeEventListener('touchend', los)
      document.removeEventListener('touchcancel', los)
    }
  }, [aan])
}
