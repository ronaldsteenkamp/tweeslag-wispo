import { Aftelklok } from '../components/Aftelklok'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { InstallatieBanner } from '../components/InstallatieBanner'
import { FotoStrip } from '../components/FotoStrip'
import { MeldingenKaart } from '../components/Meldingen'
import { openMijnProfiel } from '../components/Profiel'
import { Sneeuw } from '../components/Sneeuw'
import { StemmingOpHome } from '../components/Stemmen'
import { WeerKaart } from '../components/WeerKaart'
import type { Tab } from '../components/TabBalk'
import { config } from '../config'
import { NAAM_OVERGENOMEN } from '../lib/backend'
import { useData, type Dag } from '../lib/data'
import { isAf, useMijnProfiel } from '../lib/profiel'
import { platform } from '../lib/installatie'
import { useNu } from '../lib/nu'
import { schrijf, useOpgeslagen } from '../lib/opslag'
import { datumISO, datumLabel, lokaalNaarDate, tijdUUMM } from '../lib/tijd'
import { Programma } from './Planning'

const vertrek = lokaalNaarDate(config.vertrek)
const thuiskomst = lokaalNaarDate(config.thuiskomst)

export default function Home({ naarTab, naarWeer }: { naarTab: (t: Tab) => void; naarWeer: () => void }) {
  const nu = useNu(1000)
  const { data: planning, fout } = useData('planning')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const profiel = useMijnProfiel()
  const [overgenomen] = useOpgeslagen<string | null>(NAAM_OVERGENOMEN, null)

  const dagen = planning?.dagen ?? []
  const vandaag = datumISO(nu)
  const index = dagen.findIndex((d) => d.datum === vandaag)
  const fase = index >= 0 ? 'tijdens' : nu < vertrek ? 'voor' : nu > thuiskomst ? 'na' : 'tijdens'

  return (
    <div className="scherm">
      <header className="hero golf">
        <Sneeuw />
        <div className="hero__top">
          <img src={`${import.meta.env.BASE_URL}img/2slag-wit.svg`} alt="Tweeslag" className="hero__logo" />
          <div>
            <p className="hero__club">Wispo 2027</p>
            <p className="hero__plek">{config.bestemming} · 5–14 maart</p>
          </div>
        </div>

        <h1 className="hero__groet">
          Hoi{' '}
          <button
            type="button"
            className="hero__naam"
            onClick={() => openMijnProfiel()}
            aria-label={naam ? `${naam}, tik voor je profiel of een andere naam` : 'Kies je naam'}
          >
            {naam ?? 'jij'}
          </button>
          !
        </h1>

        {fase === 'voor' && (
          <>
            <p className="hero__tekst">Nog even en dan vertrekken we naar de sneeuw:</p>
            <Aftelklok doel={vertrek} nu={nu} />
            <p className="hero__klein">
              Vertrek {datumLabel(config.vertrek.slice(0, 10))} om {config.vertrek.slice(11)}
            </p>
          </>
        )}

        {fase === 'tijdens' && (
          <>
            {index >= 0 && (
              <p className="hero__dag">
                Dag {index + 1} <span>van {dagen.length}</span>
              </p>
            )}
            <p className="hero__tekst">
              {index >= 0 ? `${datumLabel(vandaag)} · ${dagen[index].titel}` : 'Fijne wintersport!'}
            </p>
            {nu < vertrek && (
              <p className="hero__klein">
                De bus vertrekt om {config.vertrek.slice(11)}. Nog{' '}
                {Math.ceil((vertrek.getTime() - nu.getTime()) / 60000)} minuten!
              </p>
            )}
          </>
        )}

        {fase === 'na' && (
          <p className="hero__tekst">Welkom thuis! Wat was het een mooie week. Tot de volgende wispo ❄️</p>
        )}
      </header>

      {overgenomen && !naam && (
        <section className="kaartje melding">
          <p>
            <strong>{overgenomen}</strong> is op een ander apparaat gekozen
            {platform() === 'ios' ? ', bijvoorbeeld in de app op je beginscherm' : ''}. Je score telt daar.
          </p>
          <button type="button" className="knop knop--secundair knop--breed" onClick={() => openMijnProfiel(true)}>
            Toch dit apparaat gebruiken
          </button>
        </section>
      )}

      {/* Tijdens de reis eerst het programma van vandaag, daarna de rest */}
      {fase === 'tijdens' && index >= 0 && (
        <section className="kaartje">
          <div className="kaartje__kop">
            <h2>Vandaag</h2>
            <button type="button" className="tekstknop" onClick={() => naarTab('planning')}>
              Hele planning <Icoon naam="pijl" grootte={18} />
            </button>
          </div>
          <Programma dag={dagen[index]} nuTijd={tijdUUMM(nu)} />
        </section>
      )}

      {naam && profiel && !isAf(profiel) && (
        <button type="button" className="kaartje herinnering" onClick={() => openMijnProfiel()}>
          <span aria-hidden="true">📝</span>
          <span>
            <strong>Vul je profiel in</strong>
            <small>Ski of board, je niveau, een geheim feitje, je karaokenummer en je grootste angst.</small>
          </span>
        </button>
      )}

      {fase !== 'na' && <WeerKaart nu={nu} voorVertrek={nu < vertrek} onOpen={naarWeer} />}

      <InstallatieBanner />

      <FotoStrip naarFotomuur={() => (window.location.hash = '#fotos')} />

      <StemmingOpHome
        naarStemmen={() => {
          schrijf('spel.onderdeel', 'stemmen')
          naarTab('spel')
        }}
      />

      {fase === 'voor' && dagen[0] && <EersteDag dag={dagen[0]} naarPlanning={() => naarTab('planning')} />}
      {!planning && <DataStatus fout={fout} />}

      <AppKnop />

      {/* Helemaal onderaan */}
      {fase !== 'na' && <MeldingenKaart />}
    </div>
  )
}

function EersteDag({ dag, naarPlanning }: { dag: Dag; naarPlanning: () => void }) {
  return (
    <section className="kaartje">
      <div className="kaartje__kop">
        <h2>Zo begint het</h2>
        <button type="button" className="tekstknop" onClick={naarPlanning}>
          Planning <Icoon naam="pijl" grootte={18} />
        </button>
      </div>
      <p className="klein">{datumLabel(dag.datum)}</p>
      <Programma dag={dag} />
    </section>
  )
}

function AppKnop() {
  const p = platform()
  const links = config.les2alpesApp
  return (
    <section className="kaartje">
      <h2>Liften, weer en webcams</h2>
      <p>
        Welke liften draaien er, hoe wordt het weer en hoe ziet het er nu uit op de berg? Kijk live mee via de webcams
        in de officiële app.
      </p>
      {p === 'anders' ? (
        <div className="knoppenrij">
          <a className="knop knop--primair" href={links.ios} target="_blank" rel="noopener">
            App Store
          </a>
          <a className="knop knop--primair" href={links.android} target="_blank" rel="noopener">
            Google Play
          </a>
        </div>
      ) : (
        <a
          className="knop knop--accent knop--breed"
          href={p === 'ios' ? links.ios : links.android}
          target="_blank"
          rel="noopener"
        >
          Open de Les 2 Alpes-app
        </a>
      )}
    </section>
  )
}
