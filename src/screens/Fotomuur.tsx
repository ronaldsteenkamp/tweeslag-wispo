import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SchermKop } from '../components/SchermKop'
import { useNieuweKoppen } from '../lib/nieuweKoppen'
import { Icoon } from '../components/Icoon'
import { Verbinding } from '../components/Verbinding'
import { useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { useData } from '../lib/data'
import { grooteLink, useFotos, type Foto } from '../lib/fotos'
import { useFotoWachtrij } from '../lib/fotowachtrij'
import { lees, schrijfEnMeld } from '../lib/opslag'
import { useTerugSluit } from '../lib/terugknop'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'

export function wanneerGemaakt(iso: string) {
  const d = new Date(iso)
  return datumISO(d) === datumISO(new Date()) ? `vandaag ${tijdUUMM(d)}` : `${datumLabel(datumISO(d), 'kort')} ${tijdUUMM(d)}`
}

/** Kamerlabel zoals elders in de app: '101 · Gletsjer' */
export function useKamerLabel() {
  const { data } = useData('kamers')
  return useMemo(() => {
    const m = new Map((data?.kamers ?? []).map((k) => [k.nummer, k.naam]))
    return (nr: string | null) => (nr ? `${nr}${m.get(nr) ? ` · ${m.get(nr)}` : ''}` : '')
  }, [data])
}

export default function Fotomuur({ terug }: { terug: () => void }) {
  const backend = useBackend()
  const nieuweKop = useNieuweKoppen()
  const { fotos, mislukt, meer, laadMeer } = useFotos(30, backend.status !== 'uit')
  const kamerLabel = useKamerLabel()
  const toon = useToonNaam()
  const [open, setOpen] = useState<number | null>(null)
  const wachtend = useFotoWachtrij()

  return (
    <div className="scherm fotomuur">
      {!nieuweKop && (
        <button type="button" className="tekstknop" onClick={terug}>
          ← Terug naar Spel
        </button>
      )}
      {nieuweKop ? <SchermKop titel="Fotomuur" ondertitel="Bewijsfoto's van de challenges" terug={{ label: 'Spel', onClick: terug }} /> : <h1>Fotomuur</h1>}

      {backend.status === 'uit' ? (
        <p>Er is geen backend ingesteld, dus er is geen fotomuur.</p>
      ) : (
        <>
          <div className="kaartje klassement__status">
            <Verbinding />
            <p className="klein">Upload een foto als bewijs via het 📷-knopje bij een challenge.</p>
            {wachtend > 0 && (
              <p className="klein">
                📤 {wachtend} {wachtend === 1 ? 'foto wacht' : "foto's wachten"} op bereik en {wachtend === 1 ? 'komt' : 'komen'}{' '}
                vanzelf op de muur.
              </p>
            )}
          </div>

          {!fotos ? (
            <p className="laadtekst">
              {mislukt || backend.status !== 'verbonden'
                ? 'Geen verbinding. De fotomuur laadt zodra er internet is.'
                : "Foto's laden…"}
            </p>
          ) : fotos.length === 0 ? (
            <p className="laadtekst">Nog geen foto&apos;s. Wie is de eerste?</p>
          ) : (
            <>
              {mislukt && <p className="melding">Geen verbinding. Nieuwe foto&apos;s verschijnen zodra er internet is.</p>}
              <ul className="fotomuur__raster">
                {fotos.map((f, i) => (
                  <li key={f.id}>
                    <button type="button" className="fotomuur__foto" onClick={() => setOpen(i)}>
                      {f.klein ? <img src={f.klein} alt={`${f.challenge_titel} door ${toon(f.naam)}`} loading="lazy" /> : <span>📷</span>}
                    </button>
                    <p className="fotomuur__onderschrift">
                      <strong>{toon(f.naam)}</strong>
                      {f.kamer && <span> · kamer {kamerLabel(f.kamer)}</span>}
                      <br />
                      {f.challenge_titel}
                      <small>{wanneerGemaakt(f.gemaakt)}</small>
                    </p>
                  </li>
                ))}
              </ul>
              {meer && (
                <button type="button" className="knop knop--secundair knop--breed" onClick={laadMeer}>
                  Meer foto&apos;s
                </button>
              )}
            </>
          )}
        </>
      )}

      {open !== null && fotos && (
        <FotoGroot
          fotos={fotos}
          start={open}
          kamerLabel={kamerLabel}
          onSluit={() => setOpen(null)}
          onBijnaAanHetEind={meer ? laadMeer : undefined}
        />
      )}
    </div>
  )
}

/** Opslagsleutel: id's van foto's die je groot hebt geopend */
export const GEZIEN = 'fotos.gezien'

const minderBeweging = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

interface Zoom {
  s: number
  x: number
  y: number
}
const GEEN_ZOOM: Zoom = { s: 1, x: 0, y: 0 }
const MAX_ZOOM = 4
const DUBBELTIK_ZOOM = 2.5
/** Hoe lang het doorschuiven naar de volgende foto duurt (ms) */
const BLADERTIJD = 200

/** Grote versies (tijdelijke links) die al zijn opgehaald, zodat terugswipen meteen werkt */
const grootGeheugen = new Map<string, string>()

/**
 * Foto's schermvullend bekijken. Swipe naar links of rechts (of gebruik de pijltjes) voor de
 * volgende of vorige foto, swipe omlaag om te sluiten. Inzoomen met knijpen, dubbeltikken of
 * scrollen (en + / -); ingezoomd sleep je de foto rond.
 */
export function FotoGroot({
  fotos,
  start,
  kamerLabel,
  onSluit,
  onBijnaAanHetEind,
}: {
  fotos: Foto[]
  start: number
  kamerLabel: (nr: string | null) => string
  onSluit: () => void
  /** Bijna bij de laatste foto: meer laden (als dat kan) */
  onBijnaAanHetEind?: () => void
}) {
  const toon = useToonNaam()
  const [index, setIndex] = useState(start)
  const [, ververs] = useState(0)
  // Verschuiving tijdens het swipen, en of die geanimeerd terug of weg gaat
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [glijden, setGlijden] = useState(false)
  const vinger = useRef<{ x: number; y: number; t: number; richting: 'x' | 'y' | null } | null>(null)
  const gesleept = useRef(false)
  const dialoog = useDialoogFocus<HTMLDivElement>()
  // Inzoomen. Ingezoomd sleep je de foto rond in plaats van te bladeren of te sluiten.
  const [zoom, setZoom] = useState<Zoom>(GEEN_ZOOM)
  const zoomNu = useRef(zoom)
  zoomNu.current = zoom
  const beeld = useRef<HTMLImageElement>(null)
  const vingers = useRef(new Map<number, { x: number; y: number }>())
  const knijp = useRef<{ afstand: number; zoom: Zoom; mx: number; my: number; cx: number; cy: number } | null>(null)
  const schuif = useRef<{ x: number; y: number; zoom: Zoom } | null>(null)
  const laatsteTik = useRef({ t: 0, x: 0, y: 0 })

  /** Midden van de foto op het scherm zonder verschuiving, en zijn maat zonder zoom */
  const midden = () => {
    const r = beeld.current?.getBoundingClientRect()
    const z = zoomNu.current
    return r ? { x: r.left + r.width / 2 - z.x, y: r.top + r.height / 2 - z.y, b: r.width / z.s, h: r.height / z.s } : null
  }

  /** Niet verder dan 4x, en niet zo ver schuiven dat er naast de foto leeg scherm komt */
  const begrens = (z: Zoom): Zoom => {
    const m = midden()
    const zs = Math.min(MAX_ZOOM, Math.max(1, z.s))
    if (!m || zs === 1) return GEEN_ZOOM
    const maxX = Math.max(0, (m.b * zs - window.innerWidth) / 2)
    const maxY = Math.max(0, (m.h * zs - window.innerHeight) / 2)
    return { s: zs, x: Math.min(maxX, Math.max(-maxX, z.x)), y: Math.min(maxY, Math.max(-maxY, z.y)) }
  }

  /** Zoomen tot `zs`, waarbij het punt (px, py) op het scherm op zijn plek blijft */
  const zoomRond = (zs: number, px: number, py: number) => {
    const m = midden()
    if (!m) return
    const z0 = zoomNu.current
    const qx = (px - m.x - z0.x) / z0.s
    const qy = (py - m.y - z0.y) / z0.s
    setZoom(begrens({ s: zs, x: px - m.x - zs * qx, y: py - m.y - zs * qy }))
  }

  const i = Math.min(index, fotos.length - 1)
  const foto = fotos[i]

  // Bijhouden welke foto's je groot bekeken hebt (voor "Nieuw" op Home). Rechtstreeks bewaren
  // en melden (één schrijfactie): met een eigen useOpgeslagen hier schreef het openen eerst de
  // beginwaarde weg en kon Home die daarna over de nieuwe lijst heen terugschrijven.
  const fotoId = foto?.id
  useEffect(() => {
    if (!fotoId) return
    const oud = lees<string[]>(GEZIEN, [])
    if (!oud.includes(fotoId)) schrijfEnMeld(GEZIEN, [fotoId, ...oud].slice(0, 1000))
  }, [fotoId])

  // Grote versie van deze foto en de buren alvast ophalen
  useEffect(() => {
    let actief = true
    for (const f of [fotos[i - 1], fotos[i], fotos[i + 1]]) {
      if (!f || grootGeheugen.has(f.id)) continue
      void grooteLink(f).then((u) => {
        if (!u) return
        grootGeheugen.set(f.id, u)
        new Image().src = u
        if (actief) ververs((n) => n + 1)
      })
    }
    return () => {
      actief = false
    }
  }, [i, fotos])

  // Bijna bij de laatste foto: één keer meer laden (niet bij elke render opnieuw)
  const bijnaEind = useRef(onBijnaAanHetEind)
  bijnaEind.current = onBijnaAanHetEind
  useEffect(() => {
    if (i >= fotos.length - 3) bijnaEind.current?.()
  }, [i, fotos.length])

  // Andere foto: weer helemaal in beeld
  useEffect(() => setZoom(GEEN_ZOOM), [i])

  // Scrollen (computer) zoomt rond de muis; de pagina erachter scrolt niet mee
  useEffect(() => {
    const el = dialoog.current
    if (!el) return
    const wiel = (e: WheelEvent) => {
      e.preventDefault()
      setGlijden(false)
      zoomRond(zoomNu.current.s * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', wiel, { passive: false })
    return () => el.removeEventListener('wheel', wiel)
  })

  // Een lopende bladeranimatie: bij een nieuwe veeg of klik meteen afronden, zodat je snel
  // achter elkaar kunt bladeren
  const lopend = useRef<{ doel: number; timer: number } | null>(null)
  const iNu = useRef(i)
  iNu.current = i
  const rondAf = useCallback(() => {
    const l = lopend.current
    if (!l) return
    window.clearTimeout(l.timer)
    lopend.current = null
    setGlijden(false)
    setIndex(l.doel)
    setDx(0)
    iNu.current = l.doel
  }, [])
  useEffect(() => () => window.clearTimeout(lopend.current?.timer), [])

  const ga = useCallback(
    (richting: 1 | -1) => {
      rondAf()
      const doel = iNu.current + richting
      if (doel < 0 || doel >= fotos.length) {
        // Geen foto meer die kant op: terugveren
        setGlijden(true)
        setDx(0)
        return
      }
      if (minderBeweging()) {
        setIndex(doel)
        setDx(0)
        return
      }
      // De buurfoto ligt precies één schermbreedte opzij: de hele baan schuift één plek op,
      // en dan wordt de buurfoto zonder sprong de huidige
      setGlijden(true)
      setDx(-richting * window.innerWidth)
      lopend.current = { doel, timer: window.setTimeout(rondAf, BLADERTIJD) }
    },
    [fotos.length, rondAf],
  )

  const sluit = useRef(onSluit)
  sluit.current = onSluit

  // Terugknop (Android, of terugvegen) sluit alleen de foto, niet de app
  useTerugSluit(true, onSluit)

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sluit.current()
      if (e.key === 'ArrowRight') ga(1)
      if (e.key === 'ArrowLeft') ga(-1)
      if (e.key === '+' || e.key === '=' || e.key === '-') {
        setGlijden(true)
        zoomRond(zoomNu.current.s * (e.key === '-' ? 1 / 1.5 : 1.5), window.innerWidth / 2, window.innerHeight / 2)
      }
    }
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [ga])

  const neer = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .foto-groot__onder')) return
    vingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // Nog aan het doorschuiven: meteen afronden, dan vanaf de nieuwe foto verder vegen
    rondAf()
    setGlijden(false)
    if (vingers.current.size === 2) {
      // Tweede vinger: knijpen (geen swipe meer)
      const [a, b] = [...vingers.current.values()]
      const m = midden()
      if (!m) return
      knijp.current = {
        afstand: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: zoomNu.current,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        cx: m.x,
        cy: m.y,
      }
      vinger.current = null
      schuif.current = null
      gesleept.current = true
      setDx(0)
      setDy(0)
      return
    }
    if (vingers.current.size > 2) return
    gesleept.current = false
    if (zoomNu.current.s > 1) {
      schuif.current = { x: e.clientX, y: e.clientY, zoom: zoomNu.current }
      return
    }
    vinger.current = { x: e.clientX, y: e.clientY, t: performance.now(), richting: null }
  }
  const beweeg = (e: React.PointerEvent) => {
    if (vingers.current.has(e.pointerId)) vingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const k = knijp.current
    if (k && vingers.current.size >= 2) {
      const [a, b] = [...vingers.current.values()]
      const zs = (k.zoom.s * Math.hypot(a.x - b.x, a.y - b.y)) / k.afstand
      // Het punt tussen je vingers blijft tussen je vingers
      const qx = (k.mx - k.cx - k.zoom.x) / k.zoom.s
      const qy = (k.my - k.cy - k.zoom.y) / k.zoom.s
      setZoom(begrens({ s: zs, x: (a.x + b.x) / 2 - k.cx - zs * qx, y: (a.y + b.y) / 2 - k.cy - zs * qy }))
      return
    }
    const p = schuif.current
    if (p) {
      const x = e.clientX - p.x
      const y = e.clientY - p.y
      if (Math.hypot(x, y) > 8) gesleept.current = true
      setZoom(begrens({ ...p.zoom, x: p.zoom.x + x, y: p.zoom.y + y }))
      return
    }
    const v = vinger.current
    if (!v) return
    const x = e.clientX - v.x
    const y = e.clientY - v.y
    // Pas na een paar pixels kiezen: opzij (bladeren) of omlaag (sluiten)
    if (!v.richting && Math.hypot(x, y) > 8) v.richting = Math.abs(x) > Math.abs(y) ? 'x' : 'y'
    if (v.richting) gesleept.current = true
    if (v.richting === 'x') setDx(x)
    if (v.richting === 'y') setDy(Math.max(0, y))
  }
  const los = (e: React.PointerEvent) => {
    vingers.current.delete(e.pointerId)
    if (knijp.current) {
      if (vingers.current.size < 2) {
        knijp.current = null
        // Bijna niet ingezoomd: netjes terug naar de hele foto
        if (zoomNu.current.s < 1.05) {
          setGlijden(true)
          setZoom(GEEN_ZOOM)
        }
      }
      return
    }
    if (schuif.current) {
      schuif.current = null
      return
    }
    const v = vinger.current
    vinger.current = null
    if (!v || !v.richting) return
    const x = e.clientX - v.x
    const snel = Math.abs(x) / Math.max(1, performance.now() - v.t) > 0.5
    if (v.richting === 'x' && (Math.abs(x) > window.innerWidth * 0.2 || (snel && Math.abs(x) > 30))) {
      ga(x < 0 ? 1 : -1)
    } else if (v.richting === 'y' && e.clientY - v.y > 120) {
      onSluit()
    } else {
      setGlijden(true)
      setDx(0)
      setDy(0)
    }
  }

  if (!foto) return null

  return (
    <div
      ref={dialoog}
      className="foto-groot"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${i + 1} van ${fotos.length}: ${foto.challenge_titel}. Knijp, dubbeltik of gebruik + en - om te zoomen.`}
      onClick={() => !gesleept.current && onSluit()}
      onPointerDown={neer}
      onPointerMove={beweeg}
      onPointerUp={los}
      onPointerCancel={los}
      style={{ opacity: dy ? Math.max(0.4, 1 - dy / 400) : undefined }}
    >
      <p className="foto-groot__teller" aria-hidden="true">
        {i + 1} / {fotos.length}
      </p>
      <button type="button" className="foto-groot__sluit" aria-label="Sluiten" onClick={onSluit} data-autofocus>
        <Icoon naam="kruis" />
      </button>
      {i > 0 && (
        <button
          type="button"
          className="foto-groot__pijl foto-groot__pijl--vorige"
          aria-label="Vorige foto"
          onClick={(e) => {
            e.stopPropagation()
            ga(-1)
          }}
        >
          ‹
        </button>
      )}
      {i < fotos.length - 1 && (
        <button
          type="button"
          className="foto-groot__pijl foto-groot__pijl--volgende"
          aria-label="Volgende foto"
          onClick={(e) => {
            e.stopPropagation()
            ga(1)
          }}
        >
          ›
        </button>
      )}
      <div className="foto-groot__baan">
      {/* Vorige en volgende foto liggen één schermbreedte opzij en schuiven mee met je vinger */}
      {([-1, 1] as const).map((kant) => {
        const buur = fotos[i + kant]
        if (!buur) return null
        return (
          // Een schermgroot vak, gecentreerd op de huidige foto, met de buur in het midden
          <div key={buur.id} className="foto-groot__rail" aria-hidden="true">
            <img
              src={grootGeheugen.get(buur.id) ?? buur.klein}
              alt=""
              draggable={false}
              style={{
                aspectRatio: buur.breedte && buur.hoogte ? `${buur.breedte} / ${buur.hoogte}` : undefined,
                transform: `translate(${dx + kant * window.innerWidth}px, ${dy}px)`,
                transition: glijden ? `transform ${BLADERTIJD}ms cubic-bezier(0.2, 0, 0, 1)` : 'none',
              }}
            />
          </div>
        )
      })}
      {/* Geen key per foto: hetzelfde element blijft staan, anders verliest een veeg die net
          begint (terwijl de vorige nog afrondt) zijn vinger */}
      <img
        ref={beeld}
        src={grootGeheugen.get(foto.id) ?? foto.klein}
        alt={`${foto.challenge_titel} door ${toon(foto.naam)}`}
        draggable={false}
        className={zoom.s > 1 ? 'is-ingezoomd' : undefined}
        style={{
          aspectRatio: foto.breedte && foto.hoogte ? `${foto.breedte} / ${foto.hoogte}` : undefined,
          transform: `translate(${dx + zoom.x}px, ${dy + zoom.y}px) scale(${zoom.s})`,
          transition: glijden ? `transform ${BLADERTIJD}ms cubic-bezier(0.2, 0, 0, 1)` : 'none',
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (gesleept.current) return
          // Dubbeltik: inzoomen op die plek, of terug naar de hele foto
          const nu = performance.now()
          const vorige = laatsteTik.current
          if (nu - vorige.t < 300 && Math.hypot(e.clientX - vorige.x, e.clientY - vorige.y) < 30) {
            laatsteTik.current = { t: 0, x: 0, y: 0 }
            setGlijden(true)
            if (zoomNu.current.s > 1) setZoom(GEEN_ZOOM)
            else zoomRond(DUBBELTIK_ZOOM, e.clientX, e.clientY)
          } else laatsteTik.current = { t: nu, x: e.clientX, y: e.clientY }
        }}
      />
      </div>
      <div className="foto-groot__onder" onClick={(e) => e.stopPropagation()}>
        <p>
          <strong>{toon(foto.naam)}</strong>
          {foto.kamer && ` · kamer ${kamerLabel(foto.kamer)}`}
          <br />
          {foto.challenge_titel} · {wanneerGemaakt(foto.gemaakt)}
        </p>
      </div>
    </div>
  )
}
