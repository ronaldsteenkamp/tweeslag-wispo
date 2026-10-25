import { useEffect, useMemo, useRef, useState } from 'react'
import { PISTE_KLEUREN, useData, type Kamers, type PisteKleur, type Rad as RadData } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'
import { deelnemers, fractie, initialen, kies, useDeelnemersKeuze, willekeurig } from '../lib/rad'
import { DataStatus } from './DataStatus'
import { DeelnemersKiezer } from './DeelnemersKiezer'
import { Roulette } from './Roulette'
import { taartpunt, tik, useDraai } from './Wiel'

type Soort = 'klos' | 'piste' | 'drankje' | 'eigen'

const SOORTEN: { waarde: Soort; label: string }[] = [
  { waarde: 'klos', label: 'Klos' },
  { waarde: 'piste', label: 'Piste' },
  { waarde: 'drankje', label: 'Drankje' },
  { waarde: 'eigen', label: 'Eigen' },
]

const KLEUR_EMOJI: Record<PisteKleur, string> = { groen: '🟢', blauw: '🔵', rood: '🔴', zwart: '⚫' }
const KLEUR_NAAM: Record<PisteKleur, string> = { groen: 'Groene', blauw: 'Blauwe', rood: 'Rode', zwart: 'Zwarte' }

/** Vakken om en om donkerblauw, lichtblauw en wit; tekst die op elke kleur leesbaar is */
const VAKKLEUREN = [
  { vlak: 'var(--tweeslag-donkerblauw)', tekst: '#ffffff' },
  { vlak: 'var(--tweeslag-lichtblauw)', tekst: 'var(--tweeslag-donkerblauw)' },
  { vlak: '#ffffff', tekst: 'var(--tweeslag-donkerblauw)' },
]

/** Kleur van vak i, zo dat twee buren (ook het laatste en het eerste vak) nooit gelijk zijn */
const vakKleur = (i: number, n: number) => VAKKLEUREN[n % 3 === 1 && i === n - 1 ? 1 : i % 3]

interface Uitslag {
  soort: Soort
  optie: string
  opdracht?: string
  kleur?: PisteKleur
}

/** Spel → Rad: het rad, of voor wie in "casino" staat de roulettetafel */
export function RadOnderdeel() {
  const { data: rad, fout } = useData('rad')
  const { data: kamers } = useData('kamers')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const [casinoVerlaten, setCasinoVerlaten] = useOpgeslagen('casino.verlaten', false)

  if (!rad) return <DataStatus fout={fout} />
  const casino = !!naam && rad.casino.includes(naam)
  if (casino && !casinoVerlaten) return <Roulette naam={naam} kamers={kamers} onTerug={() => setCasinoVerlaten(true)} />
  return <Rad rad={rad} kamers={kamers} naam={naam} naarCasino={casino ? () => setCasinoVerlaten(false) : undefined} />
}

function Rad({
  rad,
  kamers,
  naam,
  naarCasino,
}: {
  rad: RadData
  kamers?: Kamers
  naam: string | null
  naarCasino?: () => void
}) {
  const [soort, setSoort] = useOpgeslagen<Soort>('rad.soort', 'klos')
  const [keuze] = useDeelnemersKeuze()
  const [kleuren, setKleuren] = useOpgeslagen<PisteKleur[]>('rad.kleuren', PISTE_KLEUREN)
  const [eigen, setEigen] = useOpgeslagen<string[]>('rad.eigen', ['Ja', 'Nee'])
  const [geluidAan, setGeluidAan] = useOpgeslagen('rad.geluid', true)
  const [bezig, setBezig] = useState(false)
  const [uitslag, setUitslag] = useState<Uitslag | null>(null)
  const groep = useRef<SVGGElement>(null)
  const { hoek, draai } = useDraai()

  const opties = useMemo<{ waarde: string; kleur?: PisteKleur }[]>(() => {
    if (soort === 'klos') return deelnemers(keuze, kamers, naam).map((n) => ({ waarde: n }))
    if (soort === 'piste')
      return rad.pistes.filter((p) => kleuren.includes(p.kleur)).map((p) => ({ waarde: p.naam, kleur: p.kleur }))
    if (soort === 'drankje') return rad.drankjes.map((d) => ({ waarde: d }))
    return eigen.map((e) => e.trim()).filter(Boolean).map((e) => ({ waarde: e }))
  }, [soort, keuze, kamers, naam, rad, kleuren, eigen])

  // Andere opties: oude uitslag weg
  useEffect(() => setUitslag(null), [opties])

  const draaiRad = async () => {
    if (bezig || opties.length < 2) return
    const n = opties.length
    const vak = 360 / n
    const i = willekeurig(n)
    // Vak i komt onder de pijl (boven), ergens binnen het vak en niet precies op de grens
    const doelRest = (((360 - (i + 0.5) * vak + (fractie() - 0.5) * vak * 0.7) % 360) + 360) % 360
    const nu = hoek.current
    const doel = nu + 360 * 4 + ((((doelRest - (nu % 360)) % 360) + 360) % 360)
    setBezig(true)
    setUitslag(null)
    await draai({
      doel,
      duur: 3300 + fractie() * 700,
      vak,
      onTik: geluidAan ? tik : undefined,
      onFrame: (h) => groep.current?.setAttribute('transform', `rotate(${h})`),
    })
    const o = opties[i]
    setUitslag({
      soort,
      optie: o.waarde,
      kleur: o.kleur,
      opdracht: soort === 'klos' && rad.klosOpdrachten.length ? kies(rad.klosOpdrachten) : undefined,
    })
    setBezig(false)
  }

  const tekort =
    soort === 'klos'
      ? 'Kies minstens twee mensen.'
      : soort === 'piste'
        ? 'Kies minstens één kleur met twee of meer pistes.'
        : soort === 'eigen'
          ? 'Vul minstens twee opties in.'
          : 'Er staan nog geen drankjes in rad.json.'

  return (
    <>
      {naarCasino && (
        <button type="button" className="tekstknop" onClick={naarCasino}>
          🎰 Naar je casino
        </button>
      )}

      <div className="segment segment--vier" role="tablist" aria-label="Welk rad">
        {SOORTEN.map((s) => (
          <button
            key={s.waarde}
            type="button"
            role="tab"
            aria-selected={soort === s.waarde}
            className={`segment__knop${soort === s.waarde ? ' is-actief' : ''}`}
            onClick={() => setSoort(s.waarde)}
            disabled={bezig}
          >
            {s.label}
          </button>
        ))}
      </div>

      {soort === 'klos' && <DeelnemersKiezer kamers={kamers} naam={naam} />}
      {soort === 'piste' && (
        <fieldset className="veld">
          <legend>Welke kleuren?</legend>
          <div className="radkeuzes">
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
      {soort === 'eigen' && <EigenOpties opties={eigen} onWijzig={setEigen} />}

      <section className="kaartje radkaart golf" aria-label="Rad">
        <RadWiel opties={opties} soort={soort} groep={groep} hoek={hoek.current} />
        {opties.length < 2 ? (
          <p className="radkaart__tekort">{tekort}</p>
        ) : (
          <button type="button" className="knop knop--accent radkaart__draai" onClick={() => void draaiRad()} disabled={bezig}>
            {bezig ? 'Draait…' : 'Draai!'}
          </button>
        )}
        <button type="button" className="radkaart__geluid" onClick={() => setGeluidAan(!geluidAan)} aria-pressed={geluidAan}>
          {geluidAan ? '🔊 Geluid aan' : '🔈 Geluid uit'}
        </button>
      </section>

      <div aria-live="polite">{uitslag && <UitslagKaart uitslag={uitslag} />}</div>
    </>
  )
}

function RadWiel({
  opties,
  soort,
  groep,
  hoek,
}: {
  opties: { waarde: string; kleur?: PisteKleur }[]
  soort: Soort
  groep: React.RefObject<SVGGElement>
  hoek: number
}) {
  const n = Math.max(opties.length, 1)
  const vak = 360 / n
  const letter = n <= 6 ? 11 : n <= 10 ? 9 : n <= 16 ? 7.5 : 6
  // Bij veel namen: initialen; bij veel andere opties: kleinere tekst (en afkappen)
  const kort = soort === 'klos' && n > 16
  const maxTekens = Math.floor(66 / (letter * 0.56))
  const label = (o: { waarde: string; kleur?: PisteKleur }) => {
    const t = kort ? initialen(o.waarde) : o.waarde
    const tekst = t.length > maxTekens ? `${t.slice(0, maxTekens - 1)}…` : t
    return o.kleur ? `${tekst} ${KLEUR_EMOJI[o.kleur]}` : tekst
  }
  return (
    <svg className="radkaart__wiel" viewBox="-115 -115 230 230" role="img" aria-label={`Rad met ${opties.length} vakken`}>
      <circle r="106" fill="var(--tweeslag-donkerblauw)" stroke="#ffffff" strokeWidth="3" />
      <g ref={groep} transform={`rotate(${hoek})`}>
        {opties.length === 0 && <circle r="100" fill="var(--tweeslag-lichtblauw)" />}
        {opties.length === 1 && <circle r="100" fill={VAKKLEUREN[0].vlak} />}
        {opties.length >= 2 &&
          opties.map((o, i) => {
            const kleur = vakKleur(i, n)
            return (
              <g key={`${i}-${o.waarde}`}>
                <path d={taartpunt(100, i * vak, (i + 1) * vak)} fill={kleur.vlak} stroke="var(--tweeslag-donkerblauw)" strokeWidth="0.6" />
                <text
                  transform={`rotate(${(i + 0.5) * vak - 90})`}
                  x="92"
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

const hoofdletter = (s: string) => s.charAt(0).toLocaleUpperCase('nl') + s.slice(1)

function UitslagKaart({ uitslag }: { uitslag: Uitslag }) {
  const { soort, optie, opdracht, kleur } = uitslag
  return (
    <section className="kaartje raduitslag">
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
          {kleur && <p>{KLEUR_NAAM[kleur]} piste. Iedereen erachteraan!</p>}
        </>
      )}
      {soort === 'drankje' && (
        <>
          <p className="raduitslag__groot">🍻 {optie}!</p>
          <p>Proost!</p>
        </>
      )}
      {soort === 'eigen' && <p className="raduitslag__groot">🎯 {optie}</p>}
    </section>
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
