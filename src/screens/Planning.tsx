import { useEffect, useRef } from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { useData, type Dag } from '../lib/data'
import { useNu } from '../lib/nu'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'

/** De items van één dag als tijdlijn. Met nuTijd worden voorbije items gedimd en is 'straks' gemarkeerd. */
export function Programma({ dag, nuTijd }: { dag: Dag; nuTijd?: string }) {
  if (dag.items.length === 0) return <p className="klein">Nog geen programma.</p>
  const volgende = nuTijd ? dag.items.findIndex((i) => i.tijd > nuTijd) : -1
  // Het item dat het laatst begonnen is (geen als we geen tijd weten of er nog niets begonnen is)
  const huidig = nuTijd === undefined ? -1 : volgende === -1 ? dag.items.length - 1 : volgende - 1
  return (
    <ol className="tijdlijn">
      {dag.items.map((item, i) => {
        const voorbij = i < huidig
        const bezig = i === huidig
        return (
          <li
            key={`${item.tijd}-${item.titel}-${i}`}
            className={`tijdlijn__item${voorbij ? ' is-voorbij' : ''}${bezig ? ' is-bezig' : ''}${i === volgende ? ' is-straks' : ''}`}
          >
            <span className="tijdlijn__tijd">{item.tijd}</span>
            <div className="tijdlijn__inhoud">
              <h3>
                {item.titel}
                {bezig && <span className="label label--accent">Nu</span>}
                {i === volgende && <span className="label">Straks</span>}
              </h3>
              {item.omschrijving && <p>{item.omschrijving}</p>}
              {item.locatie && (
                <p className="tijdlijn__locatie">
                  <Icoon naam="pin" grootte={18} /> {item.locatie}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function Planning() {
  const { data, fout } = useData('planning')
  const nu = useNu(30000)
  const vandaag = datumISO(nu)
  const dagRefs = useRef(new Map<string, HTMLElement>())
  const gescrold = useRef(false)

  useEffect(() => {
    if (!data || gescrold.current) return
    gescrold.current = true
    dagRefs.current.get(vandaag)?.scrollIntoView({ block: 'start' })
  }, [data, vandaag])

  if (!data) {
    return (
      <div className="scherm">
        <h1>Planning</h1>
        <DataStatus fout={fout} />
      </div>
    )
  }

  const naarDag = (datum: string) => dagRefs.current.get(datum)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="scherm">
      <h1>Planning</h1>
      <div className="dagkiezer" role="navigation" aria-label="Spring naar dag">
        {data.dagen.map((d) => (
          <button
            key={d.datum}
            type="button"
            className={`dagkiezer__dag${d.datum === vandaag ? ' is-vandaag' : ''}`}
            onClick={() => naarDag(d.datum)}
          >
            {datumLabel(d.datum, 'kort')}
          </button>
        ))}
      </div>

      {data.dagen.map((dag, i) => {
        const isVandaag = dag.datum === vandaag
        return (
          <section
            key={dag.datum}
            ref={(el) => {
              if (el) dagRefs.current.set(dag.datum, el)
              else dagRefs.current.delete(dag.datum)
            }}
            className={`kaartje dag${isVandaag ? ' dag--vandaag' : ''}${dag.datum < vandaag ? ' dag--voorbij' : ''}`}
            aria-current={isVandaag ? 'date' : undefined}
          >
            <div className="dag__kop">
              <p className="dag__nummer">
                Dag {i + 1} · {datumLabel(dag.datum)}
              </p>
              {isVandaag && <span className="label label--accent">Vandaag</span>}
            </div>
            <h2>{dag.titel}</h2>
            <Programma dag={dag} nuTijd={isVandaag ? tijdUUMM(nu) : undefined} />
          </section>
        )
      })}
    </div>
  )
}
