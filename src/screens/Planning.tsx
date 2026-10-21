import { useEffect, useRef, useState } from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { useData, type Dag } from '../lib/data'
import { useNu } from '../lib/nu'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { graden, useWeer, weerIcoon, weerTekst } from '../lib/weer'

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
                {item.melding === true && (
                  <span className="tijdlijn__bel" title="Je krijgt 30 minuten van tevoren een melding" aria-label="met melding">
                    🔔
                  </span>
                )}
                {bezig &&<span className="label label--accent">Nu</span>}
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

/**
 * Schuift de dagenbalk zelf met een korte animatie. Een tweede 'smooth' scroll tegelijk
 * met die van de pagina breekt in Chrome één van beide af.
 */
function schuifNaar(el: HTMLElement, doel: number) {
  const start = el.scrollLeft
  const max = el.scrollWidth - el.clientWidth
  const eind = Math.max(0, Math.min(max, doel))
  const t0 = performance.now()
  const stap = (t: number) => {
    const p = Math.min(1, (t - t0) / 300)
    el.scrollLeft = start + (eind - start) * (1 - Math.pow(1 - p, 3))
    if (p < 1) requestAnimationFrame(stap)
  }
  requestAnimationFrame(stap)
}

export default function Planning() {
  const { data, fout } = useData('planning')
  const nu = useNu(30000)
  const vandaag = datumISO(nu)
  const { weer } = useWeer()
  // Weer in het dorp, per datum (alleen voor dagen binnen de verwachting)
  const weerPerDag = new Map((weer?.locaties[0]?.dagen ?? []).map((d) => [d.datum, d]))
  const dagRefs = useRef(new Map<string, HTMLElement>())
  const chipRefs = useRef(new Map<string, HTMLButtonElement>())
  const balk = useRef<HTMLDivElement>(null)
  const gescrold = useRef(false)
  const negeerScrollTot = useRef(0)
  const [actief, setActief] = useState<string | null>(null)

  // Bij openen: naar vandaag (of de eerste dag)
  useEffect(() => {
    if (!data || gescrold.current) return
    gescrold.current = true
    const start = data.dagen.some((d) => d.datum === vandaag) ? vandaag : data.dagen[0]?.datum
    if (!start) return
    setActief(start)
    if (start === vandaag) dagRefs.current.get(vandaag)?.scrollIntoView({ block: 'start' })
  }, [data, vandaag])

  // De actieve dag schuift naar links in de dagenbalk, de rest schuift mee
  useEffect(() => {
    const chip = actief ? chipRefs.current.get(actief) : undefined
    if (chip && balk.current) schuifNaar(balk.current, chip.offsetLeft - 16)
  }, [actief])

  // Tijdens het scrollen door de planning loopt de dagenbalk mee
  useEffect(() => {
    if (!data) return
    let wacht = 0
    const bijScroll = () => {
      if (wacht) return
      wacht = requestAnimationFrame(() => {
        wacht = 0
        if (Date.now() < negeerScrollTot.current) return
        const grens = (balk.current?.getBoundingClientRect().bottom ?? 0) + 24
        let huidig = data.dagen[0]?.datum
        for (const d of data.dagen) {
          const el = dagRefs.current.get(d.datum)
          if (el && el.getBoundingClientRect().top <= grens) huidig = d.datum
        }
        // Helemaal onderaan: de laatste dag, ook als die niet tot bovenaan kan scrollen
        const onderaan = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
        if (onderaan) huidig = data.dagen[data.dagen.length - 1]?.datum ?? huidig
        if (huidig) setActief(huidig)
      })
    }
    window.addEventListener('scroll', bijScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', bijScroll)
      cancelAnimationFrame(wacht)
    }
  }, [data])

  if (!data) {
    return (
      <div className="scherm">
        <h1>Planning</h1>
        <DataStatus fout={fout} />
      </div>
    )
  }

  const naarDag = (datum: string) => {
    // Even niet laten meelopen, anders springt de balk langs alle tussenliggende dagen
    negeerScrollTot.current = Date.now() + 1200
    setActief(datum)
    dagRefs.current.get(datum)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="scherm">
      <h1>Planning</h1>
      <div ref={balk} className="dagkiezer" role="navigation" aria-label="Spring naar dag">
        {data.dagen.map((d) => (
          <button
            key={d.datum}
            ref={(el) => {
              if (el) chipRefs.current.set(d.datum, el)
              else chipRefs.current.delete(d.datum)
            }}
            type="button"
            className={`dagkiezer__dag${d.datum === vandaag ? ' is-vandaag' : ''}${d.datum === actief ? ' is-actief' : ''}`}
            aria-current={d.datum === actief ? 'true' : undefined}
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
              {weerPerDag.has(dag.datum) && (
                <span className="dag__weer" title={`${weerTekst(weerPerDag.get(dag.datum)!.code)} in het dorp`}>
                  <span aria-hidden="true">{weerIcoon(weerPerDag.get(dag.datum)!.code)}</span>{' '}
                  {graden(weerPerDag.get(dag.datum)!.tMax)}
                </span>
              )}
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
