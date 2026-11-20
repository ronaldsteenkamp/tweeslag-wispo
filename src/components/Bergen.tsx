import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PANORAMA as P } from '../lib/bergen-bijgestuurd'
import '../styles/bergen.css'

/*
 * Bergen: één stuk van het panorama vanaf Le Jandri (lib/bergen-data.ts), in de stijl van de witte
 * Home-bergen. Uitgewerkt in mockups/bergen-systeem.html; kleuren in theme.css.
 *
 * - Nooit uitrekken: altijd 'xMidYMax slice'. Is het vlak breder dan het gekozen stuk (tablet,
 *   liggend), dan wordt het stuk breder in plaats van in te zoomen; anders vallen de toppen weg.
 * - Twee lagen SVG: de verre ketens liggen achter de sneeuw van <Sneeuw>, de witte voorste kam en
 *   het dal ervoor (zie bergen.css).
 * - Parallax: verre lagen blijven bij het scrollen iets achter (max ~24 px). Niet bij minder beweging.
 */

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  /** stuk van het panorama in panorama-px (0–1500 = 0°–187,5°) */
  venster?: [number, number]
  /** welke lagen: 0 = verste keten … 3 = de witte voorste kam */
  lagen?: number[]
  /** px lucht boven de hoogste top in het venster */
  lucht?: number
  /** px onder de laagste laagtop: zo blijft van elke keten de top met wat flank zichtbaar */
  diepte?: number
  /** golvende overgang naar het papier onderaan */
  dal?: boolean
  dalHoogte?: number
  /** naam van een top (bijv. 'Grand Pic de la Meije') voor het rode vlaggetje */
  vlag?: string
  /** eerste laag die vóór de sneeuw ligt */
  voorVanaf?: number
  parallax?: boolean
  weer?: 'bewolkt' | 'mist' | 'storm'
  className?: string
  style?: CSSProperties
  /** extra tekenwerk in dezelfde coördinaten, vóór de sneeuw (bijv. een route) */
  extra?: (vb: ViewBox) => ReactNode
  /**
   * Doorlopend landschap: het midden van het beeld in panorama-px (zie cameraVoor). Dan gelden een
   * vaste schaal en horizon voor alle schermen, en negeert het venster/lucht/diepte.
   */
  camera?: number
  /** Doorlopend, maar ingezoomd: zoveel panorama-px over een telefoonbreedte (Paklijst). Schuift dan niet mee bij vegen. */
  zoom?: number
}

const DIEPTE = [0.2, 0.42, 0.7, 1]

/**
 * Waar een top in de tekening staat. Niet de OSM-hoogte: het DEM is grover en komt lager uit, en een
 * nabije keten kan de top net overlappen. Dus het hoogste kampunt vlak bij de top, en in welke laag.
 */
export function getekendeTop(naam: string, lagen: number[] = [0, 1, 2, 3]) {
  const osm = P.toppen.find((t) => t.naam === naam)
  let top: { x: number; y: number; laag: number } | undefined
  if (osm)
    for (const i of lagen)
      for (const [x, y] of P.lagen[i].kam)
        if (Math.abs(x - osm.x) <= 12 && (!top || y < top.y)) top = { x, y, laag: i }
  return top
}

/*
 * Doorlopend landschap (mockups/bergen-doorlopend.html): één camera die per tab van de tabbalk een
 * stap naar rechts schuift. Overal dezelfde schaal (BREED panorama-px over een telefoonbreedte) en
 * dezelfde horizon, zodat het voelt als kijken langs één bergkam. Bij het vegen tussen tabs schuiven
 * de bergen trager mee dan het scherm (tabswipe.ts); daarom tekenen we opzij extra panorama.
 */
const BREED = 700
const STAP = 100
/** Ruimte (css-px) tussen de bovenkant van het bergvlak en de hoogste top: daar past de vlag in */
const MARGE = 38
/** Hoogte van het dal onderaan (de witte sneeuwrand boven het papier), ook overal gelijk */
const DAL = 18
const TABS_LANDSCHAP = ['home', 'planning', 'paklijst', 'kamers', 'kaart', 'rad', 'spel']
/** Bij welke tab een scherm hoort (schermen achter een tab staan op dezelfde plek) */
const BIJ_TAB: Record<string, string> = { verdelen: 'kamers', beheer: 'kamers', fotos: 'spel', welkom: 'home' }
/** Weer hoort niet bij de tabbalk: een eigen uitzicht op de gletsjer, wel op dezelfde schaal */
const WEER_CAMERA = 1050
/**
 * Verder dan hier kijken we niet: rechts daarvan zakken de witte voorkam en de laag erachter weg
 * (het dal naar het zuiden) en blijft alleen een donkerblauw vlak van de verre ketens over.
 */
const EIND = 1400

/** Het midden van het beeld voor een scherm, of undefined (onbekend scherm: eigen venster) */
export function cameraVoor(scherm: string): number | undefined {
  if (scherm === 'weer') return WEER_CAMERA
  const i = TABS_LANDSCHAP.indexOf(BIJ_TAB[scherm] ?? scherm)
  return i < 0 ? undefined : 445 + STAP * i
}

/** Laatst gemeten maat per soort vlak: een nieuw scherm (bijv. het buurscherm bij vegen) hoeft dan niet twee keer te tekenen */
const MAAT = new Map<string, { b: number; h: number }>()

/** Hoogste punt (kleinste y) van de kammen tussen a en b, ook waar een lijn van buiten het beeld binnenkomt */
function hoogsteIn(a: number, b: number, lagen: number[]) {
  let top = P.hoogte
  for (const i of lagen) {
    const kam = P.lagen[i].kam
    for (let k = 0; k < kam.length; k++) {
      const [x, y] = kam[k]
      if (x >= a && x <= b) top = Math.min(top, y)
      if (k === 0) continue
      const [px, py] = kam[k - 1]
      for (const rand of [a, b])
        if (px < rand && x > rand) top = Math.min(top, py + ((y - py) * (rand - px)) / (x - px))
    }
  }
  return top
}

function doorlopend(camera: number, breedtePx: number, verhouding: number, lagen: number[], zoom: number) {
  // op een tablet niet inzoomen maar meer panorama laten zien
  const b = Math.min(P.breedte, zoom * Math.max(1, breedtePx / 390))
  const h = b / verhouding
  // op een breder scherm wordt het stuk breder: binnen het panorama houden, anders zie je aan de rand
  // alleen lucht (Weer en Spel liggen tegen het einde aan, Home tegen het begin)
  camera = Math.max(b / 2, Math.min(EIND - b / 2, camera))
  // De hoogste top in beeld staat altijd MARGE px onder de bovenkant van het vlak, en het vlak
  // begint op elk scherm even ver van de bovenkant (--bergen-top in bergen.css). Zo staat de top
  // overal op dezelfde hoogte op het scherm; de berg loopt door tot de onderkant van de kop.
  const top = hoogsteIn(camera - b / 2, camera + b / 2, lagen)
  const y0 = top - (MARGE * b) / breedtePx
  // opzij: zoveel als het scherm bij een hele veeg méér schuift dan de bergen (Weer veegt niet mee)
  const veeg = camera === WEER_CAMERA || zoom !== BREED ? 0 : 1 - STAP / BREED
  const opzijPx = b * veeg
  return {
    x0: camera - b / 2 - opzijPx,
    x1: camera + b / 2 + opzijPx,
    y0,
    yb: y0 + h,
    opzij: opzijPx / b,
    // deel van de veeg dat de bergen terugschuiven: ze lopen STAP mee per schermbreedte
    veeg,
  }
}

/** Boven- en onderkant van een stuk panorama */
function kader([x0, x1]: [number, number], lagen: number[], lucht: number, diepte: number, vlag: boolean) {
  let top = P.hoogte
  let laagsteTop = 0
  for (const i of lagen) {
    let t = P.hoogte
    for (const [x, y] of P.lagen[i].kam) if (x >= x0 && x <= x1) t = Math.min(t, y)
    top = Math.min(top, t)
    laagsteTop = Math.max(laagsteTop, t)
  }
  const yb = Math.min(P.hoogte, laagsteTop + diepte)
  const y0 = top - (vlag ? 26 : 0) - lucht // mag boven 0 uitkomen: daar is gewoon lucht
  return { y0, yb }
}

export function Bergen({
  venster = [0, P.breedte],
  lagen = [0, 1, 2, 3],
  lucht = 36,
  diepte = 90,
  dal = true,
  dalHoogte = 24,
  vlag,
  voorVanaf = 3,
  parallax = true,
  weer,
  className = '',
  style,
  extra,
  camera,
  zoom = BREED,
}: Props) {
  const vak = useRef<HTMLDivElement>(null)
  const [maat, setMaat] = useState(() => MAAT.get(className) ?? { b: 0, h: 0 })
  const verhouding = maat.h ? maat.b / maat.h : 0

  useLayoutEffect(() => {
    const el = vak.current
    if (!el) return
    const meet = () => {
      if (!el.clientWidth || !el.clientHeight) return
      const nieuw = { b: el.clientWidth, h: el.clientHeight }
      MAAT.set(className, nieuw)
      setMaat((m) => (m.b === nieuw.b && m.h === nieuw.h ? m : nieuw))
    }
    meet()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(meet)
    ro.observe(el)
    return () => ro.disconnect()
  }, [className])

  // venster en hoogte; breder maken als het vlak breder is dan het stuk
  let [x0, x1] = venster
  let { y0, yb } = kader([x0, x1], lagen, lucht, diepte, !!vlag)
  // Doorlopend: vaste schaal en horizon, met extra panorama opzij voor het vegen (zie doorlopend())
  const door = camera !== undefined && verhouding ? doorlopend(camera, maat.b, verhouding, lagen, zoom) : null
  if (door) ({ x0, x1, y0, yb } = door)
  else if (verhouding > ((x1 - x0) / (yb - y0)) * 1.02) {
    for (let stap = 0; stap < 2; stap++) {
      const nodig = Math.min(P.breedte, (yb - y0) * verhouding)
      const midden = (x0 + x1) / 2
      x0 = Math.max(0, Math.min(P.breedte - nodig, midden - nodig / 2))
      x1 = x0 + nodig
      ;({ y0, yb } = kader([x0, x1], lagen, lucht, diepte, !!vlag))
    }
  }
  const vb: ViewBox = { x: x0, y: y0, w: x1 - x0, h: yb - y0 }
  const viewBox = `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`

  // Doorlopend: de top staat overal even hoog, dus in een hoge kop ligt de berg achter de tekst. Meet
  // tot waar de tekst van de kop loopt (gezien vanaf de bovenkant van het bergvlak) voor de waas.
  const [tekstTot, setTekstTot] = useState(0)
  const doorlopendAan = camera !== undefined
  useLayoutEffect(() => {
    const el = vak.current
    const kop = el?.offsetParent as HTMLElement | null
    if (!el || !kop || !doorlopendAan) return
    const meet = () => {
      const boven = el.getBoundingClientRect().top
      let onder = boven
      for (const c of kop.children) {
        if (c.contains(el) || c.classList.contains('sneeuw') || (c as HTMLElement).hidden) continue
        if (getComputedStyle(c).position === 'absolute') continue
        onder = Math.max(onder, c.getBoundingClientRect().bottom)
      }
      const tot = Math.round(onder - boven)
      setTekstTot((t) => (t === tot ? t : tot))
    }
    meet()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(meet)
    ro.observe(kop)
    return () => ro.disconnect()
  }, [doorlopendAan])

  // parallax bij scrollen: verre lagen blijven iets achter
  useEffect(() => {
    const el = vak.current
    if (!el || !parallax || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.closest('.buurpaneel')) return
    const groepen = [...el.querySelectorAll<SVGGElement>('.laag')]
    let wacht = 0
    const zet = () => {
      wacht = 0
      const r = el.getBoundingClientRect()
      if (r.bottom < 0) return
      const scroll = Math.max(0, Math.min(160, -r.top))
      for (const g of groepen) g.style.transform = `translateY(${(scroll * (1 - Number(g.dataset.diepte)) * 0.15).toFixed(2)}px)`
    }
    const plan = () => {
      if (!wacht) wacht = requestAnimationFrame(zet)
    }
    window.addEventListener('scroll', plan, { passive: true })
    return () => {
      window.removeEventListener('scroll', plan)
      cancelAnimationFrame(wacht)
    }
  }, [parallax])

  const laag = (i: number) => (
    <g key={i} className="laag" data-diepte={DIEPTE[i]}>
      <path className={`l${i}`} d={P.lagen[i].d} />
      {P.lagen[i].schaduw && <path className={`s${i}`} d={P.lagen[i].schaduw} />}
    </g>
  )
  const mist = (i: number) => <rect key={`m${i}`} className="mist" x={vb.x} y={vb.y} width={vb.w} height={vb.h} opacity={0.35} />
  const achter = lagen.filter((i) => i < voorVanaf)
  const voor = lagen.filter((i) => i >= voorVanaf)
  const top = vlag ? getekendeTop(vlag, lagen) : undefined
  const vlagje = top && (
    <g className="laag" data-diepte={DIEPTE[top.laag]}>
      <path d={`M${top.x} ${top.y + 1}V${top.y - 18}`} stroke="#fff" strokeWidth="1.6" />
      <path className="vlag" d={`M${top.x} ${top.y - 18}l14 5-14 5Z`} />
    </g>
  )
  const w = vb.w
  const yd = yb - (door ? DAL : dalHoogte)
  const svgStijl: CSSProperties | undefined = door ? { left: `${-door.opzij * 100}%`, width: `${(1 + 2 * door.opzij) * 100}%` } : undefined
  const svg = (soort: string, inhoud: ReactNode) => (
    <svg
      className={`bergen-vlak__svg bergen-vlak__svg--${soort}`}
      style={svgStijl}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      {inhoud}
    </svg>
  )
  // het dal golft op vaste plekken in het panorama, zodat het bij het vegen doorloopt
  const dalPad = door
    ? (() => {
        const golf = (x: number) => yd + 4 * Math.sin(x / 70) + 2.5 * Math.sin(x / 23 + 1)
        let d = `M${x0} ${yb}`
        for (let x = Math.floor(x0 / 12) * 12; x <= x1 + 12; x += 12) d += `L${x} ${golf(x).toFixed(1)}`
        return d + `L${x1 + 12} ${yb}Z`
      })()
    : `M${x0} ${yb}V${yd + 6}C${x0 + w * 0.18} ${yd - 4} ${x0 + w * 0.36} ${yd + 8} ${x0 + w * 0.54} ${yd + 2}S${x0 + w * 0.87} ${yd - 6} ${x1} ${yd + 4}V${yb}Z`

  return (
    <div
      ref={vak}
      className={`bergen-vlak${door ? ' bergen-vlak--doorlopend' : ''} ${className}`}
      style={style}
      data-weer={weer}
      data-veeg={door?.veeg ? door.veeg.toFixed(4) : undefined}
      aria-hidden="true"
    >
      {svg(
        'achter',
        <>
          {achter.flatMap((i) => [laag(i), mist(i)])}
          {top && top.laag < voorVanaf && vlagje}
        </>,
      )}
      {svg(
        'voor',
        <>
          {voor.map(laag)}
          {/* een hoge kop reikt verder omlaag dan het panorama: daar loopt de voorste berg door */}
          {door && yb > P.hoogte && <rect className={`l${lagen[lagen.length - 1]}`} x={x0} y={P.hoogte - 1} width={x1 - x0} height={yb - P.hoogte + 1} />}
          {top && top.laag >= voorVanaf && vlagje}
          {dal && <path className="dal" d={dalPad} />}
          {extra?.(vb)}
        </>,
      )}
      {door && tekstTot > 0 && (
        <span className="bergen-vlak__waas" style={{ '--tekst-tot': `${tekstTot}px` } as CSSProperties} />
      )}
    </div>
  )
}

/** Een stuk van het panorama van een gegeven breedte met een bekende top in het midden */
export function rondTop(naam: string, breedte: number, verschuif = 0): [number, number] {
  const t = P.toppen.find((x) => x.naam === naam)
  const midden = (t?.x ?? P.breedte / 2) + verschuif
  const x0 = Math.max(0, Math.min(P.breedte - breedte, midden - breedte / 2))
  return [x0, x0 + breedte]
}

export const MEIJE = 'Grand Pic de la Meije'

/**
 * De strook onderaan een donkerblauwe kop (SchermKop, Spel): de tabs liggen op één doorlopend
 * landschap (cameraVoor), Weer heeft een eigen stuk op dezelfde schaal.
 */
export function Bergstrook({ weer }: { weer?: Props['weer'] }) {
  const plek = useRef<HTMLSpanElement>(null)
  const [scherm, setScherm] = useState('')
  useLayoutEffect(() => {
    const inhoud = plek.current?.closest('[class*="inhoud--"]')
    const m = inhoud?.className.match(/inhoud--([a-z]+)/)
    setScherm(m?.[1] ?? '')
  }, [])
  return (
    <>
      <span ref={plek} hidden />
      {scherm && (
        <Bergen
          className="bergen-vlak--strook"
          camera={cameraVoor(scherm)}
          venster={[300, 900]}
          lucht={4}
          diepte={40}
          dalHoogte={12}
          weer={weer}
        />
      )}
    </>
  )
}
