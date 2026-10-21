import { useState } from 'react'
import { stuurTestmelding, useMeldingen, zetMeldingenAan, zetMeldingenUit } from '../lib/meldingen'

/** Op Home: meldingen aanzetten (pas na een tik wordt om toestemming gevraagd) */
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
    setTekst(fout ?? 'Meldingen staan aan ✓')
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
      <section className="kaartje meldingen meldingen--aan">
        <p className="meldingen__regel">
          <span aria-hidden="true">🔔</span> <strong>Meldingen staan aan</strong>
        </p>
        <div className="meldingen__knoppen">
          <button type="button" className="tekstknop" onClick={() => void test()} disabled={bezig}>
            Testmelding
          </button>
          <button type="button" className="tekstknop" onClick={() => void uit()} disabled={bezig}>
            Uitzetten
          </button>
        </div>
        {tekst && <p className="klein">{tekst}</p>}
      </section>
    )
  }

  return (
    <section className="kaartje meldingen">
      <h2>🔔 Meldingen</h2>
      <p>
        Krijg een seintje een half uur voor belangrijke momenten (zoals vertrek van de bus), bij nieuwe challenges, de
        uitslag van de stemming en berichten van de reisleiding.
      </p>
      {status === 'ios-beginscherm' ? (
        <p className="melding">
          Op een iPhone werken meldingen alleen in de app op je beginscherm (iOS 16.4 of nieuwer). Tik in Safari op{' '}
          <strong>Deel</strong> → <strong>Zet op beginscherm</strong>, open de app daar en tik dan hier op{' '}
          <em>Meldingen aanzetten</em>.
        </p>
      ) : status === 'geblokkeerd' ? (
        <p className="melding">
          Meldingen zijn geblokkeerd voor deze app. Zet ze aan in de instellingen van je telefoon (bij de app of bij de
          browser) en kom dan hier terug.
        </p>
      ) : (
        <button type="button" className="knop knop--primair knop--breed" onClick={() => void aan()} disabled={bezig}>
          {bezig ? 'Bezig…' : 'Meldingen aanzetten'}
        </button>
      )}
      {tekst && <p className="klein">{tekst}</p>}
    </section>
  )
}
