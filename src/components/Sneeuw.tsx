import { useEffect, useRef } from 'react'
import { useOpgeslagen } from '../lib/opslag'
import { startSneeuw, type Sneeuw as SneeuwLaag } from '../lib/sneeuw'

// Sterren in het bovenste deel van de lucht (boven de bergen), die zacht twinkelen
const STERREN = Array.from({ length: 22 }, () => ({
  links: Math.random() * 100,
  boven: 4 + Math.random() * 50,
  groot: Math.random() < 0.3,
  duur: 2.5 + Math.random() * 2.5,
  vertraging: -Math.random() * 5,
}))

/**
 * Winterse nachtlucht als achtergrond van een donkerblauw blok (alleen decoratie): vallende
 * sneeuw, twinkelende sterren en eventueel een maansikkel. `aantal` bepaalt hoeveel sterren er
 * zijn (28 = alle).
 *
 * De sneeuw is een canvas per kop (lib/sneeuw.js): echte zesarmige kristallen in vier
 * dieptelagen, met wisselende intensiteit en af en toe een storm. Het weer is gedeeld, dus in
 * elke kop sneeuwt het even hard en een storm loopt door als je van tab wisselt. Uit te zetten
 * met de schakelaar 'Sneeuw' onderaan Home; bij 'minder beweging' staat alles stil (zie app.css).
 */
export function Sneeuw({ aantal = 28, maan = false }: { aantal?: number; maan?: boolean }) {
  const [sneeuwAan] = useOpgeslagen('sneeuw.aan', true)
  const vak = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = vak.current
    if (!sneeuwAan || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // In een buurscherm (klaargezet naast het huidige, of in beeld tijdens het vegen) staat de
    // sneeuw stil: één getekend beeld, zodat de kop tijdens het vegen al besneeuwd is. Zodra het
    // vak het huidige scherm wordt (zelfde element, 'buurpaneel' eraf) gaat hij meteen vallen.
    // Opbouwen in het buurscherm in een rustig moment, niet midden in een veeg (dat hapert).
    const paneel = el.closest<HTMLElement>('.inhoud')
    const isBuur = () => !!paneel?.classList.contains('buurpaneel')
    let sneeuw: SneeuwLaag | null = null
    const start = () => {
      cancel()
      if (!sneeuw) sneeuw = begin(el, isBuur())
    }
    const ric = typeof window.requestIdleCallback === 'function'
    let wacht = 0
    const cancel = () => (ric ? window.cancelIdleCallback(wacht) : clearTimeout(wacht))
    if (isBuur()) wacht = ric ? window.requestIdleCallback(start, { timeout: 1000 }) : window.setTimeout(start, 300)
    else start()
    const mo = new MutationObserver(() => {
      if (!isBuur()) start()
      sneeuw?.zetStil(isBuur())
    })
    if (paneel) mo.observe(paneel, { attributes: true, attributeFilter: ['class'] })
    return () => {
      mo.disconnect()
      cancel()
      sneeuw?.vernietig()
    }
  }, [sneeuwAan])

  return (
    <div ref={vak} className="sneeuw" aria-hidden="true">
      {STERREN.slice(0, Math.ceil((aantal / 28) * STERREN.length)).map((s, i) => (
        <i
          key={`s${i}`}
          className={`sneeuw__ster${s.groot ? ' sneeuw__ster--groot' : ''}`}
          style={{
            left: `${s.links}%`,
            top: `${s.boven}%`,
            animationDuration: `${s.duur}s`,
            animationDelay: `${s.vertraging}s`,
          }}
        />
      ))}
      {maan && (
        <svg className="sneeuw__maan" viewBox="0 0 34 34">
          <defs>
            <mask id="maansikkel">
              <rect width="34" height="34" fill="#fff" />
              <circle cx="23" cy="13" r="12" fill="#000" />
            </mask>
          </defs>
          <circle cx="17" cy="17" r="13" fill="#fdf6d8" mask="url(#maansikkel)" />
        </svg>
      )}
    </div>
  )
}

/** De sneeuw in een kop starten (stil = eerst als stilstaand beeld) */
function begin(el: HTMLElement, stil: boolean): SneeuwLaag {
  return startSneeuw({
    doel: el,
    vast: false,
    aan: true,
    stil,
    opslagSleutel: null,
    // Een kop is klein en heeft witte tekst: minder vlokken, geen grote vlok vooraan en de
    // dichtste laag wat kleiner, zodat een vlok achter een cijfer de tekst niet wegvaagt
    dichtheid: 70,
    minVlokken: 30,
    maxVlokken: 160,
    lagen: { dichtbij: { grootte: [13, 22] }, voorgrond: { aan: false } },
    // op donkerblauw: wit met een zachte ijsblauwe rand
    rand: 'rgba(150, 200, 235, 0.45)',
    storm: { waas: 0.1 },
    // De halfdoorzichtige blokjes in de kop (keuzebalk bij Rad, vakje rechts, je naam, het weer
    // op Home, de hoogte op Paklijst, de afteltegels) zijn beslagen glas: de sneeuw erachter
    // tekent de module zelf vaag en zwakker. Lichter dan backdrop-filter, ook op iOS.
    vervaging: {
      modus: 'canvas',
      selector:
        '.schermkop__keuze .segment, .schermkop__rechts, .ik, .homekop__weer, .pakkop__hoogte, .aftelklok__blok',
      vaag: 6,
      doorzicht: 0.55,
      onderlaag: false,
      tekst: '',
    },
  })
}
