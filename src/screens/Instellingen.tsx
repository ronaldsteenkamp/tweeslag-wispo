import { useEffect } from 'react'
import { LogoKnop } from '../components/LogoKnop'
import { MeldingenKaart } from '../components/Meldingen'
import { SchermKop } from '../components/SchermKop'
import { SneeuwRij } from '../components/SneeuwRij'
import { config } from '../config'
import { opsomming } from '../lib/kamerligging'
import { useOpgeslagen } from '../lib/opslag'

export type Thema = 'auto' | 'licht' | 'donker'

/** Zet het thema op <html> (index.html doet dit ook al vóór het tekenen) */
export function zetThema(t: Thema) {
  if (t === 'auto') delete document.documentElement.dataset.thema
  else document.documentElement.dataset.thema = t
}

/** Instellingen: thema, sneeuw, meldingen, wat er op je telefoon staat en wie wat ziet. */
export default function Instellingen({ terug, naarVakancie }: { terug: () => void; naarVakancie: () => void }) {
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

      <section className="instellingen__groep" aria-labelledby="inst-naam">
        <h2 className="home__kopje" id="inst-naam">
          Bij je naam
        </h2>
        <p className="instellingen__tekst">
          Je paklijst, je busbingokaart, je eigen raderen en je casinofiches horen bij je naam, niet bij je telefoon.
          Kies je je naam op een andere telefoon, dan staat alles daar ook. Kies je hier een andere naam, dan zie je wat
          bij die naam hoort. Zonder bereik werkt alles gewoon; wat je dan verandert, gaat mee zodra je weer bereik hebt.
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
            <b>Alleen jij</b> ziet je paklijst, je bingokaart, je eigen raderen, je casinofiches, je stemmen en je kiekjes die nog bij de
            redactie liggen.
          </p>
          <p>
            <b>De redactie</b> ({opsomming([...config.redactieNamen])}) ziet alle ingestuurde kiekjes en kan ze plaatsen of
            weghalen.
          </p>
        </div>
      </section>

      <footer className="home__voet">
        <LogoKnop grootte={56} onKlik={naarVakancie} />
        <p>
          {config.appNaam} · versie {__BOUWDATUM__}
        </p>
      </footer>
    </div>
  )
}
