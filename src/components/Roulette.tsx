import { useEffect, useMemo, useRef, useState } from 'react'
import type { Kamers } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'
import { deelnemers, fractie, schud, useDeelnemersKeuze, willekeurig } from '../lib/rad'
import { DeelnemersKiezer } from './DeelnemersKiezer'
import { DIAMANTEN, planWorp, R_BAAN, R_DIAMANT, R_VAKJE, type Stand, type Worp } from '../lib/roulette'
import { minderBeweging, punt, rolgeluid, taartpunt, tik } from './Wiel'

/*
 * Jacco's casino: een roulettetafel met de deelnemers als getallen. Fiches zijn nep en staan
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
  const [geluidAan] = useOpgeslagen('rad.geluid', true)
  const wiel = useRef<SVGGElement>(null)
  const bal = useRef<SVGCircleElement>(null)
  const staart = useRef<SVGPathElement>(null)
  // Waar wiel en balletje nu zijn (graden, 0 = boven); een nieuwe draai begint daar.
  // Het balletje ligt in rust in een vakje (null = nog nooit gedraaid: in het vakje van 0).
  const hoek = useRef(0)
  const wielSnelheid = useRef(0)
  const balHoek = useRef<number | null>(null)
  const balStraal = useRef(R_VAKJE)
  const frame = useRef<number | null>(null)
  const rol = useRef<ReturnType<typeof rolgeluid>>(null)
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      rol.current?.stop()
    },
    [],
  )

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

  const toon = (st: Stand) => {
    hoek.current = st.wiel
    wielSnelheid.current = st.wielSnelheid
    balHoek.current = st.bal
    balStraal.current = st.straal
    wiel.current?.setAttribute('transform', `rotate(${st.wiel})`)
    const [bx, by] = punt(st.straal, st.bal)
    bal.current?.setAttribute('cx', String(bx))
    bal.current?.setAttribute('cy', String(by))
    // Bewegingsstaart: zo ziet een snel balletje er ook op 60 beelden per seconde vloeiend uit
    const lengte = Math.min(30, Math.abs(st.balSnelheid) * 0.03)
    if (lengte < 2) staart.current?.setAttribute('d', '')
    else {
      const van = st.bal - Math.sign(st.balSnelheid) * lengte
      const [x1, y1] = punt(st.straal, van)
      const [x2, y2] = punt(st.straal, st.bal)
      const omloop = st.balSnelheid > 0 ? 1 : 0
      staart.current?.setAttribute('d', `M${x1} ${y1} A${st.straal} ${st.straal} 0 0 ${omloop} ${x2} ${y2}`)
    }
  }

  /** Speelt een worp af; klaar zodra het balletje stil ligt (het wiel draait daarna nog even uit) */
  const speel = (worp: Worp) =>
    new Promise<void>((klaar) => {
      if (frame.current) cancelAnimationFrame(frame.current)
      if (minderBeweging()) {
        toon(worp.stand(worp.einde))
        klaar()
        return
      }
      rol.current = geluidAan ? rolgeluid() : null
      const begin = performance.now()
      let volgendTikje = 0
      let geland = false
      const stap = (nu: number) => {
        const t = (nu - begin) / 1000
        const st = worp.stand(t)
        toon(st)
        if (geluidAan) {
          while (volgendTikje < worp.tikjes.length && worp.tikjes[volgendTikje].t <= t) {
            const tj = worp.tikjes[volgendTikje++]
            tik(tj.volume, tj.toon)
          }
          const v = Math.abs(st.balSnelheid)
          rol.current?.zet(st.rolt ? Math.min(0.05, v / 12000) : 0, 300 + v * 0.8)
        }
        if (!geland && t >= worp.landing) {
          geland = true
          rol.current?.stop()
          rol.current = null
          window.setTimeout(klaar, 500)
        }
        if (t < worp.einde) frame.current = requestAnimationFrame(stap)
        else frame.current = null
      }
      frame.current = requestAnimationFrame(stap)
    })

  const draaiWiel = async () => {
    if (bezig || totaal === 0 || n < 2) return
    const vakken = n + 1
    const getal = willekeurig(vakken) // vak i = getal i (0, 1, 2, …, N)
    const worp = planWorp({
      wiel: hoek.current,
      wielSnelheid: wielSnelheid.current,
      bal: balHoek.current ?? hoek.current + 180 / vakken,
      balStraal: balStraal.current,
      getal,
      vakken,
      toeval: fractie,
    })
    setBezig(true)
    setUitslag(null)
    await speel(worp)
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
        <section className="casino__tafel" aria-label="Jacco's Casino">
          <div className="casino__kopregel">
            <h2 className="casino__titel">Jacco's Casino</h2>
            <p className="casino__saldo" aria-label={`${fiches(saldo)} fiches`}>
              <span aria-hidden="true">🪙</span> {fiches(saldo)}
            </p>
          </div>

          <RouletteWiel n={n} wiel={wiel} bal={bal} staart={staart} hoek={hoek.current} balHoek={balHoek.current ?? hoek.current + 180 / (n + 1)} balStraal={balStraal.current} />

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
              Volgende ronde
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
  staart,
  hoek,
  balHoek,
  balStraal,
}: {
  n: number
  wiel: React.RefObject<SVGGElement>
  bal: React.RefObject<SVGCircleElement>
  staart: React.RefObject<SVGPathElement>
  hoek: number
  balHoek: number
  balStraal: number
}) {
  const vakken = n + 1
  const vak = 360 / vakken
  const letter = vakken <= 13 ? 8.5 : vakken <= 25 ? 7.5 : 6.5
  const kleur = (g: number) => (g === 0 ? '#1d8a4a' : isRood(g) ? '#b8141d' : '#181818')
  const [bx, by] = punt(balStraal, balHoek)
  return (
    <svg className="casino__wiel" viewBox="-118 -118 236 236" role="img" aria-label={`Roulettewiel met 0 tot en met ${n}`}>
      <defs>
        <radialGradient id="rw-rand" cx="0" cy="0" r="117" gradientUnits="userSpaceOnUse">
          <stop offset="92%" stopColor="#6e3f1b" />
          <stop offset="96%" stopColor="#8a5428" />
          <stop offset="100%" stopColor="#3d210c" />
        </radialGradient>
        {/* Vaste deel: de baan langs de rand en de schuine helling naar het wiel */}
        <radialGradient id="rw-kom" cx="0" cy="0" r="108" gradientUnits="userSpaceOnUse">
          <stop offset="81%" stopColor="#1c120a" />
          <stop offset="89%" stopColor="#4a3020" />
          <stop offset="90.5%" stopColor="#2b1a0d" />
          <stop offset="96%" stopColor="#5c3b20" />
          <stop offset="100%" stopColor="#24150a" />
        </radialGradient>
        <radialGradient id="rw-kegel" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#a8703a" />
          <stop offset="55%" stopColor="#6e4220" />
          <stop offset="100%" stopColor="#3a210e" />
        </radialGradient>
        <radialGradient id="rw-goud" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff4c4" />
          <stop offset="50%" stopColor="#e2b752" />
          <stop offset="100%" stopColor="#8a6420" />
        </radialGradient>
        <linearGradient id="rw-chroom" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#b9bec4" />
          <stop offset="100%" stopColor="#6d737a" />
        </linearGradient>
        {/* Diepte in de vakjes: donkerder aan de randen */}
        <radialGradient id="rw-diepte" cx="0" cy="0" r="88" gradientUnits="userSpaceOnUse">
          <stop offset="71.5%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="78%" stopColor="#000" stopOpacity="0" />
          <stop offset="84%" stopColor="#000" stopOpacity="0.05" />
          <stop offset="87.5%" stopColor="#000" stopOpacity="0.5" />
          <stop offset="88%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rw-licht" cx="35%" cy="22%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rw-bal" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#ecebe6" />
          <stop offset="100%" stopColor="#a9a8a2" />
        </radialGradient>
      </defs>
      <circle r="117" fill="url(#rw-rand)" />
      <circle r="108.5" fill="url(#rw-kom)" stroke="#e8c463" strokeWidth="1" />
      <circle r={R_BAAN - 5.2} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
      {DIAMANTEN.map((d, i) => (
        <polygon
          key={d}
          points={i % 2 ? '-4.5,0 0,-1.8 4.5,0 0,1.8' : '0,-4.5 1.8,0 0,4.5 -1.8,0'}
          fill="url(#rw-chroom)"
          stroke="#4b4f55"
          strokeWidth="0.4"
          transform={`rotate(${d}) translate(0 ${-R_DIAMANT})`}
        />
      ))}
      <g ref={wiel} transform={`rotate(${hoek})`}>
        <circle r="89" fill="url(#rw-chroom)" />
        {Array.from({ length: vakken }, (_, g) => (
          <g key={g}>
            {/* Getallenring buiten, vakjes binnen (zoals bij een echt wiel) */}
            <path d={taartpunt(88, g * vak, (g + 1) * vak, 77)} fill={kleur(g)} />
            <path d={taartpunt(77, g * vak, (g + 1) * vak, 63)} fill={kleur(g)} />
            <text
              transform={`rotate(${(g + 0.5) * vak})`}
              y={-82.5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={letter}
              fill="#ffffff"
              className="casino__wielgetal"
            >
              {g}
            </text>
          </g>
        ))}
        <circle r="88" fill="url(#rw-diepte)" />
        {Array.from({ length: vakken }, (_, g) => {
          const [x1, y1] = punt(88, g * vak)
          const [x2, y2] = punt(77, g * vak)
          const [x3, y3] = punt(63, g * vak)
          return (
            <g key={g}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8c463" strokeWidth="0.5" />
              {/* Schotje tussen twee vakjes */}
              <line x1={x2} y1={y2} x2={x3} y2={y3} stroke="#d4d8dc" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          )
        })}
        <circle r="77" fill="none" stroke="#e8c463" strokeWidth="1.2" />
        <circle r="63.5" fill="url(#rw-kegel)" stroke="#c9ced3" strokeWidth="2" />
        <circle r="50" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />
        <circle r="30" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />
        {/* Het kruis in het midden waaraan de croupier het wiel draait */}
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect x="-2.2" y="-38" width="4.4" height="30" rx="2.2" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.4" />
            <circle cy="-40" r="4.6" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.4" />
          </g>
        ))}
        <circle r="11" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.6" />
        <circle r="5" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.4" />
      </g>
      {/* Licht van boven: draait niet mee, zoals een echte weerspiegeling */}
      <circle r="108" fill="url(#rw-licht)" pointerEvents="none" />
      <path ref={staart} d="" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" />
      <circle ref={bal} cx={bx} cy={by} r="4.2" fill="url(#rw-bal)" className="casino__bal" />
    </svg>
  )
}
