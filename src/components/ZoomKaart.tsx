import { useCallback, useEffect, useRef, useState, type PointerEvent as AanwijsEvent } from 'react'
import { Icoon } from './Icoon'

interface Stand {
  s: number // zoom (1 = past precies in beeld)
  x: number
  y: number
}

/** Hoe ver (px) je mag bewegen voordat een aanraking slepen wordt in plaats van tikken */
const SLEEPDREMPEL = 8

/** Een stip op de kaart (bijv. iemand die zijn locatie deelt). x en y in procenten. */
export interface KaartMarker {
  id: string
  x: number
  y: number
  /** Naam onder de stip */
  label: string
  /** Letters in de stip */
  kort: string
  kleur: string
  /** Eigen stip: met witte ring */
  eigen?: boolean
  /** Oude positie: vager */
  oud?: boolean
  /** Uitleg voor schermlezers */
  beschrijving: string
}

interface Props {
  src: string
  alt: string
  bron: string
  /** Tekst als de afbeelding (nog) niet te laden is */
  ontbreekt: string
  markers: KaartMarker[]
  gekozen: string | null
  onMarker: (id: string) => void
  /** Tik op een lege plek van de kaart */
  onLeegTik: () => void
  hint: string
}

/** Kaart met knijpen om te zoomen, slepen, dubbeltikken (of scrollen) en stippen die meebewegen */
export function ZoomKaart({ src, alt, bron, ontbreekt, markers, gekozen, onMarker, onLeegTik, hint: hintTekst }: Props) {
  const vak = useRef<HTMLDivElement>(null)
  const beeld = useRef<HTMLImageElement>(null)
  const laag = useRef<HTMLDivElement>(null)
  const stand = useRef<Stand>({ s: 1, x: 0, y: 0 })
  const pas = useRef({ b: 0, h: 0, max: 4 }) // afmeting bij zoom 1
  const vingers = useRef(new Map<number, { x: number; y: number }>())
  const gebaar = useRef<{ start: Stand; afstand: number; midden: { x: number; y: number } } | null>(null)
  const laatsteTik = useRef({ t: 0, x: 0, y: 0 })
  // De aanraking die (misschien) een tik is: waar en wanneer hij begon, en op welke pin
  const tik = useRef<{ x: number; y: number; t: number; marker: string | null; gesleept: boolean } | null>(null)
  const [geladen, setGeladen] = useState<'bezig' | 'ok' | 'fout'>('bezig')
  const [hint, setHint] = useState(true)

  const teken = useCallback(() => {
    const { s, x, y } = stand.current
    const t = `translate3d(${x}px, ${y}px, 0) scale(${s})`
    if (beeld.current) beeld.current.style.transform = t
    if (laag.current) {
      laag.current.style.transform = t
      // Pins tegengeschaald, zodat ze op elk zoomniveau even groot blijven
      laag.current.style.setProperty('--tegen', String(1 / s))
    }
  }, [])

  /** Houdt de kaart binnen beeld en gecentreerd als hij kleiner is dan het scherm */
  const begrens = useCallback((n: Stand): Stand => {
    const v = vak.current
    if (!v) return n
    const { clientWidth: vb, clientHeight: vh } = v
    const s = Math.min(Math.max(n.s, 1), pas.current.max)
    const b = pas.current.b * s
    const h = pas.current.h * s
    const x = b <= vb ? (vb - b) / 2 : Math.min(0, Math.max(vb - b, n.x))
    const y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, n.y))
    return { s, x, y }
  }, [])

  const zet = useCallback(
    (n: Stand, zacht = false) => {
      stand.current = begrens(n)
      const overgang = zacht ? 'transform 0.25s ease-out' : 'none'
      if (beeld.current) beeld.current.style.transition = overgang
      if (laag.current) laag.current.style.transition = overgang
      teken()
    },
    [begrens, teken],
  )

  /** Zoom naar factor s rond punt (px, py) in het kaartvak */
  const zoomOm = useCallback(
    (s: number, px: number, py: number, zacht = false) => {
      const o = stand.current
      const nieuw = Math.min(Math.max(s, 1), pas.current.max)
      const f = nieuw / o.s
      zet({ s: nieuw, x: px - (px - o.x) * f, y: py - (py - o.y) * f }, zacht)
    },
    [zet],
  )

  const passen = useCallback(() => {
    const v = vak.current
    const el = beeld.current
    if (!v || !el || !el.naturalWidth) return
    const schaal = Math.min(v.clientWidth / el.naturalWidth, v.clientHeight / el.naturalHeight)
    pas.current = {
      b: el.naturalWidth * schaal,
      h: el.naturalHeight * schaal,
      // Inzoomen tot twee keer de echte resolutie van de afbeelding, minstens 4x
      max: Math.max(4, 2 / schaal),
    }
    for (const d of [el, laag.current]) {
      if (!d) continue
      d.style.width = `${pas.current.b}px`
      d.style.height = `${pas.current.h}px`
    }
    zet(stand.current)
  }, [zet])

  useEffect(() => {
    window.addEventListener('resize', passen)
    return () => window.removeEventListener('resize', passen)
  }, [passen])

  useEffect(() => {
    // Knijpen in Safari: de eigen zoom van de pagina tegenhouden
    const v = vak.current
    if (!v) return
    const stop = (e: Event) => e.preventDefault()
    v.addEventListener('gesturestart', stop)
    v.addEventListener('gesturechange', stop)
    const wiel = (e: WheelEvent) => {
      e.preventDefault()
      const r = v.getBoundingClientRect()
      zoomOm(stand.current.s * Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top)
    }
    v.addEventListener('wheel', wiel, { passive: false })
    return () => {
      v.removeEventListener('gesturestart', stop)
      v.removeEventListener('gesturechange', stop)
      v.removeEventListener('wheel', wiel)
    }
  }, [zoomOm])

  /** Zoomknoppen (met handschoenen gaat knijpen lastig): rond het midden van het beeld */
  const zoomMidden = (factor: number) => {
    const v = vak.current
    if (v) zoomOm(stand.current.s * factor, v.clientWidth / 2, v.clientHeight / 2, true)
  }

  const punt = (e: AanwijsEvent) => {
    const r = vak.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const startGebaar = () => {
    const p = [...vingers.current.values()]
    if (p.length === 0) {
      gebaar.current = null
      return
    }
    const midden = p.length === 1 ? p[0] : { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
    const afstand = p.length === 1 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
    gebaar.current = { start: { ...stand.current }, afstand, midden }
  }

  const onDown = (e: AanwijsEvent) => {
    // De zoomknoppen handelen hun eigen tik af
    if ((e.target as HTMLElement).closest?.('.kaartvak__zoom')) return
    vak.current?.setPointerCapture(e.pointerId)
    const p = punt(e)
    vingers.current.set(e.pointerId, p)
    setHint(false)
    // Eén vinger: misschien een tik. Een tweede vinger maakt er een knijpgebaar van.
    const marker = (e.target as HTMLElement).closest?.('[data-marker]')?.getAttribute('data-marker') ?? null
    tik.current = vingers.current.size === 1 ? { ...p, t: performance.now(), marker, gesleept: false } : null
    startGebaar()
  }

  const onMove = (e: AanwijsEvent) => {
    if (!vingers.current.has(e.pointerId) || !gebaar.current) return
    const nu = punt(e)
    vingers.current.set(e.pointerId, nu)
    const p = [...vingers.current.values()]
    const g = gebaar.current
    if (p.length >= 2) {
      const m = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
      const afstand = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
      const s = Math.min(Math.max(g.start.s * (afstand / g.afstand), 1), pas.current.max)
      // Het punt onder je vingers blijft onder je vingers
      const cx = (g.midden.x - g.start.x) / g.start.s
      const cy = (g.midden.y - g.start.y) / g.start.s
      zet({ s, x: m.x - cx * s, y: m.y - cy * s })
      return
    }
    const t = tik.current
    if (t && !t.gesleept) {
      // Kleine trilling van je vinger bij een tik verschuift de kaart niet
      if (Math.hypot(nu.x - t.x, nu.y - t.y) < SLEEPDREMPEL) return
      // Vanaf hier slepen; de kaart haalt je vinger in, zodat het punt eronder blijft
      t.gesleept = true
    }
    zet({ s: g.start.s, x: g.start.x + p[0].x - g.midden.x, y: g.start.y + p[0].y - g.midden.y })
  }

  const onUp = (e: AanwijsEvent) => {
    const p = punt(e)
    const wasEnkel = vingers.current.size === 1
    vingers.current.delete(e.pointerId)
    startGebaar()
    if (!wasEnkel) return
    const t = tik.current
    tik.current = null
    // Gesleept, of lang vastgehouden: geen tik
    if (!t || t.gesleept || e.type === 'pointercancel' || performance.now() - t.t > 600) return

    if (t.marker) {
      laatsteTik.current = { t: 0, x: 0, y: 0 }
      onMarker(t.marker)
      return
    }
    onLeegTik()
    // Dubbeltik: inzoomen op die plek, of terug naar het hele overzicht
    const nu = performance.now()
    const vorige = laatsteTik.current
    if (nu - vorige.t < 300 && Math.hypot(p.x - vorige.x, p.y - vorige.y) < 30) {
      if (stand.current.s > 1.05) zet({ s: 1, x: 0, y: 0 }, true)
      else zoomOm(2.5, p.x, p.y, true)
      laatsteTik.current = { t: 0, x: 0, y: 0 }
    } else {
      laatsteTik.current = { t: nu, x: p.x, y: p.y }
    }
  }

  return (
    <>
      <div
        ref={vak}
        className="kaartvak"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img
          ref={beeld}
          src={src}
          alt={alt}
          draggable={false}
          className="kaartvak__beeld"
          onLoad={() => {
            setGeladen('ok')
            passen()
          }}
          onError={() => setGeladen('fout')}
        />
        <div ref={laag} className="kaartvak__laag" hidden={geladen !== 'ok'}>
          {markers.map((m) => (
            <button
              key={m.id}
              type="button"
              data-marker={m.id}
              className={`stip${m.id === gekozen ? ' is-gekozen' : ''}${m.eigen ? ' is-eigen' : ''}${m.oud ? ' is-oud' : ''}`}
              style={{ left: `${m.x}%`, top: `${m.y}%`, ['--kleur' as string]: m.kleur }}
              aria-label={m.beschrijving}
              // Alleen voor het toetsenbord; tikken handelt het kaartvak af (zie onUp)
              onClick={(e) => e.detail === 0 && onMarker(m.id)}
            >
              <span className="stip__rondje" aria-hidden="true">
                {m.kort}
              </span>
              <span className="stip__naam" aria-hidden="true">
                {m.label}
              </span>
            </button>
          ))}
        </div>
        {geladen === 'fout' && <p className="kaartvak__melding">{ontbreekt}</p>}
        {geladen === 'ok' && hint && <p className="kaartvak__hint">{hintTekst}</p>}
        {geladen === 'ok' && <p className="kaartvak__bron">{bron}</p>}
        {geladen === 'ok' && (
          <div className="kaartvak__zoom">
            <button type="button" className="kaartvak__zoomknop" aria-label="Inzoomen" onClick={() => zoomMidden(1.6)}>
              <Icoon naam="plus" />
            </button>
            <button type="button" className="kaartvak__zoomknop" aria-label="Uitzoomen" onClick={() => zoomMidden(1 / 1.6)}>
              <Icoon naam="min" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
