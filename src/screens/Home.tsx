import { Aftelklok } from '../components/Aftelklok'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { InstallatieBanner } from '../components/InstallatieBanner'
import { Sneeuw } from '../components/Sneeuw'
import type { Tab } from '../components/TabBalk'
import { config } from '../config'
import { useData, type Dag } from '../lib/data'
import { platform } from '../lib/installatie'
import { useNu } from '../lib/nu'
import { useOpgeslagen } from '../lib/opslag'
import { datumISO, datumLabel, lokaalNaarDate, tijdUUMM } from '../lib/tijd'
import { Programma } from './Planning'

const vertrek = lokaalNaarDate(config.vertrek)
const thuiskomst = lokaalNaarDate(config.thuiskomst)

export default function Home({ naarTab }: { naarTab: (t: Tab) => void }) {
  const nu = useNu(1000)
  const { data: planning, fout } = useData('planning')
  const [naam] = useOpgeslagen<string | null>('naam', null)

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

        <h1 className="hero__groet">{naam ? `Hoi ${naam}!` : 'Hoi!'}</h1>

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
                De bus vertrekt om {config.vertrek.slice(11)}. Nog {Math.ceil((vertrek.getTime() - nu.getTime()) / 60000)}{' '}
                minuten!
              </p>
            )}
          </>
        )}

        {fase === 'na' && (
          <p className="hero__tekst">Welkom thuis! Wat was het een mooie week. Tot de volgende wispo ❄️</p>
        )}
      </header>

      <InstallatieBanner />

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

      {fase === 'voor' && dagen[0] && <EersteDag dag={dagen[0]} naarPlanning={() => naarTab('planning')} />}
      {!planning && <DataStatus fout={fout} />}

      <AppKnop />
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
      <h2>Liften, pistes en weer</h2>
      <p>Welke liften draaien er, hoe is de sneeuw en hoe laat gaat de shuttlebus? Dat staat live in de officiële app.</p>
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
