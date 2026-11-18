import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SchermKop } from '../components/SchermKop'
import { Icoon } from '../components/Icoon'
import { useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { useData, type Dag } from '../lib/data'
import { useKamerNaam } from '../lib/kamernamen'
import { grooteLink, useFotos, type Foto } from '../lib/fotos'
import { useFotoWachtrijLijst, type WachtendeFoto } from '../lib/fotowachtrij'
import { useNu } from '../lib/nu'
import { lees, schrijfEnMeld } from '../lib/opslag'
import { useTerugSluit } from '../lib/terugknop'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import '../styles/barlow.css'
import '../styles/fotomuur.css'

export function wanneerGemaakt(iso: string) {
  const d = new Date(iso)
  return datumISO(d) === datumISO(new Date()) ? `vandaag ${tijdUUMM(d)}` : `${datumLabel(datumISO(d), 'kort')} ${tijdUUMM(d)}`
}

/** Kamerlabel zoals elders in de app: '101 · Gletsjer' */
export function useKamerLabel() {
  const { data } = useData('kamers')
  const naamVanKamer = useKamerNaam()
  return useMemo(() => {
    const m = new Map((data?.kamers ?? []).map((k) => [k.nummer, naamVanKamer(k)]))
    return (nr: string | null) => (nr ? `${nr}${m.get(nr) ? ` · ${m.get(nr)}` : ''}` : '')
  }, [data, naamVanKamer])
}

/*
 * De Fotomuur als de Wispo-editie van het clubblad (gekozen uit mockups/fotomuur-c.html), in
 * hetzelfde drukwerk als het Spel: papier, navy inkt, lichtblauw en stempelrood. Elke reisdag is
 * een pagina met een openingsfoto en de challenge als kop, daaronder wisselend zetwerk (foto's
 * mogen daar bijgesneden worden; groot zie je altijd de hele foto). Na de reis: het jaarboek.
 * Opmaak in styles/fotomuur.css.
 */

/** Breder dan dit = panorama: altijd over de hele breedte */
const PANORAMA = 2.2
const verhouding = (f: Foto) => (f.breedte && f.hoogte ? f.breedte / f.hoogte : 4 / 3)

interface Pagina {
  datum: string
  /** Reisdag (1-10) als de datum in de planning staat */
  nr: number | null
  titel: string
  opening: Foto
  rest: Foto[]
}

/** Foto's per dag (nieuwste dag eerst); de openingsfoto is de nieuwste liggende foto */
function maakPaginas(fotos: Foto[], dagen: Dag[]): Pagina[] {
  const perDag = new Map<string, Foto[]>()
  for (const f of fotos) {
    const d = datumISO(new Date(f.gemaakt))
    if (!perDag.has(d)) perDag.set(d, [])
    perDag.get(d)!.push(f)
  }
  return [...perDag].map(([datum, lijst]) => {
    const i = dagen.findIndex((d) => d.datum === datum)
    const opening = lijst.find((f) => verhouding(f) >= 1 && verhouding(f) < PANORAMA) ?? lijst[0]
    return {
      datum,
      nr: i < 0 ? null : i + 1,
      titel: i < 0 ? datumLabel(datum) : dagen[i].titel,
      opening,
      rest: lijst.filter((f) => f !== opening),
    }
  })
}

/** Zetwerk: panorama's breed, de rest in blokken (groot + twee klein, drie naast elkaar, twee naast elkaar) */
function zetwerk(fotos: Foto[]): { soort: 'a' | 'b' | 'c' | 'enkel' | 'panorama'; fotos: Foto[] }[] {
  const uit: ReturnType<typeof zetwerk> = []
  let patroon = 0
  let gewoon: Foto[] = []
  const blokken = () => {
    while (gewoon.length) {
      const soort = (['a', 'b', 'c'] as const)[patroon++ % 3]
      const deel = gewoon.splice(0, soort === 'c' ? 2 : 3)
      uit.push({ soort: deel.length === 1 ? 'enkel' : deel.length === 2 ? 'c' : soort, fotos: deel })
    }
  }
  for (const f of fotos) {
    if (verhouding(f) >= PANORAMA) {
      blokken()
      uit.push({ soort: 'panorama', fotos: [f] })
    } else gewoon.push(f)
  }
  blokken()
  gewoon = []
  return uit
}

export default function Fotomuur({ terug }: { terug: () => void }) {
  const backend = useBackend()
  const { fotos, mislukt, meer, laadMeer } = useFotos(30, backend.status !== 'uit')
  const { data: planning } = useData('planning')
  const nu = useNu(60_000)
  const kamerLabel = useKamerLabel()
  const toon = useToonNaam()
  const wachtend = useFotoWachtrijLijst()
  const [open, setOpen] = useState<{ lijst: Foto[]; i: number } | null>(null)

  const dagen = useMemo(() => planning?.dagen ?? [], [planning])
  const vandaagISO = datumISO(nu)
  const vandaagNr = dagen.findIndex((d) => d.datum === vandaagISO) + 1
  const laatsteDag = dagen[dagen.length - 1]?.datum
  const naDeReis = !!laatsteDag && vandaagISO > laatsteDag

  const paginas = useMemo(() => maakPaginas(fotos ?? [], dagen), [fotos, dagen])
  // Doorbladeren gaat op leesvolgorde: per pagina de opening en dan het zetwerk
  const leesvolgorde = useMemo(() => paginas.flatMap((p) => [p.opening, ...zetwerk(p.rest).flatMap((b) => b.fotos)]), [paginas])
  const openFoto = (f: Foto, lijst = leesvolgorde) => setOpen({ lijst, i: Math.max(0, lijst.indexOf(f)) })

  // Oudere pagina's laden zodra je onderaan komt (geen knop nodig, wel als terugval)
  const onderkant = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = onderkant.current
    if (!el || !meer || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && laadMeer(), { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [meer, laadMeer, fotos?.length])

  // Inzenden gaat altijd bij een challenge: naar de challenges in het Spel
  const naarChallenges = () => {
    schrijfEnMeld('spel.onderdeel', 'challenges')
    terug()
  }

  const verbonden = backend.status === 'verbonden' && !!backend.gekoppeld
  const fotoDag = (f: Foto) => {
    const d = datumISO(new Date(f.gemaakt))
    const i = dagen.findIndex((x) => x.datum === d)
    return i < 0 ? datumLabel(d, 'kort') : `Pag. ${i + 1} · ${dagen[i].titel}`
  }

  return (
    <div className="scherm fotomuur">
      <SchermKop
        titel="Fotomuur"
        boven="G.S.B.V. Tweeslag"
        ondertitel={naDeReis ? 'Jaarboek Wispo 2027' : `Wispo-editie${vandaagNr ? ` nr. ${vandaagNr}` : ''} · ${datumLabel(vandaagISO)}`}
        terug={{ label: 'Spel', onClick: terug }}
      />

      {backend.status === 'uit' ? (
        <p className="fotomuur__tekst">Er is geen backend ingesteld, dus er is geen fotomuur.</p>
      ) : (
        <>
          <div className="fotomuur__naam">
            <p className="fotomuur__caps">
              {naDeReis
                ? 'Les Deux Alpes · 5 – 14 maart 2027'
                : fotos?.length
                  ? `${fotos.length}${meer ? '+' : ''} foto's in het blad`
                  : 'Bewijs van de challenges'}
            </p>
            {!naDeReis && fotos?.length !== 0 && (
              <button type="button" className="fotomuur__knop" onClick={naarChallenges} aria-label="Foto inzenden bij een challenge">
                <Icoon naam="camera" grootte={20} /> Inzenden
              </button>
            )}
          </div>

          <TerPerse wachtend={wachtend} verbonden={verbonden} />

          {mislukt && fotos && <p className="fotomuur__melding">Geen verbinding. Nieuwe foto&apos;s verschijnen zodra er internet is.</p>}

          {!fotos ? (
            <p className="fotomuur__tekst">
              {mislukt || backend.status !== 'verbonden' ? 'Geen verbinding. Het blad laadt zodra er internet is.' : 'Het blad wordt gedrukt…'}
            </p>
          ) : fotos.length === 0 ? (
            <section className="fotomuur__leeg">
              <h2>
                Deze editie
                <br />
                is nog leeg.
              </h2>
              <p>
                De redactie, dat zijn jullie, zit klaar. Alles wat je instuurt voor een challenge komt in het blad, per dag een
                pagina.
              </p>
              <button type="button" className="fotomuur__knop" onClick={naarChallenges}>
                <Icoon naam="camera" grootte={20} /> Eerste foto inzenden
              </button>
              <Colofon />
            </section>
          ) : (
            <>
              {naDeReis && <Jaarboek paginas={paginas} dagen={dagen} onOpen={openFoto} />}
              {paginas.map((p) => (
                <article key={p.datum} id={`pagina-${p.datum}`} className="fotomuur__pagina" aria-labelledby={`kop-${p.datum}`}>
                  <header className="fotomuur__paginakop">
                    <h2 id={`kop-${p.datum}`}>
                      <small className="fotomuur__caps">
                        {p.nr ? `Pag. ${p.nr} · ` : ''}
                        {datumLabel(p.datum)}
                      </small>
                      {p.titel}
                    </h2>
                    <span className="fotomuur__caps">
                      {p.rest.length + 1} {p.rest.length ? "foto's" : 'foto'}
                    </span>
                  </header>
                  <Opening foto={p.opening} kamerLabel={kamerLabel} onOpen={() => openFoto(p.opening)} />
                  {zetwerk(p.rest).map((b) =>
                    b.soort === 'panorama' ? (
                      <figure key={b.fotos[0].id} className="fotomuur__panorama">
                        <FotoKnop foto={b.fotos[0]} onOpen={() => openFoto(b.fotos[0])} />
                        <figcaption className="fotomuur__byline">
                          {b.fotos[0].challenge_titel} · {toon(b.fotos[0].naam)} · {tijdUUMM(new Date(b.fotos[0].gemaakt))}
                        </figcaption>
                      </figure>
                    ) : (
                      <div key={b.fotos[0].id} className={`fotomuur__zet fotomuur__zet--${b.soort}`}>
                        {b.fotos.map((f) => (
                          <figure key={f.id} className="fotomuur__stuk">
                            <FotoKnop foto={f} onOpen={() => openFoto(f)} />
                            <figcaption>
                              <b>{toon(f.naam)}</b> · {tijdUUMM(new Date(f.gemaakt))}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ),
                  )}
                </article>
              ))}
              <div ref={onderkant} />
              {meer ? (
                <button type="button" className="fotomuur__knop fotomuur__knop--licht fotomuur__meer" onClick={laadMeer}>
                  Oudere pagina&apos;s
                </button>
              ) : (
                <p className="fotomuur__caps fotomuur__einde">{naDeReis ? 'Einde van het jaarboek' : '— einde van deze editie —'}</p>
              )}
            </>
          )}
        </>
      )}

      {open && (
        <FotoGroot
          fotos={open.lijst}
          start={open.i}
          kamerLabel={kamerLabel}
          kop={fotoDag}
          onSluit={() => setOpen(null)}
          onBijnaAanHetEind={meer && open.lijst === leesvolgorde ? laadMeer : undefined}
        />
      )}
    </div>
  )
}

/** Een foto op de muur als knop; de alt-tekst noemt wie, wanneer en welke challenge */
function FotoKnop({ foto: f, onOpen, groot }: { foto: Foto; onOpen: () => void; groot?: string | null }) {
  const toon = useToonNaam()
  const d = new Date(f.gemaakt)
  return (
    <button type="button" className="fotomuur__foto" onClick={onOpen}>
      {f.klein ? (
        <img
          src={groot ?? f.klein}
          alt={`Foto van ${toon(f.naam)}, ${datumLabel(datumISO(d))} ${tijdUUMM(d)}, challenge ${f.challenge_titel}`}
          width={f.breedte ?? undefined}
          height={f.hoogte ?? undefined}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="fotomuur__leegvlak" role="img" aria-label={`Foto van ${toon(f.naam)} (nog niet geladen)`} />
      )}
    </button>
  )
}

/** De openingsfoto van een pagina: groot (scherpe versie), met de challenge als kop */
function Opening({ foto: f, kamerLabel, onOpen }: { foto: Foto; kamerLabel: (nr: string | null) => string; onOpen: () => void }) {
  const toon = useToonNaam()
  const [groot, setGroot] = useState<string | null>(() => grootGeheugen.get(f.id) ?? null)
  useEffect(() => {
    let actief = true
    if (grootGeheugen.has(f.id)) setGroot(grootGeheugen.get(f.id)!)
    else
      void grooteLink(f).then((u) => {
        if (!u) return
        grootGeheugen.set(f.id, u)
        // Pas wisselen als hij binnen is, zodat de kleine versie niet even verdwijnt
        const img = new Image()
        img.src = u
        img.decode().then(
          () => actief && setGroot(u),
          () => {},
        )
      })
    return () => {
      actief = false
    }
  }, [f])
  return (
    <figure className="fotomuur__opening">
      <FotoKnop foto={f} onOpen={onOpen} groot={groot} />
      <h3>{f.challenge_titel}</h3>
      <p className="fotomuur__byline">
        Foto: {toon(f.naam)}
        {f.kamer ? ` · kamer ${kamerLabel(f.kamer)}` : ''} · {tijdUUMM(new Date(f.gemaakt))}
      </p>
    </figure>
  )
}

/** Foto's die nog op deze telefoon staan en op bereik wachten */
function TerPerse({ wachtend, verbonden }: { wachtend: WachtendeFoto[]; verbonden: boolean }) {
  if (!wachtend.length) return null
  return (
    <section className="fotomuur__pers" aria-live="polite" aria-labelledby="ter-perse">
      <h2 id="ter-perse">Ter perse · {wachtend.length}</h2>
      <ul>
        {wachtend.map((w) => (
          <li key={w.id}>
            <img src={w.klein} alt="" />
            <div>
              <p>{w.titel}</p>
              <span className={`fotomuur__stempel${w.bezig ? ' fotomuur__stempel--blauw' : ''}`}>
                {w.bezig ? 'Wordt gedrukt…' : !verbonden ? 'Wacht op bereik' : w.pogingen ? 'Opnieuw in de rij' : 'Bijna aan de beurt'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {!verbonden && (
        <p className="fotomuur__klein">Je foto&apos;s liggen veilig op je telefoon en gaan vanzelf naar de drukker zodra er bereik is.</p>
      )}
    </section>
  )
}

function Colofon() {
  return (
    <div className="fotomuur__colofon">
      <span className="fotomuur__caps">Colofon</span>
      <p>
        Alleen te zien in deze app. Foto van jezelf liever niet in het blad? Zeg het tegen de organisatie, dan halen we hem
        eraf.
      </p>
    </div>
  )
}

/** Na de reis: omslag met vier foto's (elk van een andere dag) en de inhoudsopgave */
function Jaarboek({ paginas, dagen, onOpen }: { paginas: Pagina[]; dagen: Dag[]; onOpen: (f: Foto, lijst: Foto[]) => void }) {
  const omslag = paginas
    .filter((p) => p.nr)
    .map((p) => p.opening)
    .filter((_, i, l) => i % Math.max(1, Math.floor(l.length / 4)) === 0)
    .slice(0, 4)
  const aantal = paginas.reduce((n, p) => n + p.rest.length + 1, 0)
  const metFotos = new Set(paginas.map((p) => p.datum))
  return (
    <section className="fotomuur__jaarboek">
      {omslag.length === 4 && (
        <div className="fotomuur__omslag">
          {omslag.map((f) => (
            <FotoKnop key={f.id} foto={f} onOpen={() => onOpen(f, omslag)} />
          ))}
        </div>
      )}
      <h2>
        Jaarboek
        <br />
        Wispo 2027
      </h2>
      <p>
        {aantal} foto&apos;s op {metFotos.size} pagina&apos;s.
      </p>
      <ol className="fotomuur__inhoud">
        {dagen.map((d, i) => (
          <li key={d.datum}>
            {metFotos.has(d.datum) ? (
              <a href={`#pagina-${d.datum}`} onClick={(e) => {
                e.preventDefault()
                document.getElementById(`pagina-${d.datum}`)?.scrollIntoView()
              }}>
                <b>{d.titel}</b>
                <span aria-hidden="true" />
                <span className="fotomuur__caps">pag. {i + 1}</span>
              </a>
            ) : (
              <span className="fotomuur__inhoud-leeg">
                <b>{d.titel}</b>
                <span aria-hidden="true" />
                <span className="fotomuur__caps">geen foto&apos;s</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
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
  kop,
  onSluit,
  onBijnaAanHetEind,
}: {
  fotos: Foto[]
  start: number
  kamerLabel: (nr: string | null) => string
  /** Tekst linksboven (anders 'foto 3 van 12') */
  kop?: (f: Foto) => string
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
        {kop ? kop(foto) : `Foto ${i + 1} van ${fotos.length}`}
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
          <Icoon naam="links" grootte={28} />
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
          <Icoon naam="rechts" grootte={28} />
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
        <p className="foto-groot__kop">{foto.challenge_titel}</p>
        <p className="foto-groot__byline">
          Foto: {toon(foto.naam)}
          {foto.kamer && ` · kamer ${kamerLabel(foto.kamer)}`} · {wanneerGemaakt(foto.gemaakt)}
        </p>
      </div>
    </div>
  )
}
