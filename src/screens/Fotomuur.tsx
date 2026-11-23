import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SchermKop } from '../components/SchermKop'
import { Icoon } from '../components/Icoon'
import { useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { useData, type Dag } from '../lib/data'
import { useKamerNaam } from '../lib/kamernamen'
import { alleFotos, downloadZip, grooteLink, momentVan, useFotos, zetJury, type Foto } from '../lib/fotos'
import { veiligeNaam } from '../lib/zip'
import { lokaalNaarDate } from '../lib/tijd'
import { gooiWeg, probeerOpnieuw, useFotoWachtrijLijst, type WachtendeFoto } from '../lib/fotowachtrij'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { useNu } from '../lib/nu'
import { lees, schrijfEnMeld } from '../lib/opslag'
import { StukjeSchrijven } from '../components/Bewijs'
import { useSpelGeluid } from '../lib/spelgeluid'
import { useGeplaatsteStukjes, useStukjesWachtrij, type Stukje } from '../lib/stukjes'
import { useTerugSluit } from '../lib/terugknop'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { useKlassement, type Klassement } from '../lib/scorebord'
import {
  kamerVanDeDag,
  kiesOpening,
  modules,
  opTijd,
  telling,
  uitsnijpunt,
  verdeel,
  verdeelStukjes,
  vorm,
  zaad,
  type Module,
} from '../lib/dagblad'
import '../styles/barlow.css'
import '../styles/fotomuur.css'
import '../styles/bewijs.css'

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
 * De Fotomuur als de Wispo-editie van het clubblad, in hetzelfde drukwerk als het Spel: papier,
 * navy inkt, lichtblauw en stempelrood. Opmaak "Dagblad" (gekozen uit mockups/clubblad-a.html):
 * elke reisdag is een voorpagina met een krantenkop, de Foto van de dag tot aan de schermrand en
 * het onderschrift als kop, daaronder kolommen met een kolomlijn, ingezonden stukjes tussen de
 * foto's, de kaders Kamer van de dag en De uitslag, en bij veel foto's de rubriek Gespot. Welke
 * foto's samen een blok vormen staat in lib/dagblad.ts; foto's mogen in het zetwerk bijgesneden
 * worden, groot zie je altijd de hele foto. Na de reis: het jaarboek. Opmaak in styles/fotomuur.css.
 */

/**
 * Alleen bij lokaal testen (`vite` of `--mode zonderbackend`): testdata uit window.__demoClubblad,
 * gezet door scripts/clubblad-demo.js. In de echte build is deze voorwaarde altijd onwaar en
 * valt de testdata eruit.
 */
interface DemoClubblad {
  fotos: Foto[]
  stukjes: Stukje[]
  wachtrij: WachtendeFoto[]
  klassement: Klassement | null
  beheerder: boolean
}
const DEMO: DemoClubblad | undefined =
  import.meta.env.DEV || import.meta.env.MODE === 'zonderbackend'
    ? (window as unknown as { __demoClubblad?: DemoClubblad }).__demoClubblad
    : undefined

interface Pagina {
  datum: string
  /** Reisdag (1-10) als de datum in de planning staat */
  nr: number | null
  titel: string
  opening: Foto
  rest: Foto[]
}

/**
 * Foto's per dag (nieuwste dag eerst). Binnen een dag op tijd, van de ochtend naar de avond;
 * opening = de Foto van de dag (zie kiesOpening in lib/dagblad.ts).
 */
function maakPaginas(fotos: Foto[], dagen: Dag[]): Pagina[] {
  const perDag = new Map<string, Foto[]>()
  for (const f of fotos) {
    const d = datumISO(momentVan(f))
    if (!perDag.has(d)) perDag.set(d, [])
    perDag.get(d)!.push(f)
  }
  return [...perDag].map(([datum, lijst]) => {
    const i = dagen.findIndex((d) => d.datum === datum)
    const opTijdLijst = opTijd(lijst)
    const opening = kiesOpening(opTijdLijst)!
    return {
      datum,
      nr: i < 0 ? null : i + 1,
      titel: i < 0 ? datumLabel(datum) : dagen[i].titel,
      opening,
      rest: opTijdLijst.filter((f) => f !== opening),
    }
  })
}

export default function Fotomuur({ terug, naarSpel, keuze }: { terug?: () => void; naarSpel: () => void; keuze?: ReactNode }) {
  const backend = useBackend()
  const echteFotos = useFotos(30, backend.status !== 'uit' && !DEMO)
  const { fotos, mislukt, meer, laadMeer } = DEMO ? { fotos: DEMO.fotos, mislukt: false, meer: false, laadMeer: () => {} } : echteFotos
  const { data: planning } = useData('planning')
  const nu = useNu(60_000)
  const kamerLabel = useKamerLabel()
  const echtWachtend = useFotoWachtrijLijst()
  const wachtend = DEMO ? DEMO.wachtrij : echtWachtend
  const [open, setOpen] = useState<{ lijst: Foto[]; i: number } | null>(null)
  const echteStukjes = useGeplaatsteStukjes(backend.status !== 'uit' && !DEMO)
  const stukjes = DEMO ? DEMO.stukjes : echteStukjes
  const echtKlassement = useKlassement(backend.status !== 'uit' && !DEMO).klassement
  const klassement = DEMO ? DEMO.klassement : echtKlassement
  const jury = backend.beheerder || !!DEMO?.beheerder
  const wachtendeStukjes = useStukjesWachtrij()
  const [schrijven, setSchrijven] = useState(false)
  const [geluid] = useSpelGeluid()
  const [bedankt, setBedankt] = useState<string | null>(null)

  const dagen = useMemo(() => planning?.dagen ?? [], [planning])
  const vandaagISO = datumISO(nu)
  const vandaagNr = dagen.findIndex((d) => d.datum === vandaagISO) + 1
  const laatsteDag = dagen[dagen.length - 1]?.datum
  const naDeReis = !!laatsteDag && vandaagISO > laatsteDag

  const paginas = useMemo(() => maakPaginas(fotos ?? [], dagen), [fotos, dagen])
  // Elke dag een blad: de foto's (als die er zijn) en daaronder de rubriek Ingezonden
  const bladen = useMemo(() => {
    const per = new Map<string, Stukje[]>()
    for (const s of stukjes ?? []) {
      const d = datumISO(new Date(s.gemaakt))
      per.set(d, [...(per.get(d) ?? []), s])
    }
    const datums = [...new Set([...paginas.map((p) => p.datum), ...per.keys()])].sort().reverse()
    return datums.map((datum) => {
      const i = dagen.findIndex((d) => d.datum === datum)
      return {
        datum,
        nr: i < 0 ? null : i + 1,
        titel: i < 0 ? datumLabel(datum) : dagen[i].titel,
        pagina: paginas.find((p) => p.datum === datum),
        // Oudste stukje bovenaan, zoals ze binnenkwamen
        stukjes: [...(per.get(datum) ?? [])].reverse(),
      }
    })
  }, [paginas, stukjes, dagen])
  const aantalStukjes = stukjes?.length ?? 0
  // Doorbladeren gaat op leesvolgorde: per pagina de Foto van de dag, dan de kolommen en Gespot
  // (het zetwerk houdt de volgorde van p.rest aan)
  const leesvolgorde = useMemo(() => paginas.flatMap((p) => [p.opening, ...p.rest]), [paginas])
  const openFoto = (f: Foto, lijst = leesvolgorde) => setOpen({ lijst, i: Math.max(0, lijst.indexOf(f)) })

  // Het clubblad open = alle foto's erin gezien: de teller op de tabbalk en "Nieuw" op Home gaan
  // weg zonder dat je elke foto hoeft aan te tikken. Alleen als het blad echt in beeld is: als
  // buurscherm (onzichtbaar klaargezet voor het vegen, class 'buurpaneel') telt het niet.
  const scherm = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const vak = scherm.current?.closest('.inhoud')
    if (!vak || !fotos?.length) return
    const ids = fotos.map((f) => f.id)
    const kijk = () => {
      if (!vak.classList.contains('buurpaneel') && document.visibilityState === 'visible') markeerGezien(ids)
    }
    kijk()
    // Een buurscherm wordt bij het vegen het huidige scherm (zelfde element, andere class)
    const mo = new MutationObserver(kijk)
    mo.observe(vak, { attributes: true, attributeFilter: ['class'] })
    document.addEventListener('visibilitychange', kijk)
    return () => {
      mo.disconnect()
      document.removeEventListener('visibilitychange', kijk)
    }
  }, [fotos])

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
    naarSpel()
  }

  const verbonden = backend.status === 'verbonden' && !!backend.gekoppeld
  const fotoDag = (f: Foto) => {
    const d = datumISO(momentVan(f))
    const i = dagen.findIndex((x) => x.datum === d)
    return i < 0 ? datumLabel(d, 'kort') : `Pag. ${i + 1} · ${dagen[i].titel}`
  }

  return (
    <div className="scherm fotomuur" ref={scherm}>
      <SchermKop
        titel="Clubblad"
        boven="G.S.B.V. Tweeslag"
        ondertitel={naDeReis ? 'Jaarboek Wispo 2027' : `Wispo-editie${vandaagNr ? ` nr. ${vandaagNr}` : ''} · ${datumLabel(vandaagISO)}`}
        terug={terug ? { label: 'Terug', onClick: terug } : undefined}
      >
        {keuze}
      </SchermKop>

      {backend.status === 'uit' && !DEMO ? (
        <p className="fotomuur__tekst">Het clubblad is in deze versie niet gekoppeld.</p>
      ) : (
        <>
          <div className="fotomuur__naam">
            <p className="fotomuur__caps">
              {naDeReis
                ? 'Les Deux Alpes · 5 – 14 maart 2027'
                : fotos?.length || aantalStukjes
                  ? `${telling(fotos?.length ?? 0, aantalStukjes).replace(/^(\d+)/, meer ? '$1+' : '$1')} in het blad`
                  : 'Bewijs van de challenges'}
            </p>
            {!naDeReis && (fotos?.length !== 0 || aantalStukjes > 0) && (
              <span className="fotomuur__knoppen">
                <button type="button" className="fotomuur__knop" onClick={naarChallenges} aria-label="Foto inzenden bij een challenge">
                  <Icoon naam="camera" grootte={20} /> Foto
                </button>
                {stukjes !== null && (
                  <button type="button" className="fotomuur__knop fotomuur__knop--licht" onClick={() => setSchrijven(true)} aria-label="Stukje insturen voor de rubriek Ingezonden">
                    <Icoon naam="potlood" grootte={20} /> Stukje
                  </button>
                )}
              </span>
            )}
          </div>
          {wachtendeStukjes.length > 0 && (
            <p className="fotomuur__melding" role="status">
              {wachtendeStukjes.length === 1 ? 'Je stukje ligt' : `${wachtendeStukjes.length} stukjes liggen`} klaar voor de post en
              {wachtendeStukjes.length === 1 ? ' gaat' : ' gaan'} vanzelf zodra er bereik is.
            </p>
          )}
          {bedankt && (
            <p className="fotomuur__melding" role="status">
              {bedankt}
            </p>
          )}

          <TerPerse wachtend={wachtend} verbonden={verbonden} />

          {mislukt && fotos && <p className="fotomuur__melding">Geen verbinding. Nieuwe foto&apos;s verschijnen zodra er internet is.</p>}

          {!fotos ? (
            <p className="fotomuur__tekst">
              {mislukt || backend.status !== 'verbonden' ? 'Geen verbinding. Het blad laadt zodra er internet is.' : 'Het blad wordt gedrukt…'}
            </p>
          ) : fotos.length === 0 && !aantalStukjes ? (
            <section className="fotomuur__leeg">
              <h2>
                Deze editie
                <br />
                is nog leeg.
              </h2>
              <p>
                Stuur een kiekje in bij een challenge. Zodra de redactie het plaatst, staat het hier: elke reisdag een voorpagina.
              </p>
              <button type="button" className="fotomuur__knop" onClick={naarChallenges}>
                <Icoon naam="camera" grootte={20} /> Eerste foto inzenden
              </button>
              {stukjes !== null && (
                <button type="button" className="fotomuur__knop fotomuur__knop--licht" onClick={() => setSchrijven(true)}>
                  <Icoon naam="potlood" grootte={20} /> Of schrijf een stukje
                </button>
              )}
              <Colofon />
            </section>
          ) : (
            <>
              {naDeReis && <Jaarboek paginas={paginas} dagen={dagen} meer={meer} onOpen={openFoto} />}
              {bladen.map((blad, i) => (
                <Voorpagina
                  key={blad.datum}
                  {...blad}
                  // De uitslag alleen op de pagina van vandaag: de server kent geen stand per dag
                  stand={i === 0 && blad.datum === vandaagISO ? (klassement?.personen ?? []).slice(0, 3) : []}
                  kamerLabel={kamerLabel}
                  onOpen={(f) => openFoto(f)}
                />
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

      {schrijven && (
        <StukjeSchrijven
          challenge={null}
          geluid={geluid}
          onSluit={() => setSchrijven(false)}
          onKlaar={(later) => {
            setSchrijven(false)
            setBedankt(later ? 'Je stukje ligt klaar voor de post.' : 'Ter perse. De redactie leest je stukje vanavond.')
            window.setTimeout(() => setBedankt(null), 6000)
          }}
        />
      )}
      {open && (
        <FotoGroot
          fotos={open.lijst}
          start={open.i}
          kamerLabel={kamerLabel}
          kop={fotoDag}
          extra={(f) => <JuryKnop key={f.id} foto={f} jury={jury} />}
          onSluit={() => setOpen(null)}
          onBijnaAanHetEind={meer && open.lijst === leesvolgorde ? laadMeer : undefined}
        />
      )}
    </div>
  )
}

/**
 * Een foto op de muur als knop; de alt-tekst noemt wie, wanneer en welke challenge. Het vak heeft
 * vooraf een vaste maat (de verhouding van de foto, of `snij`), zodat niets verspringt tijdens het
 * laden. Met `snij` wordt de foto bijgesneden, bij staande foto's vanaf de bovenkant.
 */
function FotoKnop({
  foto: f,
  onOpen,
  groot,
  snij,
  stempel = true,
}: {
  foto: Foto
  onOpen: () => void
  groot?: string | null
  snij?: string
  stempel?: boolean
}) {
  const toon = useToonNaam()
  const d = momentVan(f)
  const eigen = f.breedte && f.hoogte ? `${f.breedte} / ${f.hoogte}` : undefined
  return (
    <button type="button" className="fotomuur__foto" onClick={onOpen} style={{ aspectRatio: snij ?? eigen }}>
      {f.jury && stempel && (
        <span className="fotomuur__jury" aria-hidden="true">
          Jurykeuze
        </span>
      )}
      {f.klein ? (
        <img
          src={groot ?? f.klein}
          alt={`Foto van ${toon(f.naam)}, ${datumLabel(datumISO(d))} ${tijdUUMM(d)}, challenge ${f.challenge_titel}${f.jury ? ', jurykeuze' : ''}`}
          width={f.breedte ?? undefined}
          height={f.hoogte ?? undefined}
          loading="lazy"
          decoding="async"
          style={snij ? { objectPosition: uitsnijpunt(f) } : undefined}
        />
      ) : (
        <span className="fotomuur__leegvlak" role="img" aria-label={`Foto van ${toon(f.naam)} (nog niet geladen)`} />
      )}
    </button>
  )
}

type KamerLabel = (nr: string | null) => string

/**
 * Eén reisdag als voorpagina. Leesvolgorde (ook voor schermlezers): krantenkop → Foto van de dag →
 * de kolommen, met de ingezonden stukjes op hun plek tussen de foto's → Kamer van de dag → Gespot →
 * De uitslag. Rubrieken staan er alleen als er inhoud voor is.
 */
function Voorpagina({
  datum,
  nr,
  titel,
  pagina: p,
  stukjes,
  stand,
  kamerLabel,
  onOpen,
}: {
  datum: string
  nr: number | null
  titel: string
  pagina?: Pagina
  stukjes: Stukje[]
  stand: { naam: string; totaal: number }[]
  kamerLabel: KamerLabel
  onOpen: (f: Foto) => void
}) {
  const toon = useToonNaam()
  const { kolom, gespot } = verdeel(p?.rest ?? [])
  const mods = modules(kolom, zaad(datum))
  const { quote, brieven } = verdeelStukjes(stukjes)
  const kamer = p ? kamerVanDeDag([p.opening, ...p.rest]) : null
  const aantalFotos = p ? p.rest.length + 1 : 0

  // Tussen de modules: de quote na de eerste, brieven na de vierde, Kamer van de dag na de zesde
  const tussen = new Map<number, ReactNode[]>()
  const zet = (na: number, n: ReactNode) => {
    const plek = Math.min(na, mods.length)
    tussen.set(plek, [...(tussen.get(plek) ?? []), n])
  }
  if (quote) zet(1, <Quote key={`q-${quote.id}`} stukje={quote} kamerLabel={kamerLabel} />)
  for (const s of brieven) zet(4, <Brief key={`b-${s.id}`} stukje={s} kamerLabel={kamerLabel} />)
  if (kamer)
    zet(
      6,
      <aside key="kamer" className="dagblad__kader" aria-label="Kamer van de dag">
        <span className="fotomuur__caps">Kamer van de dag</span>
        <h3>{kamerLabel(kamer.kamer)}</h3>
        <p>{kamer.aantal} foto&apos;s in het blad vandaag.</p>
        <div className="dagblad__drie">
          {kamer.fotos.slice(0, 3).map((f) => (
            <FotoKnop key={f.id} foto={f} snij="1 / 1" stempel={false} onOpen={() => onOpen(f)} />
          ))}
        </div>
      </aside>,
    )

  return (
    <article id={`pagina-${datum}`} className="fotomuur__pagina dagblad" aria-labelledby={`kop-${datum}`}>
      <header className="dagblad__kop">
        <p className="dagblad__datumregel fotomuur__caps">
          <span>{nr ? `Reisdag ${nr}` : 'Buiten de reis'}</span>
          <span>{datumLabel(datum)}</span>
        </p>
        <h2 id={`kop-${datum}`}>{titel}</h2>
        <p className="dagblad__sub fotomuur__caps">{telling(aantalFotos, stukjes.length)}</p>
      </header>
      {p && <Opening foto={p.opening} kamerLabel={kamerLabel} onOpen={() => onOpen(p.opening)} />}
      {tussen.get(0)}
      {mods.map((m, i) => (
        <ModuleBlok key={m.fotos[0].id} m={m} kamerLabel={kamerLabel} onOpen={onOpen} na={tussen.get(i + 1)} />
      ))}
      {gespot.length > 0 && (
        <section className="dagblad__mod" aria-label={`Gespot, ${gespot.length} foto's`}>
          <span className="dagblad__rubriek">Gespot · {gespot.length}</span>
          <div className="dagblad__gespot">
            {gespot.map((f) => (
              <FotoKnop key={f.id} foto={f} snij="1 / 1" onOpen={() => onOpen(f)} />
            ))}
          </div>
        </section>
      )}
      {stand.length > 0 && (
        <aside className="dagblad__kader" aria-label="De uitslag">
          <span className="fotomuur__caps">De uitslag · stand van vandaag</span>
          <ol className="dagblad__stand">
            {stand.map((s) => (
              <li key={s.naam}>
                {toon(s.naam)}
                <span aria-hidden="true" />
                {s.totaal}
              </li>
            ))}
          </ol>
        </aside>
      )}
      <p className="dagblad__folio fotomuur__caps">Clubblad Tweeslag · Wispo 2027{nr ? ` · pag. ${nr}` : ''}</p>
    </article>
  )
}

/** Eén blok uit het zetwerk (zie modules() in lib/dagblad.ts), met wat er direct na komt */
function ModuleBlok({ m, kamerLabel, onOpen, na }: { m: Module<Foto>; kamerLabel: KamerLabel; onOpen: (f: Foto) => void; na?: ReactNode }) {
  const toon = useToonNaam()
  const onderschrift = (f: Foto) => f.onderschrift && <p className="dagblad__onderschrift">“{f.onderschrift}”</p>
  let blok: ReactNode
  if (m.soort === 'pano') {
    const f = m.fotos[0]
    blok = (
      <figure className="dagblad__mod dagblad__rand">
        <FotoKnop foto={f} onOpen={() => onOpen(f)} />
        <figcaption className="dagblad__onder">
          <b>{f.challenge_titel}</b> · {toon(f.naam)} · {tijdUUMM(momentVan(f))}
        </figcaption>
        {onderschrift(f)}
      </figure>
    )
  } else if (m.soort === 'duo') {
    blok = (
      <div className="dagblad__mod dagblad__duo">
        {m.fotos.map((f) => (
          <figure key={f.id}>
            <FotoKnop foto={f} snij={m.snij} onOpen={() => onOpen(f)} />
            <figcaption className="dagblad__onder">
              <b>{toon(f.naam)}</b> · {tijdUUMM(momentVan(f))}
            </figcaption>
            {onderschrift(f)}
          </figure>
        ))}
      </div>
    )
  } else {
    const f = m.fotos[0]
    blok = (
      <figure className={`dagblad__mod dagblad__zij${m.om ? ' dagblad__zij--om' : ''}${vorm(f) === 'liggend' ? '' : ' dagblad__zij--staand'}`}>
        <FotoKnop foto={f} snij={m.snij} onOpen={() => onOpen(f)} />
        <figcaption className="dagblad__kolom">
          <span className="dagblad__kolomkop">{f.challenge_titel}</span>
          {onderschrift(f)}
          <span className="dagblad__onder">
            {toon(f.naam)}
            {f.kamer ? ` · kamer ${kamerLabel(f.kamer)}` : ''} · {tijdUUMM(momentVan(f))}
          </span>
        </figcaption>
      </figure>
    )
  }
  return (
    <>
      {blok}
      {na}
    </>
  )
}

/** Een kort ingezonden stukje als grote quote tussen de foto's */
function Quote({ stukje: s, kamerLabel }: { stukje: Stukje; kamerLabel: KamerLabel }) {
  const toon = useToonNaam()
  return (
    <figure className="dagblad__quote">
      <span className="dagblad__rubriek dagblad__rubriek--rood">Ingezonden</span>
      <blockquote>{s.tekst}</blockquote>
      <figcaption className="fotomuur__caps">
        — {toon(s.naam)}
        {s.kamer ? `, kamer ${kamerLabel(s.kamer)}` : ''}
        {s.challenge_titel ? ` · bij ${s.challenge_titel}` : ''}
      </figcaption>
    </figure>
  )
}

/** Een langer ingezonden stukje als brief; lang = in twee kolommen met een kolomlijn */
function Brief({ stukje: s, kamerLabel }: { stukje: Stukje; kamerLabel: KamerLabel }) {
  const toon = useToonNaam()
  return (
    <figure className={`dagblad__brief${s.tekst.length > 220 ? ' dagblad__brief--lang' : ''}`}>
      <span className="fotomuur__caps">Ingezonden{s.challenge_titel ? ` · bij ${s.challenge_titel}` : ''}</span>
      <blockquote>{s.tekst}</blockquote>
      <figcaption className="fotomuur__caps">
        — {toon(s.naam)}
        {s.kamer ? `, kamer ${kamerLabel(s.kamer)}` : ''} · {tijdUUMM(new Date(s.gemaakt))}
      </figcaption>
    </figure>
  )
}

/**
 * Foto van de dag: tot aan de schermrand (scherpe versie zodra die binnen is), het onderschrift
 * als kop en anders de challenge. Een staande foto wordt hier 4:5 (vanaf de bovenkant), zodat hij
 * niet meer dan een scherm hoog is; groot zie je hem heel.
 */
function Opening({ foto: f, kamerLabel, onOpen }: { foto: Foto; kamerLabel: KamerLabel; onOpen: () => void }) {
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
    <section className="dagblad__opening" aria-label="Foto van de dag">
      <span className={`dagblad__rubriek${f.jury ? ' dagblad__rubriek--rood' : ''}`}>
        {f.jury ? 'Foto van de dag · jurykeuze' : 'Foto van de dag'}
      </span>
      <figure>
        <div className="dagblad__rand">
          <FotoKnop foto={f} onOpen={onOpen} groot={groot} stempel={false} snij={vorm(f) === 'staand' ? '4 / 5' : undefined} />
        </div>
        <figcaption>
          {f.onderschrift ? <h3 className="dagblad__quotekop">“{f.onderschrift}”</h3> : <h3>{f.challenge_titel}</h3>}
          <p className="fotomuur__byline">
            {f.onderschrift ? `${f.challenge_titel} · ` : ''}Foto: {toon(f.naam)}
            {f.kamer ? ` · kamer ${kamerLabel(f.kamer)}` : ''} · {tijdUUMM(momentVan(f))}
          </p>
        </figcaption>
      </figure>
    </section>
  )
}

/** Foto's die nog op deze telefoon staan en op bereik wachten */
/** Tekst op de stempel van een wachtende foto */
function persStempel(w: WachtendeFoto, verbonden: boolean) {
  if (w.bezig) return 'Wordt gedrukt…'
  if (w.vast) return 'Niet gelukt'
  if (!verbonden) return 'Wacht op bereik'
  return w.pogingen ? 'Opnieuw in de rij' : 'Bijna aan de beurt'
}

function TerPerse({ wachtend, verbonden }: { wachtend: WachtendeFoto[]; verbonden: boolean }) {
  const [weg, setWeg] = useState<WachtendeFoto | null>(null)
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
                {persStempel(w, verbonden)}
              </span>
              {w.vast && (
                <>
                  {w.fout && <p className="fotomuur__klein">{w.fout}</p>}
                  <div className="fotomuur__perskeuze">
                    <button type="button" className="fotomuur__knop" onClick={() => void probeerOpnieuw(w.id)}>
                      <Icoon naam="herstel" grootte={18} /> Opnieuw
                    </button>
                    <button type="button" className="fotomuur__knop fotomuur__knop--licht" onClick={() => setWeg(w)}>
                      Weggooien
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!verbonden ? (
        <p className="fotomuur__klein">Je foto&apos;s liggen veilig op je telefoon en gaan vanzelf naar de drukker zodra er bereik is.</p>
      ) : (
        wachtend.some((w) => w.vast) && (
          <p className="fotomuur__klein">Een foto die niet lukt blijft hier staan tot jij kiest: nog een keer, of weg.</p>
        )
      )}
      <BevestigDialoog
        open={!!weg}
        titel="Foto weggooien?"
        tekst={`De foto voor "${weg?.titel ?? ''}" staat alleen op deze telefoon. Weg is weg.`}
        bevestigLabel="Weggooien"
        gevaarlijk
        onAnnuleer={() => setWeg(null)}
        onBevestig={() => {
          if (weg) void gooiWeg(weg.id)
          setWeg(null)
        }}
      />
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

/**
 * In de grote foto: de stempel als de jury hem koos, en voor beheerders (de jury) de knop om hem
 * te geven of af te nemen. De server geeft de maker er 10 punten voor (migratie 0017).
 */
function JuryKnop({ foto, jury }: { foto: Foto; jury: boolean }) {
  const toon = useToonNaam()
  const [aan, setAan] = useState(!!foto.jury)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  if (!jury && !aan) return null
  const wissel = async () => {
    setBezig(true)
    setFout(null)
    const f = await zetJury(foto, !aan)
    setBezig(false)
    if (f) setFout(f)
    else setAan(!aan)
  }
  return (
    <div className="foto-groot__jury">
      {aan && <span className="fotomuur__stempel">Jurykeuze · +10 voor {toon(foto.naam)}</span>}
      {jury && (
        <button type="button" className="fotomuur__knop fotomuur__knop--licht" onClick={() => void wissel()} disabled={bezig} aria-pressed={aan}>
          <Icoon naam={aan ? 'kruis' : 'stempel'} grootte={18} /> {bezig ? 'Bezig…' : aan ? 'Stempel eraf' : 'Jurykeuze geven'}
        </button>
      )}
      {fout && (
        <p className="fotomuur__klein" role="alert">
          {fout}
        </p>
      )}
    </div>
  )
}

/** Volgende kalenderdag, 'JJJJ-MM-DD' */
const volgendeDag = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

/** Na de reis: omslag met vier foto's (jurykeuzes voorop), de inhoudsopgave en alles downloaden */
function Jaarboek({ paginas, dagen, meer, onOpen }: { paginas: Pagina[]; dagen: Dag[]; meer: boolean; onOpen: (f: Foto, lijst: Foto[]) => void }) {
  const toon = useToonNaam()
  const [bezig, setBezig] = useState<{ wat: string; klaar: number; totaal: number } | null>(null)
  const [melding, setMelding] = useState<string | null>(null)
  const openingen = paginas.filter((p) => p.nr).map((p) => p.opening)
  // Omslag als voorpagina: tot drie Foto's van de dag (jurykeuzes voorop), de eerste groot
  const omslag = [...openingen.filter((f) => f.jury), ...openingen.filter((f) => !f.jury)].slice(0, 3)
  const aantal = paginas.reduce((n, p) => n + p.rest.length + 1, 0)
  const metFotos = new Set(paginas.map((p) => p.datum))

  /** Map in de zip: 'Dag 3 Skidag 1' (of de datum, buiten de reis) */
  const mapVan = (f: Foto) => {
    const d = datumISO(momentVan(f))
    const i = dagen.findIndex((x) => x.datum === d)
    return veiligeNaam(i < 0 ? d : `Dag ${i + 1} ${dagen[i].titel}`)
  }
  const naamVan = (f: Foto) =>
    `${mapVan(f)}/${tijdUUMM(momentVan(f)).replace(':', '.')} ${veiligeNaam(toon(f.naam), 30)} - ${veiligeNaam(f.challenge_titel, 50)}.jpg`

  const download = async (dag?: { d: Dag; nr: number }) => {
    if (bezig) return
    const wat = dag ? `Dag ${dag.nr}` : "Alle foto's"
    setMelding(null)
    setBezig({ wat, klaar: 0, totaal: 0 })
    try {
      const fotos = dag
        ? await alleFotos(lokaalNaarDate(`${dag.d.datum}T00:00`), lokaalNaarDate(`${volgendeDag(dag.d.datum)}T00:00`))
        : await alleFotos()
      if (!fotos.length) {
        setMelding('Geen foto’s gevonden.')
        return
      }
      setBezig({ wat, klaar: 0, totaal: fotos.length })
      const zipNaam = veiligeNaam(dag ? `Wispo 2027 - Dag ${dag.nr} ${dag.d.titel}` : "Wispo 2027 - alle foto's", 80) + '.zip'
      const { mislukt } = await downloadZip(fotos, zipNaam, naamVan, (klaar, totaal) => setBezig({ wat, klaar, totaal }))
      setMelding(
        mislukt
          ? `Klaar: ${fotos.length - mislukt} foto’s. ${mislukt} lukte${mislukt === 1 ? '' : 'n'} niet; probeer het straks nog eens.`
          : `Klaar: ${fotos.length} foto’s in ${zipNaam}.`,
      )
    } catch (e) {
      setMelding(`Downloaden lukte niet: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBezig(null)
    }
  }

  return (
    <section className="fotomuur__jaarboek">
      <h2>
        Jaarboek
        <br />
        Wispo 2027
      </h2>
      {omslag.length > 0 && (
        <div className={`fotomuur__omslag fotomuur__omslag--${omslag.length}`}>
          {omslag.map((f, i) => (
            <FotoKnop key={f.id} foto={f} snij={omslag.length === 1 ? undefined : i === 0 && omslag.length === 3 ? undefined : '1 / 1'} onOpen={() => onOpen(f, omslag)} />
          ))}
        </div>
      )}
      <p>
        {aantal}
        {meer ? '+' : ''} foto&apos;s op {metFotos.size} pagina&apos;s. Bewaar ze zelf: download alles in één keer of per
        dag (gewone JPEG&apos;s in een zip, ± 0,3 MB per foto). Op wifi gaat het het snelst.
      </p>
      <div className="fotomuur__download">
        <button type="button" className="fotomuur__knop" onClick={() => void download()} disabled={!!bezig}>
          <Icoon naam="download" grootte={20} /> Alle foto&apos;s (zip)
        </button>
        <p className="fotomuur__klein" role="status" aria-live="polite">
          {bezig
            ? bezig.totaal
              ? `${bezig.wat}: ${bezig.klaar} van ${bezig.totaal} ingepakt…`
              : `${bezig.wat}: foto's opzoeken…`
            : melding}
        </p>
      </div>
      <ol className="fotomuur__inhoud">
        {dagen.map((d, i) => (
          <li key={d.datum}>
            {metFotos.has(d.datum) ? (
              <>
                <a
                  href={`#pagina-${d.datum}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(`pagina-${d.datum}`)?.scrollIntoView()
                  }}
                >
                  <b>{d.titel}</b>
                  <span aria-hidden="true" />
                  <span className="fotomuur__caps">pag. {i + 1}</span>
                </a>
                <button
                  type="button"
                  className="fotomuur__inhoud-download"
                  onClick={() => void download({ d, nr: i + 1 })}
                  disabled={!!bezig}
                  aria-label={`Foto's van dag ${i + 1}, ${d.titel}, downloaden`}
                >
                  <Icoon naam="download" grootte={20} />
                </button>
              </>
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

/**
 * Opslagsleutel: id's van foto's die je gezien hebt (het clubblad geopend, of de foto groot
 * geopend). Niet meer gezien = "Nieuw" op Home en de teller op de tabbalk.
 */
export const GEZIEN = 'fotos.gezien'

/**
 * Zet foto's op gezien (nieuwste voorop, max. 1000 onthouden). Rechtstreeks lezen en melden (één
 * schrijfactie): met een eigen useOpgeslagen kon een scherm een oude lijst terugschrijven.
 */
export function markeerGezien(ids: string[]) {
  const oud = lees<string[]>(GEZIEN, [])
  const bekend = new Set(oud)
  const nieuw = ids.filter((id) => !bekend.has(id))
  if (nieuw.length) schrijfEnMeld(GEZIEN, [...nieuw, ...oud].slice(0, 1000))
}

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
  extra,
  onSluit,
  onBijnaAanHetEind,
}: {
  fotos: Foto[]
  start: number
  kamerLabel: (nr: string | null) => string
  /** Tekst linksboven (anders 'foto 3 van 12') */
  kop?: (f: Foto) => string
  /** Extra onder het onderschrift (bijv. de jurykeuze) */
  extra?: (f: Foto) => ReactNode
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
    if (fotoId) markeerGezien([fotoId])
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
        {foto.onderschrift && <p className="foto-groot__onderschrift">“{foto.onderschrift}”</p>}
        <p className="foto-groot__byline">
          Foto: {toon(foto.naam)}
          {foto.kamer && ` · kamer ${kamerLabel(foto.kamer)}`} · {wanneerGemaakt(momentVan(foto).toISOString())}
        </p>
        {extra?.(foto)}
      </div>
    </div>
  )
}
