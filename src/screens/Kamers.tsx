import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { NaamKiezer, useAlleNamen } from '../components/NaamKiezer'
import { openMijnProfiel, toonProfiel } from '../components/Profiel'
import { SchermKop } from '../components/SchermKop'
import { useNieuweKoppen } from '../lib/nieuweKoppen'
import { config } from '../config'
import { useData, type Kamer } from '../lib/data'
import { useToonNaam } from '../lib/bijnamen'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { opsomming, plaatsKamers, verdiepingen, verdiepingNaam, type Plek } from '../lib/kamerligging'
import { kamernaamFout, MAX_KAMERNAAM } from '../lib/kamernaamregels'
import { slaKamernaamOp, useEigenKamernamen, useKamerNaam } from '../lib/kamernamen'
import { useOpgeslagen } from '../lib/opslag'
import { profielBestaatVoor, sleutel, useMijnProfiel, useProfielen, useProfielFoto } from '../lib/profiel'
import { useTerugSluit } from '../lib/terugknop'
import '../styles/barlow.css'
import '../styles/kamers.css'

/*
 * Kamers als smoelenboek (richting D uit mockups/kamers-d.html, in de stijl van het Smoelenboek):
 * per appartement een bladzijde met de naam als kop en de portretten in clubkleuren. Jouw
 * appartement staat bovenaan en groter (2 × 2); de andere appartementen zijn één rij van vier.
 */

export default function Kamers({ naarVerdelen, naarBeheer, keuze }: { naarVerdelen: () => void; naarBeheer: () => void; keuze?: ReactNode }) {
  const { data, fout } = useData('kamers')
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const nieuweKop = useNieuweKoppen()
  const alleNamen = useAlleNamen(data)
  const toon = useToonNaam()
  const kamerNaamVan = useKamerNaam()
  const [open, setOpen] = useState<string | null>(null)
  // Het appartement dat je het laatst gezien hebt, om een verhuizing te melden (alleen op deze telefoon)
  const [gezien, setGezien] = useOpgeslagen<{ naam: string; nummer: string } | null>('kamers.gezien', null)

  const plekken = useMemo(() => plaatsKamers(data?.kamers ?? []), [data])
  const naamBekend = naam !== null && alleNamen.includes(naam)
  const mijn = (naamBekend && plekken.find((p) => p.kamer.bewoners.includes(naam))) || null
  const mijnNummer = mijn?.kamer.nummer ?? null

  // Eerste keer (of een andere naam): onthouden zonder melding
  useEffect(() => {
    if (naam && mijnNummer && gezien?.naam !== naam) setGezien({ naam, nummer: mijnNummer })
  }, [naam, mijnNummer, gezien, setGezien])

  const isReisleiding = naam !== null && config.reisleiding.includes(naam)

  if (!data) {
    return (
      <div className="scherm">
        {nieuweKop ? <SchermKop titel="Appartementen">{keuze}</SchermKop> : <h1>Kamers</h1>}
        <DataStatus fout={fout} />
      </div>
    )
  }

  // Alleen als je nog geen naam hebt (of hij niet meer in de kamerlijst staat). Een andere naam
  // kiezen kan hier niet: dat gaat via je naam op Home (Jouw profiel → Andere naam kiezen).
  if (!naamBekend) {
    return (
      <div className="scherm">
        {nieuweKop ? <SchermKop titel="Wie ben jij?" boven="Groep">{keuze}</SchermKop> : <h1>Wie ben jij?</h1>}
        <p>
          {naam !== null
            ? 'Je naam staat niet meer in de kamerlijst. Kies hem opnieuw.'
            : 'Kies je naam, dan zie je meteen waar je slaapt.'}{' '}
          Dit wordt alleen op deze telefoon bewaard.
        </p>
        <NaamKiezer
          namen={alleNamen}
          onKies={(n) => {
            setNaam(n)
            window.scrollTo(0, 0)
            if (!profielBestaatVoor(n)) openMijnProfiel()
          }}
        />
      </div>
    )
  }

  const ctx: Ctx = { jij: naam, mijn, toon, kamerNaamVan }
  const genoten = mijn ? mijn.kamer.bewoners.filter((b) => b !== naam).map(toon) : []
  const kopZin = mijn
    ? `Je slaapt in ${titelVan(mijn, ctx)}${genoten.length ? `, met ${opsomming(genoten)}` : ''}.`
    : 'Je staat nog niet in het boekje.'
  const verhuisdVan = mijn && gezien?.naam === naam && gezien.nummer !== mijn.kamer.nummer ? gezien.nummer : null
  const lagen = verdiepingen(plekken)
  const meerLagen = lagen.length > 1
  const andere = plekken.filter((p) => p !== mijn)
  const geopend = plekken.find((p) => p.kamer.nummer === open) ?? null
  const mensen = plekken.reduce((s, p) => s + p.kamer.bewoners.length, 0) + data.zonderKamer.length
  const vrij = plekken.reduce((s, p) => s + p.vrij, 0)

  return (
    <div className="scherm ks">
      <Duotoon />
      {nieuweKop ? (
        <SchermKop titel="Appartementen" boven={config.bestemming} ondertitel={kopZin}>
          {keuze}
        </SchermKop>
      ) : (
        <>
          <h1>Kamers</h1>
          <p className="ondertitel">{kopZin}</p>
        </>
      )}

      {verhuisdVan && mijn && (
        <div className="ks-rectificatie" role="status">
          <span className="ks-klein">Rectificatie</span>
          <p>
            Eerder stond je in {verhuisdVan}. Dat klopt niet meer: je slaapt voortaan in <b>{titelVan(mijn, ctx)}</b>
            {kamerNaamVan(mijn.kamer) ? ` (${mijn.kamer.nummer})` : ''}
            {genoten.length ? `, bij ${opsomming(genoten)}` : ''}.
          </p>
          <button type="button" onClick={() => setGezien({ naam, nummer: mijn.kamer.nummer })}>
            Gelezen
          </button>
        </div>
      )}

      {mijn ? (
        <Bladzijde plek={mijn} ctx={ctx} meerLagen={meerLagen} onOpen={setOpen}>
          <KamernaamVeld kamer={mijn.kamer} kamers={data.kamers} />
        </Bladzijde>
      ) : (
        <section className="ks-wit" aria-labelledby="ks-wit-kop">
          <span className="ks-klein">Jouw bladzijde</span>
          <h2 id="ks-wit-kop">Nog wit</h2>
          <p>De reisleiding is nog aan het puzzelen. Zodra jij een bed hebt, sta je hier met je huisgenoten.</p>
        </section>
      )}

      {plekken.length > 0 && (
        <>
          <p className="ks-lead">
            {mensen} {mensen === 1 ? 'mens' : 'mensen'} in {plekken.length} {plekken.length === 1 ? 'appartement' : 'appartementen'}
            {vrij > 0 ? `, ${vrij === 1 ? 'één bed' : `${vrij} bedden`} nog vrij` : ''}.
          </p>
          <nav className="ks-register" aria-label="Naar appartement">
            {plekken.map((p) => (
              <button
                type="button"
                key={p.kamer.nummer}
                className={p === mijn ? 'is-jouw' : undefined}
                onClick={() => document.getElementById(`ks-${p.kamer.nummer}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                aria-label={`Naar ${titelVan(p, ctx)}${kamerNaamVan(p.kamer) ? `, appartement ${p.kamer.nummer}` : ''}`}
              >
                {p.kamer.nummer}
              </button>
            ))}
          </nav>
        </>
      )}

      {meerLagen
        ? lagen.map((v) => {
            const hier = andere.filter((p) => p.verdieping === v)
            if (!hier.length) return null
            return (
              <div key={String(v)} className="ks-laag">
                <h2 className="ks-verdieping">{v === null ? 'Overige' : verdiepingNaam(v)}</h2>
                {hier.map((p) => (
                  <Bladzijde key={p.kamer.nummer} plek={p} ctx={ctx} meerLagen={meerLagen} onOpen={setOpen} />
                ))}
              </div>
            )
          })
        : andere.map((p) => <Bladzijde key={p.kamer.nummer} plek={p} ctx={ctx} meerLagen={meerLagen} onOpen={setOpen} />)}

      {data.zonderKamer.length > 0 && (
        <section className="ks-blz" aria-labelledby="ks-zonder-kop">
          <h2 className="ks-zonderkop" id="ks-zonder-kop">
            Nog niet ingedeeld
          </h2>
          <ul className="ks-smoelen">
            {data.zonderKamer.map((n) => (
              <Smoel key={n} naam={n} ctx={ctx} />
            ))}
          </ul>
        </section>
      )}

      <p className="ks-voet">
        <Icoon naam="offline" grootte={18} />
        Staat ook zonder wifi op je telefoon.
      </p>

      {isReisleiding && (
        <div className="ks-reisleiding">
          <button type="button" className="knop knop--secundair knop--breed" onClick={naarVerdelen}>
            <Icoon naam="kamers" grootte={20} /> Kamerverdeling maken (reisleiding)
          </button>
          <button type="button" className="knop knop--secundair knop--breed" onClick={naarBeheer}>
            <Icoon naam="slot" grootte={20} /> Beheer (reisleiding)
          </button>
        </div>
      )}

      {geopend && <KamerBlad plek={geopend} ctx={ctx} onSluit={() => setOpen(null)} />}
    </div>
  )
}

interface Ctx {
  jij: string
  mijn: Plek | null
  toon: (n: string) => string
  kamerNaamVan: (k: Kamer) => string | undefined
}

const titelVan = (p: Plek, ctx: Ctx) => ctx.kamerNaamVan(p.kamer) ?? `Appartement ${p.kamer.nummer}`

/** Volledige omschrijving voor schermlezers */
function omschrijving(p: Plek, ctx: Ctx) {
  const naam = ctx.kamerNaamVan(p.kamer)
  const wie = p.kamer.bewoners.map((b) => (b === ctx.jij ? `${ctx.toon(b)} (jij)` : ctx.toon(b)))
  return `${naam ? `${naam}, appartement ${p.kamer.nummer}` : `Appartement ${p.kamer.nummer}`}${p === ctx.mijn ? ', jouw appartement' : ''}${p.verdieping !== null ? `, ${verdiepingNaam(p.verdieping)}` : ''}. ${wie.length ? opsomming(wie) : 'Nog leeg'}${p.vrij ? `, ${p.vrij} ${p.vrij === 1 ? 'bed' : 'bedden'} vrij` : ''}. Bekijk het appartement.`
}

/**
 * De duotoonfilter: elke foto in clubkleuren (navy → ijsblauw), zoals in het smoelenboek.
 * Gamma 1.6 (was 2.6): bij 2.6 werden middentinten, zoals een gezicht, bijna egaal donkerblauw.
 */
function Duotoon() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="ks-duo" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="gamma" exponent="1.6" />
          <feFuncG type="gamma" exponent="1.6" />
          <feFuncB type="gamma" exponent="1.6" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.05 0.87" />
          <feFuncG type="table" tableValues="0 0.945" />
          <feFuncB type="table" tableValues="0.345 0.97" />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}

// ---------- Een bladzijde per appartement ----------

function NummerRegel({ plek, ctx, meerLagen }: { plek: Plek; ctx: Ctx; meerLagen: boolean }) {
  const jouw = plek === ctx.mijn
  // Bij meer verdiepingen staat de verdieping al als tussenkop boven de andere appartementen
  const laag = plek.verdieping !== null && (jouw || !meerLagen) ? ` · ${verdiepingNaam(plek.verdieping)}` : ''
  return (
    <span className="ks-nr">
      {jouw && 'Jouw appartement · '}
      <b>{plek.kamer.nummer}</b>
      {laag}
    </span>
  )
}

function Bladzijde({
  plek,
  ctx,
  meerLagen,
  onOpen,
  children,
}: {
  plek: Plek
  ctx: Ctx
  meerLagen: boolean
  onOpen: (nummer: string) => void
  children?: ReactNode
}) {
  const jouw = plek === ctx.mijn
  return (
    <section className={`ks-blz${jouw ? ' ks-blz--jouw' : ''}`} id={`ks-${plek.kamer.nummer}`} aria-label={titelVan(plek, ctx)}>
      <button type="button" className="ks-kop" onClick={() => onOpen(plek.kamer.nummer)} aria-label={omschrijving(plek, ctx)}>
        <span>
          <NummerRegel plek={plek} ctx={ctx} meerLagen={meerLagen} />
          <span className="ks-naam">{titelVan(plek, ctx)}</span>
        </span>
        <Icoon naam="rechts" grootte={20} />
      </button>
      <Smoelen plek={plek} ctx={ctx} />
      {children}
    </section>
  )
}

function Smoelen({ plek, ctx, voorTik }: { plek: Plek; ctx: Ctx; voorTik?: () => void }) {
  return (
    <ul className="ks-smoelen">
      {plek.kamer.bewoners.map((b) => (
        <Smoel key={b} naam={b} ctx={ctx} voorTik={voorTik} />
      ))}
      {Array.from({ length: plek.vrij }, (_, i) => (
        <li key={`vrij${i}`} className="ks-smoel is-vrij">
          <span className="ks-beeld">
            <Icoon naam="kamers" grootte={26} />
          </span>
          <span className="ks-smoel__naam">bed vrij</span>
        </li>
      ))}
    </ul>
  )
}

/** Eén portret. Tik = het spelerskaartje. */
function Smoel({ naam, ctx, voorTik }: { naam: string; ctx: Ctx; voorTik?: () => void }) {
  const { perNaam } = useProfielen()
  const mijnProfiel = useMijnProfiel()
  const jij = naam === ctx.jij
  const rij = perNaam.get(sleutel(naam))
  const url = useProfielFoto(jij ? (mijnProfiel?.foto ?? null) : (rij?.foto_pad ?? null), jij ? (mijnProfiel?.fotoLokaal ?? null) : null)
  const getoond = ctx.toon(naam)
  return (
    <li className={`ks-smoel${jij ? ' is-jij' : ''}`}>
      <button
        type="button"
        onClick={() => {
          voorTik?.()
          toonProfiel(naam)
        }}
        aria-label={`${naam}${getoond !== naam ? `, ${getoond}` : ''}${jij ? ', jij' : ''}. Bekijk het plaatje.`}
      >
        <span className="ks-beeld">
          {url ? (
            <img src={url} alt="" />
          ) : (
            <>
              <b>{getoond.charAt(0).toUpperCase()}</b>
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M0 22L22 8 36 18 58 2 76 16 100 8V40H0Z" fill="#087f9e" />
                <path d="M0 32C30 26 60 32 100 28V40H0Z" fill="#dff1f8" />
              </svg>
            </>
          )}
        </span>
        <span className="ks-smoel__naam">{getoond}</span>
        {jij && <span className="ks-smoel__jij">jij</span>}
      </button>
    </li>
  )
}

// ---------- Eén appartement van dichtbij ----------

function KamerBlad({ plek, ctx, onSluit }: { plek: Plek; ctx: Ctx; onSluit: () => void }) {
  const venster = useDialoogFocus<HTMLDivElement>(true)
  useTerugSluit(true, onSluit)
  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSluit()
    }
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [onSluit])

  // Naar body, zodat het vegen tussen tabs (transform op de inhoud) het venster niet meeneemt
  return createPortal(
    <div className="dialoog-achtergrond" onClick={onSluit}>
      <div
        ref={venster}
        className="dialoog dialoog--hoog ks-blad"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ks-blad-titel"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ks-blad__sluit" onClick={onSluit} aria-label="Sluiten">
          <Icoon naam="kruis" />
        </button>
        <h2 id="ks-blad-titel" className="ks-blad__kop">
          <NummerRegel plek={plek} ctx={ctx} meerLagen={false} />
          <span className="ks-naam">{titelVan(plek, ctx)}</span>
        </h2>
        <Smoelen plek={plek} ctx={ctx} voorTik={onSluit} />
        {plek.vrij > 0 && plek !== ctx.mijn && (
          <p className="ks-stil">Er is nog plek. Wil je verhuizen? Vraag het de reisleiding: dat blijft tussen jullie.</p>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------- Naam van je appartement ----------

/**
 * De bewoners passen zelf de naam van hun appartement aan. Leeg laten = weer de naam van de reisleiding.
 * Opslaan kan alleen met internet; de server controleert of je echt in dit appartement slaapt.
 */
function KamernaamVeld({ kamer, kamers }: { kamer: Kamer; kamers: Kamer[] }) {
  const eigen = useEigenKamernamen()
  const huidig = useKamerNaam()(kamer) ?? ''
  const [open, setOpen] = useState(false)
  const [tekst, setTekst] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const controle = kamernaamFout(tekst, kamer.nummer, kamers, eigen)

  const openen = () => {
    setTekst(huidig)
    setFout(null)
    setOpen(true)
  }

  const bewaar = async (e: FormEvent) => {
    e.preventDefault()
    if (controle || bezig) return
    // Niets veranderd: gewoon dicht
    if (tekst.trim() === huidig) return setOpen(false)
    setBezig(true)
    const f = await slaKamernaamOp(kamer.nummer, tekst)
    setBezig(false)
    setFout(f)
    if (!f) setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="tekstknop kamernaam__knop" onClick={openen}>
        <Icoon naam="potlood" grootte={20} />
        {huidig ? 'Naam van het appartement aanpassen' : 'Geef jullie appartement een naam'}
      </button>
    )
  }
  return (
    <form className="kamernaam" onSubmit={(e) => void bewaar(e)}>
      <label htmlFor="kamernaam-veld">Naam van appartement {kamer.nummer}</label>
      <div className="kamernaam__rij">
        <input
          id="kamernaam-veld"
          type="text"
          value={tekst}
          maxLength={MAX_KAMERNAAM}
          placeholder={kamer.naam ?? 'Bijv. De Gletsjerspleet'}
          autoComplete="off"
          autoFocus
          onChange={(e) => {
            setTekst(e.target.value)
            setFout(null)
          }}
          aria-describedby="kamernaam-uitleg"
          aria-invalid={!!(controle || fout)}
        />
        <span className="kamernaam__teller" aria-hidden="true">
          {tekst.trim().length}/{MAX_KAMERNAAM}
        </span>
      </div>
      <p id="kamernaam-uitleg" className="kamernaam__uitleg">
        Iedereen ziet deze naam in de app.
        {kamer.naam ? ` Leeg laten = weer "${kamer.naam}".` : ''}
      </p>
      {(controle || fout) && (
        <p className="melding melding--fout" role="alert">
          {controle ?? fout}
        </p>
      )}
      <div className="dialoog__knoppen">
        <button type="button" className="knop knop--secundair" onClick={() => setOpen(false)} disabled={bezig}>
          Annuleren
        </button>
        <button type="submit" className="knop knop--primair" disabled={bezig || !!controle}>
          {bezig ? 'Bewaren…' : 'Bewaar'}
        </button>
      </div>
    </form>
  )
}
