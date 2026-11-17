import { useState } from 'react'
import { stuurTestmelding, useMeldingen, zetMeldingenAan, zetMeldingenUit } from '../lib/meldingen'
import { Icoon } from './Icoon'

/**
 * Op Home, helemaal onderaan: meldingen aanzetten (pas na een tik wordt om toestemming gevraagd).
 * Uit: een rij met een rood bord en een schakelaar, zoals de andere rijen op Home.
 * Aan: geen kaartje meer, alleen een stille regel met Testmelding en Uitzetten.
 * Opmaak in styles/home.css (.homerij, .schakelaar, .meldingen-stil).
 */
export function MeldingenKaart() {
  const status = useMeldingen()
  const [bezig, setBezig] = useState(false)
  const [tekst, setTekst] = useState<string | null>(null)

  if (status === 'geen-backend' || status === 'niet-ondersteund') return null

  const aan = async () => {
    setBezig(true)
    setTekst(null)
    const fout = await zetMeldingenAan()
    setBezig(false)
    setTekst(fout ?? 'Meldingen staan aan.')
  }
  const test = async () => {
    setBezig(true)
    setTekst(await stuurTestmelding())
    setBezig(false)
  }
  const uit = async () => {
    setBezig(true)
    await zetMeldingenUit()
    setBezig(false)
    setTekst('Meldingen staan uit.')
  }

  if (status === 'aan') {
    return (
      <section className="meldingen-stil" aria-label="Meldingen">
        <p>
          <Icoon naam="bel" grootte={16} /> Meldingen staan aan
          <span aria-hidden="true"> · </span>
          <button type="button" onClick={() => void test()} disabled={bezig}>
            Testmelding
          </button>
          <span aria-hidden="true"> · </span>
          <button type="button" onClick={() => void uit()} disabled={bezig}>
            Uitzetten
          </button>
        </p>
        {tekst && <p className="meldingen-stil__tekst">{tekst}</p>}
      </section>
    )
  }

  const kanAanzetten = status !== 'ios-beginscherm' && status !== 'geblokkeerd'
  const bord = (
    <span className="bord bord--rood" aria-hidden="true">
      <Icoon naam="bel" grootte={19} />
    </span>
  )
  const uitleg = 'Seintje voor de bus, nieuwe challenges en de uitslag van de stemming'

  return (
    <section aria-label="Meldingen">
      {kanAanzetten ? (
        <button
          type="button"
          role="switch"
          aria-checked={false}
          className="homerij"
          onClick={() => void aan()}
          disabled={bezig}
        >
          {bord}
          <span className="homerij__tekst">
            <b>Meldingen</b>
            <small>{bezig ? 'Even geduld…' : uitleg}</small>
          </span>
          <span className={`schakelaar${bezig ? ' is-bezig' : ''}`} aria-hidden="true" />
        </button>
      ) : (
        <div className="homerij homerij--uitleg">
          {bord}
          <span className="homerij__tekst">
            <b>Meldingen</b>
            <small>
              {status === 'ios-beginscherm' ? (
                <>
                  Op een iPhone werken meldingen alleen in de app op je beginscherm (iOS 16.4 of nieuwer). Tik in Safari
                  op <strong>Deel</strong> → <strong>Zet op beginscherm</strong> en zet ze daar aan.
                </>
              ) : (
                <>Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon (bij de app of de browser).</>
              )}
            </small>
          </span>
        </div>
      )}
      {tekst && <p className="meldingen-stil__tekst">{tekst}</p>}
    </section>
  )
}
