import { useEffect } from 'react'
import { MeldingenKaart } from '../components/Meldingen'
import { SchermKop } from '../components/SchermKop'
import { SneeuwRij } from '../components/SneeuwRij'
import { config } from '../config'
import { useOpgeslagen } from '../lib/opslag'

export type Thema = 'auto' | 'licht' | 'donker'

/** Zet het thema op <html> (index.html doet dit ook al vóór het tekenen) */
export function zetThema(t: Thema) {
  if (t === 'auto') delete document.documentElement.dataset.thema
  else document.documentElement.dataset.thema = t
}

/** Instellingen: thema, sneeuw, meldingen, wat er op je telefoon staat en wie wat ziet. */
export default function Instellingen({ terug }: { terug: () => void }) {
  // Standaard licht (index.html zet hetzelfde vóór het tekenen)
  const [thema, setThema] = useOpgeslagen<Thema>('thema', 'licht')
  useEffect(() => zetThema(thema), [thema])

  return (
    <div className="scherm home instellingen">
      <SchermKop titel="Instellingen" boven="Wispo" terug={{ label: 'Home', onClick: terug }} />

      <section className="instellingen__groep" aria-labelledby="inst-weergave">
        <h2 className="home__kopje" id="inst-weergave">
          Weergave
        </h2>
        <div className="instellingen__thema">
          <p className="instellingen__label">Thema</p>
          <div className="segment segment--auto" role="group" aria-label="Thema">
            {(
              [
                ['auto', 'Telefoon'],
                ['licht', 'Licht'],
                ['donker', 'Donker'],
              ] as const
            ).map(([w, l]) => (
              <button
                key={w}
                type="button"
                className={`segment__knop${thema === w ? ' is-actief' : ''}`}
                aria-pressed={thema === w}
                onClick={() => setThema(w)}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="instellingen__uitleg">
            ‘Telefoon’ volgt de stand van je telefoon. Donker is de nacht op de berg: fijn in de bus en bij de après-ski.
          </p>
        </div>
        <SneeuwRij />
      </section>

      <section className="instellingen__groep" aria-labelledby="inst-meldingen">
        <h2 className="home__kopje" id="inst-meldingen">
          Meldingen
        </h2>
        <MeldingenKaart />
      </section>

      <section className="instellingen__groep" aria-labelledby="inst-telefoon">
        <h2 className="home__kopje" id="inst-telefoon">
          Op deze telefoon
        </h2>
        <p className="instellingen__tekst">
          Je paklijst, je busbingokaart, je eigen raderen en je casinofiches staan op je telefoon (en gaan mee als je je
          naam op een andere telefoon kiest). Een nieuwe versie van de app laat ze staan.
        </p>
      </section>

      <section className="instellingen__groep" aria-labelledby="inst-privacy">
        <h2 className="home__kopje" id="inst-privacy">
          Wie ziet wat?
        </h2>
        <div className="instellingen__tekst">
          <p>
            <b>Iedereen die de app opent</b> ziet je naam, je bijnaam, je appartement, je plaatje, je score, je badges en
            de kiekjes die in het clubblad geplaatst zijn. Deel je je locatie, dan zien ze je stip op de kaart, hooguit
            een uur oud.
          </p>
          <p>
            <b>Alleen jij</b> ziet je paklijst, je bingokaart, je casinofiches, je stemmen en je kiekjes die nog bij de
            redactie liggen.
          </p>
          <p>
            <b>De redactie</b> ({config.beheerNamen.join(' en ')}) ziet alle ingestuurde kiekjes en kan ze plaatsen of
            weghalen.
          </p>
          <p>
            <b>Niet in de app:</b> achternamen, telefoonnummers en adressen. De app staat op een openbare website die
            niet in zoekmachines komt; iedereen met de link kan hem openen.
          </p>
        </div>
      </section>

      <footer className="home__voet">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={56} height={56} loading="lazy" />
        <p>
          {config.appNaam} · versie {__BOUWDATUM__}
        </p>
      </footer>
    </div>
  )
}
