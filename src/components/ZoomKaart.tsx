import { useCallback, useEffect, useRef, useState, type PointerEvent as AanwijsEvent } from 'react'

interface Stand {
  s: number // zoom (1 = past precies in beeld)
  x: number
  y: number
}

/** Hoe ver (px) je mag bewegen voordat een aanraking slepen wordt in plaats van tikken */
const SLEEPDREMPEL = 8
/** Mensen die op het scherm dichter bij elkaar staan dan dit (px) worden één bolletje */
const SAMEN_PX = 40

/** Een stip op de kaart (iemand die zijn locatie deelt, of jij). x en y in procenten. */
export interface KaartMarker {
  id: string
  x: number
  y: number
  /** Naam onder de stip */
  label: string
  /** Letters in de stip */
  kort: string
  /** Jouw eigen stip: navy met lichtblauwe ring en een cirkel "ongeveer hier"; doet niet mee in bolletjes */
  eigen?: boolean
  /** Oude positie: grijs met stippelrand */
  oud?: boolean
  /** Uitleg voor schermlezers */
  beschrijving: string
}

/** Ga naar een plek (procenten); zoom = minimaal zoveel keer "passend". Nieuwe sleutel = opnieuw gaan. */
export interface KaartFocus {
  x: number
  y: number
  zoom: number
  sleutel: number
}

interface Props {
  src: string
  alt: string
  /** Tekst als de afbeelding (nog) niet te laden is */
  ontbreekt: string
  /** Volgorde = voorrang voor de naam als het druk wordt (eerst = belangrijkst) */
  markers: KaartMarker[]
  gekozen: string | null
  onMarker: (id: string) => void
  /** Tik op een lege plek van de kaart */
  onLeegTik: () => void
  /** Eenmalige uitleg over zoomen (null = niet tonen) */
  hint: string | null
  /** Beginbeeld: midden in procenten en zoom t.o.v. passend */
  start?: { x: number; y: number; zoom: number }
  focus?: KaartFocus | null
  /** Ruimte (px) die onderaan bedekt is (onderblad): daar niet naartoe centreren */
  onderMarge?: number
  /** Je schuift of zoomt zelf (bijvoorbeeld: stop met volgen) */
  onHandmatig?: () => void
  /** Halve breedte (in pixels van de afbeelding) van de cirkel "ongeveer hier" rond je eigen stip */
  onzekerheidPx?: number
}

interface Groep {
  id: string
  x: number
  y: number
  leden: KaartMarker[]
}

/** Kaart met knijpen om te zoomen, slepen, dubbeltikken (of scrollen) en stippen die meebewegen */
export function ZoomKaart({
  src,
  alt,
  ontbreekt,
  markers,
  gekozen,
  onMarker,
  onLeegTik,
  hint: hintTekst,
  start,
  focus,
  onderMarge = 0,
  onHandmatig,
  onzekerheidPx = 50,
}: Props) {
  const vak = useRef<HTMLDivElement>(null)
  const beeld = useRef<HTMLImageElement>(null)
  const laag = useRef<HTMLDivElement>(null)
  const stand = useRef<Stand>({ s: 1, x: 0, y: 0 })
  const pas = useRef({ b: 0, h: 0, max: 4, schaal: 1 }) // afmeting bij zoom 1
  const vingers = useRef(new Map<number, { x: number; y: number }>())
  const gebaar = useRef<{ start: Stand; afstand: number; midden: { x: number; y: number } } | null>(null)
  const laatsteTik = useRef({ t: 0, x: 0, y: 0 })
  // De aanraking die (misschien) een tik is: waar en wanneer hij begon, en op welke stip
  const tik = useRef<{ x: number; y: number; t: number; marker: string | null; groep: string | null; gesleept: boolean } | null>(null)
  const [geladen, setGeladen] = useState<'bezig' | 'ok' | 'fout'>('bezig')
  const [hint, setHint] = useState(true)
  // Zoom in stapjes: bepaalt welke mensen samen een bolletje worden (niet bij elke pixel opnieuw)
  const [zoomTrap, setZoomTrap] = useState(0)
  const trap = useRef(0)
  const begonnen = useRef(false)
  const onderRef = useRef(onderMarge)
  onderRef.current = onderMarge
  const handmatig = useRef(onHandmatig)
  handmatig.current = onHandmatig

  const teken = useCallback(() => {
    const { s, x, y } = stand.current
    const t = `translate3d(${x}px, ${y}px, 0) scale(${s})`
    // Helemaal uitgezoomd: dan mag je over de kaart naar een andere tab vegen (zie tabswipe.ts)
    vak.current?.toggleAttribute('data-uitgezoomd', s <= 1.01)
    if (beeld.current) beeld.current.style.transform = t
    if (laag.current) {
      laag.current.style.transform = t
      // Stippen tegengeschaald, zodat ze op elk zoomniveau even groot blijven
      laag.current.style.setProperty('--tegen', String(1 / s))
      laag.current.style.setProperty('--s', String(s))
    }
    const nieuw = Math.round(Math.log2(s) * 4)
    if (nieuw !== trap.current) {
      trap.current = nieuw
      setZoomTrap(nieuw)
    }
  }, [])

  /** Houdt de kaart binnen beeld en gecentreerd als hij kleiner is dan het scherm */
  const begrens = useCallback((n: Stand): Stand => {
    const v = vak.current
    if (!v) return n
    const { clientWidth: vb, clientHeight: vh } = v
    const onder = Math.min(onderRef.current, vh * 0.6)
    const s = Math.min(Math.max(n.s, 1), pas.current.max)
    const b = pas.current.b * s
    const h = pas.current.h * s
    const x = b <= vb ? (vb - b) / 2 : Math.min(0, Math.max(vb - b, n.x))
    // Met een onderblad open mag de kaart verder omhoog, zodat ook de onderkant erboven kan komen
    const y = h <= vh - onder ? (vh - onder - h) / 2 : Math.min(0, Math.max(vh - onder - h, n.y))
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

  /** Zet punt (procenten) in het midden van het zichtbare deel, bij zoom s */
  const centreer = useCallback(
    (px: number, py: number, s: number, zacht = false) => {
      const v = vak.current
      if (!v) return
      const z = Math.min(Math.max(s, 1), pas.current.max)
      const zichtbaar = v.clientHeight - Math.min(onderRef.current, v.clientHeight * 0.6)
      zet({ s: z, x: v.clientWidth / 2 - (px / 100) * pas.current.b * z, y: zichtbaar / 2 - (py / 100) * pas.current.h * z }, zacht)
    },
    [zet],
  )

  const passen = useCallback(() => {
    const v = vak.current
    const el = beeld.current
    if (!v || !el || !el.naturalWidth || !v.clientWidth || !v.clientHeight) return
    const schaal = Math.min(v.clientWidth / el.naturalWidth, v.clientHeight / el.naturalHeight)
    pas.current = {
      b: el.naturalWidth * schaal,
      h: el.naturalHeight * schaal,
      // Niet verder inzoomen dan de echte resolutie van de afbeelding: daarna wordt hij korrelig
      max: Math.max(2, 1 / schaal),
      schaal,
    }
    for (const d of [el, laag.current]) {
      if (!d) continue
      d.style.width = `${pas.current.b}px`
      d.style.height = `${pas.current.h}px`
    }
    laag.current?.style.setProperty('--pxschaal', String(schaal))
    if (!begonnen.current && start) {
      begonnen.current = true
      centreer(start.x, start.y, start.zoom)
    } else zet(stand.current)
  }, [zet, centreer, start])

  useEffect(() => {
    // Opnieuw passen als het kaartvak van formaat verandert (ook als het bij het laden van de
    // afbeelding nog even 0 hoog was, bijv. midden in een tabwissel; anders blijft hij leeg)
    const v = vak.current
    const ro = v && 'ResizeObserver' in window ? new ResizeObserver(() => passen()) : null
    if (ro && v) ro.observe(v)
    window.addEventListener('resize', passen)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', passen)
    }
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
      handmatig.current?.()
    }
    v.addEventListener('wheel', wiel, { passive: false })
    return () => {
      v.removeEventListener('gesturestart', stop)
      v.removeEventListener('gesturechange', stop)
      v.removeEventListener('wheel', wiel)
    }
  }, [zoomOm])

  // Naar een plek (Waar ben ik, iemand in de lijst)
  useEffect(() => {
    if (!focus || geladen !== 'ok') return
    centreer(focus.x, focus.y, Math.max(stand.current.s, focus.zoom), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.sleutel, geladen])

  // Onderblad open of dicht: opnieuw begrenzen
  useEffect(() => {
    if (geladen === 'ok') zet(stand.current)
  }, [onderMarge, geladen, zet])

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
    const doel = e.target as HTMLElement
    const marker = doel.closest?.('[data-marker]')?.getAttribute('data-marker') ?? null
    const groep = doel.closest?.('[data-groep]')?.getAttribute('data-groep') ?? null
    tik.current = vingers.current.size === 1 ? { ...p, t: performance.now(), marker, groep, gesleept: false } : null
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
      onHandmatig?.()
      return
    }
    const t = tik.current
    if (t && !t.gesleept) {
      // Kleine trilling van je vinger bij een tik verschuift de kaart niet
      if (Math.hypot(nu.x - t.x, nu.y - t.y) < SLEEPDREMPEL) return
      // Vanaf hier slepen; de kaart haalt je vinger in, zodat het punt eronder blijft
      t.gesleept = true
      onHandmatig?.()
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
    if (t.groep) {
      laatsteTik.current = { t: 0, x: 0, y: 0 }
      openGroep(t.groep)
      return
    }
    onLeegTik()
    // Dubbeltik: inzoomen op die plek, of terug naar het hele overzicht
    const nu = performance.now()
    const vorige = laatsteTik.current
    if (nu - vorige.t < 300 && Math.hypot(p.x - vorige.x, p.y - vorige.y) < 30) {
      if (stand.current.s > 2.6) zet({ s: 1, x: 0, y: 0 }, true)
      else zoomOm(stand.current.s * 2.2, p.x, p.y, true)
      laatsteTik.current = { t: 0, x: 0, y: 0 }
      onHandmatig?.()
    } else {
      laatsteTik.current = { t: nu, x: p.x, y: p.y }
    }
  }

  /* ---------- Bolletjes en namen ---------- */
  // Op het scherm: 1% van de kaart is zoveel pixels (bij de huidige zoomtrap)
  const s = 2 ** (zoomTrap / 4)
  const pxX = (pas.current.b * s) / 100
  const pxY = (pas.current.h * s) / 100
  const groepen: Groep[] = []
  for (const m of markers) {
    if (m.eigen) continue
    const g = groepen.find((g) => Math.hypot((g.x - m.x) * pxX, (g.y - m.y) * pxY) < SAMEN_PX)
    if (g) {
      g.leden.push(m)
      g.x += (m.x - g.x) / g.leden.length
      g.y += (m.y - g.y) / g.leden.length
    } else groepen.push({ id: `groep:${m.id}`, x: m.x, y: m.y, leden: [m] })
  }
  // Wie de gekozen stip bevat, blijft los te zien
  const losseGroepen = groepen.flatMap((g) => (g.leden.some((l) => l.id === gekozen) ? g.leden.map((l) => ({ ...g, id: `groep:${l.id}`, x: l.x, y: l.y, leden: [l] })) : [g]))
  const eigen = markers.find((m) => m.eigen)
  // Namen die over een andere stip of naam heen zouden vallen, laten we weg (voorrang: jij, gekozen, de rest op volgorde)
  const vakken: { x0: number; x1: number; y0: number; y1: number }[] = []
  const metNaam = new Set<string>()
  const volgorde = [...(eigen ? [{ id: eigen.id, x: eigen.x, y: eigen.y, naam: eigen.label }] : [])]
  for (const g of [...losseGroepen].sort((a, b) => Number(b.leden.some((l) => l.id === gekozen)) - Number(a.leden.some((l) => l.id === gekozen))))
    volgorde.push({ id: g.id, x: g.x, y: g.y, naam: g.leden.map((l) => l.label).join(', ') })
  for (const v of volgorde) vakken.push({ x0: v.x * pxX - 18, x1: v.x * pxX + 18, y0: v.y * pxY - 18, y1: v.y * pxY + 18 })
  for (const v of volgorde) {
    const b = v.naam.length * 7 + 14
    const n = { x0: v.x * pxX - b / 2, x1: v.x * pxX + b / 2, y0: v.y * pxY + 16, y1: v.y * pxY + 36 }
    const eigenVak = { x0: v.x * pxX - 18, y0: v.y * pxY - 18 }
    const botst = vakken.some((o) => !(o.x0 === eigenVak.x0 && o.y0 === eigenVak.y0) && n.x0 < o.x1 && n.x1 > o.x0 && n.y0 < o.y1 && n.y1 > o.y0)
    if (!botst) {
      metNaam.add(v.id)
      vakken.push(n)
    }
  }

  function openGroep(id: string) {
    const g = losseGroepen.find((x) => x.id === id)
    if (!g) return
    if (g.leden.length === 1) return onMarker(g.leden[0].id)
    // Bolletje: inzoomen tot ze uit elkaar gaan
    centreer(g.x, g.y, stand.current.s * 2.5, true)
    onHandmatig?.()
  }

  return (
    <div
      ref={vak}
      className="kaartvak"
      data-uitgezoomd=""
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
      <div ref={laag} className="kaartvak__laag" hidden={geladen !== 'ok'} style={{ ['--onzeker' as string]: `${onzekerheidPx * 2}px` }}>
        {losseGroepen.map((g) => {
          const m = g.leden[0]
          const samen = g.leden.length > 1
          return (
            <button
              key={g.id}
              type="button"
              data-groep={g.id}
              className={`stip${samen ? ' stip--samen' : ''}${!samen && m.id === gekozen ? ' is-gekozen' : ''}${!samen && m.oud ? ' is-oud' : ''}`}
              style={{ left: `${g.x}%`, top: `${g.y}%` }}
              aria-label={samen ? `${g.leden.length} mensen: ${g.leden.map((l) => l.label).join(', ')}. Inzoomen.` : m.beschrijving}
              // Alleen voor het toetsenbord; tikken handelt het kaartvak af (zie onUp)
              onClick={(e) => e.detail === 0 && openGroep(g.id)}
            >
              <span className="stip__rondje" aria-hidden="true">
                {samen ? g.leden.length : m.kort}
              </span>
              {metNaam.has(g.id) && (
                <span className="stip__naam" aria-hidden="true">
                  {samen ? g.leden.map((l) => l.label).join(', ') : m.label}
                </span>
              )}
            </button>
          )
        })}
        {eigen && (
          <button
            type="button"
            data-marker={eigen.id}
            className={`stip stip--jij${eigen.id === gekozen ? ' is-gekozen' : ''}${eigen.oud ? ' is-oud' : ''}`}
            style={{ left: `${eigen.x}%`, top: `${eigen.y}%` }}
            aria-label={eigen.beschrijving}
            onClick={(e) => e.detail === 0 && onMarker(eigen.id)}
          >
            <span className="stip__onzeker" aria-hidden="true" />
            <span className="stip__rondje" aria-hidden="true" />
            <span className="stip__naam" aria-hidden="true">
              {eigen.label}
            </span>
          </button>
        )}
      </div>
      {geladen === 'fout' && <p className="kaartvak__melding">{ontbreekt}</p>}
      {geladen === 'ok' && hint && hintTekst && <p className="kaartvak__hint">{hintTekst}</p>}
    </div>
  )
}
