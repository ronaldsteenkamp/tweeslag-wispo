// Sterren in het bovenste deel van de lucht (boven de bergen), die zacht twinkelen
const STERREN = Array.from({ length: 22 }, () => ({
  links: Math.random() * 100,
  boven: 4 + Math.random() * 50,
  groot: Math.random() < 0.3,
  duur: 2.5 + Math.random() * 2.5,
  vertraging: -Math.random() * 5,
}))

/**
 * Winterse nachtlucht als achtergrond van een donkerblauw blok (alleen decoratie): twinkelende
 * sterren en eventueel een maansikkel. De vallende sneeuw zelf komt van de sneeuwlaag achter de
 * hele app (components/SneeuwAchtergrond.tsx); die valt vaag door de donkere koppen heen.
 * `aantal` bepaalt hoeveel sterren er zijn (28 = alle).
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
    </div>
  )
}
