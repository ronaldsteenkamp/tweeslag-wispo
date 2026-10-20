import { useMemo, useState } from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { useData, type Kamer } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'

/** Kleine letters en zonder accenten, zodat 'esmee' ook 'Esmée' vindt */
const normaal = (s: string) =>
  s
    .toLocaleLowerCase('nl')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

export default function Kamers() {
  const { data, fout } = useData('kamers')
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const [wijzigen, setWijzigen] = useState(false)
  const [zoek, setZoek] = useState('')

  const alleNamen = useMemo(
    () =>
      [...new Set((data?.kamers ?? []).flatMap((k) => k.bewoners))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'nl')),
    [data],
  )

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
      <NaamKiezer
        namen={alleNamen}
        onbekend={naam !== null && !naamBekend}
        onKies={(n) => {
          setNaam(n)
          setWijzigen(false)
          setZoek('')
          window.scrollTo(0, 0)
        }}
        onAnnuleer={naamBekend ? () => setWijzigen(false) : undefined}
      />
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
      {q && gevonden.length === 0 && <p className="laadtekst">Niemand gevonden met ‘{zoek}’.</p>}

      {gevonden.map((k) => (
        <section className={`kaartje kamer${k === eigenKamer ? ' kamer--eigen' : ''}`} key={k.nummer + (k.naam ?? '')}>
          <KamerInhoud kamer={k} jij={naam} zoek={q} />
        </section>
      ))}
    </div>
  )
}

function KamerInhoud({ kamer, jij, zoek = '' }: { kamer: Kamer; jij: string; zoek?: string }) {
  return (
    <>
      <div className="kamer__kop">
        <span className="kamer__nummer">{kamer.nummer}</span>
        {kamer.naam && <h2>{kamer.naam}</h2>}
      </div>
      <ul className="bewoners">
        {kamer.bewoners.map((b) => (
          <li
            key={b}
            className={`${b === jij ? 'is-jij' : ''}${zoek && normaal(b).includes(zoek) ? ' is-gevonden' : ''}`}
          >
            {b}
            {b === jij && <span className="label label--accent">jij</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

function NaamKiezer({
  namen,
  onbekend,
  onKies,
  onAnnuleer,
}: {
  namen: string[]
  onbekend: boolean
  onKies: (n: string) => void
  onAnnuleer?: () => void
}) {
  const [zoek, setZoek] = useState('')
  const q = normaal(zoek)
  const lijst = q ? namen.filter((n) => normaal(n).includes(q)) : namen
  return (
    <div className="scherm">
      <h1>Wie ben jij?</h1>
      <p>
        {onbekend
          ? 'Je naam staat niet meer in de kamerlijst. Kies hem opnieuw.'
          : 'Kies je naam, dan zie je je eigen kamer meteen bovenaan.'}{' '}
        Dit wordt alleen op deze telefoon bewaard.
      </p>
      <div className="zoekveld">
        <Icoon naam="zoek" />
        <label className="verborgen" htmlFor="zoek-naam">
          Zoek je naam
        </label>
        <input
          id="zoek-naam"
          type="search"
          className="invoer"
          placeholder="Zoek je naam"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="namenraster">
        {lijst.map((n) => (
          <button key={n} type="button" className="knop knop--naam" onClick={() => onKies(n)}>
            {n}
          </button>
        ))}
      </div>
      {lijst.length === 0 && <p className="laadtekst">Geen naam gevonden. Vraag de reisleiding om je toe te voegen.</p>}
      {onAnnuleer && (
        <button type="button" className="knop knop--secundair knop--breed" onClick={onAnnuleer}>
          Annuleren
        </button>
      )}
    </div>
  )
}
