import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { Icoon } from '../components/Icoon'
import { Verbinding } from '../components/Verbinding'
import { useBackend } from '../lib/backend'
import { useData } from '../lib/data'
import { grooteLink, useFotos, verwijderFoto, type Foto } from '../lib/fotos'
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
  const { fotos, mislukt, meer, laadMeer } = useFotos(30, backend.status !== 'uit')
  const kamerLabel = useKamerLabel()
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="scherm fotomuur">
      <button type="button" className="tekstknop" onClick={terug}>
        ← Terug naar Spel
      </button>
      <h1>Fotomuur</h1>

      {backend.status === 'uit' ? (
        <p>Er is geen backend ingesteld, dus er is geen fotomuur.</p>
      ) : (
        <>
          <div className="kaartje klassement__status">
            <Verbinding />
            <p className="klein">Upload een foto als bewijs via het 📷-knopje bij een challenge.</p>
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
                      {f.klein ? <img src={f.klein} alt={`${f.challenge_titel} door ${f.naam}`} loading="lazy" /> : <span>📷</span>}
                    </button>
                    <p className="fotomuur__onderschrift">
                      <strong>{f.naam}</strong>
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

const minderBeweging = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Grote versies (tijdelijke links) die al zijn opgehaald, zodat terugswipen meteen werkt */
const grootGeheugen = new Map<string, string>()

/**
 * Foto's schermvullend bekijken. Swipe naar links of rechts (of gebruik de pijltjes) voor de
 * volgende of vorige foto, swipe omlaag om te sluiten. Met verwijderen voor de eigenaar en beheerders.
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
  const backend = useBackend()
  const [index, setIndex] = useState(start)
  const [, ververs] = useState(0)
  const [vragen, setVragen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  // Verschuiving tijdens het swipen, en of die geanimeerd terug of weg gaat
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [glijden, setGlijden] = useState(false)
  const vinger = useRef<{ x: number; y: number; t: number; richting: 'x' | 'y' | null } | null>(null)
  const gesleept = useRef(false)

  const i = Math.min(index, fotos.length - 1)
  const foto = fotos[i]
  const magVerwijderen = !!foto && (foto.user_id === backend.userId || backend.beheerder)

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

  const ga = useCallback(
    (richting: 1 | -1) => {
      const doel = i + richting
      if (doel < 0 || doel >= fotos.length) {
        // Geen foto meer die kant op: terugveren
        setGlijden(true)
        setDx(0)
        return
      }
      setFout(null)
      if (minderBeweging()) {
        setIndex(doel)
        setDx(0)
        return
      }
      const breedte = window.innerWidth
      setGlijden(true)
      setDx(-richting * breedte)
      window.setTimeout(() => {
        setGlijden(false)
        setIndex(doel)
        setDx(richting * breedte)
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setGlijden(true)
            setDx(0)
          }),
        )
      }, 180)
    },
    [i, fotos.length],
  )

  const sluit = useRef(onSluit)
  sluit.current = onSluit
  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sluit.current()
      if (e.key === 'ArrowRight') ga(1)
      if (e.key === 'ArrowLeft') ga(-1)
    }
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [ga])

  const neer = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .foto-groot__onder')) return
    vinger.current = { x: e.clientX, y: e.clientY, t: performance.now(), richting: null }
    gesleept.current = false
    setGlijden(false)
  }
  const beweeg = (e: React.PointerEvent) => {
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

  const verwijder = async () => {
    setVragen(false)
    const f = await verwijderFoto(foto)
    if (f) setFout(f)
    else onSluit()
  }

  return (
    <div
      className="foto-groot"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${i + 1} van ${fotos.length}: ${foto.challenge_titel}`}
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
      <button type="button" className="foto-groot__sluit" aria-label="Sluiten" onClick={onSluit}>
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
      <img
        key={foto.id}
        src={grootGeheugen.get(foto.id) ?? foto.klein}
        alt={`${foto.challenge_titel} door ${foto.naam}`}
        draggable={false}
        style={{
          aspectRatio: foto.breedte && foto.hoogte ? `${foto.breedte} / ${foto.hoogte}` : undefined,
          transform: `translate(${dx}px, ${dy}px)`,
          transition: glijden ? 'transform 0.18s ease-out' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="foto-groot__onder" onClick={(e) => e.stopPropagation()}>
        <p>
          <strong>{foto.naam}</strong>
          {foto.kamer && ` · kamer ${kamerLabel(foto.kamer)}`}
          <br />
          {foto.challenge_titel} · {wanneerGemaakt(foto.gemaakt)}
        </p>
        {magVerwijderen && (
          <button type="button" className="knop knop--gevaar knop--klein" onClick={() => setVragen(true)}>
            <Icoon naam="prullenbak" grootte={18} /> Verwijderen
          </button>
        )}
        {fout && <p className="melding melding--fout">{fout}</p>}
      </div>
      <BevestigDialoog
        open={vragen}
        titel="Foto verwijderen?"
        tekst={`De foto van ${foto.naam} bij "${foto.challenge_titel}" verdwijnt voor iedereen.`}
        bevestigLabel="Verwijderen"
        gevaarlijk
        onAnnuleer={() => setVragen(false)}
        onBevestig={() => void verwijder()}
      />
    </div>
  )
}
