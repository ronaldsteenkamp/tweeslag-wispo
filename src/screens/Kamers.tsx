import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { ligging, opsomming, plaatsKamers, verdiepingen, verdiepingKort, verdiepingNaam, type Plek } from '../lib/kamerligging'
import { kamernaamFout, MAX_KAMERNAAM } from '../lib/kamernaamregels'
import { slaKamernaamOp, useEigenKamernamen, useKamerNaam } from '../lib/kamernamen'
import { useOpgeslagen } from '../lib/opslag'
import { profielBestaatVoor, sleutel, useMijnProfiel, useProfielen, useProfielFoto } from '../lib/profiel'
import { useTerugSluit } from '../lib/terugknop'
import '../styles/barlow.css'
import '../styles/kamers.css'

/*
 * Kamers als plattegrond (richting A uit mockups/kamers-a.html): het bordje bij de lift, maar dan van
 * onze club. Bovenaan jouw appartement als uitsnede van de tekening, daaronder de gang van bovenaf
 * (oneven links, even rechts) of, bij meerdere verdiepingen, per verdieping een plattegrond.
 * Alles staat ook als gewone lijst (knop rechtsboven), voor wie dat prettiger leest.
 */

export default function Kamers({ naarVerdelen, naarBeheer }: { naarVerdelen: () => void; naarBeheer: () => void }) {
  const { data, fout } = useData('kamers')
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const nieuweKop = useNieuweKoppen()
  const alleNamen = useAlleNamen(data)
  const toon = useToonNaam()
  const kamerNaamVan = useKamerNaam()
  const [weergave, setWeergave] = useOpgeslagen<'plan' | 'lijst'>('kamers.weergave', 'plan')
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
        {nieuweKop ? <SchermKop titel="Kamers" /> : <h1>Kamers</h1>}
        <DataStatus fout={fout} />
      </div>
    )
  }

  // Alleen als je nog geen naam hebt (of hij niet meer in de kamerlijst staat). Een andere naam
  // kiezen kan hier niet: dat gaat via je naam op Home (Jouw profiel → Andere naam kiezen).
  if (!naamBekend) {
    return (
      <div className="scherm">
        {nieuweKop ? <SchermKop titel="Wie ben jij?" boven="Kamers" /> : <h1>Wie ben jij?</h1>}
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

  const genoten = mijn ? mijn.kamer.bewoners.filter((b) => b !== naam).map(toon) : []
  const kopZin = mijn
    ? `Je slaapt in ${mijn.kamer.nummer}${genoten.length ? `, met ${opsomming(genoten)}` : ''}.`
    : 'Jouw bed staat nog niet op de tekening.'
  const verhuisdVan = mijn && gezien?.naam === naam && gezien.nummer !== mijn.kamer.nummer ? gezien.nummer : null
  const lagen = verdiepingen(plekken)
  const geopend = plekken.find((p) => p.kamer.nummer === open) ?? null
  const ctx: Ctx = { jij: naam, mijn, toon, kamerNaamVan }

  return (
    <div className="scherm kp">
      {nieuweKop ? (
        <SchermKop titel="Kamers" boven={config.bestemming} ondertitel={kopZin} />
      ) : (
        <>
          <h1>Kamers</h1>
          <p className="ondertitel">{kopZin}</p>
        </>
      )}

      {verhuisdVan && mijn && (
        <div className="kp-melding" role="status">
          <Icoon naam="allebei" />
          <strong>Nieuwe indeling</strong>
          <p>
            Je verhuist van {verhuisdVan} naar {mijn.kamer.nummer}.
            {genoten.length ? ` Je huisgenoten worden ${opsomming(genoten)}.` : ''}
          </p>
          <button type="button" onClick={() => setGezien({ naam, nummer: mijn.kamer.nummer })}>
            Gezien
          </button>
        </div>
      )}

      {mijn ? <MijnAppartement plek={mijn} plekken={plekken} ctx={ctx} kamers={data.kamers} /> : <NogGeenBed />}

      <section className="kp-overzicht" aria-labelledby="kp-gang-kop">
        <h2 className="kp-sectie" id="kp-gang-kop">
          {lagen.length > 1 ? 'Ons gebouw' : 'Onze gang'}
          <span className="kp-wissel" role="group" aria-label="Weergave">
            <button type="button" aria-pressed={weergave === 'plan'} onClick={() => setWeergave('plan')}>
              <Icoon naam="plattegrond" grootte={18} />
              <span className="verborgen">Plattegrond</span>
            </button>
            <button type="button" aria-pressed={weergave === 'lijst'} onClick={() => setWeergave('lijst')}>
              <Icoon naam="lijst" grootte={18} />
              <span className="verborgen">Lijst</span>
            </button>
          </span>
        </h2>

        {plekken.length === 0 ? (
          <p className="kp-stil">Er zijn nog geen appartementen ingedeeld.</p>
        ) : weergave === 'plan' ? (
          <>
            {lagen.length > 1 && <Doorsnede plekken={plekken} lagen={lagen} mijn={mijn} />}
            {lagen.map((v) => (
              <Verdieping key={String(v)} verdieping={v} plekken={plekken} enige={lagen.length === 1} ctx={ctx} onOpen={setOpen} />
            ))}
            <p className="kp-legenda" aria-hidden="true">
              <span><i className="bezet" />bed</span>
              <span><i className="vrij" />vrij bed</span>
              <span><i className="jouw" />jouw appartement</span>
              <span><i className="vreemd" />andere gasten</span>
            </p>
          </>
        ) : (
          <Lijst plekken={plekken} ctx={ctx} onOpen={setOpen} />
        )}

        {data.zonderKamer.length > 0 && (
          <div className="kp-zonder">
            <span className="kp-etiket">Nog niet ingedeeld</span>
            <p>
              {data.zonderKamer.map((n, i) => (
                <span key={n}>
                  {i > 0 && ', '}
                  {n === naam ? <b>{toon(n)} (jij)</b> : toon(n)}
                </span>
              ))}
            </p>
          </div>
        )}

        <p className="kp-voet">
          <Icoon naam="offline" grootte={18} />
          Staat ook zonder wifi op je telefoon. Getekend op volgorde van de nummers.
        </p>
      </section>

      {isReisleiding && (
        <div className="kp-reisleiding">
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
  const waar = p === ctx.mijn ? 'jouw appartement' : ligging(p, ctx.mijn)
  const bezet = `${p.kamer.bewoners.length} van ${p.bedden} bedden bezet${p.vrij ? `, ${p.vrij} vrij` : ''}`
  const wie = p.kamer.bewoners.map((b) => (b === ctx.jij ? `${ctx.toon(b)} (jij)` : ctx.toon(b)))
  return `Appartement ${p.kamer.nummer}${naam ? `, ${naam}` : ''}${p.verdieping !== null ? `, ${verdiepingNaam(p.verdieping)}` : ''}${waar ? `, ${waar}` : ''}. ${bezet}${wie.length ? `: ${opsomming(wie)}` : ''}.`
}

// ---------- Jouw appartement ----------

function MijnAppartement({ plek, plekken, ctx, kamers }: { plek: Plek; plekken: Plek[]; ctx: Ctx; kamers: Kamer[] }) {
  return (
    <section className="kp-mijn" aria-labelledby="kp-mijn-kop">
      <div className="kp-mijn__kop">
        <span className="kp-nummer" aria-hidden="true">
          {plek.kamer.nummer}
        </span>
        <div>
          <span className="kp-etiket">
            Jouw appartement{plek.verdieping !== null ? ` · ${verdiepingNaam(plek.verdieping)}` : ''}
          </span>
          <h2 className="kp-mijn__naam" id="kp-mijn-kop">
            <span className="verborgen">Jouw appartement {plek.kamer.nummer}, </span>
            {titelVan(plek, ctx)}
          </h2>
        </div>
      </div>
      <div className="kp-tekening">
        <span className="kp-pin">
          <Icoon naam="pin" grootte={18} />
          hier slaap jij
        </span>
        <Bedden plek={plek} ctx={ctx} />
      </div>
      <Feiten plek={plek} />
      <Buren plek={plek} plekken={plekken} ctx={ctx} />
      <KamernaamVeld kamer={plek.kamer} kamers={kamers} />
    </section>
  )
}

function NogGeenBed() {
  return (
    <section className="kp-mijn" aria-labelledby="kp-mijn-kop">
      <h2 className="kp-sectie" id="kp-mijn-kop">
        Jouw bed <span className="kp-etiket">nog niet getekend</span>
      </h2>
      <div className="kp-leeg">
        <Icoon naam="plattegrond" grootte={34} />
        <p>
          <b>Je staat nog niet op de tekening.</b> De reisleiding is nog aan het puzzelen. Zodra jij een bed hebt, zie je hier
          waar je slaapt en met wie.
        </p>
      </div>
    </section>
  )
}

function Feiten({ plek }: { plek: Plek }) {
  return (
    <p className="kp-feiten">
      <span>
        <Icoon naam="kamers" grootte={20} />
        {plek.bedden} {plek.bedden === 1 ? 'bed' : 'bedden'}
        {plek.vrij > 0 && `, ${plek.vrij} vrij`}
      </span>
      {plek.verdieping !== null && (
        <span>
          <Icoon naam="trap" grootte={20} />
          {verdiepingNaam(plek.verdieping)}
        </span>
      )}
    </p>
  )
}

/** "Naast je: 103 Lawine · Tegenover je: 102" (alleen wie echt dichtbij ligt) */
function Buren({ plek, plekken, ctx }: { plek: Plek; plekken: Plek[]; ctx: Ctx }) {
  const groepen = new Map<string, string[]>()
  for (const p of plekken) {
    const l = ligging(p, plek)
    if (!l || !/naast|tegenover je|recht/.test(l)) continue
    const naam = ctx.kamerNaamVan(p.kamer)
    groepen.set(l, [...(groepen.get(l) ?? []), `${p.kamer.nummer}${naam ? ` ${naam}` : ''}`])
  }
  if (!groepen.size) return null
  return (
    <p className="kp-buren">
      {[...groepen].map(([l, ks], i) => (
        <span key={l}>
          {i > 0 && ' · '}
          <b>{l[0].toUpperCase() + l.slice(1)}:</b> {opsomming(ks)}
        </span>
      ))}
    </p>
  )
}

function Bedden({ plek, ctx, voorTik }: { plek: Plek; ctx: Ctx; voorTik?: () => void }) {
  return (
    <ul className="kp-bedden" aria-label="Bedden">
      {plek.kamer.bewoners.map((b) => (
        <Bed key={b} naam={b} ctx={ctx} voorTik={voorTik} />
      ))}
      {Array.from({ length: plek.vrij }, (_, i) => (
        <li key={`vrij${i}`} className="kp-bed is-vrij">
          <span className="kp-bed__kussen">
            <span />
          </span>
          <span className="kp-bed__naam">Vrij bed</span>
        </li>
      ))}
    </ul>
  )
}

/** Eén bed: foto op het kussen, naam op het dekbed. Tik = het spelerskaartje. */
function Bed({ naam, ctx, voorTik }: { naam: string; ctx: Ctx; voorTik?: () => void }) {
  const { perNaam } = useProfielen()
  const mijnProfiel = useMijnProfiel()
  const jij = naam === ctx.jij
  const rij = perNaam.get(sleutel(naam))
  const url = useProfielFoto(jij ? (mijnProfiel?.foto ?? null) : (rij?.foto_pad ?? null), jij ? (mijnProfiel?.fotoLokaal ?? null) : null)
  const getoond = ctx.toon(naam)
  return (
    <li className={`kp-bed${jij ? ' is-jij' : ''}`}>
      <button
        type="button"
        onClick={() => {
          voorTik?.()
          toonProfiel(naam)
        }}
        aria-label={`${naam}${getoond !== naam ? `, ${getoond}` : ''}${jij ? ', jij' : ''}. Bekijk het plaatje.`}
      >
        <span className="kp-bed__kussen">{url ? <img src={url} alt="" /> : <span />}</span>
        <span className="kp-bed__naam">
          {getoond}
          {jij && <small>jij</small>}
        </span>
      </button>
    </li>
  )
}

// ---------- De gang ----------

function Doorsnede({ plekken, lagen, mijn }: { plekken: Plek[]; lagen: (number | null)[]; mijn: Plek | null }) {
  const ramen = Math.max(...plekken.map((p) => p.rij)) * 2
  return (
    <nav className="kp-doorsnede" aria-label="Verdiepingen">
      {lagen.map((v) => {
        const hier = plekken.filter((p) => p.verdieping === v)
        return (
          <button
            type="button"
            key={String(v)}
            onClick={() => document.getElementById(`kp-verdieping-${v}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <b>{verdiepingKort(v)}</b>
            <span className="kp-doorsnede__ramen" aria-hidden="true">
              {Array.from({ length: ramen }, (_, i) => {
                const p = hier.find((x) => (x.kant === 'links' ? x.rij * 2 - 1 : x.rij * 2) === i + 1)
                return <i key={i} className={p ? (p === mijn ? 'jouw' : 'ons') : ''} />
              })}
            </span>
            <small>
              {hier.map((p) => p.kamer.nummer).join(' · ')}
              {mijn?.verdieping === v && (
                <>
                  <br />
                  jij
                </>
              )}
            </small>
            <span className="verborgen">, naar de {verdiepingNaam(v)}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Verdieping({
  verdieping,
  plekken,
  enige,
  ctx,
  onOpen,
}: {
  verdieping: number | null
  plekken: Plek[]
  enige: boolean
  ctx: Ctx
  onOpen: (nummer: string) => void
}) {
  const hier = plekken.filter((p) => p.verdieping === verdieping)
  const rijen = Math.max(...hier.map((p) => p.rij))
  const mijn = ctx.mijn
  const relatie = !mijn ? '' : mijn.verdieping === verdieping ? 'jouw verdieping' : (ligging(hier[0], mijn) ?? '').split(',')[0]
  const vakken = []
  for (let rij = 1; rij <= rijen; rij++) {
    const rijLeeg = !hier.some((p) => p.rij === rij)
    for (const kant of ['links', 'rechts'] as const) {
      const p = hier.find((x) => x.kant === kant && x.rij === rij)
      vakken.push(
        p ? (
          <li key={p.kamer.nummer} className={`kp-plek kp-plek--${kant}`} style={{ gridRow: rij + 1 }}>
            <KamerVak plek={p} ctx={ctx} onOpen={onOpen} />
          </li>
        ) : (
          <li
            key={`${kant}${rij}`}
            className={`kp-plek kp-plek--${kant}`}
            style={{ gridRow: rij + 1 }}
            aria-hidden="true"
          >
            <span className={`kp-kamer kp-kamer--${kant} is-vreemd${rijLeeg ? ' is-kort' : ''}`} />
          </li>
        ),
      )
    }
  }
  return (
    <div className="kp-verdieping" id={`kp-verdieping-${verdieping}`}>
      {!enige || verdieping !== null ? (
        <div className="kp-verdieping__kop">
          <h3>{verdieping === null ? 'De gang' : verdiepingNaam(verdieping)}</h3>
          <span>
            {hier.length} {hier.length === 1 ? 'appartement' : 'appartementen'}
            {relatie ? ` · ${relatie}` : ''}
          </span>
        </div>
      ) : null}
      <div className="kp-plan" style={{ gridTemplateRows: `auto repeat(${rijen}, auto)` }}>
        <div className="kp-plan__begin" aria-hidden="true">
          <span>
            <Icoon naam="trap" grootte={18} />
            begin van de gang
          </span>
        </div>
        <div className="kp-plan__gang" style={{ gridRow: `2 / span ${rijen}` }} aria-hidden="true">
          <b>GANG</b>
        </div>
        <ul className="kp-plan__vakken" aria-label={`Appartementen op ${verdieping === null ? 'de gang' : `de ${verdiepingNaam(verdieping)}`}`}>
          {vakken}
        </ul>
      </div>
    </div>
  )
}

function KamerVak({ plek, ctx, onOpen }: { plek: Plek; ctx: Ctx; onOpen: (nummer: string) => void }) {
  const naam = ctx.kamerNaamVan(plek.kamer)
  const jouw = plek === ctx.mijn
  return (
    <button
      type="button"
      className={`kp-kamer kp-kamer--${plek.kant}${jouw ? ' is-jouw' : ''}`}
      onClick={() => onOpen(plek.kamer.nummer)}
      aria-label={omschrijving(plek, ctx)}
    >
      {jouw && (
        <span className="kp-hier" aria-hidden="true">
          <Icoon naam="pin" grootte={20} />
        </span>
      )}
      <span className="kp-kamer__nr">{plek.kamer.nummer}</span>
      {naam && <span className="kp-kamer__naam">{naam}</span>}
      <span className="kp-bedjes" aria-hidden="true">
        {Array.from({ length: plek.bedden }, (_, i) => (
          <i key={i} className={i < plek.kamer.bewoners.length ? 'bezet' : 'vrij'} />
        ))}
      </span>
      <span className="kp-kamer__wie">
        {plek.kamer.bewoners.map((b, i) => (
          <span key={b}>
            {i > 0 && ', '}
            {b === ctx.jij ? <b>{ctx.toon(b)} (jij)</b> : ctx.toon(b)}
          </span>
        ))}
      </span>
      {plek.vrij > 0 && <span className="kp-kamer__vrij">{plek.vrij} bed vrij</span>}
    </button>
  )
}

function Lijst({ plekken, ctx, onOpen }: { plekken: Plek[]; ctx: Ctx; onOpen: (nummer: string) => void }) {
  return (
    <ul className="kp-lijst">
      {plekken.map((p) => {
        const naam = ctx.kamerNaamVan(p.kamer)
        const extra = [verdiepingKort(p.verdieping), p.vrij ? `${p.vrij} vrij` : ''].filter(Boolean).join(' · ')
        return (
          <li key={p.kamer.nummer}>
            <button
              type="button"
              className={`kp-rij${p === ctx.mijn ? ' is-jouw' : ''}`}
              onClick={() => onOpen(p.kamer.nummer)}
              aria-label={omschrijving(p, ctx)}
            >
              <span className="kp-rij__nr">
                {p.kamer.nummer}
                {extra && <small>{extra}</small>}
              </span>
              <span className="kp-rij__wie">
                <strong>{naam ?? 'zonder naam'}</strong>
                {p.kamer.bewoners.map((b, i) => (
                  <span key={b}>
                    {i > 0 && ', '}
                    {b === ctx.jij ? <b>{ctx.toon(b)} (jij)</b> : ctx.toon(b)}
                  </span>
                ))}
              </span>
              <Icoon naam="rechts" grootte={18} />
            </button>
          </li>
        )
      })}
    </ul>
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

  const jouw = plek === ctx.mijn
  const waar = jouw ? 'jouw appartement' : ligging(plek, ctx.mijn)
  const etiket = [plek.verdieping !== null ? verdiepingNaam(plek.verdieping) : '', waar ?? ''].filter(Boolean).join(' · ')
  // Naar body, zodat het vegen tussen tabs (transform op de inhoud) het venster niet meeneemt
  return createPortal(
    <div className="dialoog-achtergrond" onClick={onSluit}>
      <div
        ref={venster}
        className="dialoog dialoog--hoog kp-blad"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kp-blad-titel"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="kp-blad__sluit" onClick={onSluit} aria-label="Sluiten">
          <Icoon naam="kruis" />
        </button>
        <h2 id="kp-blad-titel" className="kp-blad__kop">
          <span className="kp-nummer">{plek.kamer.nummer}</span>
          <span>
            {etiket && <span className="kp-etiket">{etiket}</span>}
            <span className="kp-mijn__naam">{titelVan(plek, ctx)}</span>
          </span>
        </h2>
        <div className={`kp-tekening${jouw ? '' : ' is-ander'}`}>
          {jouw && (
            <span className="kp-pin">
              <Icoon naam="pin" grootte={18} />
              hier slaap jij
            </span>
          )}
          <Bedden plek={plek} ctx={ctx} voorTik={onSluit} />
        </div>
        <Feiten plek={plek} />
        {plek.vrij > 0 && !jouw && (
          <p className="kp-stil">Er is nog plek. Wil je verhuizen? Vraag het de reisleiding: dat blijft tussen jullie.</p>
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
