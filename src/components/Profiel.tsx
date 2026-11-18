import { useEffect, useRef, useState } from 'react'
import { useBackend } from '../lib/backend'
import { BadgeOverzicht, BadgeRij, OpenBadgeOverzicht } from './Badges'
import {
  bijnaamFout,
  MAX_BIJNAAM,
  slaBijnaamOp,
  useBijnaamVan,
  useEigenBijnaam,
  useToonNaam,
  wisBijnaam,
} from '../lib/bijnamen'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { useData, type Kamers } from '../lib/data'
import { useKamerNaam } from '../lib/kamernamen'
import { useOpgeslagen } from '../lib/opslag'
import { useTerugSluit } from '../lib/terugknop'
import {
  heeftIets,
  MAX,
  NIVEAUS,
  PISTES,
  SKI_KEUZES,
  sleutel,
  slaProfielOp,
  useMijnProfiel,
  useProfielen,
  useProfielFoto,
  type Profiel,
  type ProfielRij,
  type Ski,
} from '../lib/profiel'
import { BevestigDialoog } from './BevestigDialoog'
import { FotoBijsnijder } from './FotoBijsnijder'
import { Icoon, type IcoonNaam } from './Icoon'
import { NaamKiezer, useAlleNamen } from './NaamKiezer'
import '../styles/barlow.css'
import '../styles/profiel.css'

/*
 * Profielen als spelerskaartjes: iedereen een plaatje in het Tweeslag-album. Voorkant: foto (of een
 * lege plek "nog niet geplakt"), naam, ski of board, piste en kamer. Achterkant: karaoke, wat niemand
 * weet en de grootste angst. Niets is verplicht; wat leeg is, staat er gewoon niet op.
 */

// ---------- Eén venster voor de hele app ----------

type Venster = { soort: 'bekijk'; naam: string; melding?: string } | { soort: 'mijn'; naamKiezen: boolean } | null

let venster: Venster = null
const vensterLuisteraars = new Set<() => void>()
const zetVenster = (v: Venster) => {
  venster = v
  vensterLuisteraars.forEach((f) => f())
}

/** Toont het plaatje van iemand (of je eigen) */
export const toonProfiel = (naam: string) => zetVenster({ soort: 'bekijk', naam })
/** Opent je eigen plaatje om aan te passen, eventueel meteen met het kiezen van je naam */
export const openMijnProfiel = (naamKiezen = false) => zetVenster({ soort: 'mijn', naamKiezen })

function useVenster() {
  const [, ververs] = useState(0)
  useEffect(() => {
    const f = () => ververs((n) => n + 1)
    vensterLuisteraars.add(f)
    return () => {
      vensterLuisteraars.delete(f)
    }
  }, [])
  return venster
}

// ---------- Stukjes ----------

const SKI_ICOON: Record<Ski, IcoonNaam> = { ski: 'ski', board: 'board', allebei: 'allebei', nooit: 'bier' }

/** Pistebordje in de kleur van het niveau, met het nummer erop (dubbelzwart: ◆◆) */
export function Pistebord({ niveau, className = '' }: { niveau: number; className?: string }) {
  const piste = PISTES[niveau - 1]
  if (!piste) return null
  return (
    <span
      className={`pistebord pistebord--${piste.kleur} ${className}`}
      role="img"
      aria-label={`${piste.naam}e piste: ${NIVEAUS[niveau - 1]}`}
    >
      <span aria-hidden="true">{piste.kleur === 'dubbelzwart' ? '◆◆' : niveau}</span>
    </span>
  )
}

/** Plaatjesnummer (plek op het alfabet) en kamer van iemand */
export function plaatjeInfo(naam: string, namen: string[], kamers?: Kamers) {
  const i = namen.findIndex((n) => sleutel(n) === sleutel(naam))
  const kamer = kamers?.kamers.find((k) => k.bewoners.some((b) => sleutel(b) === sleutel(naam))) ?? null
  return { nummer: i >= 0 ? i + 1 : null, kamer }
}

const nr = (n: number | null) => (n === null ? '' : String(n).padStart(2, '0'))

/** Wat er op een plaatje staat: van de server, of je eigen (ook als het nog verstuurd moet worden) */
export type Bekeken = Pick<ProfielRij, 'naam' | 'ski' | 'niveau' | 'feitje' | 'karaoke' | 'artiest' | 'angst' | 'foto_pad'> & {
  fotoLokaal?: string | null
}

const leegPlaatje = (naam: string): Bekeken => ({
  naam,
  ski: null,
  niveau: null,
  feitje: '',
  karaoke: '',
  artiest: '',
  angst: '',
  foto_pad: null,
})

const vanProfiel = (p: Profiel): Bekeken => ({ ...p, foto_pad: p.foto, fotoLokaal: p.fotoLokaal })

/** Het spelerskaartje, voor- en achterkant. Draaien gaat met de knop eronder (of door erop te tikken). */
export function Plaatje({
  p,
  nummer,
  kamer,
  omgedraaid = false,
  onDraai,
}: {
  p: Bekeken
  nummer: number | null
  kamer: string | null
  omgedraaid?: boolean
  onDraai?: () => void
}) {
  const url = useProfielFoto(p.foto_pad, p.fotoLokaal)
  const bijnaam = useBijnaamVan(p.naam)
  const ski = SKI_KEUZES.find((k) => k.waarde === p.ski)
  const piste = p.niveau ? PISTES[p.niveau - 1] : null
  const getoond = bijnaam ?? p.naam

  const verhaal: { icoon: IcoonNaam; label: string; tekst: React.ReactNode }[] = []
  if (p.karaoke || p.artiest)
    verhaal.push({
      icoon: 'microfoon',
      label: 'Bus-karaoke',
      tekst: (
        <>
          {p.karaoke}
          {p.artiest && <small>{p.karaoke ? ' – ' : ''}{p.artiest}</small>}
        </>
      ),
    })
  if (p.feitje) verhaal.push({ icoon: 'fluister', label: 'Wat niemand weet', tekst: p.feitje })
  if (p.angst) verhaal.push({ icoon: 'bliksem', label: 'Bang voor', tekst: p.angst })

  return (
    <div className={`plaatje${omgedraaid ? ' is-omgedraaid' : ''}`}>
      <div className="plaatje__draaier" onClick={onDraai}>
        {/* Voorkant */}
        <div className="plaatje__kant plaatje__voor" aria-hidden={omgedraaid}>
          {url ? (
            <>
              <img src={url} alt={`Foto van ${p.naam}`} />
              {nummer !== null && <span className="plaatje__nr">№ {nr(nummer)}</span>}
            </>
          ) : (
            <div className="plaatje__gat" aria-hidden="true">
              <b>{nr(nummer)}</b>
              <span>Nog niet geplakt</span>
            </div>
          )}
          {p.niveau && <Pistebord niveau={p.niveau} className="plaatje__piste" />}
          <div className="plaatje__band">
            <p className="plaatje__naam">
              {getoond}
              {bijnaam && <small>{p.naam}</small>}
            </p>
            <p className="plaatje__positie">
              <span>
                {ski ? (
                  <>
                    <Icoon naam={SKI_ICOON[ski.waarde]} grootte={18} />
                    {ski.label}
                  </>
                ) : (
                  'Tweeslag'
                )}
              </span>
              {kamer && (
                <span>
                  <Icoon naam="kamers" grootte={18} />
                  <span className="verborgen">Kamer </span>
                  {kamer}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Achterkant */}
        <div className="plaatje__kant plaatje__achter" aria-hidden={!omgedraaid}>
          <p className="achter__kop">
            <span>Seizoen 2027 · Les 2 Alpes</span>
            <img src={`${import.meta.env.BASE_URL}img/2slag-wit.svg`} alt="" />
          </p>
          <p className="achter__naam">{getoond}</p>
          <dl className="achter__feiten">
            <div>
              <dt>Speelt als</dt>
              <dd className={ski ? '' : 'is-leeg'}>
                {ski ? (
                  <>
                    <Icoon naam={SKI_ICOON[ski.waarde]} grootte={17} />
                    {ski.label}
                  </>
                ) : (
                  '–'
                )}
              </dd>
            </div>
            <div>
              <dt>Piste</dt>
              <dd className={piste ? '' : 'is-leeg'}>
                {piste && p.niveau ? (
                  <>
                    <Pistebord niveau={p.niveau} />
                    {piste.naam}
                  </>
                ) : (
                  '–'
                )}
              </dd>
            </div>
            <div>
              <dt>Kamer</dt>
              <dd className={kamer ? '' : 'is-leeg'}>{kamer ?? '–'}</dd>
            </div>
          </dl>
          {p.niveau && <p className="achter__niveau">{NIVEAUS[p.niveau - 1]}</p>}
          {verhaal.length ? (
            <dl className="achter__verhaal">
              {verhaal.map((v) => (
                <div key={v.label}>
                  <Icoon naam={v.icoon} grootte={19} />
                  <div>
                    <dt>{v.label}</dt>
                    <dd>{v.tekst}</dd>
                  </div>
                </div>
              ))}
            </dl>
          ) : (
            <div className="achter__blanco">
              <p>De rest van de achterkant is nog blanco.</p>
              <i />
              <i />
              <i />
            </div>
          )}
          <p className="achter__voet">
            <span>
              Tweeslag Groningen
              <br />
              Wispo 05.03–14.03.2027
            </span>
            {nummer !== null && <b>№ {nr(nummer)}</b>}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Plaatje met de knop "Draai om" eronder */
function DraaibaarPlaatje(props: { p: Bekeken; nummer: number | null; kamer: string | null }) {
  const [om, setOm] = useState(false)
  return (
    <>
      <Plaatje {...props} omgedraaid={om} onDraai={() => setOm(!om)} />
      <button type="button" className="draaiknop" aria-pressed={om} onClick={() => setOm(!om)}>
        <Icoon naam="draai" grootte={20} />
        {om ? 'Voorkant' : 'Draai om'}
      </button>
    </>
  )
}

/** "Kamer 103 · Lawine" (met de naam die de bewoners zelf kozen) */
function useKamerTekst(kamer: { nummer: string; naam?: string } | null) {
  const kamerNaam = useKamerNaam()
  if (!kamer) return null
  const naam = kamerNaam(kamer)
  return `Kamer ${kamer.nummer}${naam ? ` · ${naam}` : ''}`
}

// ---------- Invullen ----------

/** Het formulier voor je plaatje, voor het welkomstscherm en voor "Jouw plaatje" */
export function ProfielFormulier({
  profiel,
  onKlaar,
  laterLabel = 'Later',
}: {
  profiel: Profiel
  /** opgeslagen: true na Plakken, false na Later/Annuleren */
  onKlaar: (opgeslagen: boolean) => void
  laterLabel?: string
}) {
  const [ski, setSki] = useState(profiel.ski)
  const [niveau, setNiveau] = useState(profiel.niveau)
  const [feitje, setFeitje] = useState(profiel.feitje)
  const [karaoke, setKaraoke] = useState(profiel.karaoke)
  const [artiest, setArtiest] = useState(profiel.artiest)
  const [angst, setAngst] = useState(profiel.angst)
  const [foto, setFoto] = useState(profiel.foto)
  const [fotoLokaal, setFotoLokaal] = useState(profiel.fotoLokaal)
  const [fotoFout, setFotoFout] = useState<string | null>(null)
  // De gekozen foto (om opnieuw bij te snijden) en de foto die nu bijgesneden wordt
  const [origineel, setOrigineel] = useState<File | null>(null)
  const [bijsnijden, setBijsnijden] = useState<File | null>(null)
  const bestand = useRef<HTMLInputElement>(null)
  const { data } = useData('kamers')
  const namen = useAlleNamen(data)
  const { nummer, kamer } = plaatjeInfo(profiel.naam, namen, data)

  const kiesFoto = (f: File | undefined) => {
    if (bestand.current) bestand.current.value = ''
    if (!f) return
    setFotoFout(null)
    setBijsnijden(f)
  }

  const bijgesneden = async (blob: Blob) => {
    try {
      const url = await new Promise<string>((ok, mis) => {
        const lezer = new FileReader()
        lezer.onload = () => ok(String(lezer.result))
        lezer.onerror = () => mis(new Error('De foto kon niet gelezen worden'))
        lezer.readAsDataURL(blob)
      })
      setFotoLokaal(url)
      setOrigineel(bijsnijden)
    } catch (e) {
      setFotoFout(e instanceof Error ? e.message : 'Deze foto lukt niet. Probeer een andere.')
    }
    setBijsnijden(null)
  }

  if (bijsnijden) {
    return (
      <FotoBijsnijder bestand={bijsnijden} onKlaar={(b) => void bijgesneden(b)} onAnnuleer={() => setBijsnijden(null)} />
    )
  }

  const opslaan = (e: React.FormEvent) => {
    e.preventDefault()
    slaProfielOp({ ...profiel, ski, niveau, feitje, karaoke, artiest, angst, foto, fotoLokaal })
    onKlaar(true)
  }

  const voorbeeld: Bekeken = { naam: profiel.naam, ski, niveau, feitje, karaoke, artiest, angst, foto_pad: foto, fotoLokaal }
  const heeftFoto = !!(foto || fotoLokaal)

  return (
    <form className="plaatjeform" onSubmit={opslaan}>
      <div className="plaatjeform__voorbeeld" aria-hidden="true">
        <Plaatje p={voorbeeld} nummer={nummer} kamer={kamer?.nummer ?? null} />
      </div>

      <section className="plaatjeform__blok" aria-labelledby="pf-foto-kop">
        <h3 className="plaatjeform__label" id="pf-foto-kop">
          Foto voor je plaatje
        </h3>
        <div className="plaatjeform__fotorij">
          <button type="button" className="plaatjeknop plaatjeknop--neven" onClick={() => bestand.current?.click()}>
            <Icoon naam="camera" grootte={20} />
            {heeftFoto ? 'Andere foto' : 'Foto kiezen'}
          </button>
          {origineel && fotoLokaal && (
            <button type="button" className="plaatjeknop--tekst" onClick={() => setBijsnijden(origineel)}>
              Opnieuw bijsnijden
            </button>
          )}
          {heeftFoto && (
            <button
              type="button"
              className="plaatjeknop--tekst"
              onClick={() => {
                setFoto(null)
                setFotoLokaal(null)
                setOrigineel(null)
              }}
            >
              Foto weghalen
            </button>
          )}
        </div>
        <input
          ref={bestand}
          type="file"
          accept="image/*"
          hidden
          aria-describedby="pf-foto-uitleg"
          onChange={(e) => kiesFoto(e.target.files?.[0])}
        />
        <p className="plaatjeform__uitleg" id="pf-foto-uitleg">
          Mag, hoeft niet. Wordt op je telefoon verkleind; de locatie uit de foto gaat eraf.
        </p>
        {fotoFout && <p className="melding melding--fout">{fotoFout}</p>}
      </section>

      <fieldset className="plaatjeform__blok">
        <legend className="plaatjeform__label">Op de berg speel je als…</legend>
        <div className="plaatjeform__keuzes plaatjeform__keuzes--twee">
          {SKI_KEUZES.map((k) => (
            <label key={k.waarde} className="plaatjekeuze">
              <input
                type="radio"
                name="ski"
                value={k.waarde}
                checked={ski === k.waarde}
                onChange={() => setSki(k.waarde)}
                onClick={() => ski === k.waarde && setSki(null)}
              />
              <span className="plaatjekeuze__vak">
                <Icoon naam={SKI_ICOON[k.waarde]} grootte={22} />
                {k.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="plaatjeform__blok">
        <legend className="plaatjeform__label">Jouw piste</legend>
        <div className="plaatjeform__keuzes">
          {NIVEAUS.map((label, i) => (
            <label key={label} className="plaatjekeuze">
              <input
                type="radio"
                name="niveau"
                value={i + 1}
                checked={niveau === i + 1}
                onChange={() => setNiveau(i + 1)}
                onClick={() => niveau === i + 1 && setNiveau(null)}
              />
              <span className="plaatjekeuze__vak">
                <Pistebord niveau={i + 1} />
                <span className="plaatjekeuze__tekst">
                  <b>{PISTES[i].naam}</b>
                  {label}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Tekstveld
        id="pf-feitje"
        label="Wat niemand van je weet"
        waarde={feitje}
        max={MAX.feitje}
        onWijzig={setFeitje}
        placeholder="Ik heb ooit een speer gegooid op het NK"
        lang
      />

      <fieldset className="plaatjeform__blok">
        <legend className="plaatjeform__label">Jouw nummer voor in de bus</legend>
        <div className="plaatjeform__twee">
          <div>
            <label className="plaatjeform__sublabel" htmlFor="pf-karaoke">
              Nummer
            </label>
            <input
              id="pf-karaoke"
              className="plaatjeform__invoer"
              value={karaoke}
              maxLength={MAX.karaoke}
              autoComplete="off"
              onChange={(e) => setKaraoke(e.target.value)}
            />
          </div>
          <div>
            <label className="plaatjeform__sublabel" htmlFor="pf-artiest">
              Artiest
            </label>
            <input
              id="pf-artiest"
              className="plaatjeform__invoer"
              value={artiest}
              maxLength={MAX.artiest}
              autoComplete="off"
              onChange={(e) => setArtiest(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <Tekstveld
        id="pf-angst"
        label="Grootste angst"
        waarde={angst}
        max={MAX.angst}
        onWijzig={setAngst}
        placeholder="Spinnen, stoeltjeslift, stilte in een lift"
      />

      <div className="plaatjeform__knoppen">
        <button type="submit" className="plaatjeknop plaatjeknop--hoofd">
          Plakken
        </button>
        <button type="button" className="plaatjeknop plaatjeknop--neven" onClick={() => onKlaar(false)}>
          {laterLabel}
        </button>
      </div>
      <p className="plaatjeform__uitleg plaatjeform__uitleg--midden">Niets is verplicht. Een half plaatje is ook een plaatje.</p>
    </form>
  )
}

function Tekstveld({
  id,
  label,
  waarde,
  max,
  onWijzig,
  placeholder,
  lang,
}: {
  id: string
  label: string
  waarde: string
  max: number
  onWijzig: (w: string) => void
  placeholder: string
  lang?: boolean
}) {
  const props = {
    id,
    className: 'plaatjeform__invoer',
    value: waarde,
    maxLength: max,
    placeholder,
    autoComplete: 'off',
    'aria-describedby': `${id}-teller`,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onWijzig(e.target.value),
  }
  return (
    <div className="plaatjeform__blok">
      <div className="plaatjeform__labelrij">
        <label className="plaatjeform__label" htmlFor={id}>
          {label}
        </label>
        <span className="plaatjeform__teller" id={`${id}-teller`}>
          {waarde.length}/{max}
        </span>
      </div>
      {lang ? <textarea rows={3} {...props} /> : <input {...props} />}
    </div>
  )
}

// ---------- Bijnaam ----------

/**
 * Je bijnaam invullen of aanpassen. Wordt los van de rest van het profiel opgeslagen,
 * zodat dat ook kan als je profiel nog niet af is.
 */
export function BijnaamVeld({ namen }: { namen: string[] }) {
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const { bijnaam, fout: serverFout, teVersturen } = useEigenBijnaam()
  const [tekst, setTekst] = useState(bijnaam ?? '')
  const [opgeslagen, setOpgeslagen] = useState(false)
  // Komt er van de server een andere bijnaam binnen (bijv. al bezet), dan het veld bijwerken
  useEffect(() => setTekst(bijnaam ?? ''), [bijnaam])
  if (!naam) return null

  const fout = bijnaamFout(tekst, naam, namen)
  const gewijzigd = tekst.trim() !== (bijnaam ?? '')
  const opslaan = (e: React.FormEvent) => {
    e.preventDefault()
    if (fout || !gewijzigd) return
    slaBijnaamOp(tekst)
    setOpgeslagen(true)
  }

  return (
    <form className="plaatjeform__blok bijnaam" onSubmit={opslaan}>
      <div className="plaatjeform__labelrij">
        <label className="plaatjeform__label" htmlFor="bijnaam-invoer">
          Bijnaam <span className="plaatjeform__optioneel">mag leeg</span>
        </label>
        <span className="plaatjeform__teller">
          {tekst.length}/{MAX_BIJNAAM}
        </span>
      </div>
      <div className="bijnaam__rij">
        <input
          id="bijnaam-invoer"
          className="plaatjeform__invoer"
          value={tekst}
          maxLength={MAX_BIJNAAM}
          autoComplete="nickname"
          autoCapitalize="words"
          aria-describedby="bijnaam-uitleg"
          onChange={(e) => {
            setTekst(e.target.value)
            setOpgeslagen(false)
          }}
        />
        <button type="submit" className="plaatjeknop plaatjeknop--neven" disabled={!!fout || !gewijzigd}>
          {tekst.trim() || !bijnaam ? 'Bewaar' : 'Weghalen'}
        </button>
      </div>
      {fout ? (
        <p className="melding melding--fout">{fout}</p>
      ) : serverFout && !gewijzigd ? (
        <p className="melding melding--fout">{serverFout}</p>
      ) : (
        <p className="plaatjeform__uitleg" id="bijnaam-uitleg" role="status">
          {opgeslagen && !gewijzigd
            ? teVersturen
              ? 'Bewaard. Hij gaat naar de anderen zodra er verbinding is.'
              : 'Bewaard. Zo heet je nu overal in de app.'
            : 'Staat overal in de app in plaats van je naam.'}
        </p>
      )}
    </form>
  )
}

// ---------- Het venster ----------

/** Eén keer in App: toont een plaatje of je eigen plaatje om aan te passen */
export function ProfielVenster() {
  const v = useVenster()
  const sluit = () => zetVenster(null)
  const venster = useDialoogFocus<HTMLDivElement>(v !== null)
  // Terugknop (Android, of terugvegen) sluit het profielvenster, niet de app
  useTerugSluit(v !== null, sluit)
  // Zolang het venster open is, scrolt de pagina eronder niet mee (ook niet als je in het venster
  // onderaan bent en verder veegt)
  const open = v !== null
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    html.classList.add('venster-open')
    return () => html.classList.remove('venster-open')
  }, [open])
  // Alle badges van iemand, in hetzelfde venster (na een tik op +N). Het profiel blijft eronder
  // staan (verborgen), zodat een half ingevuld formulier in Jouw profiel niet kwijtraakt.
  const [overzicht, setOverzicht] = useState<string | null>(null)
  useEffect(() => setOverzicht(null), [v])
  // Ander venster: weer bovenaan beginnen
  useEffect(() => {
    venster.current?.scrollTo({ top: 0 })
  }, [v, venster])
  const terugUitOverzicht = () => {
    setOverzicht(null)
    // Weer naar het rondje +N (of de tekstknop) waar je vandaan kwam
    window.requestAnimationFrame(() =>
      venster.current?.querySelector<HTMLElement>('.badgerij__meer, .badgerij__alles')?.focus(),
    )
  }

  useEffect(() => {
    if (!v) return
    // Escape in het overzicht: terug naar het profiel; anders het venster dicht
    const opToets = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (overzicht) terugUitOverzicht()
      else zetVenster(null)
    }
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, overzicht])

  if (!v) return null
  return (
    // Naast het venster tikken sluit alleen een bekeken plaatje; bij invullen zou je je antwoorden kwijtraken
    <div className="dialoog-achtergrond" onClick={v.soort === 'bekijk' ? sluit : undefined}>
      <div
        ref={venster}
        className="dialoog dialoog--hoog dialoog--plaatje"
        role="dialog"
        aria-modal="true"
        aria-labelledby="venster-titel"
        onClick={(e) => e.stopPropagation()}
      >
        <OpenBadgeOverzicht.Provider value={setOverzicht}>
          {/* display: contents, zodat de opmaak van het venster (gap) gewoon blijft gelden */}
          <div style={{ display: overzicht ? 'none' : 'contents' }}>
            {v.soort === 'bekijk' ? (
              <Bekijk key={v.naam} naam={v.naam} melding={v.melding} onSluit={sluit} />
            ) : (
              <MijnProfiel naamKiezen={v.naamKiezen} onSluit={sluit} />
            )}
          </div>
          {overzicht && <BadgeOverzicht naam={overzicht} onTerug={terugUitOverzicht} />}
        </OpenBadgeOverzicht.Provider>
      </div>
    </div>
  )
}

function VensterKop({ boven, titel, verborgen }: { boven: string; titel: string; verborgen?: string }) {
  return (
    <header className="plaatjekop">
      <p className="plaatjekop__boven">{boven}</p>
      <h2 id="venster-titel" className="plaatjekop__titel">
        {titel}
        {verborgen && <span className="verborgen">{verborgen}</span>}
      </h2>
    </header>
  )
}

function Bekijk({ naam, melding, onSluit }: { naam: string; melding?: string; onSluit: () => void }) {
  const [mijnNaam] = useOpgeslagen<string | null>('naam', null)
  const mijn = useMijnProfiel()
  const { perNaam } = useProfielen()
  const backend = useBackend()
  const { data } = useData('kamers')
  const namen = useAlleNamen(data)
  const [bijnaamWissen, setBijnaamWissen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const bijnaam = useBijnaamVan(naam)
  const toon = useToonNaam()

  const eigen = mijnNaam !== null && sleutel(mijnNaam) === sleutel(naam)
  const rij = perNaam.get(sleutel(naam))
  const p: Bekeken = eigen && mijn ? vanProfiel(mijn) : !eigen && rij ? rij : leegPlaatje(naam)
  const leeg = !heeftIets(p)
  const { nummer, kamer } = plaatjeInfo(naam, namen, data)
  const kamerTekst = useKamerTekst(kamer)

  return (
    <>
      <VensterKop
        boven={eigen ? 'Tweeslag-album 2027' : (kamerTekst ?? 'Tweeslag-album 2027')}
        titel={eigen ? 'Jouw plaatje' : nummer !== null ? `Plaatje ${nr(nummer)}` : toon(naam)}
        verborgen={eigen || nummer === null ? undefined : `: ${toon(naam)}`}
      />
      {melding && (
        <p className="plaatje__melding" role="status">
          {melding}
        </p>
      )}
      {eigen && leeg && (
        <p className="plaatje__rustig">Je plaatje is nog niet geplakt. Geen haast: het album hoeft pas in maart vol.</p>
      )}
      <DraaibaarPlaatje p={p} nummer={nummer} kamer={kamer?.nummer ?? null} />
      {!eigen && leeg && <p className="plaatje__rustig">{toon(naam)} komt nog. Zo'n plaatje is extra zeldzaam.</p>}
      <BadgeRij naam={naam} />
      {eigen && (
        <button type="button" className="plaatjeknop plaatjeknop--hoofd" onClick={() => openMijnProfiel()}>
          <Icoon naam="potlood" grootte={20} />
          {leeg ? 'Plaatje maken' : 'Plaatje aanpassen'}
        </button>
      )}
      {!eigen && bijnaam && backend.beheerder && (
        <button type="button" className="knop knop--gevaar knop--breed" onClick={() => setBijnaamWissen(true)}>
          Bijnaam wissen (beheer)
        </button>
      )}
      <BevestigDialoog
        open={bijnaamWissen}
        titel={`Bijnaam "${bijnaam ?? ''}" wissen?`}
        tekst={`Daarna staat ${naam} weer met de gewone naam in de app. Diegene kan een nieuwe bijnaam kiezen.`}
        bevestigLabel="Wissen"
        gevaarlijk
        onAnnuleer={() => setBijnaamWissen(false)}
        onBevestig={() => {
          setBijnaamWissen(false)
          void wisBijnaam(naam).then((f) => setFout(f))
        }}
      />
      {fout && <p className="melding melding--fout">{fout}</p>}
      <button type="button" className="plaatjeknop plaatjeknop--neven" onClick={onSluit}>
        Sluiten
      </button>
    </>
  )
}

function MijnProfiel({ naamKiezen, onSluit }: { naamKiezen: boolean; onSluit: () => void }) {
  const { data, fout } = useData('kamers')
  const namen = useAlleNamen(data)
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const [kiezen, setKiezen] = useState(naamKiezen || naam === null)
  const profiel = useMijnProfiel()

  if (kiezen || !naam || !profiel) {
    return (
      <>
        <VensterKop boven="Tweeslag-album 2027" titel="Wie ben jij?" />
        <p>{naam ? `Nu gekozen: ${naam}. Tik op je eigen naam.` : 'Tik op je naam.'}</p>
        {data ? (
          <NaamKiezer
            namen={namen}
            onKies={(n) => {
              setNaam(n)
              setKiezen(false)
            }}
          />
        ) : (
          <p className="laadtekst">{fout ? 'De namenlijst kon niet geladen worden.' : 'Even laden…'}</p>
        )}
        <button
          type="button"
          className="plaatjeknop plaatjeknop--neven"
          onClick={() => (naam && !naamKiezen ? setKiezen(false) : onSluit())}
        >
          Annuleren
        </button>
      </>
    )
  }

  return (
    <>
      <VensterKop boven="Jouw plaatje" titel={heeftIets(profiel) ? 'Plaatje aanpassen' : 'Plaatje maken'} />
      <p className="plaatje__wie">
        Je bent <strong>{naam}</strong>
        <button type="button" className="plaatjeknop--tekst" onClick={() => setKiezen(true)}>
          Andere naam kiezen
        </button>
      </p>
      <BijnaamVeld namen={namen} />
      {/* Opnieuw beginnen zodra het profiel van de server binnen is (na het kiezen van een naam) */}
      <ProfielFormulier
        key={`${profiel.naam}|${profiel.verstuurd ? 'server' : 'lokaal'}`}
        profiel={profiel}
        onKlaar={(opgeslagen) =>
          opgeslagen ? zetVenster({ soort: 'bekijk', naam, melding: 'Geplakt! Zo staat je plaatje in het album.' }) : onSluit()
        }
        laterLabel={heeftIets(profiel) ? 'Terug zonder plakken' : 'Later'}
      />
    </>
  )
}
