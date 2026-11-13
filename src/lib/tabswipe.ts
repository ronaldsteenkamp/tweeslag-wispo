import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'

/*
 * Vegen tussen tabs zoals in Instagram: het buurscherm ligt (echt, niet als plaatje) direct
 * naast het huidige scherm en beide volgen je vinger 1:1, zonder vervagen. Laat je los na
 * ongeveer een derde van de breedte of met een flick, dan schuiven ze door; anders veren ze
 * terug. Hoe sneller je veegt, hoe sneller het afloopt.
 *
 * Het buurscherm rendert de aanroeper (App) zodra onBuur een richting geeft, in een element
 * met de class "buurpaneel". Dit bestand zet alleen de verschuivingen.
 */

/** Afstand vanaf de schermrand waar we niet luisteren: daar zit "terug" van iOS/Android */
const RAND = 24
/** Zoveel pixels bewegen voordat we beslissen of het horizontaal of verticaal is */
const BESLIS = 10
/** Loslaten voorbij dit deel van de breedte: wisselen */
const DREMPEL = 0.35
/** Of sneller dan dit (px/ms) in dezelfde richting: wisselen */
const FLICK = 0.3
/** Afloop: snel begin, zacht einde (zoals iOS-paginering) */
const AFLOOP = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Duur van het nieuwe scherm laten inschuiven na een tik op de tabbalk */
const INSCHUIF = 48
const AFREMMEN = 'cubic-bezier(0.05, 0.7, 0.1, 1)'

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

const buurPaneel = () => document.querySelector<HTMLElement>('.buurpaneel')

/** Na een tik op de tabbalk: nieuw scherm schuift een stukje in vanaf die kant (+1 = van rechts) */
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
  /** Toon het buurscherm in die richting naast het huidige (null = weghalen) */
  onBuur: (richting: 1 | -1 | null) => void
  /** Wissel naar de tab in die richting (en haal het buurscherm weg), zonder eigen animatie */
  onWissel: (richting: 1 | -1) => void
}

export function useTabSwipe({ aan, kan, onBuur, onWissel }: Opties) {
  const opties = useRef({ kan, onBuur, onWissel })
  opties.current = { kan, onBuur, onWissel }

  useEffect(() => {
    if (!aan) return
    let start: { x: number; y: number } | null = null
    let modus: 'twijfel' | 'veeg' = 'twijfel'
    let paneel: HTMLElement | null = null
    let buur: 1 | -1 | null = null // welk buurscherm er nu naast ligt
    let dx = 0
    // Laatste paar posities, voor de snelheid bij loslaten
    let spoor: { x: number; t: number }[] = []
    let bezig = false // een afloop-animatie loopt nog

    const zet = (x: number) => {
      const b = window.innerWidth
      if (paneel) paneel.style.transform = x ? `translateX(${x}px)` : ''
      const bp = buurPaneel()
      if (bp && buur) bp.style.transform = `translateX(${x + buur * b}px)`
    }

    const opruimen = (el: HTMLElement | null) => {
      if (!el) return
      el.style.transform = ''
      el.style.willChange = ''
    }

    const neer = (e: TouchEvent) => {
      start = null
      modus = 'twijfel'
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
        // Tweede vinger (knijpen): terug en stoppen
        if (modus === 'veeg') afloop(false)
        start = null
        return
      }
      const { clientX, clientY } = e.touches[0]
      const ruw = clientX - start.x
      const dy = clientY - start.y
      if (modus === 'twijfel') {
        if (Math.hypot(ruw, dy) < BESLIS) return
        if (Math.abs(ruw) < 1.5 * Math.abs(dy)) {
          start = null // verticaal: gewoon scrollen
          return
        }
        modus = 'veeg'
        paneel = wisselPaneel()
        paneel?.getAnimations().forEach((a) => a.cancel())
        if (paneel) paneel.style.willChange = 'transform'
      }
      // Horizontaal: de pagina niet ook laten scrollen
      if (e.cancelable) e.preventDefault()
      const richting: 1 | -1 = ruw < 0 ? 1 : -1
      const mag = opties.current.kan(richting)
      // Geen tab in die richting (Home naar rechts, Spel naar links): het scherm blijft staan
      dx = mag ? ruw : 0
      const nodig = mag && dx !== 0 ? richting : null
      if (nodig !== buur) {
        buur = nodig
        // Meteen renderen, zodat het buurscherm in dezelfde frame al naast het huidige ligt
        flushSync(() => opties.current.onBuur(nodig))
      }
      zet(dx)
      spoor.push({ x: clientX, t: e.timeStamp })
      if (spoor.length > 5) spoor.shift()
    }

    /** Doorschuiven naar het buurscherm (wissel) of terugveren */
    function afloop(wissel: boolean, snelheid = 0) {
      const el = paneel
      const bp = buurPaneel()
      const r = buur
      const b = window.innerWidth
      const doelX = wissel && r ? -r * b : 0
      const rest = Math.abs(doelX - dx)
      // Sneller vegen = sneller aflopen; altijd tussen 160 en 340 ms
      const duur = Math.round(Math.min(340, Math.max(160, rest / Math.max(Math.abs(snelheid), 1.6))))

      const klaar = () => {
        if (wissel && r) flushSync(() => opties.current.onWissel(r))
        else flushSync(() => opties.current.onBuur(null))
        opruimen(el)
        el?.getAnimations().forEach((a) => a.cancel())
        buur = null
        dx = 0
        bezig = false
      }
      if (!el || minderBeweging() || rest < 1) {
        klaar()
        return
      }
      bezig = true
      const opties2: KeyframeAnimationOptions = { duration: duur, easing: AFLOOP, fill: 'forwards' }
      const anim = el.animate([{ transform: `translateX(${dx}px)` }, { transform: `translateX(${doelX}px)` }], opties2)
      if (bp && r) bp.animate([{ transform: `translateX(${dx + r * b}px)` }, { transform: `translateX(${doelX + r * b}px)` }], opties2)
      let gedaan = false
      const eenmaal = () => {
        if (gedaan) return
        gedaan = true
        klaar()
      }
      anim.onfinish = eenmaal
      // Vangnet: als de app net naar de achtergrond gaat, loopt de animatie niet af
      window.setTimeout(eenmaal, duur + 200)
    }

    const los = (e: TouchEvent) => {
      if (!start || modus !== 'veeg') {
        start = null
        return
      }
      start = null
      const eerste = spoor[0]
      const laatste = spoor[spoor.length - 1]
      const snelheid = laatste && eerste && laatste.t > eerste.t ? (laatste.x - eerste.x) / (laatste.t - eerste.t) : 0
      spoor = []
      const ver = Math.abs(dx) > window.innerWidth * DREMPEL
      const flick = Math.abs(snelheid) > FLICK && Math.sign(snelheid) === Math.sign(dx)
      const tegen = Math.abs(snelheid) > FLICK && Math.sign(snelheid) === -Math.sign(dx)
      // Ver genoeg of geflickt, maar niet als je op het laatst terugveegt
      afloop(e.type !== 'touchcancel' && buur !== null && (ver || flick) && !tegen, snelheid)
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
