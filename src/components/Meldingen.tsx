import { useState } from 'react'
import {
  gekozenSoorten,
  MELDINGSOORTEN,
  stuurTestmelding,
  useMeldingen,
  zetMeldingenAan,
  zetMeldingenUit,
  zetSoort,
} from '../lib/meldingen'
import { Icoon } from './Icoon'

/**
 * In Instellingen: meldingen aan- en uitzetten (pas na een tik wordt om toestemming gevraagd).
 * Een rij met een rood bord en een schakelaar, zoals Sneeuw. Na aanzetten komt er meteen een
 * testmelding en blijft de rij staan met de schakelaar aan; nog een tik zet ze weer uit.
 * Lukt de testmelding niet, dan staat er een regel onder met 'Opnieuw proberen' (zet het
 * abonnement opnieuw op de server en stuurt weer een test).
 * Opmaak in styles/home.css (.homerij, .schakelaar, .meldingen-stil).
 */
/**
 * Onder de schakelaar Meldingen (als ze aan staan): per soort aan of uit, voor deze telefoon.
 * Berichten van de organisatie komen altijd door.
 */
function MeldingSoorten() {
  useMeldingen() // opnieuw tekenen na een keuze
  const gekozen = gekozenSoorten()
  return (
    <div className="meldingsoorten" role="group" aria-label="Welke meldingen">
      {MELDINGSOORTEN.map((s) => {
        const aan = gekozen.includes(s.id)
        return (
          <button
            key={s.id}
            type="button"
            role="switch"
            aria-checked={aan}
            className="homerij homerij--sub"
            onClick={() => zetSoort(s.id, !aan)}
          >
            <span className="homerij__tekst">
              <b>{s.titel}</b>
              <small>{s.uitleg}</small>
            </span>
            <span className={`schakelaar${aan ? ' is-aan' : ''}`} aria-hidden="true" />
          </button>
        )
      })}
      <p className="meldingsoorten__altijd">
        <Icoon naam="info" grootte={16} /> Berichten van de organisatie komen altijd door.
      </p>
    </div>
  )
}

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

  const uit = async () => {
    setBezig(true)
    setTekst(null)
    setTestMislukt(false)
    await zetMeldingenUit()
    setBezig(false)
  }

  if (status === 'aan') {
    return (
      <section aria-label="Meldingen">
        <button type="button" role="switch" aria-checked={true} className="homerij" onClick={() => void uit()} disabled={bezig}>
          <span className="bord bord--rood" aria-hidden="true">
            <Icoon naam="bel" grootte={19} />
          </span>
          <span className="homerij__tekst">
            <b>Meldingen</b>
            <small>{bezig ? 'Even geduld…' : 'Staan aan op deze telefoon. Kies hieronder welke je wilt.'}</small>
          </span>
          <span className="schakelaar is-aan" aria-hidden="true" />
        </button>
        <MeldingSoorten />

        {testMislukt && (
          <div className="meldingen-stil">
            <p>
              <Icoon naam="bel" grootte={16} /> De testmelding kwam niet aan
              <span aria-hidden="true"> · </span>
              <button type="button" onClick={() => void aan()} disabled={bezig}>
                {bezig ? 'Even geduld…' : 'Opnieuw proberen'}
              </button>
            </p>
            {tekst && <p className="meldingen-stil__tekst">{tekst}</p>}
          </div>
        )}
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
