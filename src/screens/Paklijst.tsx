import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { Sneeuw } from '../components/Sneeuw'
import { config } from '../config'
import { useData } from '../lib/data'
import { nu } from '../lib/nu'
import { lees, schrijfEnMeld, useOpgeslagen } from '../lib/opslag'
import { lokaalNaarDate } from '../lib/tijd'
import '../styles/barlow.css'
import '../styles/paklijst.css'

/*
 * Paklijst als afdaling: van de gletsjer (3600 m) naar het dorp (1650 m). Elk onderwerp is een stuk
 * piste in zijn eigen kleur (zwart, rood, blauw, groen) met een genummerd bordje. Is een onderwerp
 * af, dan wordt het bordje een stempel en klapt het onderwerp in. Alles ingepakt: een groot stempel
 * "Aangekomen" op de kaart. De opmaak staat in styles/paklijst.css.
 */

interface EigenItem {
  id: string
  naam: string
}

interface Onderwerp {
  id: string
  naam: string
  items: { s: string; naam: string; eigenId?: string }[]
}

/** Zo lang blijft een net voltooid onderwerp open (je ziet het laatste vinkje), daarna klapt het dicht */
const KLAP_PAUZE = 700
/** Duur van het dichtklappen; gelijk aan de overgang van .pak-cat__inhoud in paklijst.css */
const KLAP_DUUR = 220
const BOVEN = 3600
const DORP = 1650
const KLEUREN = ['zwart', 'rood', 'blauw', 'groen'] as const
/** De piste in het hoogteprofiel (viewBox 360 × 140; onderin ruimte voor de bordjes) */
const ROUTE = 'M14 26 C40 28 54 42 80 46 S122 52 144 64 S186 72 210 82 S252 90 274 98 S318 110 340 114'

const sleutel = (categorie: string, item: string) => `${categorie}::${item}`
const eigenSleutel = (id: string) => `eigen::${id}`
const nl = (n: number) => n.toLocaleString('nl-NL')
const kleur = (i: number) => KLEUREN[i % KLEUREN.length]
const zacht = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const tril = (patroon: number | number[]) => {
  try {
    navigator.vibrate?.(patroon)
  } catch {
    // Niet elke browser mag trillen
  }
}

export default function Paklijst() {
  const { data, fout } = useData('paklijst')
  const [vinkjes, setVinkjes] = useOpgeslagen<string[]>('paklijst.vinkjes', [])
  const [eigen, setEigen] = useOpgeslagen<EigenItem[]>('paklijst.eigen', [])
  const [nieuw, setNieuw] = useState('')
  const aangevinkt = useMemo(() => new Set(vinkjes), [vinkjes])

  const onderwerpen = useMemo<Onderwerp[]>(() => {
    const lijst: Onderwerp[] = (data?.categorieen ?? []).map((c) => ({
      id: c.naam,
      naam: c.naam,
      items: c.items.map((i) => ({ s: sleutel(c.naam, i), naam: i })),
    }))
    if (eigen.length)
      lijst.push({ id: 'eigen', naam: 'Eigen spullen', items: eigen.map((e) => ({ s: eigenSleutel(e.id), naam: e.naam, eigenId: e.id })) })
    return lijst
  }, [data, eigen])

  const perCat = onderwerpen.map((o) => ({
    klaar: o.items.filter((i) => aangevinkt.has(i.s)).length,
    totaal: o.items.length,
  }))
  const klaar = perCat.reduce((n, c) => n + c.klaar, 0)
  const totaal = perCat.reduce((n, c) => n + c.totaal, 0)
  const p = totaal ? klaar / totaal : 0
  const allesKlaar = totaal > 0 && klaar === totaal

  // ---- Open en dicht: een klaar onderwerp is dicht, de rest open; tikken op de kop draait dat om ----
  const [handmatig, setHandmatig] = useState<Map<string, boolean>>(() => new Map())
  const klapTimers = useRef(new Map<string, number>())
  useEffect(() => {
    const timers = klapTimers.current
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])
  const zetOpen = (id: string, open: boolean | null) => {
    window.clearTimeout(klapTimers.current.get(id))
    klapTimers.current.delete(id)
    setHandmatig((m) => {
      const n = new Map(m)
      if (open === null) n.delete(id)
      else n.set(id, open)
      return n
    })
  }

  // Net gestempeld onderwerp (voor de stempel-animatie)
  const [netGestempeld, setNetGestempeld] = useState<string | null>(null)

  // ---- Alles ingepakt: stempel op de kaart, en naar boven zodat je hem ziet ----
  const [netVol, setNetVol] = useState(0)
  const vorigProcent = useRef<number | null>(null)
  const scrollTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(scrollTimer.current), [])
  useEffect(() => {
    if (!data) return
    const vorig = vorigProcent.current
    vorigProcent.current = p
    if (p !== 1) window.clearTimeout(scrollTimer.current)
    if (vorig === null || vorig === 1 || p !== 1) return
    setNetVol((n) => n + 1)
    tril([12, 60, 24])
    // Klapt het laatste onderwerp nog dicht, dan eerst dat afwachten
    const wacht = klapTimers.current.size > 0 ? KLAP_PAUZE + (zacht() ? KLAP_DUUR : 0) + 50 : 0
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => window.scrollTo({ top: 0, behavior: zacht() ? 'smooth' : 'auto' }), wacht)
  }, [data, p])

  // Voor de badge 🎒 Ingepakt: eenmaal alles ingepakt blijft dat zo (ook als je later iets uitvinkt).
  // Het moment van de eerste keer is voor 🐦 Vroege vogel.
  useEffect(() => {
    if (data && allesKlaar && !lees('paklijst.ingepakt', false)) {
      schrijfEnMeld('paklijst.ingepaktOp', Date.now())
      schrijfEnMeld('paklijst.ingepakt', true)
    }
  }, [data, allesKlaar])

  // ---- Melding met "ongedaan maken" ----
  const [melding, setMelding] = useState<{ tekst: string; terug: () => void; nr: number } | null>(null)
  useEffect(() => {
    if (!melding) return
    const id = window.setTimeout(() => setMelding(null), 5000)
    return () => window.clearTimeout(id)
  }, [melding])
  const meld = (tekst: string, terug: () => void) => setMelding((m) => ({ tekst, terug, nr: (m?.nr ?? 0) + 1 }))

  const wissel = (o: Onderwerp, s: string) => {
    const wordtAan = !aangevinkt.has(s)
    setVinkjes((oud) => (oud.includes(s) ? oud.filter((x) => x !== s) : [...oud, s]))
    if (!wordtAan) {
      // Niet meer klaar: de volgende keer dat het klaar is, klapt het weer in
      zetOpen(o.id, null)
      return
    }
    tril(8)
    const wordtKlaar = o.items.every((i) => i.s === s || aangevinkt.has(i.s))
    if (!wordtKlaar) return
    setNetGestempeld(o.id)
    tril([6, 40, 10])
    zetOpen(o.id, true)
    klapTimers.current.set(
      o.id,
      window.setTimeout(() => zetOpen(o.id, null), KLAP_PAUZE),
    )
  }

  const voegToe = (e: FormEvent) => {
    e.preventDefault()
    const naam = nieuw.trim()
    if (!naam) return
    setEigen((oud) => [...oud, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), naam }])
    setNieuw('')
  }

  const verwijder = (id: string) => {
    const oudEigen = eigen
    const oudVinkjes = vinkjes
    const item = eigen.find((x) => x.id === id)
    setEigen((oud) => oud.filter((x) => x.id !== id))
    setVinkjes((oud) => oud.filter((x) => x !== eigenSleutel(id)))
    meld(`‘${item?.naam ?? 'Item'}’ weggehaald`, () => {
      setEigen(oudEigen)
      setVinkjes(oudVinkjes)
    })
  }

  const allesUit = () => {
    const oud = vinkjes
    setVinkjes([])
    setHandmatig(new Map())
    meld('Terug naar de gletsjer: alles uitgevinkt', () => setVinkjes(oud))
  }

  // De kop bestaat pas als de data er is: daarom een ref-functie (dan weet de hook wanneer hij er is)
  const [kopEl, setKopEl] = useState<HTMLElement | null>(null)
  const klein = useKopWeg(kopEl)

  if (!data) {
    return (
      <div className="scherm paklijst">
        <header className="pakkop">
          <Sneeuw aantal={8} />
          <p className="pakkop__boven">Wispo 2027 · Les Deux Alpes</p>
          <h1 className="pakkop__titel">Paklijst</h1>
        </header>
        <DataStatus fout={fout} />
      </div>
    )
  }

  const hoogte = Math.round((BOVEN - (BOVEN - DORP) * p) / 10) * 10
  const dagen = Math.max(0, Math.ceil((lokaalNaarDate(config.vertrek).getTime() - nu().getTime()) / 864e5))

  return (
    <div className={`scherm paklijst${allesKlaar ? ' is-vol' : ''}`}>
      {/* De smalle balk bovenaan als de kop uit beeld is: alleen beeld (de kop zelf is voor schermlezers) */}
      <div className="pakkop__balkplek" aria-hidden="true">
        <div
          className={`pakbalk${klein ? ' is-zichtbaar' : ''}`}
          onClick={() => window.scrollTo({ top: 0, behavior: zacht() ? 'smooth' : 'auto' })}
        >
          <b>Paklijst</b>
          <span className="pakbalk__spoor">
            {perCat.map((c, i) => (
              <span
                key={onderwerpen[i].id}
                style={{ flexGrow: c.totaal, '--v': c.totaal ? c.klaar / c.totaal : 0 } as CSSProperties}
                className={`pak--${kleur(i)}`}
              />
            ))}
          </span>
          <span className="pakbalk__hoogte">
            {nl(hoogte)}
            <small>m</small>
          </span>
        </div>
      </div>

      <header className="pakkop" ref={setKopEl}>
        {/* Sterren en sneeuw zoals in de andere koppen; de berg ligt ervoor */}
        <Sneeuw aantal={8} />
        <div className="pakkop__rij">
          <div>
            <p className="pakkop__boven">Wispo 2027 · Les Deux Alpes</p>
            <h1 className="pakkop__titel">Paklijst</h1>
          </div>
          <p className="pakkop__hoogte" aria-hidden="true">
            <span className="pakkop__label">{allesKlaar ? 'Beneden op' : 'Je staat op'}</span>
            {nl(hoogte)}
            <small>m</small>
          </p>
        </div>
        <Profiel perCat={perCat} p={p} vol={allesKlaar} netVol={netVol} klaar={klaar} totaal={totaal} />
        <p className="pakkop__status" aria-live="polite">
          {statusTekst(klaar, totaal, dagen)}
        </p>
      </header>

      <div className="pak-lijst">
        {onderwerpen.length === 0 && (
          <div className="pak-leeg">
            Nog niks op de lijst
            <span>Zet er hieronder zelf iets op.</span>
          </div>
        )}
        {onderwerpen.map((o, i) => {
          const c = perCat[i]
          const isKlaar = c.totaal > 0 && c.klaar === c.totaal
          const open = handmatig.get(o.id) ?? !isKlaar
          const lijstId = `paklijst-${o.id.replace(/\W+/g, '-')}`
          return (
            <section
              key={o.id}
              className={`pak-cat pak--${kleur(i)}${isKlaar ? ' is-klaar' : ''}${open ? '' : ' is-dicht'}${
                netGestempeld === o.id && isKlaar ? ' net-gestempeld' : ''
              }`}
            >
              <h2 className="pak-cat__kop">
                <button
                  type="button"
                  className="pak-cat__knop"
                  aria-expanded={open}
                  aria-controls={lijstId}
                  onClick={() => zetOpen(o.id, !open)}
                >
                  <span className="pak-cat__nr" aria-hidden="true" onAnimationEnd={() => setNetGestempeld(null)}>
                    {i + 1}
                  </span>
                  <span className="pak-cat__naam">{o.naam}</span>
                  <span className="pak-cat__teller">
                    <span className="verborgen">{isKlaar ? 'klaar, ' : ''}</span>
                    {c.klaar}/{c.totaal}
                  </span>
                  <span className="pak-cat__pijl" aria-hidden="true" />
                </button>
              </h2>
              <div className="pak-cat__inhoud" id={lijstId}>
                <ul className="pak-items">
                  {o.items.map((it) => (
                    <li key={it.s} className={`pak-item${it.eigenId ? ' pak-item--eigen' : ''}`}>
                      <VinkRegel tekst={it.naam} aan={aangevinkt.has(it.s)} onWissel={() => wissel(o, it.s)} />
                      {it.eigenId && (
                        <button
                          type="button"
                          className="pak-item__weg"
                          aria-label={`${it.naam} verwijderen`}
                          onClick={() => verwijder(it.eigenId!)}
                        >
                          <Icoon naam="kruis" grootte={20} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )
        })}
      </div>

      <div className="pak-onder">
        <form className="pak-toevoegen" onSubmit={voegToe}>
          <label className="verborgen" htmlFor="nieuw-item">
            Eigen item
          </label>
          <input
            id="nieuw-item"
            value={nieuw}
            onChange={(e) => setNieuw(e.target.value)}
            placeholder="Zelf iets toevoegen"
            maxLength={80}
            enterKeyHint="done"
          />
          <button type="submit" disabled={!nieuw.trim()} aria-label="Toevoegen">
            <Icoon naam="plus" />
          </button>
        </form>
        {klaar > 0 && (
          <button type="button" className="pak-reset" onClick={allesUit}>
            Alles uitvinken voor de terugreis
          </button>
        )}
      </div>

      {melding && (
        <div className="toast pak-melding" role="status" key={melding.nr}>
          <span>{melding.tekst}</span>
          <button
            type="button"
            className="pak-melding__knop"
            onClick={() => {
              melding.terug()
              setMelding(null)
            }}
          >
            Ongedaan maken
          </button>
        </div>
      )}
    </div>
  )
}

function statusTekst(klaar: number, totaal: number, dagen: number): ReactNode {
  if (!totaal) return null
  if (klaar === 0)
    return (
      <>
        <strong>Boven op de gletsjer, tas nog leeg.</strong> Nog {dagen} {dagen === 1 ? 'nachtje' : 'nachtjes'} tot de bus vertrekt.
      </>
    )
  if (klaar === totaal)
    return (
      <>
        <strong>Beneden in het dorp.</strong> Tas dicht, paspoort bovenop. Tot in de bus!
      </>
    )
  const rest = totaal - klaar
  if (klaar / totaal < 0.5)
    return (
      <>
        <strong>
          {klaar} van {totaal} in de tas.
        </strong>{' '}
        Rustig aan, het is nog een eind naar beneden.
      </>
    )
  return (
    <>
      <strong>Over de helft.</strong> Nog {rest} {rest === 1 ? 'ding' : 'dingen'}, dan sta je beneden.
    </>
  )
}

/** Hoogteprofiel: de piste in stukken per onderwerp, met bordjes, de skiër en het stempel bij 100% */
function Profiel({
  perCat,
  p,
  vol,
  netVol,
  klaar,
  totaal,
}: {
  perCat: { klaar: number; totaal: number }[]
  p: number
  vol: boolean
  netVol: number
  klaar: number
  totaal: number
}) {
  const route = useRef<SVGPathElement>(null)
  const [lengte, setLengte] = useState(0)
  useLayoutEffect(() => {
    if (route.current) setLengte(route.current.getTotalLength())
  }, [])
  const punt = (l: number) => route.current?.getPointAtLength(l) ?? { x: 14, y: 26 }

  const stukken: { a: number; gedaan: number; klaar: boolean }[] = []
  let acc = 0
  for (const c of perCat) {
    if (!c.totaal || !totaal) {
      stukken.push({ a: 0, gedaan: 0, klaar: false })
      continue
    }
    const a = (acc / totaal) * lengte
    acc += c.totaal
    const b = (acc / totaal) * lengte
    stukken.push({ a, gedaan: Math.max(0, Math.min(b, p * lengte) - a), klaar: c.klaar === c.totaal })
  }
  const veel = perCat.length > 8
  const skier = punt(p * lengte)

  return (
    <div
      className="pakprofiel"
      role="progressbar"
      aria-label="Ingepakt"
      aria-valuemin={0}
      aria-valuemax={totaal}
      aria-valuenow={klaar}
      aria-valuetext={`${klaar} van ${totaal} ingepakt`}
    >
      <div key={netVol} className={`pakprofiel__stempel${netVol ? ' is-net' : ''}`} aria-hidden="true" hidden={!vol}>
        <b>Aangekomen</b>
        <small>1650 m · alles in de tas</small>
      </div>
      <svg viewBox="0 0 360 140" aria-hidden="true">
        <path className="pakprofiel__berg" d="M0 140V44L22 14L38 26L56 6L84 40L104 30L134 56L160 44L196 72L228 64L268 88L304 84L360 104V140Z" />
        <path className="pakprofiel__dal" d="M0 140V90C60 80 110 96 170 100S290 106 360 116V140Z" />
        <path ref={route} className="pakprofiel__route" d={ROUTE} />
        {lengte > 0 &&
          stukken.map((s, i) => (
            <path
              key={i}
              className={`pakprofiel__stuk pak--${kleur(i)}`}
              d={ROUTE}
              style={{ strokeDasharray: `0 ${s.a.toFixed(1)} ${s.gedaan.toFixed(1)} ${lengte.toFixed(0)}` }}
            />
          ))}
        {lengte > 0 &&
          stukken.map((s, i) => {
            if (!perCat[i].totaal) return null
            const pt = punt(s.a)
            const r = veel ? 4 : 7
            return (
              <g key={i} className={`pakprofiel__bord pak--${kleur(i)}`} transform={`translate(${pt.x.toFixed(1)} ${(pt.y + (veel ? 10 : 16)).toFixed(1)})`}>
                {s.klaar && !veel ? (
                  <g className="pakprofiel__stempeltje" transform="rotate(-14)">
                    <circle r="8.5" strokeWidth="1.8" strokeDasharray="20 1.4 14 1 19" />
                    <circle r="6.2" strokeWidth="0.8" />
                    <path d="M-3.2 0.3l2.1 2.1 4.3-4.6" strokeWidth="2" />
                  </g>
                ) : (
                  <>
                    <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={veel ? 1 : 2} />
                    {!veel && <text y="3.6">{i + 1}</text>}
                  </>
                )}
              </g>
            )
          })}
        <path className="pakprofiel__dorp" transform="translate(328 104)" d="M0 10V4l4-4 4 4v6zM10 10V2l3-3 3 3v8zM18 10V5l3-3 3 3v5z" />
        <text className="pakprofiel__label" x="14" y="12">
          3600 · Glacier
        </text>
        <text className="pakprofiel__label" x="354" y="90" textAnchor="end">
          Dorp · 1650
        </text>
        <g className="pakprofiel__skier" transform={`translate(${skier.x.toFixed(1)} ${skier.y.toFixed(1)})`}>
          <circle className="bol" r="11" />
          <circle className="hoofd" cx="1.5" cy="-5.2" r="1.7" />
          <path className="figuur" d="M-1.8 -2.4L1 0.6L-2.2 3.6M1 0.6L3.6 2.4M-6 5.4L6.5 1.6M-4.8 -0.8L-1.8 -2.4L2.6 -3" />
        </g>
      </svg>
    </div>
  )
}

/** true zodra de kop helemaal uit beeld is gescrold (niet in het buurscherm tijdens het vegen) */
function useKopWeg(el: HTMLElement | null) {
  const [weg, setWeg] = useState(false)
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (el.closest('.buurpaneel')) return
    const io = new IntersectionObserver(([e]) => setWeg(!e.isIntersecting && e.boundingClientRect.top < 0), {
      rootMargin: '-40px 0px 0px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [el])
  return weg
}

function VinkRegel({ tekst, aan, onWissel }: { tekst: string; aan: boolean; onWissel: () => void }) {
  const [net, setNet] = useState(false)
  return (
    <label className={`pak-vink${aan ? ' is-aan' : ''}${net ? ' is-net' : ''}`}>
      <input
        type="checkbox"
        checked={aan}
        onChange={() => {
          setNet(!aan)
          onWissel()
        }}
      />
      <span className="pak-vink__vak" aria-hidden="true" onAnimationEnd={() => setNet(false)}>
        <svg viewBox="0 0 24 24">
          <path d="M5.5 12.5l4.2 4.2L18.5 7.8" />
        </svg>
      </span>
      <span className="pak-vink__tekst">{tekst}</span>
    </label>
  )
}
