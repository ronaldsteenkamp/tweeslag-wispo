import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PANORAMA as P } from '../lib/bergen-data'
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
}

const DIEPTE = [0.2, 0.42, 0.7, 1]

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
}: Props) {
  const vak = useRef<HTMLDivElement>(null)
  const [verhouding, setVerhouding] = useState(0)

  useLayoutEffect(() => {
    const el = vak.current
    if (!el) return
    const meet = () => setVerhouding(el.clientWidth / Math.max(1, el.clientHeight))
    meet()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(meet)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // venster en hoogte; breder maken als het vlak breder is dan het stuk
  let [x0, x1] = venster
  let { y0, yb } = kader([x0, x1], lagen, lucht, diepte, !!vlag)
  if (verhouding > ((x1 - x0) / (yb - y0)) * 1.02) {
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
  const top = vlag ? P.toppen.find((t) => t.naam === vlag) : undefined
  const w = vb.w
  const yd = yb - dalHoogte
  const svg = (soort: string, inhoud: ReactNode) => (
    <svg className={`bergen-vlak__svg bergen-vlak__svg--${soort}`} viewBox={viewBox} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {inhoud}
    </svg>
  )

  return (
    <div ref={vak} className={`bergen-vlak ${className}`} style={style} data-weer={weer} aria-hidden="true">
      {svg(
        'achter',
        <>
          {achter.flatMap((i) => [laag(i), mist(i)])}
          {top && voorVanaf > 1 && (
            <g className="laag" data-diepte={DIEPTE[1]}>
              <path d={`M${top.x} ${top.y}V${top.y - 18}`} stroke="#fff" strokeWidth="1.6" />
              <path className="vlag" d={`M${top.x} ${top.y - 18}l14 5-14 5Z`} />
            </g>
          )}
        </>,
      )}
      {svg(
        'voor',
        <>
          {voor.map(laag)}
          {dal && (
            <path
              className="dal"
              d={`M${x0} ${yb}V${yd + 6}C${x0 + w * 0.18} ${yd - 4} ${x0 + w * 0.36} ${yd + 8} ${x0 + w * 0.54} ${yd + 2}S${x0 + w * 0.87} ${yd - 6} ${x1} ${yd + 4}V${yb}Z`}
            />
          )}
          {extra?.(vb)}
        </>,
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

/** Per scherm een eigen stuk van de kam voor de strook onder de kop (La Meije zelf staat op Home en Paklijst) */
const STROOK: Record<string, [number, number]> = {
  planning: [0, 600],
  kamers: [700, 1300],
  verdelen: [700, 1300],
  beheer: [700, 1300],
  rad: [900, 1500],
  spel: [780, 1380],
  fotos: [780, 1380],
  weer: [860, 1460],
}

/** De strook onderaan een donkerblauwe kop (SchermKop, Spel): kiest zelf het stuk bij het scherm */
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
      <Bergen className="bergen-vlak--strook" venster={STROOK[scherm] ?? [300, 900]} lucht={4} diepte={40} dalHoogte={12} weer={weer} />
    </>
  )
}
