import type { CSSProperties } from 'react'

// Eén keer bepalen, zodat de vlokken niet verspringen bij elke render.
// Ongeveer een derde blijft een klein stipje (sneeuw verder weg), de rest is een sneeuwvlok die draait.
const VLOKKEN = Array.from({ length: 28 }, (_, i) => {
  const duur = 7 + Math.random() * 9
  const stip = Math.random() < 0.35
  return {
    stip,
    vorm: i % 3,
    links: Math.random() * 100,
    grootte: stip ? 2 + Math.random() * 3 : 8 + Math.random() * 10,
    duur,
    vertraging: -Math.random() * duur,
    drift: (Math.random() - 0.5) * 60,
    draai: stip ? 0 : (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 270),
    zicht: 0.45 + Math.random() * 0.5,
  }
})

/** Eén arm van een vlok (van het midden naar boven), in drie varianten */
const ARMEN = [
  <>
    <line x1="0" y1="0" x2="0" y2="-10" />
    <line x1="0" y1="-5" x2="-3" y2="-8" />
    <line x1="0" y1="-5" x2="3" y2="-8" />
  </>,
  <>
    <line x1="0" y1="0" x2="0" y2="-10" />
    <line x1="0" y1="-4" x2="-2.5" y2="-6" />
    <line x1="0" y1="-4" x2="2.5" y2="-6" />
    <line x1="0" y1="-7" x2="-2" y2="-9" />
    <line x1="0" y1="-7" x2="2" y2="-9" />
  </>,
  <>
    <line x1="0" y1="0" x2="0" y2="-10" />
    <circle cx="0" cy="-10" r="1.3" fill="#ffffff" stroke="none" />
    <line x1="0" y1="-6" x2="-2.5" y2="-7.5" />
    <line x1="0" y1="-6" x2="2.5" y2="-7.5" />
  </>,
]

/** Zeskantige sneeuwvlok: zes keer dezelfde arm, steeds 60° verder */
function Vlok({ vorm }: { vorm: number }) {
  return (
    <svg viewBox="-12 -12 24 24" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" fill="none">
      {[0, 60, 120, 180, 240, 300].map((hoek) => (
        <g key={hoek} transform={`rotate(${hoek})`}>
          {ARMEN[vorm]}
        </g>
      ))}
    </svg>
  )
}

// Sterren in het bovenste deel van de lucht (boven de bergen), die zacht twinkelen
const STERREN = Array.from({ length: 22 }, () => ({
  links: Math.random() * 100,
  boven: 4 + Math.random() * 50,
  groot: Math.random() < 0.3,
  duur: 2.5 + Math.random() * 2.5,
  vertraging: -Math.random() * 5,
}))

/**
 * Winterse nachtlucht als achtergrond van een donkerblauw blok (alleen decoratie):
 * twinkelende sterren, zachtjes vallende sneeuw en eventueel een maansikkel.
 */
export function Sneeuw({ aantal = 28, maan = false }: { aantal?: number; maan?: boolean }) {
  return (
    <div className="sneeuw" aria-hidden="true">
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
      {VLOKKEN.slice(0, aantal).map((v, i) => (
        <span
          key={i}
          className={v.stip ? 'sneeuw__stip' : undefined}
          style={
            {
              left: `${v.links}%`,
              width: v.grootte,
              height: v.grootte,
              opacity: v.zicht,
              animationDuration: `${v.duur}s`,
              animationDelay: `${v.vertraging}s`,
              '--drift': `${v.drift}px`,
              '--draai': `${v.draai}deg`,
            } as CSSProperties
          }
        >
          {!v.stip && <Vlok vorm={v.vorm} />}
        </span>
      ))}
    </div>
  )
}
