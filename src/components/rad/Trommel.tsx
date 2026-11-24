import { useEffect, useRef, useState } from 'react'
import type { PisteKleur } from '../../lib/data'
import { fractie, willekeurig } from '../../lib/rad'
import { flapper } from '../../lib/radwiskunde'
import { draai, koppelVegen, minderBeweging, tik, tril, uitslagGeluid } from '../../lib/radmotor'
import { GeluidKnop, rond, tekstVan, useMachine, type MachineProps } from './basis'

/*
 * Piste als liftbord: het rad van opzij gezien, een trommel met genummerde bordjes achter een
 * venster, zoals het oude vertrekbord bij het dalstation. Lange namen passen (horizontaal, twee
 * regels), alle 28 pistes ook. Twee stalen tongen klepperen langs de randen van de bordjes; het
 * gekozen bordje klikt in het midden vast. Veeg omhoog of druk op de knop. De uitslag is een
 * omroepbericht.
 *
 * 3D: de bordjes staan rond een cilinder; alleen de trommel draait (één transform per beeld).
 */

const VAK = 54 // px, hoogte van een bordje
const CHIP: Record<PisteKleur, { vlak: string; tekst: string }> = {
  groen: { vlak: '#1e7a4c', tekst: '#ffffff' },
  blauw: { vlak: '#1d5fc4', tekst: '#ffffff' },
  rood: { vlak: '#c4212f', tekst: '#ffffff' },
  zwart: { vlak: '#fffdf8', tekst: '#17171c' },
}
const ZONDER: { vlak: string; tekst: string }[] = [
  { vlak: '#099fc4', tekst: '#0d0058' },
  { vlak: '#fffdf8', tekst: '#0d0058' },
]

export function Trommel(p: MachineProps) {
  const m = useMachine(p)
  const { lijst, uitslag } = m
  const venster = useRef<HTMLDivElement>(null)
  const trommel = useRef<HTMLDivElement>(null)
  const tongL = useRef<HTMLDivElement>(null)
  const tongR = useRef<HTMLDivElement>(null)
  const theta = useRef(0)
  const lopend = useRef<{ stop: () => void } | null>(null)
  const [winnaar, setWinnaar] = useState<number | null>(null)
  const [bericht, setBericht] = useState<'klaar' | 'wacht' | 'uitslag'>('klaar')

  const n = lijst.length
  // De lijst een paar keer rond de trommel (minstens 24 bordjes), zodat hij altijd rond oogt
  const m2 = Math.max(1, n) * Math.ceil(24 / Math.max(1, n))
  const a = 360 / m2
  const straal = VAK / (2 * Math.tan((a * Math.PI) / 360))
  const maat = useRef({ a, straal, m2, n })
  maat.current = { a, straal, m2, n }
  const lijstRef = useRef(lijst)
  lijstRef.current = lijst
  const uitslagRef = useRef(uitslag)
  uitslagRef.current = uitslag

  const zet = (t: number) => {
    const { a: hoek, straal: r } = maat.current
    if (trommel.current) trommel.current.style.transform = `translateZ(${(-r).toFixed(1)}px) rotateX(${t.toFixed(3)}deg)`
    // De tongen buigen mee als de rand van een bordje erlangs komt (randen op een half bordje)
    const d = flapper(t + hoek / 2, hoek, hoek * 0.45)
    if (tongL.current) tongL.current.style.transform = `rotate(${(-d * 22).toFixed(2)}deg)`
    if (tongR.current) tongR.current.style.transform = `rotate(${(d * 22).toFixed(2)}deg)`
  }

  // Nieuwe lijst: trommel terug naar het begin
  useEffect(() => {
    theta.current = 0
    zet(0)
    setWinnaar(null)
    setBericht('klaar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lijst])

  useEffect(() => () => lopend.current?.stop(), [])

  const tikje = (snelheid: number) => {
    if (!m.props.current.geluid) return
    tik('klep', snelheid)
    if (snelheid < 480) tril(6, true)
  }

  const rol = async (veeg?: number) => {
    const l = lijstRef.current
    if (m.bezigRef.current || l.length < 2) return
    const { a: hoek, m2: totaal } = maat.current
    const i = m.props.current.kies(l) // de uitslag ligt vast vóór er iets beweegt
    const j = willekeurig(totaal / l.length) * l.length + i // welk exemplaar (maakt voor de kans niets uit)
    const minder = minderBeweging()
    // Omhoog geveegd (of de knop) rolt vooruit, omlaag geveegd rolt terug
    const r = veeg && veeg < 0 ? -1 : 1
    const kracht = veeg ? Math.min(1, Math.abs(veeg) / 1000) : 0.45 + fractie() * 0.25
    const rondjes = minder ? 1 : Math.round(2 + kracht * 3)
    // Het bordje klikt precies in het midden vast (palletje), dus geen speling binnen het vak nodig
    const naar =
      r > 0
        ? theta.current + 360 * rondjes + rond(j * hoek - theta.current)
        : theta.current - 360 * rondjes - rond(theta.current - j * hoek)
    m.setUitslag(null)
    setWinnaar(null)
    setBericht('wacht')
    m.zetBezig(true)
    const d = draai({
      van: theta.current + hoek / 2,
      naar: naar + hoek / 2,
      duur: minder ? 1600 : 4200 + kracht * 1800,
      macht: minder ? 2.3 : 3.1,
      aanloop: minder || veeg ? 0 : 5,
      nagolf: minder ? 0 : r * hoek * 0.34,
      vak: hoek,
      onTik: tikje,
      onFrame: (h) => {
        theta.current = h - hoek / 2
        zet(theta.current)
      },
    })
    lopend.current = d
    await d.klaar
    lopend.current = null
    // Wat er hierna ook misgaat: de trommel komt altijd weer vrij
    try {
      theta.current = rond(j * hoek)
      zet(theta.current)
      const pr = m.props.current
      if (pr.geluid) {
        try {
          uitslagGeluid('klep')
          tril([30, 50, 90])
        } catch {
          // Geen geluid, wel een uitslag
        }
      }
      setWinnaar(j)
      setBericht('uitslag')
      m.setUitslag({ i, u: pr.uitslag(l[i]) })
      pr.naUitslag?.(l[i])
    } catch (e) {
      console.error(e)
      setBericht('klaar')
    } finally {
      m.zetBezig(false)
    }
  }
  const rolRef = useRef(rol)
  rolRef.current = rol

  // Vegen: de trommel volgt de vinger (omhoog = vooruit), loslaten met vaart = rollen
  useEffect(() => {
    const el = venster.current
    if (!el) return
    // Het terugklikken na zacht loslaten; stoppen zodra de vinger weer neerkomt
    let klik: { stop: () => void } | null = null
    const ontkoppel = koppelVegen(el, {
      uit: () => m.bezigRef.current || lijstRef.current.length < 2,
      onNeer: () => {
        klik?.stop()
        klik = null
      },
      hoekVan: (e) => (-e.clientY / (maat.current.straal * Math.PI)) * 180,
      onSleep: (d) => {
        const { a: hoek } = maat.current
        if (uitslagRef.current) {
          m.setUitslag(null)
          setWinnaar(null)
          setBericht('klaar')
        }
        const oud = Math.floor((theta.current + hoek / 2) / hoek)
        theta.current += d
        zet(theta.current)
        if (Math.floor((theta.current + hoek / 2) / hoek) !== oud) tikje(200)
      },
      onLos: (v) => {
        // ~60°/s is zo'n 250 px/s: elke veeg die nog beweegt bij het loslaten laat de trommel rollen
        if (Math.abs(v) > 60) void rolRef.current(v)
        else {
          // Stil losgelaten: terug in het dichtstbijzijnde palletje klikken
          const { a: hoek } = maat.current
          const doel = Math.round(theta.current / hoek) * hoek
          klik = draai({ van: theta.current, naar: doel, duur: 220, macht: 2, onFrame: (h) => { theta.current = h; zet(h) } })
        }
      },
    })
    return () => {
      klik?.stop()
      ontkoppel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kleur = (i: number) => {
    const k = lijst[i]?.kleur
    return k ? CHIP[k] : ZONDER[i % 2]
  }
  const omroep =
    bericht === 'uitslag' && uitslag
      ? { label: uitslag.u.label, tekst: uitslag.u.tekst, zin: uitslag.u.zin ?? '' }
      : bericht === 'wacht'
        ? { label: 'Een ogenblik geduld', tekst: '· · ·', zin: '' }
        : { label: 'Volgende afdaling', tekst: 'Welke piste?', zin: 'Veeg de trommel of druk op de knop.' }

  return (
    <section className="radm radm--liftbord" aria-label="Piste-rad">
      <div className="liftbord">
        <div className="liftbord__kop">
          <span className="liftbord__naam">Vertrekbord</span>
          <span className="liftbord__rij">
            <span>{n} pistes</span>
            <GeluidKnop aan={p.geluid} zet={p.zetGeluid} className="radm__geluid" />
          </span>
        </div>
        <div
          ref={venster}
          className={`liftbord__venster${uitslag ? ' is-uitslag' : ''}`}
          data-eigen-gebaar
          role="img"
          aria-label={`Trommel met ${n} pistes: ${lijst.map(tekstVan).join(', ')}`}
        >
          <div ref={trommel} className="liftbord__trommel">
            {n > 0 &&
              Array.from({ length: m2 }, (_, j) => {
                const i = j % n
                const o = lijst[i]
                const c = kleur(i)
                const t = tekstVan(o)
                return (
                  <div
                    key={`${j}-${o.waarde}`}
                    className={`liftbord__bordje${winnaar === j ? ' is-winnaar' : ''}`}
                    style={
                      {
                        transform: `rotateX(${(-j * a).toFixed(3)}deg) translateZ(${straal.toFixed(1)}px)`,
                        '--chip': c.vlak,
                        '--chiptekst': c.tekst,
                      } as React.CSSProperties
                    }
                  >
                    <i>{String(i + 1).padStart(2, '0')}</i>
                    <b className={t.length > 16 ? 'is-lang' : undefined}>{t}</b>
                  </div>
                )
              })}
          </div>
          <div className="liftbord__kader" />
          <div ref={tongL} className="liftbord__tong liftbord__tong--l" aria-hidden="true">
            <svg viewBox="0 0 22 16">
              <path d="M0 2h8l14 6-14 6H0z" fill="#c4212f" stroke="#fffdf8" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
          <div ref={tongR} className="liftbord__tong liftbord__tong--r" aria-hidden="true">
            <svg viewBox="0 0 22 16">
              <path d="M22 2h-8L0 8l14 6h8z" fill="#c4212f" stroke="#fffdf8" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div key={bericht === 'uitslag' ? `u${winnaar}` : bericht} className={`liftbord__omroep${bericht === 'uitslag' ? ' is-nieuw' : ''}`} aria-hidden="true">
          <small>{omroep.label}</small>
          <b className={omroep.tekst.length > 14 ? 'is-lang' : undefined}>{omroep.tekst}</b>
          {omroep.zin && <p>{omroep.zin}</p>}
        </div>
      </div>
      {n < 2 ? (
        <p className="radm__tekort">{p.tekort}</p>
      ) : (
        <button type="button" className="radm__start" onClick={() => void rol()} disabled={m.bezig} aria-busy={m.bezig}>
          <b>{m.bezig ? 'Trommel rolt…' : uitslag ? 'Volgende rit' : 'Bord rollen'}</b>
          <span>{m.bezig ? 'hou het venster in de gaten' : uitslag ? 'nog een keer rollen' : 'welke afdaling vertrekt er?'}</span>
        </button>
      )}
      <p className="verborgen" aria-live="polite">
        {uitslag ? uitslag.u.live : ''}
      </p>
    </section>
  )
}
