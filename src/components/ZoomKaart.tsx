import { useCallback, useEffect, useRef, useState, type PointerEvent as AanwijsEvent } from 'react'
import type { Plek, PlekSoort } from '../lib/data'
import { Icoon } from './Icoon'

interface Stand {
  s: number // zoom (1 = past precies in beeld)
  x: number
  y: number
}

/** Hoe ver (px) je mag bewegen voordat een aanraking slepen wordt in plaats van tikken */
const SLEEPDREMPEL = 8

export const SOORTEN: Record<PlekSoort, { label: string; icoon: string; kleur: string }> = {
  apres: { label: 'Bier & après-ski', icoon: '🍻', kleur: '#8e24aa' },
  eten: { label: 'Eten', icoon: '🍽️', kleur: '#d62839' },
  afspreek: { label: 'Afspreken', icoon: '🚩', kleur: '#0d0058' },
  handig: { label: 'Handig', icoon: 'ℹ️', kleur: '#1b8a5a' },
}

interface Props {
  src: string
  alt: string
  bron: string
  /** Tekst als de afbeelding (nog) niet te laden is */
  ontbreekt: string
  plekken: Plek[]
  gekozen: string | null
  onPlek: (id: string) => void
  /** Tik op een lege plek van de kaart */
  onLeegTik: () => void
  /** Plaatsmodus: tik geeft de positie in procenten */
  onPlaats?: (x: number, y: number) => void
  markering?: { x: number; y: number } | null
  hint: string
}

/** Kaart met knijpen om te zoomen, slepen, dubbeltikken, +/− knoppen en pins die meebewegen */
export function ZoomKaart({ src, alt, bron, ontbreekt, plekken, gekozen, onPlek, onLeegTik, onPlaats, markering, hint: hintTekst }: Props) {
  const vak = useRef<HTMLDivElement>(null)
  const beeld = useRef<HTMLImageElement>(null)
  const laag = useRef<HTMLDivElement>(null)
  const stand = useRef<Stand>({ s: 1, x: 0, y: 0 })
  const pas = useRef({ b: 0, h: 0, max: 4 }) // afmeting bij zoom 1
  const vingers = useRef(new Map<number, { x: number; y: number }>())
  const gebaar = useRef<{ start: Stand; afstand: number; midden: { x: number; y: number } } | null>(null)
  const laatsteTik = useRef({ t: 0, x: 0, y: 0 })
  // De aanraking die (misschien) een tik is: waar en wanneer hij begon, en op welke pin
  const tik = useRef<{ x: number; y: number; t: number; plek: string | null; gesleept: boolean } | null>(null)
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
    const p = punt(e)
    vingers.current.set(e.pointerId, p)
    setHint(false)
    // Eén vinger: misschien een tik. Een tweede vinger maakt er een knijpgebaar van.
    const plek = (e.target as HTMLElement).closest?.('[data-plek]')?.getAttribute('data-plek') ?? null
    tik.current = vingers.current.size === 1 ? { ...p, t: performance.now(), plek, gesleept: false } : null
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

    if (t.plek) {
      laatsteTik.current = { t: 0, x: 0, y: 0 }
      onPlek(t.plek)
      return
    }
    if (onPlaats) {
      const { s, x, y } = stand.current
      const px = ((p.x - x) / s / pas.current.b) * 100
      const py = ((p.y - y) / s / pas.current.h) * 100
      if (px >= 0 && px <= 100 && py >= 0 && py <= 100) onPlaats(Math.round(px * 10) / 10, Math.round(py * 10) / 10)
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

  const knopZoom = (factor: number) => {
    const v = vak.current
    if (!v) return
    zoomOm(stand.current.s * factor, v.clientWidth / 2, v.clientHeight / 2, true)
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
          {plekken.map((p) => (
            <button
              key={p.id}
              type="button"
              data-plek={p.id}
              className={`pin${p.id === gekozen ? ' is-gekozen' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, ['--kleur' as string]: SOORTEN[p.soort].kleur }}
              aria-label={`${SOORTEN[p.soort].label}: ${p.naam}`}
              // Alleen voor het toetsenbord; tikken handelt het kaartvak af (zie onUp)
              onClick={(e) => e.detail === 0 && onPlek(p.id)}
            >
              <span aria-hidden="true">{SOORTEN[p.soort].icoon}</span>
            </button>
          ))}
          {markering && <span className="pin pin--plaats" style={{ left: `${markering.x}%`, top: `${markering.y}%` }} aria-hidden="true" />}
        </div>
        {geladen === 'fout' && <p className="kaartvak__melding">{ontbreekt}</p>}
        {geladen === 'ok' && hint && <p className="kaartvak__hint">{hintTekst}</p>}
        {geladen === 'ok' && <p className="kaartvak__bron">{bron}</p>}
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
    </>
  )
}
