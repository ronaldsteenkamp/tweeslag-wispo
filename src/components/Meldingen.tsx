import { useState } from 'react'
import { stuurTestmelding, useMeldingen, zetMeldingenAan } from '../lib/meldingen'
import { Icoon } from './Icoon'

/**
 * Op Home, helemaal onderaan: meldingen aanzetten (pas na een tik wordt om toestemming gevraagd).
 * Uit: een rij met een rood bord en een schakelaar, zoals de andere rijen op Home.
 * Na aanzetten komt er meteen een testmelding en verdwijnt het blok. Uitzetten kan via de
 * instellingen van de telefoon. Alleen als de testmelding niet lukt, blijft er een regel staan
 * met 'Opnieuw proberen' (zet het abonnement opnieuw op de server en stuurt weer een test).
 * Opmaak in styles/home.css (.homerij, .schakelaar, .meldingen-stil).
 */
export function MeldingenKaart() {
  const status = useMeldingen()
  const [bezig, setBezig] = useState(false)
  const [tekst, setTekst] = useState<string | null>(null)
  const [testMislukt, setTestMislukt] = useState(false)

  if (status === 'geen-backend' || status === 'niet-ondersteund') return null

  const aan = async () => {
    setBezig(true)
    setTekst(null)
    setTestMislukt(false)
    const fout = await zetMeldingenAan()
    if (fout) {
      setBezig(false)
      setTekst(fout)
      return
    }
    const uitslag = await stuurTestmelding()
    setBezig(false)
    if (!uitslag.startsWith('Testmelding verstuurd')) {
      setTestMislukt(true)
      setTekst(uitslag.replace(/\s*Zet meldingen uit en weer aan\.$/, ''))
    }
  }

  if (status === 'aan') {
    if (!testMislukt) return null
    return (
      <section className="meldingen-stil" aria-label="Meldingen">
        <p>
          <Icoon naam="bel" grootte={16} /> Meldingen staan aan, maar de testmelding kwam niet aan
          <span aria-hidden="true"> · </span>
          <button type="button" onClick={() => void aan()} disabled={bezig}>
            {bezig ? 'Even geduld…' : 'Opnieuw proberen'}
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
