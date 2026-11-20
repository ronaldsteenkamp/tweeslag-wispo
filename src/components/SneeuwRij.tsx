import { useOpgeslagen } from '../lib/opslag'
import { Icoon } from './Icoon'

/**
 * Op Home, onderaan bij Meldingen: de sneeuw in de blauwe koppen aan of uit (wordt onthouden op
 * deze telefoon). Zelfde rij en schakelaar als Meldingen (styles/home.css).
 */
export function SneeuwRij() {
  const [aan, zetAan] = useOpgeslagen('sneeuw.aan', true)
  return (
    <section aria-label="Sneeuw">
      <button type="button" role="switch" aria-checked={aan} className="homerij" onClick={() => zetAan(!aan)}>
        <span className="bord bord--blauw" aria-hidden="true">
          <Icoon naam="sneeuwvlok" grootte={19} />
        </span>
        <span className="homerij__tekst">
          <b>Sneeuw</b>
          <small>{aan ? 'Valt in de blauwe koppen, af en toe stormt het' : 'Staat uit op deze telefoon'}</small>
        </span>
        <span className={`schakelaar${aan ? ' is-aan' : ''}`} aria-hidden="true" />
      </button>
    </section>
  )
}
