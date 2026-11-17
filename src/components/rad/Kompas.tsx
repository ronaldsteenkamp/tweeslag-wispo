import { useEffect, useRef } from 'react'
import { fractie } from '../../lib/rad'
import { doelHoek, vakOnderPijl } from '../../lib/radwiskunde'
import { draai, hoekRondMidden, koppelVegen, minderBeweging, tik, tril, uitslagGeluid } from '../../lib/radmotor'
import { punt } from '../Wiel'
import { GeluidKnop, rond, tekstVan, useMachine, type MachineProps } from './basis'

/*
 * Eigen lijsten als kompas: een oriëntatiekompas op een doorzichtige grondplaat. De wijzerplaat
 * staat stil en de naald draait, zodat zelfgetypte opties rechtop en leesbaar blijven, ook lange.
 * De naald slingert na zoals een echte kompasnaald; de klikring tikt bij elke optie.
 *
 * Gerekend als een wiel dat tegen de klok in draait; de naald staat op -hoek (met de klok mee).
 */

export function Kompas({ lijstNaam, ...p }: MachineProps & { lijstNaam: string }) {
  const m = useMachine(p)
  const { lijst, uitslag } = m
  const kompas = useRef<HTMLDivElement>(null)
  const naald = useRef<HTMLDivElement>(null)
  const hoek = useRef(0)
  const lopend = useRef<{ stop: () => void } | null>(null)
  const lijstRef = useRef(lijst)
  lijstRef.current = lijst
  const uitslagRef = useRef(uitslag)
  uitslagRef.current = uitslag

  const n = lijst.length
  const vak = 360 / Math.max(1, n)

  const zet = (h: number) => {
    if (naald.current) naald.current.style.transform = `rotate(${(-h).toFixed(2)}deg)`
  }
  useEffect(() => zet(hoek.current), [lijst])
  useEffect(() => () => lopend.current?.stop(), [])

  const tikje = (snelheid: number) => {
    if (!m.props.current.geluid) return
    tik('kompas', snelheid)
    if (snelheid < 500) tril(5, true)
  }

  const start = async (veeg?: number) => {
    const l = lijstRef.current
    if (m.bezigRef.current || l.length < 2) return
    const aantal = l.length
    const v = 360 / aantal
    const i = m.props.current.kies(l) // de uitslag ligt vast vóór er iets beweegt
    const minder = minderBeweging()
    const kracht = veeg ? Math.min(1, Math.abs(veeg) / 1500) : 0.45 + fractie() * 0.25
    const rondjes = minder ? 1 : Math.round(3 + kracht * 3)
    const naar = doelHoek(i, aantal, hoek.current, fractie(), rondjes, -1)
    m.setUitslag(null)
    m.zetBezig(true)
    const d = draai({
      van: hoek.current,
      naar,
      duur: minder ? 1500 : 3200 + kracht * 1600,
      macht: minder ? 2.3 : 2.8,
      aanloop: minder || veeg ? 0 : -5,
      // Een kompasnaald slingert een paar keer na
      nagolf: minder ? 0 : -Math.min(16, v * 0.6),
      golven: 3.5,
      demping: 3.2,
      nagolfDuur: 1600,
      vak: v,
      onTik: tikje,
      onFrame: (h) => {
        hoek.current = h
        zet(h)
      },
    })
    lopend.current = d
    await d.klaar
    lopend.current = null
    hoek.current = rond(hoek.current)
    zet(hoek.current)
    if (vakOnderPijl(hoek.current, aantal) !== i) console.error('Naald wijst niet naar de uitslag', i)
    const pr = m.props.current
    if (pr.geluid) {
      uitslagGeluid('kompas')
      tril([25, 40, 70])
    }
    m.setUitslag({ i, u: pr.uitslag(l[i]) })
    m.zetBezig(false)
    pr.naUitslag?.(l[i])
  }
  const startRef = useRef(start)
  startRef.current = start

  // Vegen: de naald volgt de vinger, loslaten met vaart = draaien
  useEffect(() => {
    const el = kompas.current
    if (!el) return
    return koppelVegen(el, {
      uit: () => m.bezigRef.current || lijstRef.current.length < 2,
      hoekVan: (e) => -hoekRondMidden(el, e),
      onSleep: (d) => {
        if (uitslagRef.current) m.setUitslag(null)
        const v = 360 / lijstRef.current.length
        const oud = Math.floor(hoek.current / v)
        hoek.current += d
        zet(hoek.current)
        if (Math.floor(hoek.current / v) !== oud) tikje(200)
      },
      onLos: (v) => {
        if (Math.abs(v) > 240) void startRef.current(v)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maat = n <= 3 ? 19 : n <= 5 ? 17 : n <= 8 ? 15 : 13
  const breed = n <= 3 ? 40 : n <= 5 ? 30 : n <= 8 ? 25 : 20
  const koers = m.bezig
    ? { label: 'Koers zoeken', tekst: '· · ·', zin: '' }
    : uitslag
      ? { label: uitslag.u.label, tekst: uitslag.u.tekst, zin: uitslag.u.zin ?? '' }
      : { label: 'Waar gaan we heen?', tekst: lijstNaam, zin: `${n} opties op het kompas` }

  return (
    <section className="radm radm--kompas" aria-label="Eigen rad">
      <div className="kompasplaat">
        <i className="kompasplaat__pijl" aria-hidden="true" />
        <div className="kompasplaat__kop">
          <span>Eigen koers</span>
          <GeluidKnop aan={p.geluid} zet={p.zetGeluid} className="radm__geluid" />
        </div>
        <div
          ref={kompas}
          className={`kompas${uitslag ? ' is-uitslag' : ''}`}
          data-eigen-gebaar
          role="img"
          aria-label={`Kompas met ${n} opties: ${lijst.map(tekstVan).join(', ')}`}
        >
          <svg viewBox="-110 -110 220 220" aria-hidden="true">
            <circle r="108" fill="#0d0058" />
            <circle r="104" fill="none" stroke="#fffdf8" strokeWidth=".8" opacity=".6" />
            {Array.from({ length: 72 }, (_, k) => {
              const g = k * 5
              const [x1, y1] = punt(104, g)
              const [x2, y2] = punt(g % 45 ? 100 : 96, g)
              return <line key={g} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fffdf8" strokeWidth={g % 45 ? 0.6 : 1.2} opacity=".7" />
            })}
            {(
              [
                ['N', 0],
                ['O', 90],
                ['Z', 180],
                ['W', 270],
              ] as const
            ).map(([l, g]) => {
              const [x, y] = punt(89, g)
              return (
                <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="9" className="kompas__windroos" fill={l === 'N' ? '#ff8a95' : '#9fe3f4'}>
                  {l}
                </text>
              )
            })}
            {n > 1 &&
              lijst.map((_, i) => {
                const [x, y] = punt(82, i * vak)
                const [px, py] = punt(100, i * vak)
                return (
                  <g key={i}>
                    <line x1="0" y1="0" x2={x} y2={y} stroke="#fffdf8" strokeWidth=".7" opacity=".35" strokeDasharray="2 2" />
                    <circle cx={px} cy={py} r="1.8" fill="#d8b65a" />
                  </g>
                )
              })}
            <circle r="82" fill="none" stroke="#fffdf8" strokeWidth=".6" opacity=".35" />
          </svg>
          {/* De opties staan rechtop rond de naald */}
          {lijst.map((o, i) => {
            const [x, y] = punt(n <= 4 ? 52 : 60, (i + 0.5) * vak)
            return (
              <span
                key={`${i}-${o.waarde}`}
                className={`kompas__optie${uitslag?.i === i ? ' is-winnaar' : ''}`}
                style={
                  {
                    left: `${50 + (x / 220) * 100}%`,
                    top: `${50 + (y / 220) * 100}%`,
                    maxWidth: `${breed}%`,
                    '--maat': `${maat}px`,
                  } as React.CSSProperties
                }
              >
                {tekstVan(o)}
              </span>
            )
          })}
          <div ref={naald} className="kompas__naald" aria-hidden="true">
            <svg viewBox="-110 -110 220 220">
              <defs>
                <radialGradient id="kompas-dop" cx=".35" cy=".3">
                  <stop offset="0" stopColor="#fff6d6" />
                  <stop offset=".6" stopColor="#d8b65a" />
                  <stop offset="1" stopColor="#7a5a1a" />
                </radialGradient>
              </defs>
              <path d="M0 -84 L9 0 L0 6 L-9 0 Z" fill="#c4212f" stroke="#7d0f19" strokeWidth=".8" />
              <path d="M0 64 L9 0 L0 -6 L-9 0 Z" fill="#fffdf8" stroke="#8a8fa6" strokeWidth=".8" />
              <circle r="9" fill="url(#kompas-dop)" stroke="#5c4716" strokeWidth=".8" />
            </svg>
          </div>
        </div>
        <div key={uitslag ? `u${uitslag.i}` : m.bezig ? 'b' : 'k'} className={`kompas__koers${uitslag ? ' is-nieuw' : ''}`} aria-hidden="true">
          <small>{koers.label}</small>
          <b className={koers.tekst.length > 16 ? 'is-lang' : undefined}>{koers.tekst}</b>
          {koers.zin && <p>{koers.zin}</p>}
        </div>
      </div>
      {n < 2 ? (
        <p className="radm__tekort">{p.tekort}</p>
      ) : (
        <button type="button" className="radm__start" onClick={() => void start()} disabled={m.bezig} aria-busy={m.bezig}>
          <b>{m.bezig ? 'Naald zoekt…' : uitslag ? 'Nog een keer peilen' : 'Zoek de koers'}</b>
          <span>{m.bezig ? 'even geduld, hij slingert nog' : uitslag ? 'zelfde lijst, nieuwe koers' : 'of geef de naald een zwiep'}</span>
        </button>
      )}
      <p className="verborgen" aria-live="polite">
        {uitslag ? uitslag.u.live : ''}
      </p>
    </section>
  )
}
