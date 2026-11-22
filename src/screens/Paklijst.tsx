import {
  useEffect,
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
import { Bergen, MEIJE, getekendeTop, type ViewBox } from '../components/Bergen'
import { PANORAMA } from '../lib/bergen-bijgestuurd'
import { config } from '../config'
import { useData } from '../lib/data'
import { nu } from '../lib/nu'
import { lees, schrijfEnMeld, useOpgeslagen } from '../lib/opslag'
import { lokaalNaarDate } from '../lib/tijd'
import '../styles/barlow.css'
import '../styles/paklijst.css'

/*
 * Paklijst als route naar de top ("Route naar de top", mockups/paklijst-bergen-a.html): in de kop staat
 * het panorama vanaf Le Jandri, en een piste loopt van het dorp (1650 m) over de witte flank van La Meije
 * naar de top (3982 m). Elk onderwerp is een stuk piste in zijn eigen kleur (groen, blauw, rood, zwart:
 * steeds steiler) met een genummerd bordje. Je skiër klimt mee met wat je inpakt; is een onderwerp af,
 * dan wordt het bordje een stempel en klapt het onderwerp in. Alles ingepakt: de vlag staat op de top
 * en er komt een groot stempel. De opmaak staat in styles/paklijst.css.
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
const BOVEN = 3982 // La Meije
const DORP = 1650
/** Van het dal naar de top steeds steiler: groen, blauw, rood, zwart */
const KLEUREN = ['groen', 'blauw', 'rood', 'zwart'] as const

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

export default function Paklijst({ terug }: { terug?: () => void } = {}) {
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
    meld('Terug naar het dorp: alles uitgevinkt', () => setVinkjes(oud))
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

  // op de top precies 3982 m, onderweg afgerond op 10 m
  const hoogte = allesKlaar ? BOVEN : Math.round((DORP + (BOVEN - DORP) * p) / 10) * 10
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
        {terug && (
          <button type="button" className="schermkop__terug" onClick={terug}>
            <Icoon naam="links" grootte={26} />
            Home
          </button>
        )}
        <div className="pakkop__rij">
          <div>
            <p className="pakkop__boven">Wispo 2027 · Les Deux Alpes</p>
            <h1 className="pakkop__titel">Paklijst</h1>
          </div>
          <p className="pakkop__hoogte" aria-hidden="true">
            <span className="pakkop__label">{allesKlaar ? 'Op de top' : 'Je staat op'}</span>
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
        <strong>Nog in het dorp, tas nog leeg.</strong> Nog {dagen} {dagen === 1 ? 'nachtje' : 'nachtjes'} tot de bus vertrekt.
      </>
    )
  if (klaar === totaal)
    return (
      <>
        <strong>Op de top van La Meije.</strong> Tas dicht, paspoort bovenop. Tot in de bus!
      </>
    )
  const rest = totaal - klaar
  if (klaar / totaal < 0.5)
    return (
      <>
        <strong>
          {klaar} van {totaal} in de tas.
        </strong>{' '}
        Rustig aan, het is nog een eind naar boven.
      </>
    )
  return (
    <>
      <strong>Over de helft.</strong> Nog {rest} {rest === 1 ? 'ding' : 'dingen'}, dan sta je op de top.
    </>
  )
}

/** Hoogteprofiel: de piste over de flank van La Meije, in stukken per onderwerp, met bordjes, de skiër en het stempel bij 100% */
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
        <b>Op de top</b>
        <small>{nl(BOVEN)} m · alles in de tas</small>
      </div>
      <Bergen
        className="pakprofiel__bergen"
        // ingezoomd op La Meije: hier klim je hem op. Top op dezelfde hoogte als de andere tabs.
        camera={(PANORAMA.toppen.find((t) => t.naam === MEIJE)?.x ?? 645) - 50}
        zoom={440}
        vlag={vol ? MEIJE : undefined}
        parallax={false}
        extra={(vb) => <Route vb={vb} perCat={perCat} p={p} totaal={totaal} />}
      />
    </div>
  )
}

/** De kam van de witte voorste berg op hoogte x (panorama-coördinaten) */
function kamY(x: number) {
  const kam = PANORAMA.lagen[3].kam
  for (let i = 1; i < kam.length; i++) {
    if (kam[i][0] >= x) {
      const [ax, ay] = kam[i - 1]
      const [bx, by] = kam[i]
      return ay + ((by - ay) * (x - ax)) / Math.max(1, bx - ax)
    }
  }
  return kam[kam.length - 1][1]
}

/** Hoe ver een stuk piste heen en weer slingert, naar moeilijkheid: groen krult, zwart gaat recht omhoog */
const SLINGER: Record<(typeof KLEUREN)[number], number> = { groen: 1, blauw: 0.6, rood: 0.3, zwart: 0 }
const STAPPEN = 240

/**
 * De route: van het dal over de witte linkerflank van La Meije naar de top. Op elke hoogte ligt hij een
 * stukje ín de berg (onder de kam). Elk onderwerp is een stuk piste (t0–t1, naar aantal spullen) en
 * slingert naar zijn kleur: groen in brede bochten, blauw en rood minder, zwart als één rechte lijn.
 */
function routePad(vb: ViewBox, stukken: { t0: number; t1: number; kleur: (typeof KLEUREN)[number] }[]) {
  const top = getekendeTop(MEIJE)!
  const onder = vb.y + vb.h - 12
  const basis = (t: number, dx = 0) => {
    const x = top.x - 150 * (1 - t) + dx
    const kam = kamY(x)
    return { x, y: t >= 1 ? top.y : Math.min(onder, kam + (onder - kam) * (1 - t) * 0.75 + 10 * (1 - t)) }
  }
  const slinger = (t: number) => {
    const s = stukken.find((s) => t >= s.t0 && t <= s.t1)
    return s ? SLINGER[s.kleur] : 1
  }
  // de uitslag zacht laten over- en afnemen op de grens van twee stukken, anders knikt de lijn
  const ts = Array.from({ length: STAPPEN + 1 }, (_, i) => i / STAPPEN)
  const ruw = ts.map(slinger)
  // de slinger staat dwars op de looprichting van de ruggengraat (anders schuift hij alleen langs de
  // helling heen en weer); hoe krulleriger het stuk, hoe vaker het draait
  const rug = ts.map((t) => basis(t))
  let fase = 0
  const pts = ts.map((t, i) => {
    let som = 0
    let n = 0
    for (let j = Math.max(0, i - 6); j <= Math.min(STAPPEN, i + 6); j++, n++) som += ruw[j]
    const k = som / n
    if (i) fase += (Math.PI * 2 * (3 + 4 * k)) / STAPPEN
    const a = k * 16 * (1 - t * 0.4) * Math.min(1, t * 30)
    const v = rug[Math.max(0, i - 1)]
    const w = rug[Math.min(STAPPEN, i + 1)]
    const l = Math.hypot(w.x - v.x, w.y - v.y) || 1
    const x = rug[i].x + (-(w.y - v.y) / l) * a * Math.sin(fase)
    const y = rug[i].y + ((w.x - v.x) / l) * a * Math.sin(fase)
    return { x, y: t >= 1 ? y : Math.min(onder, Math.max(y, kamY(x) + 3)) }
  })
  // zwart: één rechte lijn van begin tot eind van het stuk (wel in de berg houden)
  for (const s of stukken) {
    if (s.kleur !== 'zwart') continue
    const i0 = Math.round(s.t0 * STAPPEN)
    const i1 = Math.round(s.t1 * STAPPEN)
    for (let i = i0 + 1; i < i1; i++) {
      const f = (i - i0) / (i1 - i0)
      const x = pts[i0].x + (pts[i1].x - pts[i0].x) * f
      const y = pts[i0].y + (pts[i1].y - pts[i0].y) * f
      pts[i] = { x, y: Math.max(y, Math.min(onder, kamY(x) + 3)) }
    }
  }
  const lang = [0]
  for (let i = 1; i < pts.length; i++) lang.push(lang[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const d = 'M' + pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('L')
  return { d, pts, lang }
}

function Route({ vb, perCat, p, totaal }: { vb: ViewBox; perCat: { klaar: number; totaal: number }[]; p: number; totaal: number }) {
  const grenzen = useMemo(() => {
    const g: { t0: number; t1: number; kleur: (typeof KLEUREN)[number] }[] = []
    let acc = 0
    perCat.forEach((c, i) => {
      const t0 = totaal ? acc / totaal : 0
      acc += c.totaal
      g.push({ t0, t1: totaal ? acc / totaal : 0, kleur: kleur(i) })
    })
    return g
  }, [perCat.map((c) => c.totaal).join(','), totaal]) // eslint-disable-line react-hooks/exhaustive-deps
  const { d, pts, lang } = useMemo(() => routePad(vb, grenzen), [vb.x, vb.y, vb.w, vb.h, grenzen]) // eslint-disable-line react-hooks/exhaustive-deps
  const lengte = lang[lang.length - 1]
  // lengte langs de lijn bij een deel t van de spullen, en het punt op een lengte
  const lengteBij = (t: number) => {
    const f = Math.max(0, Math.min(1, t)) * STAPPEN
    const i = Math.min(STAPPEN - 1, Math.floor(f))
    return lang[i] + (lang[i + 1] - lang[i]) * (f - i)
  }
  const punt = (l: number) => {
    let i = 1
    while (i < STAPPEN && lang[i] < l) i++
    const f = (l - lang[i - 1]) / Math.max(1e-6, lang[i] - lang[i - 1])
    const k = Math.max(0, Math.min(1, f))
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k }
  }

  const stukken: { a: number; gedaan: number; klaar: boolean }[] = perCat.map((c, i) => {
    if (!c.totaal || !totaal) return { a: 0, gedaan: 0, klaar: false }
    const a = lengteBij(grenzen[i].t0)
    const b = lengteBij(grenzen[i].t1)
    return { a, gedaan: Math.max(0, Math.min(b, lengteBij(p)) - a), klaar: c.klaar === c.totaal }
  })
  const veel = perCat.length > 8
  const skier = punt(lengteBij(p))
  const start = punt(0)

  return (
    <g className="pakprofiel__laag">
      <path className="pakprofiel__route" d={d} />
      {lengte > 0 &&
        stukken.map((s, i) => (
          <path
            key={i}
            className={`pakprofiel__stuk pak--${kleur(i)}`}
            d={d}
            style={{ strokeDasharray: `0 ${s.a.toFixed(1)} ${s.gedaan.toFixed(1)} ${lengte.toFixed(0)}` }}
          />
        ))}
      {lengte > 0 &&
        stukken.map((s, i) => {
          if (!perCat[i].totaal) return null
          const pt = punt(s.a + 2)
          const r = veel ? 4 : 7
          // vlak onder de top ligt de kam rechts van de route hoger dan het bordje: dan zakt het bordje
          // tot het helemaal op de berg staat, anders steekt het in de lucht uit
          const bx = pt.x + 13
          const rand = s.klaar && !veel ? 9 : r
          const by = Math.max(pt.y - 3, Math.max(kamY(bx - rand), kamY(bx), kamY(bx + rand)) + rand + 2)
          return (
            <g key={i} className={`pakprofiel__bord pak--${kleur(i)}`} transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)})`}>
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
      {lengte > 0 && (
        <>
          <path className="pakprofiel__dorp" transform={`translate(${(start.x - 30).toFixed(1)} ${(start.y - 6).toFixed(1)})`} d="M0 10V4l4-4 4 4v6zM10 10V2l3-3 3 3v8zM18 10V5l3-3 3 3v5z" />
          <g className="pakprofiel__skier" transform={`translate(${skier.x.toFixed(1)} ${skier.y.toFixed(1)})`}>
            <circle className="bol" r="11" />
            <circle className="hoofd" cx="1.5" cy="-5.2" r="1.7" />
            <path className="figuur" d="M-1.8 -2.4L1 0.6L-2.2 3.6M1 0.6L3.6 2.4M-6 5.4L6.5 1.6M-4.8 -0.8L-1.8 -2.4L2.6 -3" />
          </g>
        </>
      )}
    </g>
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
