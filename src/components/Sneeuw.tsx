import type { CSSProperties } from 'react'

// Eén keer bepalen, zodat de vlokken niet verspringen bij elke render
const VLOKKEN = Array.from({ length: 28 }, () => {
  const duur = 7 + Math.random() * 9
  return {
    links: Math.random() * 100,
    grootte: 2 + Math.random() * 5,
    duur,
    vertraging: -Math.random() * duur,
    drift: (Math.random() - 0.5) * 60,
    zicht: 0.45 + Math.random() * 0.5,
  }
})

/** Zachtjes vallende sneeuw als achtergrond van een blok (alleen decoratie) */
export function Sneeuw({ aantal = 28 }: { aantal?: number }) {
  return (
    <div className="sneeuw" aria-hidden="true">
      {VLOKKEN.slice(0, aantal).map((v, i) => (
        <span
          key={i}
          style={
            {
              left: `${v.links}%`,
              width: v.grootte,
              height: v.grootte,
              opacity: v.zicht,
              animationDuration: `${v.duur}s`,
              animationDelay: `${v.vertraging}s`,
              '--drift': `${v.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
