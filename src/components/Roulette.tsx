import { useEffect, useMemo, useRef, useState } from 'react'
import type { Kamers } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'
import { deelnemers, fractie, schud, useDeelnemersKeuze, willekeurig } from '../lib/rad'
import { DeelnemersKiezer } from './DeelnemersKiezer'
import { taartpunt, tik, useDraai } from './Wiel'

/*
 * Josje's casino: een roulettetafel met de deelnemers als getallen. Fiches zijn nep en staan
 * alleen op deze telefoon; ze tellen nergens mee.
 */

const FICHES = [10, 25, 100] as const
const START = 1000
/** Fiches op, dan: een bak (bier in één keer leeg) voor zoveel nieuwe fiches */
const LENING = 500

type Buiten = 'rood' | 'zwart' | 'even' | 'oneven'
const BUITEN: { sleutel: Buiten; label: string }[] = [
  { sleutel: 'rood', label: 'Rood' },
  { sleutel: 'zwart', label: 'Zwart' },
  { sleutel: 'even', label: 'Even' },
  { sleutel: 'oneven', label: 'Oneven' },
]

const isRood = (g: number) => g % 2 === 1
const kleurVan = (g: number) => (g === 0 ? 'groen' : isRood(g) ? 'rood' : 'zwart')
const fiches = (n: number) => n.toLocaleString('nl-NL')

/** Wint deze inzet bij uitslag g? Geeft het totale bedrag terug dat de bank uitbetaalt (incl. inzet). */
function uitbetaling(sleutel: string, inzet: number, g: number, n: number): number {
  if (/^\d+$/.test(sleutel)) return Number(sleutel) === g ? inzet * n : 0 // (N-1):1 plus de inzet terug
  if (g === 0) return 0
  const wint =
    (sleutel === 'rood' && isRood(g)) ||
    (sleutel === 'zwart' && !isRood(g)) ||
    (sleutel === 'even' && g % 2 === 0) ||
    (sleutel === 'oneven' && g % 2 === 1)
  return wint ? inzet * 2 : 0
}

/** Een bedrag als stapeltje fiches (grootste eerst), voor op het speelveld */
function stapel(bedrag: number): number[] {
  const uit: number[] = []
  for (const f of [...FICHES].reverse()) while (bedrag >= f && uit.length < 6) (uit.push(f), (bedrag -= f))
  return uit
}

interface Uitslag {
  getal: number
  naam: string | null
  ingezet: number
  uitbetaald: number
}

export function Roulette({
  naam,
  kamers,
  onBezig,
}: {
  naam: string | null
  kamers?: Kamers
  /** Draait het wiel? (dan kan er niet van rad gewisseld worden) */
  onBezig?: (bezig: boolean) => void
}) {
  const [keuze] = useDeelnemersKeuze()
  const [saldo, setSaldo] = useOpgeslagen('casino.fiches', START)
  const [geleend, setGeleend] = useOpgeslagen('casino.geleend', 0)
  const [fiche, setFiche] = useState<number>(25)
  const [inzet, setInzet] = useState<Record<string, number>>({})
  const [bezig, setBezig] = useState(false)
  useEffect(() => onBezig?.(bezig), [bezig, onBezig])
  const [uitslag, setUitslag] = useState<Uitslag | null>(null)
  const [melding, setMelding] = useState<string | null>(null)
  const wiel = useRef<SVGGElement>(null)
  const bal = useRef<SVGCircleElement>(null)
  // Waar het balletje nu ligt (graden, 0 = boven); een nieuwe draai begint daar
  const balHoek = useRef(0)
  const balStraal = useRef(95)
  const { hoek, draai } = useDraai()

  const spelers = useMemo(() => deelnemers(keuze, kamers, naam), [keuze, kamers, naam])
  const n = spelers.length
  // Elk getal 1..N hoort bij één naam, per ronde opnieuw geschud
  const [volgorde, setVolgorde] = useState<string[]>(() => schud(spelers))
  const totaal = Object.values(inzet).reduce((s, x) => s + x, 0)
  const totaalNu = useRef(totaal)
  totaalNu.current = totaal

  // Andere spelers: inzet terug en opnieuw schudden
  const spelersSleutel = spelers.join('|')
  useEffect(() => {
    setVolgorde(schud(spelersSleutel ? spelersSleutel.split('|') : []))
    setUitslag(null)
    const terug = totaalNu.current
    if (terug) setSaldo((s) => s + terug)
    totaalNu.current = 0
    setInzet({})
  }, [spelersSleutel, setSaldo])

  useEffect(() => {
    if (!uitslag) return
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && volgendeRonde()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  })

  useEffect(() => {
    if (!melding) return
    const id = window.setTimeout(() => setMelding(null), 2500)
    return () => window.clearTimeout(id)
  }, [melding])

  const zet = (sleutel: string) => {
    if (bezig || uitslag) return
    if (saldo < fiche) {
      setMelding(saldo === 0 ? 'Je fiches zijn op.' : `Je hebt nog maar ${fiches(saldo)} fiches. Kies een kleinere fiche.`)
      return
    }
    setSaldo(saldo - fiche)
    setInzet({ ...inzet, [sleutel]: (inzet[sleutel] ?? 0) + fiche })
  }

  const inzetTerug = () => {
    setSaldo(saldo + totaal)
    setInzet({})
  }

  const volgendeRonde = () => {
    setUitslag(null)
    setVolgorde(schud(spelers))
  }

  const draaiWiel = async () => {
    if (bezig || totaal === 0 || n < 2) return
    const vakken = n + 1
    const vak = 360 / vakken
    const getal = willekeurig(vakken) // vak i = getal i (0, 1, 2, …, N)
    // Het balletje eindigt op een willekeurige plek; het wiel draait zo dat het vakje daar ligt
    const balEind = fractie() * 360
    const wielRest = (((balEind - (getal + 0.5) * vak) % 360) + 360) % 360
    const wielStart = hoek.current
    const wielDoel = wielStart + 360 * 3 + ((((wielRest - (wielStart % 360)) % 360) + 360) % 360)
    // Het balletje beweegt ten opzichte van het wiel: eerst hard de andere kant op, dan steeds
    // langzamer tot het stil in het vakje ligt (vanaf 85% draait het gewoon met het wiel mee).
    // Zo komt het precies goed uit zonder sprongen, wat het wiel ook doet.
    const relStart = balHoek.current - wielStart
    const relVakje = (getal + 0.5) * vak
    const relEind = relVakje + 360 * Math.floor((relStart - 360 * 6 - relVakje) / 360)
    const straalStart = balStraal.current
    setBezig(true)
    setUitslag(null)
    await draai({
      doel: wielDoel,
      duur: 4200 + fractie() * 600,
      vak,
      onTik: tik,
      onFrame: (h, t) => {
        wiel.current?.setAttribute('transform', `rotate(${h})`)
        const tb = Math.min(1, t / 0.85)
        const rel = relStart + (relEind - relStart) * (1 - Math.pow(1 - tb, 3))
        // Eerst uit het vakje terug de baan op (95), aan het eind vallen in het vakje (73) met een paar kleine hupjes
        const zacht = (x: number) => x * x * (3 - 2 * x)
        const op = zacht(Math.min(1, tb / 0.1))
        const u = Math.min(1, Math.max(0, (tb - 0.55) / 0.45))
        const hupje = 4 * Math.abs(Math.sin(Math.PI * 3 * u)) * (1 - u)
        const r = straalStart + (95 - straalStart) * op - 22 * zacht(u) + hupje
        balStraal.current = r
        balHoek.current = h + rel
        const a = ((h + rel - 90) * Math.PI) / 180
        bal.current?.setAttribute('cx', String(Math.cos(a) * r))
        bal.current?.setAttribute('cy', String(Math.sin(a) * r))
      },
    })
    const uitbetaald = Object.entries(inzet).reduce((s, [k, x]) => s + uitbetaling(k, x, getal, n), 0)
    setSaldo((s) => s + uitbetaald)
    setUitslag({ getal, naam: getal === 0 ? null : volgorde[getal - 1] ?? null, ingezet: totaal, uitbetaald })
    setInzet({})
    setBezig(false)
  }

  const winnend = (sleutel: string) => {
    if (!uitslag) return false
    return /^\d+$/.test(sleutel) ? Number(sleutel) === uitslag.getal : uitbetaling(sleutel, 1, uitslag.getal, n) > 0
  }

  return (
    <div className="casino">
      {n < 2 ? (
        <p className="melding">Kies minstens twee spelers (tik hieronder op Spelers).</p>
      ) : (
        <section className="casino__tafel" aria-label="Josjes casino">
          <div className="casino__kopregel">
            <h2 className="casino__titel">Josjes casino</h2>
            <p className="casino__saldo" aria-label={`${fiches(saldo)} fiches`}>
              <span aria-hidden="true">🪙</span> {fiches(saldo)}
            </p>
          </div>

          <RouletteWiel n={n} wiel={wiel} bal={bal} hoek={hoek.current} />

          <div className="casino__veld">
            <Vak sleutel="0" label="0, iedereen drinkt" klasse="casino__vak casino__vak--nul" inzet={inzet} winnend={winnend('0')} onZet={zet} uit={!!uitslag || bezig}>
              <strong>0</strong>
              <span>Iedereen drinkt</span>
            </Vak>
            <div className="casino__raster">
              {volgorde.map((speler, i) => {
                const g = i + 1
                return (
                  <Vak
                    key={g}
                    sleutel={String(g)}
                    label={`${g}, ${speler}`}
                    klasse={`casino__vak casino__vak--${isRood(g) ? 'rood' : 'zwart'}`}
                    inzet={inzet}
                    winnend={winnend(String(g))}
                    onZet={zet}
                    uit={!!uitslag || bezig}
                  >
                    <strong>{g}</strong>
                    <span>{speler}</span>
                  </Vak>
                )
              })}
            </div>
            <div className="casino__buiten">
              {BUITEN.map((b) => (
                <Vak
                  key={b.sleutel}
                  sleutel={b.sleutel}
                  label={b.label}
                  klasse={`casino__vak casino__vak--buiten casino__vak--${b.sleutel}`}
                  inzet={inzet}
                  winnend={winnend(b.sleutel)}
                  onZet={zet}
                  uit={!!uitslag || bezig}
                >
                  <strong>{b.label}</strong>
                </Vak>
              ))}
            </div>
          </div>

          {saldo === 0 && totaal === 0 && !bezig && !uitslag ? (
            <div className="casino__bank">
              <button
                type="button"
                className="knop knop--breed casino__knop"
                onClick={() => {
                  setSaldo(LENING)
                  setGeleend(geleend + 1)
                }}
              >
                🍺 Trek een bak voor {fiches(LENING)} nieuwe fiches
              </button>
              {geleend > 0 && (
                <p className="klein">
                  Al {geleend} {geleend === 1 ? 'bak' : 'bakken'} getrokken.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="casino__bediening">
                <div className="casino__fiches" role="radiogroup" aria-label="Fiche">
                  {FICHES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={fiche === f}
                      className={`fiche fiche--${f}${fiche === f ? ' is-gekozen' : ''}`}
                      onClick={() => setFiche(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="knop casino__knop casino__draai"
                  onClick={() => void draaiWiel()}
                  disabled={bezig || totaal === 0 || !!uitslag}
                >
                  {bezig ? 'Rolt…' : totaal === 0 ? 'Zet in' : 'Rien ne va plus!'}
                </button>
              </div>
              <p className="casino__inzetregel">
                Inzet <strong>{fiches(totaal)}</strong>
                {totaal > 0 && !bezig && (
                  <button type="button" className="tekstknop casino__terug" onClick={inzetTerug}>
                    terugnemen
                  </button>
                )}
              </p>
            </>
          )}
        </section>
      )}

      <details className="kaartje casino__spelers">
        <summary>Spelers ({n})</summary>
        <DeelnemersKiezer kamers={kamers} naam={naam} />
      </details>
      <p className="klein casino__uitleg">Nepfiches: geen echt geld en geen punten. Ze staan alleen op deze telefoon.</p>

      {uitslag && (
        <div className="dialoog-achtergrond dialoog-achtergrond--midden" onClick={volgendeRonde}>
          <div
            className="dialoog casino__popup"
            role="dialog"
            aria-modal="true"
            aria-label="Uitslag"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="casino__getal">
              <span className={`casino__bol casino__bol--${kleurVan(uitslag.getal)}`}>{uitslag.getal}</span>
              {uitslag.getal === 0 ? 'groen' : kleurVan(uitslag.getal)}
            </p>
            <p className="casino__klos">{uitslag.naam ? `${uitslag.naam} neemt een slok!` : '🍻 Iedereen drinkt!'}</p>
            <p>
              {uitslag.uitbetaald > uitslag.ingezet
                ? `Je wint ${fiches(uitslag.uitbetaald - uitslag.ingezet)} fiches 🎉`
                : uitslag.uitbetaald === uitslag.ingezet
                  ? 'Quitte: je krijgt je inzet terug.'
                  : `Je verliest ${fiches(uitslag.ingezet - uitslag.uitbetaald)} fiches.`}
            </p>
            <button type="button" className="knop knop--breed casino__knop" onClick={volgendeRonde}>
              🔀 Volgende ronde
            </button>
          </div>
        </div>
      )}

      {melding && (
        <div className="toast" role="status">
          <span>{melding}</span>
        </div>
      )}
    </div>
  )
}

function Vak({
  sleutel,
  label,
  klasse,
  inzet,
  winnend,
  uit,
  onZet,
  children,
}: {
  sleutel: string
  label: string
  klasse: string
  inzet: Record<string, number>
  winnend: boolean
  uit: boolean
  onZet: (s: string) => void
  children: React.ReactNode
}) {
  const bedrag = inzet[sleutel] ?? 0
  return (
    <button
      type="button"
      className={`${klasse}${winnend ? ' is-winnend' : ''}`}
      onClick={() => onZet(sleutel)}
      aria-disabled={uit}
      aria-label={`${label}${bedrag ? `, ingezet ${bedrag}` : ''}`}
    >
      {children}
      {bedrag > 0 && (
        <span className="stapel" aria-hidden="true">
          {stapel(bedrag).map((f, i) => (
            <span key={i} className={`fiche fiche--mini fiche--${f}`} style={{ bottom: i * 3 }} />
          ))}
          <span className="stapel__bedrag">{bedrag}</span>
        </span>
      )}
    </button>
  )
}

function RouletteWiel({
  n,
  wiel,
  bal,
  hoek,
}: {
  n: number
  wiel: React.RefObject<SVGGElement>
  bal: React.RefObject<SVGCircleElement>
  hoek: number
}) {
  const vakken = n + 1
  const vak = 360 / vakken
  const letter = vakken <= 13 ? 9 : vakken <= 25 ? 7 : 5.5
  return (
    <svg className="casino__wiel" viewBox="-118 -118 236 236" role="img" aria-label={`Roulettewiel met 0 tot en met ${n}`}>
      <defs>
        <radialGradient id="hout" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="#7a4a22" />
          <stop offset="100%" stopColor="#4a2a10" />
        </radialGradient>
        <radialGradient id="kegel" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#f6e7a8" />
          <stop offset="60%" stopColor="#b88a3b" />
          <stop offset="100%" stopColor="#6b4518" />
        </radialGradient>
      </defs>
      <circle r="116" fill="url(#hout)" />
      <circle r="102" fill="#2a1a0c" stroke="#f3d36b" strokeWidth="1.5" />
      <g ref={wiel} transform={`rotate(${hoek})`}>
        {Array.from({ length: vakken }, (_, g) => (
          <g key={g}>
            <path
              d={taartpunt(88, g * vak, (g + 1) * vak, 62)}
              fill={g === 0 ? '#1f8a4c' : isRood(g) ? '#c0262d' : '#1b1b1b'}
              stroke="#f3d36b"
              strokeWidth="0.8"
            />
            <text
              transform={`rotate(${(g + 0.5) * vak})`}
              y={-77}
              textAnchor="middle"
              fontSize={letter}
              fill="#ffffff"
              className="casino__wielgetal"
            >
              {g}
            </text>
          </g>
        ))}
        <circle r="62" fill="url(#kegel)" stroke="#f3d36b" strokeWidth="1.5" />
        {[0, 90, 180, 270].map((a) => (
          <rect key={a} x="-3" y="-40" width="6" height="34" rx="3" fill="#f3d36b" transform={`rotate(${a})`} />
        ))}
        <circle r="9" fill="#f3d36b" stroke="#6b4518" strokeWidth="2" />
      </g>
      <circle ref={bal} cx="0" cy="-95" r="4.2" fill="#ffffff" stroke="#c9c9c9" strokeWidth="0.8" className="casino__bal" />
    </svg>
  )
}
