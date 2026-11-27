import { useMemo } from 'react'
import { fractie } from '../lib/rad'

// Goud, rood en wit, zoals de tafel
const CONFETTI_KLEUREN = ['#f3d36b', '#ffffff', '#c0262d', '#fbe58f']

/** Een handvol confetti over het rad of de speltafel (bij minder beweging meteen weer weg) */
export function Confetti() {
  const stukjes = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        links: 10 + fractie() * 80,
        opzij: (fractie() - 0.5) * 120,
        vertraging: fractie() * 0.25,
        duur: 1.3 + fractie() * 0.8,
        draai: (fractie() - 0.5) * 900,
        kleur: CONFETTI_KLEUREN[i % CONFETTI_KLEUREN.length],
      })),
    [],
  )
  return (
    <div className="confetti" aria-hidden="true">
      {stukjes.map((s, i) => (
        <span
          key={i}
          style={
            {
              left: `${s.links}%`,
              background: s.kleur,
              animationDelay: `${s.vertraging}s`,
              animationDuration: `${s.duur}s`,
              '--opzij': `${s.opzij}px`,
              '--draai': `${s.draai}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
