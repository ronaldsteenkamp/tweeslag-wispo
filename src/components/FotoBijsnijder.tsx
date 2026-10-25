import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { snijUit } from '../lib/fotos'

const MAX_ZOOM = 4

/**
 * Profielfoto bijsnijden: slepen om te verplaatsen, knijpen, scrollen of de schuif om te zoomen.
 * Het rondje laat zien wat er straks als profielfoto te zien is.
 */
export function FotoBijsnijder({
  bestand,
  onKlaar,
  onAnnuleer,
}: {
  bestand: File
  onKlaar: (blob: Blob) => void
  onAnnuleer: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [maat, setMaat] = useState<{ b: number; h: number } | null>(null)
  const [vak, setVak] = useState(0) // breedte (= hoogte) van het vierkant op het scherm
  const [zoom, setZoom] = useState(1)
  // Bij knijpen komen er meerdere bewegingen per frame: dan telt de nieuwste zoom, niet die van de render
  const zoomNu = useRef(1)
  const [verschuiving, setVerschuiving] = useState({ x: 0, y: 0 })
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const kader = useRef<HTMLDivElement>(null)
  const vingers = useRef(new Map<number, { x: number; y: number }>())
  const knijpAfstand = useRef<number | null>(null)

  useEffect(() => {
    const u = URL.createObjectURL(bestand)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [bestand])

  useLayoutEffect(() => {
    const el = kader.current
    if (!el) return
    const meet = () => setVak(el.clientWidth)
    meet()
    const ro = new ResizeObserver(meet)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Bij zoom 1 bedekt de foto precies het vierkant
  const basis = maat && vak ? vak / Math.min(maat.b, maat.h) : 0
  const schaal = basis * zoom
  const breed = maat ? maat.b * schaal : 0
  const hoog = maat ? maat.h * schaal : 0

  /** Houdt de foto over het hele vierkant, zonder lege randen */
  const binnen = (v: { x: number; y: number }, b = breed, h = hoog) => {
    const mx = Math.max(0, (b - vak) / 2)
    const my = Math.max(0, (h - vak) / 2)
    return { x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) }
  }

  const zetZoom = (nieuw: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, nieuw))
    if (!maat) return
    const f = z / zoomNu.current
    zoomNu.current = z
    setZoom(z)
    // Het midden blijft het midden
    setVerschuiving((v) => binnen({ x: v.x * f, y: v.y * f }, maat.b * basis * z, maat.h * basis * z))
  }

  const neer = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    vingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    knijpAfstand.current = null
  }

  const beweeg = (e: React.PointerEvent) => {
    const vorige = vingers.current.get(e.pointerId)
    if (!vorige) return
    const nu = { x: e.clientX, y: e.clientY }
    vingers.current.set(e.pointerId, nu)
    if (vingers.current.size === 1) {
      setVerschuiving((v) => binnen({ x: v.x + nu.x - vorige.x, y: v.y + nu.y - vorige.y }))
    } else if (vingers.current.size === 2) {
      const [a, b] = [...vingers.current.values()]
      const afstand = Math.hypot(a.x - b.x, a.y - b.y)
      if (knijpAfstand.current) zetZoom(zoomNu.current * (afstand / knijpAfstand.current))
      knijpAfstand.current = afstand
    }
  }

  const los = (e: React.PointerEvent) => {
    vingers.current.delete(e.pointerId)
    knijpAfstand.current = null
  }

  // Scrollen met de muis (computer) zoomt ook; passive: false om de pagina niet te laten scrollen
  useEffect(() => {
    const el = kader.current
    if (!el) return
    const wiel = (e: WheelEvent) => {
      e.preventDefault()
      zetZoom(zoomNu.current * Math.exp(-e.deltaY / 400))
    }
    el.addEventListener('wheel', wiel, { passive: false })
    return () => el.removeEventListener('wheel', wiel)
  })

  const gebruik = async () => {
    if (!maat || !schaal) return
    setBezig(true)
    setFout(null)
    try {
      // Waar ligt het vierkant in de pixels van de foto?
      const links = vak / 2 - breed / 2 + verschuiving.x
      const boven = vak / 2 - hoog / 2 + verschuiving.y
      const zijde = vak / schaal
      const x = Math.min(maat.b - zijde, Math.max(0, -links / schaal))
      const y = Math.min(maat.h - zijde, Math.max(0, -boven / schaal))
      onKlaar(await snijUit(bestand, { x, y, zijde }))
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Deze foto lukt niet. Probeer een andere.')
      setBezig(false)
    }
  }

  return (
    <div className="bijsnijder">
      <p className="klein">Sleep om de foto te verplaatsen. Knijp of gebruik de schuif om in en uit te zoomen.</p>
      <div
        ref={kader}
        className="bijsnijder__kader"
        onPointerDown={neer}
        onPointerMove={beweeg}
        onPointerUp={los}
        onPointerCancel={los}
      >
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => setMaat({ b: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setFout('Dit bestand kan de app niet lezen. Kies een foto (JPEG of PNG).')}
            style={
              maat
                ? {
                    width: breed,
                    height: hoog,
                    transform: `translate(-50%, -50%) translate(${verschuiving.x}px, ${verschuiving.y}px)`,
                  }
                : { visibility: 'hidden' }
            }
          />
        )}
        <div className="bijsnijder__rondje" aria-hidden="true" />
      </div>

      <div className="bijsnijder__zoom">
        <button
          type="button"
          className="icoonknop"
          aria-label="Uitzoomen"
          onClick={() => zetZoom(zoomNu.current / 1.25)}
        >
          −
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => zetZoom(Number(e.target.value))}
        />
        <button
          type="button"
          className="icoonknop"
          aria-label="Inzoomen"
          onClick={() => zetZoom(zoomNu.current * 1.25)}
        >
          +
        </button>
      </div>

      {fout && <p className="melding melding--fout">{fout}</p>}
      <div className="dialoog__knoppen">
        <button type="button" className="knop knop--secundair" onClick={onAnnuleer} disabled={bezig}>
          Annuleren
        </button>
        <button type="button" className="knop knop--primair" onClick={() => void gebruik()} disabled={!maat || bezig}>
          {bezig ? 'Bezig…' : 'Gebruiken'}
        </button>
      </div>
    </div>
  )
}
