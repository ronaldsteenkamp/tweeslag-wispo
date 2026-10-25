import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PISTE_KLEUREN, useData, type Kamers, type PisteKleur, type Rad as RadData } from '../lib/data'
import { lees, useOpgeslagen } from '../lib/opslag'
import { BevestigDialoog } from './BevestigDialoog'
import { deelnemers, fractie, initialen, kies, useDeelnemersKeuze, willekeurig } from '../lib/rad'
import { doelHoek, vakTekst, verspreid } from '../lib/radwiskunde'
import { DataStatus } from './DataStatus'
import { DeelnemersKiezer } from './DeelnemersKiezer'
import { Roulette } from './Roulette'
import { minderBeweging, taartpunt, tik, tril, useDraai } from './Wiel'

type Soort = 'klos' | 'piste' | 'drankje' | 'eigen' | 'casino'

const SOORTEN: { waarde: Soort; label: string }[] = [
  { waarde: 'klos', label: 'Klos' },
  { waarde: 'piste', label: 'Piste' },
  { waarde: 'drankje', label: 'Drankje' },
  { waarde: 'eigen', label: 'Eigen' },
  { waarde: 'casino', label: 'Casino' },
]

const KLEUR_EMOJI: Record<PisteKleur, string> = { groen: '🟢', blauw: '🔵', rood: '🔴', zwart: '⚫' }
const KLEUR_NAAM: Record<PisteKleur, string> = { groen: 'Groene', blauw: 'Blauwe', rood: 'Rode', zwart: 'Zwarte' }
/** Rand van een pistevak in de kleur van de piste (blauw lichter dan het clubblauw, zwart met een witte rand) */
const PISTE_RAND: Record<PisteKleur, string> = { groen: '#22a447', blauw: '#3f7df0', rood: '#e0283f', zwart: '#111111' }

/** Vakken om en om donkerblauw, lichtblauw en wit; tekst die op elke kleur leesbaar is */
const VAKKLEUREN = [
  { vlak: 'var(--tweeslag-donkerblauw)', tekst: '#ffffff' },
  { vlak: 'var(--tweeslag-lichtblauw)', tekst: 'var(--tweeslag-donkerblauw)' },
  { vlak: '#ffffff', tekst: 'var(--tweeslag-donkerblauw)' },
]

/** Kleur van vak i, zo dat twee buren (ook het laatste en het eerste vak) nooit gelijk zijn */
const vakKleur = (i: number, n: number) => VAKKLEUREN[n % 3 === 1 && i === n - 1 ? 1 : i % 3]

interface Optie {
  waarde: string
  kleur?: PisteKleur
}

interface EigenLijst {
  naam: string
  opties: string[]
}

const MAX_LIJSTEN = 8

interface Uitslag {
  soort: Soort
  /** Ondertitel, bij het draaien gekozen */
  zin?: string
  optie: string
  opdracht?: string
  kleur?: PisteKleur
}

/** Kort, voor de regel "Laatste:" onder het rad */
const kortTekst = (u: Uitslag) => (u.kleur ? `${KLEUR_EMOJI[u.kleur]} ${u.optie}` : u.optie)

/** Volledig, voor schermlezers */
function voorleesTekst(u: Uitslag) {
  if (u.soort === 'klos') return `${u.optie} is de klos!${u.opdracht ? ` ${hoofdletter(u.opdracht.replace(/[.!]+$/, ''))}.` : ''}`
  if (u.soort === 'piste') return `${u.optie}${u.kleur ? `, ${KLEUR_NAAM[u.kleur].toLowerCase()} piste` : ''}`
  return u.optie
}

/** Het tabblad Rad: vier radden en het casino (voor iedereen) */
export function RadOnderdeel() {
  const { data: rad, fout } = useData('rad')
  const { data: kamers } = useData('kamers')
  const [naam] = useOpgeslagen<string | null>('naam', null)

  if (!rad) return <DataStatus fout={fout} />
  return <Rad rad={rad} kamers={kamers} naam={naam} />
}

function Rad({ rad, kamers, naam }: { rad: RadData; kamers?: Kamers; naam: string | null }) {
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
  // De laatste vijf uitslagen per rad
  const [laatste, setLaatste] = useOpgeslagen<Partial<Record<Soort, string[]>>>('rad.laatste', {})
  const [bezig, setBezig] = useState(false)
  const [casinoBezig, setCasinoBezig] = useState(false)
  const [uitslag, setUitslag] = useState<Uitslag | null>(null)
  const [popup, setPopup] = useState(false)
  // De opties waarmee gedraaid wordt (blijven op het rad staan tot er iets verandert) en het winnende vak
  const [vast, setVast] = useState<{ opties: Optie[]; winnaar: number | null; ronde: number } | null>(null)
  const groep = useRef<SVGGElement>(null)
  const draaiKnop = useRef<HTMLButtonElement>(null)
  const nogEensKnop = useRef<HTMLButtonElement>(null)
  const popupTimer = useRef<number>()
  const { hoek, draai } = useDraai()

  // Per rad apart, zodat bijvoorbeeld een nieuwe kamerverdeling de pistes niet opnieuw schudt
  const namen = useMemo(() => deelnemers(keuze, kamers, naam).map((n) => ({ waarde: n })), [keuze, kamers, naam])
  const pistes = useMemo(
    () => verspreid(rad.pistes.filter((p) => kleuren.includes(p.kleur)).map((p) => ({ waarde: p.naam, kleur: p.kleur })), fractie),
    [rad.pistes, kleuren],
  )
  const drankjes = useMemo(
    () => [...new Set([...rad.drankjes, ...eigenDrank])].filter((d) => !drankUit.includes(d)).map((d) => ({ waarde: d })),
    [rad.drankjes, eigenDrank, drankUit],
  )
  const eigenOpties = useMemo(() => eigen.map((e) => e.trim()).filter(Boolean).map((e) => ({ waarde: e })), [eigen])
  const opties: Optie[] =
    soort === 'klos' ? namen : soort === 'piste' ? pistes : soort === 'drankje' ? drankjes : soort === 'eigen' ? eigenOpties : []

  // Andere opties: oude uitslag weg. Tijdens het draaien niet: dan blijft het rad gelijk aan de uitslag.
  useEffect(() => {
    if (bezig) return
    setUitslag(null)
    setVast(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opties])

  useEffect(() => () => window.clearTimeout(popupTimer.current), [])

  const sluitPopup = () => {
    setPopup(false)
    draaiKnop.current?.focus()
  }

  useEffect(() => {
    if (!popup) return
    nogEensKnop.current?.focus()
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && sluitPopup()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [popup])

  /** Een willekeurige ondertitel uit rad.json (met een standaard als die leeg is) */
  const ondertitel = (s: Soort, kleur?: PisteKleur) => {
    if (s === 'drankje') return rad.drankZinnen.length ? kies(rad.drankZinnen) : 'Proost!'
    if (s === 'piste') {
      const zinnen = [...rad.pisteZinnen.algemeen, ...(kleur ? rad.pisteZinnen[kleur] : [])]
      return zinnen.length ? kies(zinnen) : 'Iedereen erachteraan!'
    }
    return undefined
  }

  const draaiRad = async () => {
    if (bezig || opties.length < 2) return
    // Deze lijst blijft op het rad staan tot de uitslag er is, ook als er intussen iets verandert
    const lijst = opties
    const n = lijst.length
    const i = willekeurig(n)
    // Vak i komt onder de pijl (boven), ergens binnen het vak en niet precies op de grens
    const doel = doelHoek(i, n, hoek.current, fractie())
    window.clearTimeout(popupTimer.current)
    setVast((oud) => ({ opties: lijst, winnaar: null, ronde: (oud?.ronde ?? 0) + 1 }))
    setBezig(true)
    setUitslag(null)
    setPopup(false)
    await draai({
      doel,
      duur: 3300 + fractie() * 700,
      vak: 360 / n,
      onTik: geluidAan
        ? () => {
            tik()
            tril(5)
          }
        : undefined,
      onFrame: (h) => groep.current?.setAttribute('transform', `rotate(${h})`),
    })
    const o = lijst[i]
    const nieuw: Uitslag = {
      soort,
      optie: o.waarde,
      kleur: o.kleur,
      opdracht: soort === 'klos' && rad.klosOpdrachten.length ? kies(rad.klosOpdrachten) : undefined,
      zin: ondertitel(soort, o.kleur),
    }
    setUitslag(nieuw)
    setVast((oud) => (oud ? { ...oud, winnaar: i } : oud))
    setLaatste((oud) => ({ ...oud, [soort]: [kortTekst(nieuw), ...(oud[soort] ?? [])].slice(0, 5) }))
    if (geluidAan) tril([80, 60, 180])
    setBezig(false)
    // Eerst even het winnende vak laten oplichten, dan pas de popup
    popupTimer.current = window.setTimeout(() => setPopup(true), minderBeweging() ? 0 : 700)
  }

  const tekort =
    soort === 'klos'
      ? 'Kies minstens twee mensen.'
      : soort === 'piste'
        ? 'Kies minstens één kleur met twee of meer pistes.'
        : soort === 'eigen'
          ? 'Vul minstens twee opties in.'
          : 'Kies minstens twee drankjes.'

  // Met een toetsenbord: pijltjes (en Home/End) gaan naar het vorige of volgende rad
  const opPijltje = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const nu = SOORTEN.findIndex((s) => s.waarde === soort)
    const stap = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
    const nieuw = e.key === 'Home' ? 0 : e.key === 'End' ? SOORTEN.length - 1 : stap ? (nu + stap + SOORTEN.length) % SOORTEN.length : -1
    if (nieuw < 0) return
    e.preventDefault()
    setSoort(SOORTEN[nieuw].waarde)
    ;(e.currentTarget.children[nieuw] as HTMLElement | undefined)?.focus()
  }

  const keuzebalk = (
    <div className="segment segment--vijf" role="tablist" aria-label="Welk rad" onKeyDown={opPijltje}>
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
        {keuzebalk}
        <Roulette naam={naam} kamers={kamers} onBezig={setCasinoBezig} />
      </>
    )
  }

  return (
    <>
      {keuzebalk}

      <section className="kaartje radkaart golf" aria-label="Rad">
        <button
          type="button"
          className="radkaart__geluid"
          onClick={() => setGeluidAan(!geluidAan)}
          aria-pressed={geluidAan}
          aria-label={geluidAan ? 'Geluid en trillen uitzetten' : 'Geluid en trillen aanzetten'}
          title={geluidAan ? 'Geluid en trillen aan' : 'Geluid en trillen uit'}
        >
          {geluidAan ? '🔊' : '🔇'}
        </button>
        <RadWiel
          opties={vast?.opties ?? opties}
          soort={soort}
          groep={groep}
          hoek={hoek.current}
          winnaar={bezig ? null : (vast?.winnaar ?? null)}
        />
        {vast?.winnaar != null && !bezig && <Confetti key={vast.ronde} />}
        {opties.length < 2 ? (
          <p className="radkaart__tekort">{tekort}</p>
        ) : (
          <button
            ref={draaiKnop}
            type="button"
            className="knop knop--accent radkaart__draai"
            onClick={() => void draaiRad()}
            disabled={bezig}
            aria-busy={bezig}
          >
            {bezig ? 'Draait…' : 'Draai!'}
          </button>
        )}
        {!!laatste[soort]?.length && (
          <p className="radkaart__laatste">
            Laatste: <strong>{laatste[soort]![0]}</strong>
            {laatste[soort]!.slice(1).map((x) => ` · ${x}`)}
          </p>
        )}
        <p className="verborgen" aria-live="polite">
          {uitslag ? voorleesTekst(uitslag) : ''}
        </p>
      </section>

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
                  {KLEUR_EMOJI[k]} {k}
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

      {popup && uitslag && (
        <div className="dialoog-achtergrond dialoog-achtergrond--licht" onClick={sluitPopup}>
          <div
            className="dialoog raduitslag raduitslag--popup"
            role="dialog"
            aria-modal="true"
            aria-label="Uitslag"
            aria-describedby="raduitslag-inhoud"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="raduitslag-inhoud" className="raduitslag__inhoud">
              <UitslagInhoud uitslag={uitslag} />
            </div>
            <div className="dialoog__knoppen">
              <button type="button" className="knop knop--secundair" onClick={sluitPopup}>
                Sluiten
              </button>
              <button
                ref={nogEensKnop}
                type="button"
                className="knop knop--accent"
                onClick={() => {
                  setPopup(false)
                  void draaiRad()
                }}
              >
                Nog eens!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function RadWiel({
  opties,
  soort,
  groep,
  hoek,
  winnaar,
}: {
  opties: Optie[]
  soort: Soort
  groep: React.RefObject<SVGGElement>
  hoek: number
  /** Het vak onder de pijl na het draaien (licht op) */
  winnaar: number | null
}) {
  const n = Math.max(opties.length, 1)
  const vak = 360 / n
  const { letter, ruimte, maxTekens } = vakTekst(n)
  // Pas bij heel veel namen initialen; anders kleinere tekst (en afkappen)
  const kort = soort === 'klos' && n > 40
  const label = (o: Optie) => {
    const t = kort ? initialen(o.waarde) : o.waarde
    return t.length > maxTekens ? `${t.slice(0, maxTekens - 1)}…` : t
  }

  // Afkappen gaat op aantal tekens; is een tekst met brede letters (W, M) toch te lang, dan iets smaller maken
  useLayoutEffect(() => {
    groep.current?.querySelectorAll<SVGTextElement>('.radkaart__vaktekst').forEach((t) => {
      t.removeAttribute('textLength')
      t.removeAttribute('lengthAdjust')
      const max = Number(t.dataset.ruimte)
      if (t.getComputedTextLength() > max) {
        t.setAttribute('textLength', String(max))
        t.setAttribute('lengthAdjust', 'spacingAndGlyphs')
      }
    })
  }, [groep, opties, ruimte])

  return (
    <svg className="radkaart__wiel" viewBox="-115 -115 230 230" role="img" aria-label={`Rad met ${opties.length} vakken`}>
      <circle r="106" fill="var(--tweeslag-donkerblauw)" stroke="#ffffff" strokeWidth="3" />
      <g ref={groep} transform={`rotate(${hoek})`}>
        {opties.length === 0 && <circle r="100" fill="var(--tweeslag-lichtblauw)" />}
        {opties.length === 1 && <circle r="100" fill={VAKKLEUREN[0].vlak} />}
        {opties.length >= 2 &&
          opties.map((o, i) => {
            const kleur = vakKleur(i, n)
            // Pistes: een rand in de kleur van de piste, de tekst schuift iets naar binnen
            const rand = o.kleur ? 7 : 0
            return (
              <g key={`${i}-${o.waarde}`}>
                <path d={taartpunt(100, i * vak, (i + 1) * vak)} fill={kleur.vlak} stroke="var(--tweeslag-donkerblauw)" strokeWidth="0.6" />
                {o.kleur && (
                  <path
                    d={taartpunt(100, i * vak, (i + 1) * vak, 100 - rand)}
                    fill={PISTE_RAND[o.kleur]}
                    stroke="#ffffff"
                    strokeWidth="0.6"
                  />
                )}
                <text
                  transform={`rotate(${(i + 0.5) * vak - 90})`}
                  x={92 - rand}
                  data-ruimte={ruimte - rand}
                  y={letter * 0.35}
                  textAnchor="end"
                  fontSize={letter}
                  fill={kleur.tekst}
                  className="radkaart__vaktekst"
                >
                  {label(o)}
                </text>
              </g>
            )
          })}
        {/* Pinnetjes op de rand */}
        {opties.length >= 2 &&
          opties.map((_, i) => {
            const r = (((i * vak - 90) * Math.PI) / 180)
            return <circle key={i} cx={Math.cos(r) * 103} cy={Math.sin(r) * 103} r="1.8" fill="#f3d36b" />
          })}
        {winnaar !== null && opties.length >= 2 && (
          <path d={taartpunt(100, winnaar * vak, (winnaar + 1) * vak)} className="radkaart__winnaar" />
        )}
      </g>
      <circle r="17" fill="#ffffff" stroke="var(--tweeslag-donkerblauw)" strokeWidth="3" />
      <text y="6" textAnchor="middle" fontSize="17" aria-hidden="true">
        ❄️
      </text>
      {/* De rode pijl bovenaan */}
      <path d="M0 -92 L-11 -114 L11 -114 Z" fill="#d7263d" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

const CONFETTI_KLEUREN = ['#f3d36b', '#ffffff', '#099fc4', '#d7263d', '#7fd3ea']

/** Een handvol confetti over het rad (bij minder beweging meteen weer weg) */
function Confetti() {
  const stukjes = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        links: 10 + fractie() * 80,
        opzij: (fractie() - 0.5) * 120,
        vertraging: fractie() * 0.25,
        duur: 1.3 + fractie() * 0.8,
        draai: (fractie() - 0.5) * 900,
        kleur: CONFETTI_KLEUREN[i % CONFETTI_KLEUREN.length],
      })),
    [],
  )
  return (
    <div className="confetti" aria-hidden="true">
      {stukjes.map((s, i) => (
        <span
          key={i}
          style={
            {
              left: `${s.links}%`,
              background: s.kleur,
              animationDelay: `${s.vertraging}s`,
              animationDuration: `${s.duur}s`,
              '--opzij': `${s.opzij}px`,
              '--draai': `${s.draai}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

const hoofdletter = (s: string) => s.charAt(0).toLocaleUpperCase('nl') + s.slice(1)

function UitslagInhoud({ uitslag }: { uitslag: Uitslag }) {
  const { soort, optie, opdracht, kleur, zin } = uitslag
  return (
    <>
      {soort === 'klos' && (
        <>
          <p className="raduitslag__groot">🎯 {optie} is de klos!</p>
          {opdracht && <p>{hoofdletter(opdracht.replace(/[.!]+$/, ''))}.</p>}
        </>
      )}
      {soort === 'piste' && (
        <>
          <p className="raduitslag__groot">
            {kleur && KLEUR_EMOJI[kleur]} {optie}
          </p>
          {kleur && <p className="raduitslag__soort">{KLEUR_NAAM[kleur]} piste</p>}
          {zin && <p>{zin}</p>}
        </>
      )}
      {soort === 'drankje' && (
        <>
          <p className="raduitslag__groot">🍻 {optie}!</p>
          {zin && <p>{zin}</p>}
        </>
      )}
      {soort === 'eigen' && <p className="raduitslag__groot">🎯 {optie}</p>}
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
                ✕
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
            🗑
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
              ✕
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
