import { useOpgeslagen } from '../lib/opslag'
import { useZuinig } from '../lib/zuinig'
import { Icoon } from './Icoon'

/**
 * In Instellingen: de sneeuw in de blauwe koppen aan of uit (wordt onthouden op deze telefoon).
 * Zolang Zuinig op de berg aan staat, sneeuwt het niet en is deze schakelaar even niet te gebruiken.
 * Zelfde rij en schakelaar als Meldingen (styles/home.css).
 */
export function SneeuwRij() {
  const [aan, zetAan] = useOpgeslagen('sneeuw.aan', true)
  const zuinig = useZuinig().aan
  return (
    <section aria-label="Sneeuw">
      <button
        type="button"
        role="switch"
        aria-checked={aan && !zuinig}
        className="homerij"
        onClick={() => zetAan(!aan)}
        disabled={zuinig}
      >
        <span className="bord bord--blauw" aria-hidden="true">
          <Icoon naam="sneeuwvlok" grootte={19} />
        </span>
        <span className="homerij__tekst">
          <b>Sneeuw</b>
          <small>
            {zuinig
              ? 'Staat stil zolang Zuinig op de berg aan staat'
              : aan
                ? 'Valt in de blauwe koppen, af en toe stormt het'
                : 'Staat uit op deze telefoon'}
          </small>
        </span>
        <span className={`schakelaar${aan && !zuinig ? ' is-aan' : ''}`} aria-hidden="true" />
      </button>
    </section>
  )
}
