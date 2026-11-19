import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon, type IcoonNaam } from '../components/Icoon'
import { SchermKop } from '../components/SchermKop'
import { config } from '../config'
import { useData, type Dag } from '../lib/data'
import { useNieuweKoppen } from '../lib/nieuweKoppen'
import { useNu } from '../lib/nu'
import { dagStatus, duur, isVervallen, type ItemMetStatus, type VrijeTijd } from '../lib/programma'
import { datumISO, datumLabel, lokaalNaarDate, tijdUUMM } from '../lib/tijd'
import { graden, useWeer, weerSoort, weerTekst } from '../lib/weer'
import { WeerIcoon } from '../components/WeerIcoon'
import '../styles/barlow.css'
import '../styles/planning.css'

/** Soort activiteit aan de hand van trefwoorden in de titel (voor het icoontje bij de nieuwe koppen) */
export function soortActiviteit(titel: string): IcoonNaam {
  const t = titel.toLowerCase()
  // Après-ski eerst, anders telt het als skiën
  if (/apr[eè]s|feest|karaoke/.test(t)) return 'muziek'
  if (/ontbijt|lunch|diner/.test(t)) return 'eten'
  if (/bus|vertrek/.test(t)) return 'bus'
  // 'les' als los woord, maar niet in 'Les Deux Alpes'
  if (/ski|piste|\bles\b(?! deux)/.test(t)) return 'ski'
  return 'sneeuwvlok'
}

/** De items van één dag als tijdlijn. Met nuTijd worden voorbije items gedimd en is 'straks' gemarkeerd. */
export function Programma({ dag, nuTijd, metIconen = false }: { dag: Dag; nuTijd?: string; metIconen?: boolean }) {
  if (dag.items.length === 0) return <p className="klein">Nog geen programma.</p>
  // Vervallen items tellen niet mee voor 'nu' en 'straks'
  const telt = (i: number) => !isVervallen(dag.items[i])
  const volgende = nuTijd ? dag.items.findIndex((i, k) => telt(k) && i.tijd > nuTijd) : -1
  // Het item dat het laatst begonnen is (geen als we geen tijd weten of er nog niets begonnen is)
  let huidig = nuTijd === undefined ? -1 : volgende === -1 ? dag.items.length - 1 : volgende - 1
  while (huidig >= 0 && !telt(huidig)) huidig--
  return (
    <ol className={`tijdlijn${metIconen ? ' tijdlijn--iconen' : ''}`}>
      {dag.items.map((item, i) => {
        const voorbij = i < huidig
        const bezig = i === huidig
        if (isVervallen(item)) {
          return (
            <li key={`${item.tijd}-${item.titel}-${i}`} className="tijdlijn__item is-voorbij">
              <span className="tijdlijn__tijd">{item.tijd}</span>
              <div className="tijdlijn__inhoud">
                <h3>
                  <s>{item.titel}</s> <span className="label">Gaat niet door</span>
                </h3>
                {item.vervallen && <p>{item.vervallen}</p>}
              </div>
            </li>
          )
        }
        return (
          <li
            key={`${item.tijd}-${item.titel}-${i}`}
            className={`tijdlijn__item${voorbij ? ' is-voorbij' : ''}${bezig ? ' is-bezig' : ''}${i === volgende ? ' is-straks' : ''}`}
          >
            <span className="tijdlijn__tijd">{item.tijd}</span>
            {metIconen && (
              <span className="tijdlijn__icoon">
                <Icoon naam={soortActiviteit(item.titel)} grootte={18} />
              </span>
            )}
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

/* ---------------------------------------------------------------------------------------------
 * Planning als programmaboekje: elke dag is een bladzijde (vaste tijden apart, hoogtepunten groot,
 * nu/hierna in de kantlijn), en "Hele reis" is de inhoudsopgave. Opmaak in styles/planning.css.
 * ------------------------------------------------------------------------------------------- */

/** Beeldmerk bij een hoogtepunt; geen icoon als er niets past (liever niets dan een nietszeggend icoon) */
export function beeldVoor(titel: string): IcoonNaam | null {
  const t = titel.toLowerCase()
  if (/volleybal/.test(t)) return 'bal'
  if (/prijs/.test(t)) return 'spel'
  if (/bus|vertrek/.test(t)) return 'bus'
  if (/aankomst|thuiskomst/.test(t)) return 'vlag'
  if (/diner|fondue|ontbijt|lunch/.test(t)) return 'eten'
  if (/feest|karaoke|quiz|spelletjes/.test(t)) return 'muziek'
  if (/apr[eè]s/.test(t)) return 'glas'
  if (/foto/.test(t)) return 'camera'
  if (/gletsjer|gondel|lift/.test(t)) return 'lift'
  if (/ski|piste|afdaling/.test(t)) return 'ski'
  return null
}

const hoofdletter = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** De kop van een bladzijde: het hoogtepunt van die dag, anders het eerste wat iedereen doet */
function bladTitel(dag: Dag) {
  const doorgaand = dag.items.filter((i) => !isVervallen(i))
  return (doorgaand.find((i) => i.gewicht === 'hoog') ?? doorgaand.find((i) => i.gewicht !== 'routine' && !i.optioneel))?.titel ?? dag.titel
}

/** Korte samenvatting voor de inhoudsopgave */
function kern(dag: Dag) {
  // Hoogstens drie, hoogtepunten eerst gekozen, daarna op tijd gezet
  const doorgaand = dag.items.filter((i) => !isVervallen(i) && i.gewicht !== 'routine')
  const gekozen = [...doorgaand.filter((i) => i.gewicht === 'hoog'), ...doorgaand.filter((i) => i.gewicht !== 'hoog')].slice(0, 3)
  return doorgaand.filter((i) => gekozen.includes(i)).map((i) => i.titel).join(', ')
}

function Punt({ item }: { item: ItemMetStatus }) {
  const { status } = item
  const hoog = item.gewicht === 'hoog' && status !== 'voorbij'
  const beeld = hoog ? beeldVoor(item.titel) : null
  const noten: ReactNode[] = []
  if (item.optioneel) noten.push(`${hoofdletter(item.optioneel)}${item.eind ? `, tot ${item.eind}` : ''}.`)
  if (item.was) noten.push(<span className="noot--rood">Let op: verschoven, eerst gepland om {item.was}.</span>)
  if (isVervallen(item)) noten.push(<span className="noot--rood">Gaat niet door.{item.vervallen ? ` ${item.vervallen}` : ''}</span>)
  if (item.melding && (status === 'straks' || status === 'later')) noten.push('Je krijgt een halfuur van tevoren een seintje.')
  return (
    <li
      className={`punt punt--${status}${item.gewicht === 'hoog' ? ' punt--hoog' : ''}${item.optioneel ? ' punt--optioneel' : ''}`}
      aria-current={status === 'bezig' ? 'time' : undefined}
    >
      {status === 'voorbij' && (
        <span className="punt__vinkje" aria-hidden="true">
          <Icoon naam="vink" grootte={18} />
        </span>
      )}
      <p className="punt__tijd">
        {item.was && (
          <s className="punt__was">
            <span className="verborgen">was </span>
            {item.was}
          </s>
        )}
        {item.was && <span className="verborgen">nu </span>}
        <time>{item.tijd}</time>
        {status === 'bezig' && !item.optioneel && <small>tot {tijdUUMM(item.einde)}</small>}
      </p>
      <div className="punt__inhoud">
        {status === 'bezig' && (
          <p className="punt__kantlijn punt__kantlijn--nu">
            <b>Nu</b> nog {duur(item.totEinde)}
          </p>
        )}
        {status === 'straks' && <p className="punt__kantlijn">Hierna · over {duur(item.totBegin)}</p>}
        {beeld && (
          <span className="punt__beeld" aria-hidden="true">
            <Icoon naam={beeld} grootte={20} />
          </span>
        )}
        <h3>
          {status === 'voorbij' && <span className="verborgen">Geweest: </span>}
          {isVervallen(item) && <span className="verborgen">Vervallen: </span>}
          {item.titel}
        </h3>
        {item.omschrijving && !isVervallen(item) && <p className="punt__tekst">{item.omschrijving}</p>}
        {item.locatie && (
          <p className="punt__plek">
            <Icoon naam="pin" grootte={16} /> {item.locatie}
          </p>
        )}
        {noten.map((n, k) => (
          <p key={k} className="punt__noot">
            {n}
          </p>
        ))}
      </div>
    </li>
  )
}

function Rust({ vrij }: { vrij: VrijeTijd }) {
  const middag = vrij.van >= '12:00' && vrij.van < '17:00'
  return (
    <li className={`rust${vrij.status === 'bezig' ? ' rust--bezig' : ''}`}>
      <svg viewBox="0 0 64 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        <path d="M2 12l10-8 8 6 8-6 8 6 8-6 8 6 10-8" />
      </svg>
      <em>
        {vrij.status === 'bezig' ? 'Nu: ' : ''}
        {middag ? 'Vrije middag' : 'Vrije tijd'}
      </em>
      {vrij.van} tot {vrij.tot}. Niets moet, alles mag.
    </li>
  )
}

function Blad({
  dag,
  nummer,
  aantal,
  nu,
  isVandaag,
  weerTekstje,
  vorige,
  volgende,
  naar,
}: {
  dag: Dag
  nummer: number
  aantal: number
  nu: Date
  isVandaag: boolean
  weerTekstje?: string
  vorige?: Dag
  volgende?: Dag
  naar: (datum: string) => void
}) {
  const { items, vrij } = dagStatus(dag, nu)
  const routine = items.filter((i) => i.gewicht === 'routine' && !isVervallen(i))
  const rest = items.filter((i) => !routine.includes(i))
  const rijen = [
    ...rest.map((i) => ({ t: i.start.getTime(), el: <Punt key={`p-${i.tijd}-${i.titel}`} item={i} /> })),
    ...vrij.map((v) => ({ t: v.start.getTime(), el: <Rust key={`v-${v.van}`} vrij={v} /> })),
  ].sort((a, b) => a.t - b.t)

  return (
    <article className="blad" aria-labelledby="bladkop">
      <p className="blad__kicker" aria-hidden="true">
        <span>
          {isVandaag ? 'Vandaag · ' : ''}
          {dag.titel} · {datumLabel(dag.datum)}
        </span>
        <span>
          Dag {nummer}/{aantal}
        </span>
      </p>
      <h2 id="bladkop" className="blad__titel">
        <span className="verborgen">
          {dag.titel}, {datumLabel(dag.datum)}{isVandaag ? ', vandaag' : ''}:{' '}
        </span>
        {dag.items.length ? bladTitel(dag) : dag.titel}
      </h2>
      {dag.intro && <p className="blad__intro">{dag.intro}</p>}
      {weerTekstje && <p className="blad__weer">{weerTekstje}</p>}

      {routine.length > 0 && (
        <div className="vast">
          <h3 className="vast__kop">Vaste tijden</h3>
          <ul>
            {routine.map((r) => (
              <li key={`${r.tijd}-${r.titel}`} className={`vast__item vast__item--${r.status}`}>
                {r.status === 'voorbij' && <span className="verborgen">Geweest: </span>}
                {r.status === 'bezig' && <span className="verborgen">Nu: </span>}
                <time>{r.tijd}</time> {r.titel}
                {r.omschrijving && /^kookploeg/i.test(r.omschrijving) && (
                  <span className="vast__extra"> ({r.omschrijving.replace(/\.$/, '').replace(/^Kookploeg:/i, 'kookploeg')})</span>
                )}
                {r.status === 'straks' && <span className="vast__hierna"> · hierna</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dag.items.length ? (
        <ol className="programma" aria-label="Programma">
          {rijen.map((r) => r.el)}
        </ol>
      ) : (
        <div className="blad__leeg">
          <em>Deze bladzijde is nog leeg.</em>
          De reisleiding vult hem later in.
        </div>
      )}

      <nav className="blader" aria-label="Bladeren">
        {vorige ? (
          <button type="button" onClick={() => naar(vorige.datum)}>
            <span className="blader__richting">‹ Vorige dag</span>
            {vorige.titel}
          </button>
        ) : (
          <span />
        )}
        {volgende ? (
          <button type="button" className="blader__volgende" onClick={() => naar(volgende.datum)}>
            <span className="blader__richting">Volgende dag ›</span>
            {volgende.titel}
          </button>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}

function Inhoud({ dagen, vandaag, naar }: { dagen: Dag[]; vandaag: string; naar: (datum: string) => void }) {
  return (
    <section className="inhoudsopgave" aria-labelledby="inhoudkop">
      <h2 id="inhoudkop">Inhoud</h2>
      <p className="inhoudsopgave__intro">
        {dagen.length} dagen Les Deux Alpes, van de parkeerplaats tot de parkeerplaats.
      </p>
      <ol>
        {dagen.map((d, i) => {
          const soort = d.datum === vandaag ? ' is-vandaag' : d.datum < vandaag ? ' is-voorbij' : ''
          return (
            <li key={d.datum}>
              <button type="button" className={`toc${soort}`} onClick={() => naar(d.datum)} aria-current={d.datum === vandaag ? 'date' : undefined}>
                <span className="toc__nr">{i + 1}</span>
                <span className="toc__titel">{d.titel}</span>
                <span className="toc__datum">{datumLabel(d.datum, 'kort')}</span>
                <span className="toc__kern">
                  {d.datum === vandaag ? 'Vandaag · ' : ''}
                  {d.items.length ? kern(d) : 'Nog niets ingevuld'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default function Planning({ naarWeer }: { naarWeer: () => void }) {
  const { data, fout } = useData('planning')
  const nu = useNu(30000)
  const vandaag = datumISO(nu)
  const { weer } = useWeer()
  const nieuw = useNieuweKoppen()
  // Weer in het dorp, per datum (alleen voor dagen binnen de verwachting)
  const weerPerDag = new Map((weer?.locaties[0]?.dagen ?? []).map((d) => [d.datum, d]))
  const [weergave, setWeergave] = useState<'dag' | 'reis'>('reis')
  const [gekozen, setGekozen] = useState<string | null>(null)
  /** Voor welke datum we al naar "vandaag" gesprongen zijn */
  const gezet = useRef<string | null>(null)

  // Tijdens de reis opent Planning op vandaag; ervoor en erna op de hele reis. Wordt het een nieuwe
  // dag terwijl Planning open staat (de app 's ochtends uit de achtergrond), dan naar die nieuwe dag.
  useEffect(() => {
    if (!data || gezet.current === vandaag) return
    gezet.current = vandaag
    if (data.dagen.some((d) => d.datum === vandaag)) {
      setGekozen(vandaag)
      setWeergave('dag')
    }
  }, [data, vandaag])

  if (!data) {
    return (
      <div className="scherm">
        {nieuw ? <SchermKop titel="Planning" /> : <h1>Planning</h1>}
        <DataStatus fout={fout} />
      </div>
    )
  }

  const dagIndex = data.dagen.findIndex((d) => d.datum === vandaag)
  const dagenTotVertrek = Math.ceil((lokaalNaarDate(`${config.vertrek.slice(0, 10)}T00:00`).getTime() - nu.getTime()) / 86_400_000)
  const weerVandaag = weerPerDag.get(vandaag)

  // Eén zin onder de titel: wat er nu is en wat daarna komt
  let regel: ReactNode = undefined
  if (dagIndex >= 0) {
    const { items, vrij } = dagStatus(data.dagen[dagIndex], nu)
    const bezig = items.find((i) => i.status === 'bezig' && !i.optioneel)
    const straks = items.find((i) => i.status === 'straks')
    const nuVrij = vrij.find((v) => v.status === 'bezig')
    const daarna = straks ? ` Om ${straks.tijd}: ${straks.titel}.` : ''
    regel = bezig
      ? `Nu: ${bezig.titel}.${daarna}`
      : nuVrij
        ? `Nu vrij tot ${nuVrij.tot}.${daarna}`
        : straks
          ? `Om ${straks.tijd}: ${straks.titel}.`
          : 'Niets meer vandaag. Welterusten.'
  } else if (dagenTotVertrek > 0) {
    regel = `Vertrek ${datumLabel(config.vertrek.slice(0, 10))} om ${config.vertrek.slice(11)}`
  } else if (data.dagen.length && vandaag > data.dagen[data.dagen.length - 1].datum) {
    regel = 'Het boekje is uit. Tot volgend jaar.'
  }

  const naar = (datum: string) => {
    setGekozen(datum)
    setWeergave('dag')
    window.scrollTo({ top: 0 })
  }
  const kiesWeergave = (w: 'dag' | 'reis') => {
    setWeergave(w)
    // Terug naar een dag: vandaag als we op reis zijn, anders de dag die je het laatst bekeek
    if (w === 'dag' && dagIndex >= 0) setGekozen(vandaag)
  }

  const dagNr = Math.max(0, data.dagen.findIndex((d) => d.datum === (gekozen ?? data.dagen[0]?.datum)))
  const dag = data.dagen[dagNr]
  const w = dag ? weerPerDag.get(dag.datum) : undefined

  const keuze = (
    <div className="schermkop__keuze">
      <div className="segment" role="group" aria-label="Weergave">
        {(
          [
            ['reis', 'Hele reis'],
            ['dag', dagIndex >= 0 ? 'Vandaag' : 'Per dag'],
          ] as const
        ).map(([waarde, label]) => (
          <button
            key={waarde}
            type="button"
            className={`segment__knop${weergave === waarde ? ' is-actief' : ''}`}
            aria-pressed={weergave === waarde}
            onClick={() => kiesWeergave(waarde)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  const kop = (
    <SchermKop
      titel="Planning"
      boven={
        dagIndex >= 0
          ? `Dag ${dagIndex + 1} van ${data.dagen.length} · ${tijdUUMM(nu)}`
          : dagenTotVertrek > 0
            ? `Nog ${dagenTotVertrek} ${dagenTotVertrek === 1 ? 'dag' : 'dagen'}`
            : undefined
      }
      ondertitel={regel && <span role="status">{regel}</span>}
      rechts={
        weerVandaag && (
          <button type="button" className="schermkop__knop" onClick={naarWeer} title={`${weerTekst(weerVandaag.code)} in het dorp`}>
            <span className="schermkop__groot" aria-hidden="true">
              <WeerIcoon naam={weerSoort(weerVandaag.code)} grootte={30} />
            </span>
            {graden(weerVandaag.tMax)}
            <span className="verborgen"> in het dorp vandaag, {weerTekst(weerVandaag.code)}. Meer over weer en sneeuw</span>
          </button>
        )
      }
    >
      {keuze}
    </SchermKop>
  )

  return (
    <div className="scherm boekje">
      {nieuw ? kop : <h1>Planning</h1>}
      {!nieuw && keuze}
      {weergave === 'reis' || !dag ? (
        <Inhoud dagen={data.dagen} vandaag={vandaag} naar={naar} />
      ) : (
        <Blad
          key={dag.datum}
          dag={dag}
          nummer={dagNr + 1}
          aantal={data.dagen.length}
          nu={nu}
          isVandaag={dag.datum === vandaag}
          weerTekstje={w && `In het dorp: ${graden(w.tMax)}, ${weerTekst(w.code).toLowerCase()}`}
          vorige={data.dagen[dagNr - 1]}
          volgende={data.dagen[dagNr + 1]}
          naar={naar}
        />
      )}
    </div>
  )
}
