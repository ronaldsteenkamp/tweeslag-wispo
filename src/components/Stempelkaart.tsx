import { useEffect, useRef, useState, type ReactNode } from 'react'
import { klank, krasGeluid, minderBeweging, trilSpel } from '../lib/spelgeluid'

/*
 * Bouwstenen van het Spel in de stijl "stempelkaart" (styles/spel.css): een inktstempel,
 * een knop die je moet vasthouden en een kraslot. Geluid en trillen via lib/spelgeluid.
 */

/** Eén keer per scherm: ruwe randjes en spikkels voor de stempelinkt */
export function InktFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="inkt" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} result="r" />
        <feDisplacementMap in="SourceGraphic" in2="r" scale={2.5} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feColorMatrix in="r" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 2.15" result="m" />
        <feComposite in="d" in2="m" operator="in" />
      </filter>
    </svg>
  )
}

/** Ronde inktstempel. `nieuw`: komt er net op (met bonk) */
export function Stempel({ children, nieuw, className = '' }: { children: ReactNode; nieuw?: boolean; className?: string }) {
  return <span className={`stempel${nieuw ? ' stempel--nieuw' : ''} ${className}`}>{children}</span>
}

/**
 * Knop die je ~1 seconde moet vasthouden (voelt als echt indrukken en voorkomt per ongeluk
 * stemmen). Met toetsenbord of schermlezer werkt gewoon activeren.
 */
export function HoudKnop({
  duur = 900,
  onKlaar,
  disabled,
  geluid,
  children,
}: {
  duur?: number
  onKlaar: () => void
  disabled?: boolean
  geluid: boolean
  children: ReactNode
}) {
  const knop = useRef<HTMLButtonElement>(null)
  const t0 = useRef(0)
  const raf = useRef(0)
  const [bezig, setBezig] = useState(false)
  const klaar = useRef(onKlaar)
  klaar.current = onKlaar

  const zet = (p: number) => knop.current?.style.setProperty('--houd', String(p))
  const stop = () => {
    cancelAnimationFrame(raf.current)
    t0.current = 0
    zet(0)
    setBezig(false)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const loop = (t: number) => {
    const p = Math.min(1, (t - t0.current) / duur)
    zet(p)
    if (p >= 1) {
      stop()
      klaar.current()
      return
    }
    raf.current = requestAnimationFrame(loop)
  }

  return (
    <button
      ref={knop}
      type="button"
      className={`spelknop spelknop--houd${bezig ? ' wordt-gehouden' : ''}`}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled || e.button > 0) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        t0.current = performance.now()
        setBezig(true)
        klank('papier', geluid)
        trilSpel('tik', geluid)
        raf.current = requestAnimationFrame(loop)
      }}
      onPointerUp={() => t0.current && stop()}
      onPointerCancel={() => t0.current && stop()}
      onLostPointerCapture={() => t0.current && stop()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          klaar.current()
        }
      }}
    >
      <span>{children}</span>
    </button>
  )
}

/**
 * Kraslot: een zilveren laag over `children`. Krassen met de vinger; is ruim de helft weg, dan
 * valt de rest eraf. "Kras voor me" doet het automatisch (ook voor wie minder beweging wil).
 */
export function Kraslot({ children, onOpen, geluid, label }: { children: ReactNode; onOpen: () => void; geluid: boolean; label: string }) {
  const doek = useRef<HTMLCanvasElement>(null)
  const [weg, setWeg] = useState(false)
  const open = useRef(false)
  const klaar = useRef(onOpen)
  klaar.current = onOpen

  const af = () => {
    if (open.current) return
    open.current = true
    krasGeluid(false, geluid)
    // Eerst de laatste zilverresten laten vervagen, dan pas het lot open
    doek.current?.classList.add('weg')
    window.setTimeout(
      () => {
        setWeg(true)
        klaar.current()
      },
      minderBeweging() ? 0 : 320,
    )
  }

  useEffect(() => {
    const cv = doek.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.max(1, r.width * dpr)
    cv.height = Math.max(1, r.height * dpr)
    const c = cv.getContext('2d')
    if (!c) return
    c.scale(dpr, dpr)
    c.fillStyle = '#b9bcc6'
    c.fillRect(0, 0, r.width, r.height)
    c.fillStyle = 'rgba(255,255,255,.35)'
    for (let x = -r.height; x < r.width; x += 12) {
      c.beginPath()
      c.moveTo(x, r.height)
      c.lineTo(x + r.height, 0)
      c.lineTo(x + r.height + 6, 0)
      c.lineTo(x + 6, r.height)
      c.fill()
    }
    c.fillStyle = '#2b2c3a'
    c.font = '700 20px "Barlow Condensed", sans-serif'
    c.textAlign = 'center'
    c.fillText('KRAS HIER', r.width / 2, r.height / 2 + 7)
    c.globalCompositeOperation = 'destination-out'
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.lineWidth = 42
  }, [])

  const ctx = () => doek.current?.getContext('2d') ?? null
  const vorige = useRef<[number, number] | null>(null)
  const teller = useRef(0)
  const pos = (e: React.PointerEvent): [number, number] => {
    const b = doek.current!.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top]
  }
  const lijn = (a: [number, number], b: [number, number]) => {
    const c = ctx()
    if (!c) return
    c.beginPath()
    c.moveTo(a[0], a[1])
    c.lineTo(b[0], b[1])
    c.stroke()
  }
  const hoeveelWeg = () => {
    const cv = doek.current
    const c = ctx()
    if (!cv || !c) return 0
    const d = c.getImageData(0, 0, cv.width, cv.height).data
    let leeg = 0
    let tot = 0
    for (let i = 3; i < d.length; i += 4 * 37) {
      tot++
      if (d[i] < 40) leeg++
    }
    return leeg / tot
  }

  const krasVoorMe = async () => {
    if (minderBeweging()) return af()
    const cv = doek.current
    if (!cv) return af()
    const r = cv.getBoundingClientRect()
    krasGeluid(true, geluid)
    let p: [number, number] = [10, 10]
    for (let i = 0; i <= 14; i++) {
      const q: [number, number] = [i % 2 ? r.width - 10 : 10, 10 + (i * (r.height - 20)) / 14]
      lijn(p, q)
      p = q
      await new Promise((ok) => window.setTimeout(ok, 50))
    }
    af()
  }

  return (
    <div className={`kraslot${weg ? ' is-open' : ''}`}>
      <div className="kraslot__inhoud" aria-hidden={!weg}>
        {children}
      </div>
      {!weg && (
        <>
          <canvas
            ref={doek}
            className="kraslot__laag"
            role="img"
            aria-label={label}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              vorige.current = pos(e)
              lijn(vorige.current, [vorige.current[0] + 0.1, vorige.current[1]])
              krasGeluid(true, geluid)
            }}
            onPointerMove={(e) => {
              if (!vorige.current) return
              const p = pos(e)
              lijn(vorige.current, p)
              vorige.current = p
              if (++teller.current % 6 === 0 && hoeveelWeg() > 0.55) af()
            }}
            onPointerUp={() => {
              vorige.current = null
              krasGeluid(false, geluid)
            }}
            onPointerCancel={() => {
              vorige.current = null
              krasGeluid(false, geluid)
            }}
          />
          <button type="button" className="tekstknop kraslot__zelf" onClick={() => void krasVoorMe()}>
            Kras voor me
          </button>
        </>
      )}
    </div>
  )
}
