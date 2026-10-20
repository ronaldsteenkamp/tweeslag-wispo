import { useCallback, useEffect, useRef, useState, type PointerEvent as AanwijsEvent } from 'react'
import { Icoon } from '../components/Icoon'

const KAART = `${import.meta.env.BASE_URL}img/pistekaart.jpg`

interface Stand {
  s: number // zoom (1 = past precies in beeld)
  x: number
  y: number
}

/** Pistekaart met knijpen om te zoomen, slepen, dubbeltikken en grote +/− knoppen */
export default function Kaart() {
  const vak = useRef<HTMLDivElement>(null)
  const beeld = useRef<HTMLImageElement>(null)
  const stand = useRef<Stand>({ s: 1, x: 0, y: 0 })
  const pas = useRef({ b: 0, h: 0, max: 4 }) // afmeting bij zoom 1
  const vingers = useRef(new Map<number, { x: number; y: number }>())
  const gebaar = useRef<{ start: Stand; afstand: number; midden: { x: number; y: number } } | null>(null)
  const laatsteTik = useRef({ t: 0, x: 0, y: 0 })
  const [geladen, setGeladen] = useState<'bezig' | 'ok' | 'fout'>('bezig')
  const [hint, setHint] = useState(true)

  const teken = useCallback(() => {
    const el = beeld.current
    if (!el) return
    const { s, x, y } = stand.current
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
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
      const el = beeld.current
      if (el) el.style.transition = zacht ? 'transform 0.25s ease-out' : 'none'
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
    el.style.width = `${pas.current.b}px`
    el.style.height = `${pas.current.h}px`
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
    vak.current?.setPointerCapture(e.pointerId)
    vingers.current.set(e.pointerId, punt(e))
    setHint(false)
    startGebaar()
  }

  const onMove = (e: AanwijsEvent) => {
    if (!vingers.current.has(e.pointerId) || !gebaar.current) return
    vingers.current.set(e.pointerId, punt(e))
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
    } else {
      zet({ s: g.start.s, x: g.start.x + p[0].x - g.midden.x, y: g.start.y + p[0].y - g.midden.y })
    }
  }

  const onUp = (e: AanwijsEvent) => {
    const p = punt(e)
    const wasEnkel = vingers.current.size === 1
    vingers.current.delete(e.pointerId)
    startGebaar()
    if (!wasEnkel) return
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

  const knopZoom = (factor: number) => {
    const v = vak.current
    if (!v) return
    zoomOm(stand.current.s * factor, v.clientWidth / 2, v.clientHeight / 2, true)
  }

  return (
    <div className="kaartscherm">
      <h1 className="verborgen">Pistekaart</h1>
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
          src={KAART}
          alt="Pistekaart van Les Deux Alpes"
          draggable={false}
          className="kaartvak__beeld"
          onLoad={() => {
            setGeladen('ok')
            passen()
          }}
          onError={() => setGeladen('fout')}
        />
        {geladen === 'fout' && (
          <p className="kaartvak__melding">
            De pistekaart is nog niet bewaard. Open dit scherm één keer met internet.
          </p>
        )}
        {geladen === 'ok' && hint && <p className="kaartvak__hint">Knijp of dubbeltik om te zoomen</p>}
        {geladen === 'ok' && <p className="kaartvak__bron">Pistekaart © Les 2 Alpes</p>}
      </div>
      <div className="kaartknoppen">
        <button type="button" className="kaartknop" aria-label="Inzoomen" onClick={() => knopZoom(1.6)}>
          <Icoon naam="plus" grootte={28} />
        </button>
        <button type="button" className="kaartknop" aria-label="Uitzoomen" onClick={() => knopZoom(1 / 1.6)}>
          <Icoon naam="min" grootte={28} />
        </button>
        <button type="button" className="kaartknop" aria-label="Hele kaart" onClick={() => zet({ s: 1, x: 0, y: 0 }, true)}>
          <Icoon naam="herstel" grootte={26} />
        </button>
      </div>
    </div>
  )
}
