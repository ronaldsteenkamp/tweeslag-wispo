/**
 * Segmenten in de kop (Planning, Spel, Groep, Rad): één vorm voor 'onderdeel kiezen' in de hele app.
 * Staat als kind van <SchermKop>. Wisselen gaat met tikken; horizontaal vegen is voor de tabs.
 */
export function Segmenten<T extends string>({
  opties,
  waarde,
  kies,
  label,
}: {
  opties: readonly (readonly [T, string])[]
  waarde: T
  kies: (w: T) => void
  label: string
}) {
  return (
    <div className="schermkop__keuze">
      <div className={`segment segment--auto${opties.length > 3 ? ' segment--vier' : ''}`} role="group" aria-label={label}>
        {opties.map(([w, l]) => (
          <button
            key={w}
            type="button"
            className={`segment__knop${waarde === w ? ' is-actief' : ''}`}
            aria-pressed={waarde === w}
            onClick={() => kies(w)}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
