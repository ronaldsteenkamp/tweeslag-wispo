import { useState } from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { NaamKiezer, normaal, useAlleNamen } from '../components/NaamKiezer'
import { openMijnProfiel, toonProfiel } from '../components/Profiel'
import { config } from '../config'
import { useData, type Kamer } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'
import { profielAfVoor } from '../lib/profiel'

export default function Kamers({ naarVerdelen, naarBeheer }: { naarVerdelen: () => void; naarBeheer: () => void }) {
  const { data, fout } = useData('kamers')
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const [wijzigen, setWijzigen] = useState(false)
  const [zoek, setZoek] = useState('')

  const alleNamen = useAlleNamen(data)
  const isReisleiding = naam !== null && config.reisleiding.includes(naam)

  if (!data) {
    return (
      <div className="scherm">
        <h1>Kamers</h1>
        <DataStatus fout={fout} />
      </div>
    )
  }

  const naamBekend = naam !== null && alleNamen.includes(naam)
  if (!naamBekend || wijzigen) {
    return (
      <div className="scherm">
        <h1>Wie ben jij?</h1>
        <p>
          {naam !== null && !naamBekend
            ? 'Je naam staat niet meer in de kamerlijst. Kies hem opnieuw.'
            : 'Kies je naam, dan zie je je eigen kamer meteen bovenaan.'}{' '}
          Dit wordt alleen op deze telefoon bewaard.
        </p>
        <NaamKiezer
          namen={alleNamen}
          onKies={(n) => {
            setNaam(n)
            setWijzigen(false)
            setZoek('')
            window.scrollTo(0, 0)
            if (!profielAfVoor(n)) openMijnProfiel()
          }}
        />
        {naamBekend && (
          <button type="button" className="knop knop--secundair knop--breed" onClick={() => setWijzigen(false)}>
            Annuleren
          </button>
        )}
      </div>
    )
  }

  const eigenKamer = data.kamers.find((k) => k.bewoners.includes(naam))
  const q = normaal(zoek)
  const gevonden = q
    ? data.kamers.filter(
        (k) =>
          k.bewoners.some((b) => normaal(b).includes(q)) ||
          normaal(k.nummer).includes(q) ||
          normaal(k.naam ?? '').includes(q),
      )
    : data.kamers.filter((k) => k !== eigenKamer)
  const zonderKamer = q ? data.zonderKamer.filter((b) => normaal(b).includes(q)) : data.zonderKamer

  return (
    <div className="scherm">
      <h1>Kamers</h1>
      {data.verblijf && <p className="ondertitel">{data.verblijf}</p>}

      {eigenKamer && !q && (
        <section className="kaartje kamer kamer--eigen" aria-label="Jouw kamer">
          <p className="kamer__label">Jouw kamer</p>
          <KamerInhoud kamer={eigenKamer} jij={naam} />
          <button type="button" className="tekstknop" onClick={() => setWijzigen(true)}>
            Ben je niet {naam}? Kies een andere naam
          </button>
        </section>
      )}

      {!eigenKamer && !q && (
        <section className="kaartje kamer kamer--eigen" aria-label="Jouw kamer">
          <p className="kamer__label">Jouw kamer</p>
          <p>Je hebt nog geen kamer. De reisleiding maakt de kamerverdeling; daarna staat je kamer hier.</p>
          <button type="button" className="tekstknop" onClick={() => setWijzigen(true)}>
            Ben je niet {naam}? Kies een andere naam
          </button>
        </section>
      )}

      <div className="zoekveld">
        <Icoon naam="zoek" />
        <label className="verborgen" htmlFor="zoek-kamer">
          Zoek op naam
        </label>
        <input
          id="zoek-kamer"
          type="search"
          className="invoer"
          placeholder="Zoek op naam of kamer"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>

      {!q && <h2 className="tussenkop">Alle kamers</h2>}
      {q && gevonden.length === 0 && zonderKamer.length === 0 && (
        <p className="laadtekst">Niemand gevonden met ‘{zoek}’.</p>
      )}

      {gevonden.map((k) => (
        <section className={`kaartje kamer${k === eigenKamer ? ' kamer--eigen' : ''}`} key={k.nummer + (k.naam ?? '')}>
          <KamerInhoud kamer={k} jij={naam} zoek={q} />
        </section>
      ))}

      {zonderKamer.length > 0 && (
        <section className="kaartje kamer">
          <div className="kamer__kop">
            <h2>Nog geen kamer</h2>
          </div>
          <Bewoners namen={zonderKamer} jij={naam} zoek={q} />
        </section>
      )}

      {isReisleiding && (
        <>
          <button type="button" className="knop knop--secundair knop--breed" onClick={naarVerdelen}>
            🛏️ Kamerverdeling maken (reisleiding)
          </button>
          <button type="button" className="knop knop--secundair knop--breed" onClick={naarBeheer}>
            ⚙️ Beheer (reisleiding)
          </button>
        </>
      )}
    </div>
  )
}

function KamerInhoud({ kamer, jij, zoek = '' }: { kamer: Kamer; jij: string; zoek?: string }) {
  return (
    <>
      <div className="kamer__kop">
        <span className="kamer__nummer">{kamer.nummer}</span>
        {kamer.naam && <h2>{kamer.naam}</h2>}
        {kamer.bedden !== undefined && (
          <span className="kamer__bedden">
            {kamer.bedden} bedden
            {kamer.bedden > kamer.bewoners.length && ` · ${kamer.bedden - kamer.bewoners.length} vrij`}
          </span>
        )}
      </div>
      <Bewoners namen={kamer.bewoners} jij={jij} zoek={zoek} />
    </>
  )
}

function Bewoners({ namen, jij, zoek }: { namen: string[]; jij: string; zoek: string }) {
  return (
    <ul className="bewoners">
      {namen.map((b) => (
        <li
          key={b}
          className={`${b === jij ? 'is-jij' : ''}${zoek && normaal(b).includes(zoek) ? ' is-gevonden' : ''}`}
        >
          <button type="button" className="bewoners__naam" onClick={() => toonProfiel(b)}>
            {b}
            {b === jij && <span className="label label--accent">jij</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
