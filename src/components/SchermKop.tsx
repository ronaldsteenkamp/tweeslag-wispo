import { useEffect, useRef, type ReactNode } from 'react'
import { Sneeuw } from './Sneeuw'

/*
 * Kop van een scherm (alles behalve Home): een kleine versie van de Home-kop, donkerblauw met de
 * bergen onderaan. Bij het scrollen wordt de kop kleiner tot een smalle balk die bovenaan blijft
 * staan met alleen de titel. Alleen in gebruik als de nieuwe koppen aan staan (config.nieuweKoppen).
 *
 * Hoe het krimpen werkt: de kop zelf scrolt gewoon mee. Tijdens het wegscrollen wordt de inhoud
 * iets kleiner en lichter (CSS-variabele --krimp van 0 tot 1), en daarna verschijnt de smalle
 * balk. Die staat in een 'sticky' houder van 0 hoog bovenaan het scherm, zodat de pagina eronder
 * niet verspringt. Bij 'minder beweging' krimpt er niets en verschijnt de balk gewoon.
 */

interface Props {
  titel: string
  /** Kleine regel boven de titel */
  boven?: ReactNode
  ondertitel?: ReactNode
  /** Rechts in de kop: een icoon of getal */
  rechts?: ReactNode
  /** Terugknop bovenaan (voor schermen die niet in de tabbalk staan) */
  terug?: { label: string; onClick: () => void }
  /** Klein extraatje onderin de kop, bijvoorbeeld een voortgangsbalk */
  children?: ReactNode
}

export function SchermKop({ titel, boven, ondertitel, rechts, terug, children }: Props) {
  const kop = useRef<HTMLElement>(null)
  const balk = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = kop.current
    const b = balk.current
    if (!el || !b) return
    let wacht = 0
    const meet = () => {
      wacht = 0
      // Het buurscherm tijdens het vegen staat altijd bovenaan, los van hoe ver deze pagina gescrold is
      const inBuurpaneel = el.closest('.buurpaneel') !== null
      const ruimte = Math.max(1, el.offsetHeight - b.offsetHeight)
      const krimp = inBuurpaneel ? 0 : Math.min(1, Math.max(0, window.scrollY / ruimte))
      el.style.setProperty('--krimp', krimp.toFixed(3))
      b.style.setProperty('--krimp', krimp.toFixed(3))
      b.toggleAttribute('data-klein', krimp >= 1)
    }
    const straks = () => {
      if (!wacht) wacht = requestAnimationFrame(meet)
    }
    meet()
    window.addEventListener('scroll', straks, { passive: true })
    window.addEventListener('resize', straks)
    // De kop kan van hoogte veranderen (bijv. als het weer binnenkomt)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(straks)
    ro?.observe(el)
    return () => {
      window.removeEventListener('scroll', straks)
      window.removeEventListener('resize', straks)
      ro?.disconnect()
      cancelAnimationFrame(wacht)
    }
  }, [])

  const naarBoven = () => {
    const zacht = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: zacht ? 'smooth' : 'auto' })
  }

  return (
    <>
      {/* De smalle balk: alleen beeld, de echte titel is de h1 hieronder (voor schermlezers) */}
      <div className="schermkop__balkplek" aria-hidden="true">
        <div ref={balk} className="schermkop__balk" onClick={naarBoven}>
          <span className="schermkop__balktitel">{titel}</span>
        </div>
      </div>
      <header ref={kop} className="schermkop golf">
        <Sneeuw aantal={8} />
        <div className="schermkop__rij">
          <div className="schermkop__tekst">
            {terug && (
              <button type="button" className="schermkop__terug" onClick={terug.onClick}>
                ← {terug.label}
              </button>
            )}
            {boven && <p className="schermkop__boven">{boven}</p>}
            <h1 className="schermkop__titel">{titel}</h1>
            {ondertitel && <p className="schermkop__onder">{ondertitel}</p>}
          </div>
          {rechts && <div className="schermkop__rechts">{rechts}</div>}
        </div>
        {children && <div className="schermkop__extra">{children}</div>}
      </header>
    </>
  )
}
