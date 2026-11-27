import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icoon } from './Icoon'
import { PISTE_KLEUREN, useData, type Kamers, type PisteKleur, type Rad as RadData } from '../lib/data'
import { useToonNaam } from '../lib/bijnamen'
import { lees, useOpgeslagen } from '../lib/opslag'
import { tabToetsen } from '../lib/tabbladen'
import { BevestigDialoog } from './BevestigDialoog'
import { deelnemers, fractie, initialen, kies, useDeelnemersKeuze, willekeurig } from '../lib/rad'
import { verspreid } from '../lib/radwiskunde'
import { meldKlos } from '../lib/radUitslagen'
import { DataStatus } from './DataStatus'
import { DeelnemersKiezer } from './DeelnemersKiezer'
import { Roulette } from './Roulette'
import { Kompas } from './rad/Kompas'
import { TaartRad } from './rad/TaartRad'
import { Trommel } from './rad/Trommel'
import type { Optie, RadUitslag } from './rad/basis'
import '../styles/barlow.css'
import '../styles/rad.css'

type Soort = 'klos' | 'piste' | 'drankje' | 'eigen' | 'casino'

const SOORTEN: { waarde: Soort; label: string }[] = [
  { waarde: 'klos', label: 'Klos' },
  { waarde: 'piste', label: 'Piste' },
  { waarde: 'drankje', label: 'Drankje' },
  { waarde: 'eigen', label: 'Eigen' },
  { waarde: 'casino', label: 'Casino' },
]

/** Wie op zijn eigen telefoon bij het klos-rad altijd zelf de klos is */
const GRAP_NAAM = 'menno'
const sleutelNaam = (n: string) => n.trim().toLocaleLowerCase('nl')

const KLEUR_NAAM: Record<PisteKleur, string> = { groen: 'Groene', blauw: 'Blauwe', rood: 'Rode', zwart: 'Zwarte' }

interface EigenLijst {
  naam: string
  opties: string[]
}

const MAX_LIJSTEN = 8

const hoofdletter = (s: string) => s.charAt(0).toLocaleUpperCase('nl') + s.slice(1)

/**
 * Het tabblad Rad: vier raderen en het casino (voor iedereen). Elk rad heeft een eigen uitvoering:
 * Klos het après-rad, Piste het liftbord, Drankje het pisteboord en Eigen het kompas (zie rad/).
 * Met `kop` tekent de aanroeper zelf de schermkop, met de keuze van het rad erin (nieuwe koppen);
 * zonder `kop` staat de keuzebalk gewoon bovenaan. Met `keuzePlek` (een element in de kop van Spel)
 * komt de keuzebalk daar te staan.
 */
export function RadOnderdeel({
  kop,
  keuzePlek,
}: { kop?: (keuzebalk?: ReactNode) => ReactNode; keuzePlek?: HTMLElement | null } = {}) {
  const { data: rad, fout } = useData('rad')
  const { data: kamers } = useData('kamers')
  const [naam] = useOpgeslagen<string | null>('naam', null)

  if (!rad)
    return (
      <>
        {kop?.()}
        <DataStatus fout={fout} />
      </>
    )
  return <Rad rad={rad} kamers={kamers} naam={naam} kop={kop} keuzePlek={keuzePlek} />
}

function Rad({
  rad,
  kamers,
  naam,
  kop,
  keuzePlek,
}: {
  rad: RadData
  kamers?: Kamers
  naam: string | null
  kop?: (keuzebalk?: ReactNode) => ReactNode
  keuzePlek?: HTMLElement | null
}) {
  const [soort, setSoort] = useOpgeslagen<Soort>('rad.soort', 'klos')
  const [keuze] = useDeelnemersKeuze()
  const [kleuren, setKleuren] = useOpgeslagen<PisteKleur[]>('rad.kleuren', PISTE_KLEUREN)
  // Eigen lijsten; de eerste neemt de opties over van toen er nog maar één lijst was ('rad.eigen')
  const eersteLijst = useMemo(() => [{ naam: 'Lijst 1', opties: lees<string[]>('rad.eigen', ['Ja', 'Nee']) }], [])
  const [lijsten, setLijsten] = useOpgeslagen<EigenLijst[]>('rad.eigenLijsten', eersteLijst)
  const [lijstNr, setLijstNr] = useOpgeslagen('rad.eigenLijst', 0)
  const actief = Math.min(lijstNr, lijsten.length - 1)
  const eigen = lijsten[actief].opties
  // Drankjes: welke uit rad.json niet meedoen, en zelf toegevoegde
  const [drankUit, setDrankUit] = useOpgeslagen<string[]>('rad.drankjes.uit', [])
  const [eigenDrank, setEigenDrank] = useOpgeslagen<string[]>('rad.drankjes.eigen', [])
  const [geluidAan, setGeluidAan] = useOpgeslagen('rad.geluid', true)
  const [bezig, setBezig] = useState(false)
  const [casinoBezig, setCasinoBezig] = useState(false)

  // Per rad apart, zodat bijvoorbeeld een nieuwe kamerverdeling de pistes niet opnieuw schudt
  const toon = useToonNaam()
  const namen = useMemo(() => {
    const lijst = deelnemers(keuze, kamers, naam)
    // Pas bij heel veel namen initialen
    return lijst.map((n) => ({ waarde: n, tekst: lijst.length > 40 ? initialen(toon(n)) : toon(n) }))
  }, [keuze, kamers, naam, toon])
  const pistes = useMemo(
    () => verspreid(rad.pistes.filter((p) => kleuren.includes(p.kleur)).map((p) => ({ waarde: p.naam, kleur: p.kleur })), fractie),
    [rad.pistes, kleuren],
  )
  const drankjes = useMemo(
    () => [...new Set([...rad.drankjes, ...eigenDrank])].filter((d) => !drankUit.includes(d)).map((d) => ({ waarde: d })),
    [rad.drankjes, eigenDrank, drankUit],
  )
  const eigenOpties = useMemo(() => eigen.map((e) => e.trim()).filter(Boolean).map((e) => ({ waarde: e })), [eigen])

  /** Welk vak wint: eerlijk (crypto), behalve het grapje: draait Menno zelf het klos-rad, dan is hij de klos */
  const kiesKlos = useCallback(
    (lijst: Optie[]) => {
      const grap = naam !== null && sleutelNaam(naam) === GRAP_NAAM ? lijst.findIndex((o) => sleutelNaam(o.waarde) === GRAP_NAAM) : -1
      return grap >= 0 ? grap : willekeurig(lijst.length)
    },
    [naam],
  )
  const kiesEerlijk = useCallback((lijst: Optie[]) => willekeurig(lijst.length), [])

  /** Een willekeurige zin uit rad.json (met een standaard als die leeg is) */
  const pisteZin = (kleur?: PisteKleur) => {
    const zinnen = [...rad.pisteZinnen.algemeen, ...(kleur ? rad.pisteZinnen[kleur] : [])]
    return zinnen.length ? kies(zinnen) : 'Iedereen erachteraan!'
  }

  const uitslagKlos = (o: Optie): RadUitslag => {
    const t = o.tekst ?? o.waarde
    const opdracht = rad.klosOpdrachten.length ? `${hoofdletter(kies(rad.klosOpdrachten).replace(/[.!]+$/, ''))}.` : undefined
    return { label: 'De klos van de avond', tekst: `${t}!`, zin: opdracht, live: `${t} is de klos!${opdracht ? ` ${opdracht}` : ''}`, volgende: `${t} mag nu draaien` }
  }
  const uitslagPiste = (o: Optie): RadUitslag => {
    const zin = pisteZin(o.kleur)
    const kleur = o.kleur ? `${KLEUR_NAAM[o.kleur]} piste` : 'Piste'
    return { label: `Vertrek · ${kleur.toLowerCase()}`, tekst: o.waarde, zin, live: `${o.waarde}, ${kleur.toLowerCase()}. ${zin}` }
  }
  const uitslagDrankje = (o: Optie): RadUitslag => {
    const zin = rad.drankZinnen.length ? kies(rad.drankZinnen) : 'Proost!'
    return { label: 'Volgende ronde', tekst: o.waarde, zin, live: `${o.waarde}. ${zin}` }
  }
  const lijstNaam = lijsten[actief].naam.trim() || `Lijst ${actief + 1}`
  const uitslagEigen = (o: Optie): RadUitslag => ({
    label: `Koers gezet · ${lijstNaam}`,
    tekst: o.waarde,
    live: `${lijstNaam}: ${o.waarde}`,
  })

  const tekort =
    soort === 'klos'
      ? 'Kies minstens twee mensen.'
      : soort === 'piste'
        ? 'Kies minstens één kleur met twee of meer pistes.'
        : soort === 'eigen'
          ? 'Vul minstens twee opties in.'
          : 'Kies minstens twee drankjes.'

  const keuzebalk = (
    <div
      className="segment segment--vijf"
      role="tablist"
      aria-label="Welk rad"
      onKeyDown={tabToetsen(
        SOORTEN.map((s) => s.waarde),
        soort,
        setSoort,
      )}
    >
      {SOORTEN.map((s) => (
        <button
          key={s.waarde}
          type="button"
          role="tab"
          aria-selected={soort === s.waarde}
          tabIndex={soort === s.waarde ? 0 : -1}
          className={`segment__knop${soort === s.waarde ? ' is-actief' : ''}`}
          onClick={() => setSoort(s.waarde)}
          disabled={bezig || casinoBezig}
        >
          {s.label}
        </button>
      ))}
    </div>
  )

  if (soort === 'casino') {
    return (
      <>
        {kop ? kop(keuzebalk) : keuzePlek ? createPortal(keuzebalk, keuzePlek) : keuzebalk}
        <Roulette naam={naam} kamers={kamers} onBezig={setCasinoBezig} />
      </>
    )
  }

  const gedeeld = { geluid: geluidAan, zetGeluid: setGeluidAan, onBezig: setBezig, tekort }

  return (
    <>
      {kop ? kop(keuzebalk) : keuzePlek ? createPortal(keuzebalk, keuzePlek) : keuzebalk}

      {soort === 'klos' && (
        <TaartRad
          key="klos"
          stijl="apres"
          vraag={
            <>
              <small>Après · Le Rad</small>Wie is de klos?
            </>
          }
          opties={namen}
          kies={kiesKlos}
          uitslag={uitslagKlos}
          // Voor de badge 🎡 Lot uit de loterij (het grapje telt niet mee)
          naUitslag={(o) => {
            if (!(naam !== null && sleutelNaam(naam) === GRAP_NAAM)) meldKlos(o.waarde)
          }}
          {...gedeeld}
        />
      )}
      {soort === 'drankje' && (
        <TaartRad key="drankje" stijl="pisteboord" opties={drankjes} kies={kiesEerlijk} uitslag={uitslagDrankje} {...gedeeld} />
      )}
      {soort === 'piste' && <Trommel key="piste" opties={pistes} kies={kiesEerlijk} uitslag={uitslagPiste} {...gedeeld} />}
      {soort === 'eigen' && (
        <Kompas key="eigen" lijstNaam={lijstNaam} opties={eigenOpties} kies={kiesEerlijk} uitslag={uitslagEigen} {...gedeeld} />
      )}

      {/* Niets aan te passen zolang het rad draait */}
      <fieldset className="radinstellingen" disabled={bezig}>
        {soort === 'klos' && <DeelnemersKiezer kamers={kamers} naam={naam} />}
        {soort === 'piste' && (
          <fieldset className="veld">
            <legend>Welke kleuren?</legend>
            <div className="radkleuren">
              {PISTE_KLEUREN.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`keuze${kleuren.includes(k) ? ' is-actief' : ''}`}
                  aria-pressed={kleuren.includes(k)}
                  onClick={() => setKleuren((oud) => (oud.includes(k) ? oud.filter((x) => x !== k) : [...oud, k]))}
                >
                  <i className={`pistebol pistebol--${k}`} aria-hidden="true" /> {k}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {soort === 'eigen' && (
          <EigenLijsten lijsten={lijsten} actief={actief} onKies={setLijstNr} onWijzig={setLijsten} />
        )}
        {soort === 'drankje' && (
          <DrankKiezer
            vast={rad.drankjes}
            uit={drankUit}
            setUit={setDrankUit}
            eigen={eigenDrank}
            setEigen={setEigenDrank}
          />
        )}
      </fieldset>
    </>
  )
}

/** Welke drankjes doen mee (aan/uit), en zelf drankjes toevoegen of weghalen */
function DrankKiezer({
  vast,
  uit,
  setUit,
  eigen,
  setEigen,
}: {
  vast: string[]
  uit: string[]
  setUit: (f: (oud: string[]) => string[]) => void
  eigen: string[]
  setEigen: (f: (oud: string[]) => string[]) => void
}) {
  const [nieuw, setNieuw] = useState('')
  const alle = [...new Set([...vast, ...eigen])]
  const wissel = (d: string) => setUit((oud) => (oud.includes(d) ? oud.filter((x) => x !== d) : [...oud, d]))
  const voegToe = (e: React.FormEvent) => {
    e.preventDefault()
    const d = nieuw.trim().replace(/\s+/g, ' ')
    if (!d) return
    if (!alle.some((x) => x.toLocaleLowerCase('nl') === d.toLocaleLowerCase('nl'))) setEigen((oud) => [...oud, d])
    setUit((oud) => oud.filter((x) => x.toLocaleLowerCase('nl') !== d.toLocaleLowerCase('nl')))
    setNieuw('')
  }
  return (
    <fieldset className="veld">
      <legend>Welke drankjes doen mee?</legend>
      <div className="radkeuzes">
        {alle.map((d) => {
          const aan = !uit.includes(d)
          const zelf = eigen.includes(d) && !vast.includes(d)
          return zelf ? (
            <span key={d} className={`drankkeuze${aan ? ' is-actief' : ''}`}>
              <button type="button" aria-pressed={aan} onClick={() => wissel(d)}>
                {d}
              </button>
              <button
                type="button"
                className="drankkeuze__weg"
                aria-label={`${d} weghalen`}
                onClick={() => {
                  setEigen((oud) => oud.filter((x) => x !== d))
                  setUit((oud) => oud.filter((x) => x !== d))
                }}
              >
                <Icoon naam="kruis" grootte={16} />
              </button>
            </span>
          ) : (
            <button key={d} type="button" className={`keuze${aan ? ' is-actief' : ''}`} aria-pressed={aan} onClick={() => wissel(d)}>
              {d}
            </button>
          )
        })}
      </div>
      <div className="knoppenrij">
        <button type="button" className="knop knop--secundair knop--klein" onClick={() => setUit(() => [])}>
          Alles aan
        </button>
        <button type="button" className="knop knop--secundair knop--klein" onClick={() => setUit(() => alle)}>
          Niets
        </button>
      </div>
      <form className="eigenopties__regel" onSubmit={voegToe}>
        <input
          className="invoer"
          value={nieuw}
          maxLength={40}
          placeholder="Drankje toevoegen"
          aria-label="Drankje toevoegen"
          onChange={(e) => setNieuw(e.target.value)}
        />
        <button type="submit" className="knop knop--secundair knop--klein" disabled={!nieuw.trim()}>
          ＋
        </button>
      </form>
    </fieldset>
  )
}

/** Meerdere eigen lijsten (bijv. "Spelletje", "Wat eten we?"): kiezen, hernoemen, toevoegen en weghalen */
function EigenLijsten({
  lijsten,
  actief,
  onKies,
  onWijzig,
}: {
  lijsten: EigenLijst[]
  actief: number
  onKies: (i: number) => void
  onWijzig: (l: EigenLijst[]) => void
}) {
  const [weghalen, setWeghalen] = useState(false)
  const lijst = lijsten[actief]
  const naam = (l: EigenLijst, i: number) => l.naam.trim() || `Lijst ${i + 1}`
  const zet = (nieuw: Partial<EigenLijst>) => onWijzig(lijsten.map((l, i) => (i === actief ? { ...l, ...nieuw } : l)))
  return (
    <>
      <fieldset className="veld">
        <legend>Welke lijst?</legend>
        <div className="radkeuzes">
          {lijsten.map((l, i) => (
            <button
              key={i}
              type="button"
              className={`keuze${i === actief ? ' is-actief' : ''}`}
              aria-pressed={i === actief}
              onClick={() => onKies(i)}
            >
              {naam(l, i)}
            </button>
          ))}
          {lijsten.length < MAX_LIJSTEN && (
            <button
              type="button"
              className="keuze"
              onClick={() => {
                onWijzig([...lijsten, { naam: `Lijst ${lijsten.length + 1}`, opties: ['', ''] }])
                onKies(lijsten.length)
              }}
            >
              ＋ Nieuwe lijst
            </button>
          )}
        </div>
        <div className="eigenopties__regel">
          <input
            className="invoer"
            value={lijst.naam}
            maxLength={24}
            placeholder="Naam van de lijst"
            aria-label="Naam van de lijst"
            onChange={(e) => zet({ naam: e.target.value })}
          />
          <button
            type="button"
            className="icoonknop"
            aria-label={`Lijst ${naam(lijst, actief)} weghalen`}
            disabled={lijsten.length <= 1}
            onClick={() => setWeghalen(true)}
          >
            <Icoon naam="prullenbak" grootte={20} />
          </button>
        </div>
      </fieldset>
      <EigenOpties opties={lijst.opties} onWijzig={(opties) => zet({ opties })} />
      <BevestigDialoog
        open={weghalen}
        titel={`${naam(lijst, actief)} weghalen?`}
        tekst="De opties in deze lijst ben je dan kwijt."
        bevestigLabel="Weghalen"
        gevaarlijk
        onBevestig={() => {
          onWijzig(lijsten.filter((_, i) => i !== actief))
          onKies(Math.max(0, actief - 1))
          setWeghalen(false)
        }}
        onAnnuleer={() => setWeghalen(false)}
      />
    </>
  )
}

function EigenOpties({ opties, onWijzig }: { opties: string[]; onWijzig: (o: string[]) => void }) {
  return (
    <fieldset className="veld">
      <legend>Je eigen opties (2 tot 12)</legend>
      <div className="eigenopties">
        {opties.map((o, i) => (
          <div key={i} className="eigenopties__regel">
            <input
              className="invoer"
              value={o}
              maxLength={40}
              placeholder={`Optie ${i + 1}`}
              aria-label={`Optie ${i + 1}`}
              onChange={(e) => onWijzig(opties.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button
              type="button"
              className="icoonknop"
              aria-label={`Optie ${i + 1} weghalen`}
              disabled={opties.length <= 2}
              onClick={() => onWijzig(opties.filter((_, j) => j !== i))}
            >
              <Icoon naam="kruis" grootte={16} />
            </button>
          </div>
        ))}
      </div>
      {opties.length < 12 && (
        <button type="button" className="knop knop--secundair knop--klein" onClick={() => onWijzig([...opties, ''])}>
          ＋ Optie erbij
        </button>
      )}
    </fieldset>
  )
}
