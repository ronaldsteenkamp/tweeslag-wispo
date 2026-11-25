import { useEffect, useState } from 'react'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { Icoon } from '../components/Icoon'
import { LogoKnop } from '../components/LogoKnop'
import { MeldingenKaart } from '../components/Meldingen'
import { SchermKop } from '../components/SchermKop'
import { SneeuwRij } from '../components/SneeuwRij'
import { config } from '../config'
import { opsomming } from '../lib/kamerligging'
import { useBereik, verversApp } from '../lib/offline'
import { useOpgeslagen } from '../lib/opslag'
import { GELUID_SLEUTEL } from '../lib/spelgeluid'
import { useZuinig, ZUINIG_ONDER, zetZuinig } from '../lib/zuinig'

export type Thema = 'auto' | 'licht' | 'donker'

/** Zet het thema op <html> (index.html doet dit ook al vóór het tekenen) */
export function zetThema(t: Thema) {
  if (t === 'auto') delete document.documentElement.dataset.thema
  else document.documentElement.dataset.thema = t
}

/**
 * Instellingen: thema, sneeuw, zuinig, meldingen, geluid, wie wat ziet en de app verversen.
 */
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
            ‘Telefoon’ volgt de stand van je telefoon. Donker is de nacht op de berg: fijn in de bus en bij de après-ski,
            en op de meeste telefoons zuiniger.
          </p>
        </div>
        <SneeuwRij />
        <ZuinigRij />
      </section>

      <section className="instellingen__groep" aria-labelledby="inst-meldingen">
        <h2 className="home__kopje" id="inst-meldingen">
          Meldingen en geluid
        </h2>
        <MeldingenKaart />
        <GeluidRij />
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

      <VerversApp />

      <footer className="home__voet">
        <LogoKnop grootte={56} onKlik={naarVakancie} />
        <p>
          {config.appNaam} · versie {__BOUWDATUM__.split('-').reverse().join('/')}
        </p>
      </footer>
    </div>
  )
}

/** Zuinig op de berg: zelf aan of uit; gaat vanzelf aan bij weinig batterij (lib/zuinig.ts) */
function ZuinigRij() {
  const z = useZuinig()
  const grens = Math.round(ZUINIG_ONDER * 100)
  const onder = z.aan
    ? z.door === 'batterij'
      ? `Vanzelf aangegaan: je batterij is ${z.procent}%. Geen sneeuw, minder beweging, scherm gaat gewoon op slot.`
      : 'Staat aan: geen sneeuw, minder beweging, scherm gaat gewoon op slot.'
    : z.batterijBekend
      ? `Geen sneeuw, minder beweging, scherm gaat gewoon op slot. Gaat vanzelf aan onder ${grens}% batterij.`
      : 'Geen sneeuw, minder beweging, scherm gaat gewoon op slot. Handig als je batterij hard leegloopt in de kou.'
  return (
    <section aria-label="Zuinig op de berg">
      <button type="button" role="switch" aria-checked={z.aan} className="homerij" onClick={() => zetZuinig(!z.aan)}>
        <span className="bord bord--zwart" aria-hidden="true">
          <Icoon naam="batterij" grootte={19} />
        </span>
        <span className="homerij__tekst">
          <b>Zuinig op de berg</b>
          <small>{onder}</small>
        </span>
        <span className={`schakelaar${z.aan ? ' is-aan' : ''}`} aria-hidden="true" />
      </button>
    </section>
  )
}

/** Geluid en trillen van het rad én het spel in één keer (de knoppen daar blijven ook werken) */
function GeluidRij() {
  const [rad, setRad] = useOpgeslagen('rad.geluid', true)
  const [spel, setSpel] = useOpgeslagen(GELUID_SLEUTEL, true)
  const aan = rad && spel
  const zet = (w: boolean) => {
    setRad(w)
    setSpel(w)
  }
  return (
    <section aria-label="Geluid en trillen">
      <button type="button" role="switch" aria-checked={aan} className="homerij" onClick={() => zet(!aan)}>
        <span className="bord bord--blauw" aria-hidden="true">
          <Icoon naam={aan ? 'geluid' : 'stil'} grootte={19} />
        </span>
        <span className="homerij__tekst">
          <b>Geluid en trillen</b>
          <small>
            {aan
              ? 'Bij het rad, het casino, de stempels en de krasloten'
              : rad || spel
                ? `Alleen nog bij ${rad ? 'het rad en het casino' : 'het spel'}. Tik om alles aan te zetten.`
                : 'Stil: handig in de bus en om 7 uur in het appartement'}
          </small>
        </span>
        <span className={`schakelaar${aan ? ' is-aan' : ''}`} aria-hidden="true" />
      </button>
    </section>
  )
}

/** Doet Wispo raar? De nieuwste versie ophalen en de bewaarde gegevens en foto's opnieuw laden */
function VerversApp() {
  const bereik = useBereik()
  const [vraag, setVraag] = useState(false)
  const [bezig, setBezig] = useState(false)

  return (
    <section className="instellingen__groep" aria-labelledby="inst-verversen">
      <h2 className="home__kopje" id="inst-verversen">
        Doet Wispo raar?
      </h2>
      <button
        type="button"
        className="knop knop--secundair knop--breed"
        disabled={!bereik || bezig}
        onClick={() => setVraag(true)}
      >
        <Icoon naam="draai" grootte={18} /> {bezig ? 'Bezig met verversen…' : 'App verversen'}
      </button>
      <p className="instellingen__uitleg instellingen__onder">
        {bereik
          ? 'Haalt de nieuwste versie op en laadt de gegevens en foto’s opnieuw. Je naam, paklijst en spel blijven staan.'
          : 'Geen bereik: verversen kan straks weer. Zonder bereik werkt de app gewoon.'}
      </p>
      <BevestigDialoog
        open={vraag}
        titel="App verversen?"
        tekst="Wispo haalt de nieuwste versie op en laadt de gegevens en foto’s opnieuw. Je naam, paklijst, spel en raderen blijven staan."
        bevestigLabel="Verversen"
        onAnnuleer={() => setVraag(false)}
        onBevestig={() => {
          setVraag(false)
          setBezig(true)
          verversApp().catch(() => setBezig(false))
        }}
      />
    </section>
  )
}