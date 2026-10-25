import { useMemo } from 'react'
import { alleDeelnemers, type Kamers } from '../lib/data'
import { deelnemers, useDeelnemersKeuze, type DeelnemersSoort } from '../lib/rad'

const KEUZE_LABELS: { waarde: DeelnemersSoort; label: string }[] = [
  { waarde: 'iedereen', label: 'Iedereen' },
  { waarde: 'kamer', label: 'Mijn kamer' },
  { waarde: 'kamers', label: 'Kamers kiezen' },
  { waarde: 'zelf', label: 'Zelf kiezen' },
]

/** Wie doen er mee? Iedereen / Mijn kamer / Kamers kiezen / Zelf kiezen (gedeeld met de roulette) */
export function DeelnemersKiezer({ kamers, naam }: { kamers?: Kamers; naam: string | null }) {
  const [keuze, setKeuze] = useDeelnemersKeuze()
  const alle = useMemo(() => alleDeelnemers(kamers), [kamers])
  const mee = deelnemers(keuze, kamers, naam)
  const wissel = <T,>(lijst: T[], x: T) => (lijst.includes(x) ? lijst.filter((y) => y !== x) : [...lijst, x])

  return (
    <fieldset className="veld">
      <legend>Wie doen er mee?</legend>
      <div className="keuzes">
        {KEUZE_LABELS.map((k) => (
          <button
            key={k.waarde}
            type="button"
            className={`keuze${keuze.soort === k.waarde ? ' is-actief' : ''}`}
            aria-pressed={keuze.soort === k.waarde}
            onClick={() => setKeuze((oud) => ({ ...oud, soort: k.waarde }))}
          >
            {k.label}
          </button>
        ))}
      </div>
      {keuze.soort === 'kamer' && mee.length === 0 && (
        <p className="klein">{naam ? 'Je hebt nog geen kamer.' : 'Kies eerst je naam (tik op Home op je naam).'}</p>
      )}
      {keuze.soort === 'kamers' && (
        <div className="radkeuzes">
          {(kamers?.kamers ?? []).map((k) => (
            <button
              key={k.nummer}
              type="button"
              className={`keuze${keuze.kamers.includes(k.nummer) ? ' is-actief' : ''}`}
              aria-pressed={keuze.kamers.includes(k.nummer)}
              onClick={() => setKeuze((oud) => ({ ...oud, kamers: wissel(oud.kamers, k.nummer) }))}
            >
              {k.nummer}
              {k.naam ? ` ${k.naam}` : ''}
            </button>
          ))}
        </div>
      )}
      {keuze.soort === 'zelf' && (
        <>
          <div className="radkeuzes">
            {alle.map((n) => (
              <button
                key={n}
                type="button"
                className={`keuze${keuze.namen.includes(n) ? ' is-actief' : ''}`}
                aria-pressed={keuze.namen.includes(n)}
                onClick={() => setKeuze((oud) => ({ ...oud, namen: wissel(oud.namen, n) }))}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="knoppenrij">
            <button type="button" className="knop knop--secundair knop--klein" onClick={() => setKeuze((oud) => ({ ...oud, namen: alle }))}>
              Iedereen aan
            </button>
            <button type="button" className="knop knop--secundair knop--klein" onClick={() => setKeuze((oud) => ({ ...oud, namen: [] }))}>
              Niemand
            </button>
          </div>
        </>
      )}
      <p className="klein">
        {mee.length} {mee.length === 1 ? 'persoon doet' : 'mensen doen'} mee
      </p>
    </fieldset>
  )
}
