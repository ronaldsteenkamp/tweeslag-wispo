import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { fractie } from '../../lib/rad'
import { doelHoek, flapper, vakOnderPijl } from '../../lib/radwiskunde'
import {
  draai,
  hoekRondMidden,
  kleurVolgorde,
  koppelVegen,
  minderBeweging,
  pasTekst,
  radialeTekst,
  tik,
  tril,
  uitslagGeluid,
  type Materiaal,
} from '../../lib/radmotor'
import { punt, taartpunt } from '../Wiel'
import { GeluidKnop, rond, tekstVan, useMachine, type MachineProps } from './basis'

/*
 * Rond rad in twee uitvoeringen:
 * - 'apres' (Klos): het houten rad aan de muur van de après-skibar, posterkleuren, gloeilampjes
 *   rondom, een skipunt als wijzer, koeienbel en een affiche bij de uitslag.
 * - 'pisteboord' (Drankje): een geëmailleerd bord met klinknagels, een slalomvlag als wijzer, een
 *   belletje en een pistebord met de uitslag.
 * De wijzer buigt mee als er een pin tegenaan komt; het rad is ook met een veeg te draaien.
 */

type Stijl = 'apres' | 'pisteboord'

interface Uitvoering {
  kleuren: { vlak: string; tekst: string }[]
  materiaal: Materiaal
  straal: number
  tekstBuiten: number
  naaf: number
  pinStraal: number
  lijn: string
  lijnDikte: number
  flapperGraden: number
  nagolf: number
  macht: number
  duur: [number, number]
  start: [string, string]
  bezig: [string, string]
  opnieuw: string
}

const UITVOERING: Record<Stijl, Uitvoering> = {
  apres: {
    // Posterkleuren; tekst/vlak minstens 4,5 : 1
    kleuren: [
      { vlak: '#0d0058', tekst: '#f3ead7' },
      { vlak: '#bfe6f1', tekst: '#0d0058' },
      { vlak: '#b3202c', tekst: '#f3ead7' },
      { vlak: '#f3ead7', tekst: '#0d0058' },
      { vlak: '#1f5a3d', tekst: '#f3ead7' },
      { vlak: '#099fc4', tekst: '#0d0058' },
    ],
    materiaal: 'hout',
    straal: 95,
    tekstBuiten: 88,
    naaf: 22,
    pinStraal: 99.6,
    lijn: '#2a1d14',
    lijnDikte: 0.9,
    flapperGraden: 30,
    nagolf: 0.42,
    macht: 3,
    duur: [4800, 7200],
    start: ['Hup, draaien!', "of geef 'm een flinke zwiep"],
    bezig: ['Hij draait…', 'glazen omhoog'],
    opnieuw: 'Nog een rondje!',
  },
  pisteboord: {
    // Emaillekleuren; tekst/vlak minstens 4,5 : 1
    kleuren: [
      { vlak: '#0d0058', tekst: '#ffffff' },
      { vlak: '#099fc4', tekst: '#0d0058' },
      { vlak: '#fffdf8', tekst: '#0d0058' },
      { vlak: '#c4212f', tekst: '#ffffff' },
      { vlak: '#1e7a4c', tekst: '#ffffff' },
    ],
    materiaal: 'metaal',
    straal: 96,
    tekstBuiten: 89,
    naaf: 23,
    pinStraal: 101.2,
    lijn: '#f5f2ea',
    lijnDikte: 1.3,
    flapperGraden: 24,
    nagolf: 0.3,
    macht: 3.4,
    duur: [4600, 6800],
    start: ['Wat wordt het?', 'of geef het rad een zwiep'],
    bezig: ['Rad draait…', 'ogen op de vlag'],
    opnieuw: 'Nog een rondje',
  },
}

const LOGO = `${import.meta.env.BASE_URL}img/2slag-wit.svg`

export function TaartRad({ stijl, vraag, ...p }: MachineProps & { stijl: Stijl; vraag?: ReactNode }) {
  const u = UITVOERING[stijl]
  const m = useMachine(p)
  const { lijst, uitslag } = m
  const wiel = useRef<HTMLDivElement>(null)
  const draaiEl = useRef<HTMLDivElement>(null)
  const vlak = useRef<SVGSVGElement>(null)
  const wijzer = useRef<HTMLDivElement>(null)
  const lampjes = useRef<SVGGElement>(null)
  const hoek = useRef(0)
  const richting = useRef<1 | -1>(1)
  const lopend = useRef<{ stop: () => void } | null>(null)
  const lijstRef = useRef(lijst)
  lijstRef.current = lijst
  const uitslagRef = useRef(uitslag)
  uitslagRef.current = uitslag

  const n = lijst.length
  const vak = 360 / Math.max(1, n)

  const zet = (h: number) => {
    if (draaiEl.current) draaiEl.current.style.transform = `rotate(${h.toFixed(3)}deg)`
    const v = 360 / Math.max(1, lijstRef.current.length)
    const d = flapper(h, v, Math.min(v * 0.55, 9), richting.current)
    if (wijzer.current) wijzer.current.style.transform = `rotate(${(-d * u.flapperGraden).toFixed(2)}deg)`
  }

  // Tekst passend maken (na het laden van de letters nog een keer)
  useLayoutEffect(() => {
    const svg = vlak.current
    if (!svg) return
    pasTekst(svg)
    zet(hoek.current)
    let weg = false
    void document.fonts?.ready.then(() => !weg && pasTekst(svg))
    return () => {
      weg = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lijst])

  useEffect(() => () => lopend.current?.stop(), [])

  const tikje = (snelheid: number) => {
    if (!m.props.current.geluid) return
    tik(u.materiaal, snelheid)
    if (snelheid < 520) tril(7, true)
  }

  // Lichtje loopt rond met de snelheid van het rad (alleen bij het après-rad)
  const fase = useRef({ f: 0, t: 0, stap: -1 })
  const lichtjes = (snelheid: number) => {
    const g = lampjes.current
    if (!g) return
    const nu = performance.now()
    const f = fase.current
    f.f += Math.min(12, snelheid / 60) * ((nu - (f.t || nu)) / 1000)
    f.t = nu
    const stap = Math.floor(f.f) % 3
    if (stap !== f.stap) {
      f.stap = stap
      g.dataset.f = String(stap)
    }
  }

  const start = async (veeg?: number) => {
    const l = lijstRef.current
    if (m.bezigRef.current || l.length < 2) return
    const aantal = l.length
    const v = 360 / aantal
    const i = m.props.current.kies(l) // de uitslag ligt vast vóór er iets beweegt
    richting.current = veeg && veeg < 0 ? -1 : 1
    const minder = minderBeweging()
    const kracht = veeg ? Math.min(1, Math.abs(veeg) / 1600) : 0.45 + fractie() * 0.25
    const rondjes = minder ? 1 : Math.round(4 + kracht * 4)
    const naar = doelHoek(i, aantal, hoek.current, fractie(), rondjes, richting.current)
    m.setUitslag(null)
    m.zetBezig(true)
    fase.current = { f: 0, t: 0, stap: -1 }
    const d = draai({
      van: hoek.current,
      naar,
      duur: minder ? 1700 : u.duur[0] + kracht * (u.duur[1] - u.duur[0]),
      macht: minder ? 2.3 : u.macht,
      aanloop: minder || veeg ? 0 : 7 * richting.current,
      nagolf: minder ? 0 : richting.current * Math.min(4, v * u.nagolf),
      vak: v,
      onTik: tikje,
      onFrame: (h, snelheid) => {
        hoek.current = h
        zet(h)
        if (stijl === 'apres') lichtjes(snelheid)
      },
    })
    lopend.current = d
    await d.klaar
    lopend.current = null
    hoek.current = rond(hoek.current)
    richting.current = 1
    zet(hoek.current)
    lampjes.current?.removeAttribute('data-f')
    if (vakOnderPijl(hoek.current, aantal) !== i) console.error('Rad landde niet op de uitslag', i)
    const pr = m.props.current
    if (pr.geluid) {
      uitslagGeluid(u.materiaal)
      tril([30, 50, 90])
    }
    m.setUitslag({ i, u: pr.uitslag(l[i]) })
    m.zetBezig(false)
    pr.naUitslag?.(l[i])
  }
  const startRef = useRef(start)
  startRef.current = start

  // Vegen: het rad volgt de vinger, loslaten met vaart = draaien (de kant op van de veeg)
  useEffect(() => {
    const el = wiel.current
    if (!el) return
    let pin = 0
    return koppelVegen(el, {
      uit: () => m.bezigRef.current || lijstRef.current.length < 2,
      hoekVan: (e) => hoekRondMidden(el, e),
      onSleep: (d) => {
        if (uitslagRef.current) m.setUitslag(null)
        richting.current = d < 0 ? -1 : 1
        hoek.current += d
        zet(hoek.current)
        const nu = Math.floor(hoek.current / (360 / lijstRef.current.length))
        if (nu !== pin) {
          tikje(200)
          pin = nu
        }
      },
      onLos: (v) => {
        if (Math.abs(v) > 240) void startRef.current(v)
        else richting.current = 1
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const volgorde = kleurVolgorde(n, n === 2 ? 2 : u.kleuren.length)
  const { letter, ruimte } = radialeTekst(n, u.tekstBuiten, u.naaf)
  const winnaarKleur = uitslag ? u.kleuren[volgorde[uitslag.i]] : null
  const [startTekst, startOnder] = m.bezig ? u.bezig : uitslag ? [u.opnieuw, uitslag.u.volgende ?? 'zelfde rad, nieuwe kans'] : u.start

  return (
    <section className={`radm radm--${stijl}`} aria-label="Rad">
      <GeluidKnop aan={p.geluid} zet={p.zetGeluid} className="radm__geluid" />
      {vraag && <p className="radm__vraag">{vraag}</p>}
      <div
        ref={wiel}
        className={`radm__wiel${uitslag ? ' is-uitslag' : ''}`}
        data-eigen-gebaar
        role="img"
        aria-label={`Rad met ${n} vakken: ${lijst.map(tekstVan).join(', ')}`}
      >
        {stijl === 'apres' && (
          <svg viewBox="-110 -110 220 220" className="radm__lijst" aria-hidden="true">
            <defs>
              <radialGradient id="radm-gloed">
                <stop offset="0" stopColor="#fff1c4" stopOpacity=".75" />
                <stop offset="1" stopColor="#fff1c4" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle r="113" fill="#0d0058" stroke="#2c2380" strokeWidth="1.2" />
            <g ref={lampjes} className="radm__lampjes">
              {Array.from({ length: 24 }, (_, k) => {
                const [x, y] = punt(108.6, k * 15 + 7.5)
                return (
                  <g key={k}>
                    <circle className="gloed" cx={x} cy={y} r="7" />
                    <circle className="peer" cx={x} cy={y} r="2.6" />
                  </g>
                )
              })}
            </g>
          </svg>
        )}
        <div ref={draaiEl} className="radm__draai">
          <svg ref={vlak} viewBox="-110 -110 220 220" aria-hidden="true">
            {stijl === 'apres' ? (
              <>
                <defs>
                  <radialGradient id="radm-hout" r=".55">
                    <stop offset=".86" stopColor="#3d2a1d" />
                    <stop offset=".93" stopColor="#6b4a33" />
                    <stop offset="1" stopColor="#3d2a1d" />
                  </radialGradient>
                </defs>
                <circle r="104" fill="url(#radm-hout)" />
                {[97.5, 99.8, 101.6, 103].map((r, k) => (
                  <circle key={r} r={r} fill="none" stroke="#2a1d14" strokeWidth=".35" opacity={0.35 + k * 0.1} strokeDasharray={`${9 + k * 5} ${3 + k}`} />
                ))}
              </>
            ) : (
              <>
                <circle r="106.5" fill="#0d0058" />
                <circle r="104.5" fill="none" stroke="#fffdf8" strokeWidth=".8" opacity=".55" />
              </>
            )}
            <circle r={u.straal} fill={n >= 2 ? '#f5f2ea' : u.kleuren[1].vlak} />
            {n >= 2 &&
              lijst.map((_, i) => (
                <path key={`v${i}`} d={taartpunt(u.straal, i * vak, (i + 1) * vak)} fill={u.kleuren[volgorde[i]].vlak} />
              ))}
            {n >= 2 &&
              lijst.map((_, i) => {
                const [x, y] = punt(u.straal, i * vak)
                return <line key={`l${i}`} x1="0" y1="0" x2={x} y2={y} stroke={u.lijn} strokeWidth={u.lijnDikte} />
              })}
            {n >= 2 &&
              lijst.map((o, i) => (
                // Leeg getekend; pasTekst vult de tekst (en maakt hem zo nodig kleiner of korter)
                <text
                  key={`t${i}-${o.waarde}-${o.tekst ?? ''}`}
                  className="radm__vaktekst"
                  transform={`rotate(${((i + 0.5) * vak - 90).toFixed(3)})`}
                  x={u.tekstBuiten}
                  y={(letter * 0.36).toFixed(2)}
                  textAnchor="end"
                  fill={u.kleuren[volgorde[i]].tekst}
                  data-ruimte={ruimte.toFixed(2)}
                  data-maat={letter}
                  data-min={(letter * 0.72).toFixed(2)}
                  data-vol={tekstVan(o)}
                  data-tweeregels={n <= 10 ? '1' : undefined}
                />
              ))}
            <g className="radm__sluier">
              {n >= 2 &&
                lijst.map((_, i) => (
                  <path key={`s${i}`} className={uitslag?.i === i ? 'is-winnaar' : undefined} d={taartpunt(u.straal, i * vak, (i + 1) * vak)} />
                ))}
            </g>
            {uitslag && n >= 2 && <path className="radm__winnaarrand" d={taartpunt(u.straal, uitslag.i * vak, (uitslag.i + 1) * vak)} />}
            {n >= 2 &&
              lijst.map((_, i) => {
                const [x, y] = punt(u.pinStraal, i * vak)
                return stijl === 'apres' ? (
                  <g key={`p${i}`}>
                    <circle cx={x} cy={y} r="2.5" fill="#d8b65a" stroke="#5c4716" strokeWidth=".7" />
                    <circle cx={x - 0.6} cy={y - 0.6} r=".8" fill="#fff6d6" />
                  </g>
                ) : (
                  <g key={`p${i}`}>
                    <circle cx={x} cy={y} r="2.7" fill="#dfe4ec" stroke="#05002e" strokeWidth=".7" />
                    <circle cx={x - 0.7} cy={y - 0.7} r=".9" fill="#fff" />
                  </g>
                )
              })}
          </svg>
        </div>
        {/* Naaf (draait niet mee, zodat het logo rechtop blijft) en bij het emaille de glans */}
        <svg viewBox="-110 -110 220 220" className="radm__naaf" aria-hidden="true">
          {stijl === 'apres' ? (
            <>
              <defs>
                <radialGradient id="radm-naafhout" cx=".4" cy=".35">
                  <stop offset="0" stopColor="#7a5a40" />
                  <stop offset="1" stopColor="#3a281b" />
                </radialGradient>
              </defs>
              <circle r="22" fill="url(#radm-naafhout)" stroke="#2a1d14" strokeWidth="1.2" />
              <circle r="17.5" fill="#0d0058" />
              <image href={LOGO} x="-13" y="-6.5" width="26" height="13" />
            </>
          ) : (
            <>
              <defs>
                <linearGradient id="radm-glans" x1="0" y1="0" x2=".7" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity=".34" />
                  <stop offset=".42" stopColor="#fff" stopOpacity="0" />
                  <stop offset="1" stopColor="#05002e" stopOpacity=".18" />
                </linearGradient>
              </defs>
              <circle r="96" fill="url(#radm-glans)" />
              <circle r="23" fill="#0d0058" stroke="#fffdf8" strokeWidth="2.4" />
              <circle r="18.5" fill="none" stroke="#fffdf8" strokeWidth=".7" opacity=".5" />
              <image href={LOGO} x="-14" y="-7" width="28" height="14" />
            </>
          )}
        </svg>
        <div ref={wijzer} className="radm__wijzer" aria-hidden="true">
          {stijl === 'apres' ? (
            // Skipunt aan een houten blokje
            <svg viewBox="0 0 30 56">
              <rect x="4" y="0" width="22" height="10" rx="2" fill="#5a3e2b" stroke="#2a1d14" strokeWidth=".8" />
              <circle cx="15" cy="5" r="1.8" fill="#d8b65a" />
              <path d="M8.5 9h13v30c0 9-3 14-6.5 14S8.5 48 8.5 39z" fill="#0d0058" stroke="#f3ead7" strokeWidth="1.3" />
              <path d="M12.6 9h4.8v31c0 5-1 8-2.4 8s-2.4-3-2.4-8z" fill="#b3202c" />
            </svg>
          ) : (
            // Rubberen slalomvlag aan een beugel
            <svg viewBox="0 0 30 50">
              <rect x="5" y="0" width="20" height="9" rx="2.5" fill="#0d0058" />
              <circle cx="15" cy="5" r="2" fill="#fffdf8" />
              <path d="M9 8h12l-2.2 34Q15 49 11.2 42z" fill="#c4212f" stroke="#7d0f19" strokeWidth=".8" />
              <path d="M10.4 21h9.2l-.5 7h-8.2z" fill="#fffdf8" />
            </svg>
          )}
        </div>
        {/* De uitslag hangt voor de onderkant van het rad; het winnende vak blijft bovenaan zichtbaar */}
        {uitslag && (
          <div
            className="radm__uitslag"
            aria-hidden="true"
            style={
              stijl === 'pisteboord' && winnaarKleur
                ? ({
                    '--kleur': winnaarKleur.vlak,
                    '--tekst': winnaarKleur.tekst,
                    '--rand': winnaarKleur.tekst === '#ffffff' ? '#fffdf8' : '#0d0058',
                  } as React.CSSProperties)
                : undefined
            }
          >
            <small>{uitslag.u.label}</small>
            <b className={uitslag.u.tekst.length > 14 ? 'is-lang' : undefined}>{uitslag.u.tekst}</b>
            {uitslag.u.zin && <p>{uitslag.u.zin}</p>}
          </div>
        )}
      </div>
      {n < 2 ? (
        <p className="radm__tekort">{p.tekort}</p>
      ) : (
        <button type="button" className="radm__start" onClick={() => void start()} disabled={m.bezig} aria-busy={m.bezig}>
          <b>{startTekst}</b>
          <span>{startOnder}</span>
        </button>
      )}
      <p className="verborgen" aria-live="polite">
        {uitslag ? uitslag.u.live : ''}
      </p>
    </section>
  )
}
