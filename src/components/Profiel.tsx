import { useEffect, useRef, useState } from 'react'
import { useBackend } from '../lib/backend'
import { useData } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'
import {
  isAf,
  MAX,
  NIVEAUS,
  SKI_KEUZES,
  sleutel,
  slaProfielOp,
  useMijnProfiel,
  useProfielen,
  useProfielFoto,
  wisProfiel,
  type Profiel,
  type ProfielRij,
} from '../lib/profiel'
import { BevestigDialoog } from './BevestigDialoog'
import { FotoBijsnijder } from './FotoBijsnijder'
import { NaamKiezer, useAlleNamen } from './NaamKiezer'

// ---------- Eén venster voor de hele app ----------

type Venster = { soort: 'bekijk'; naam: string } | { soort: 'mijn'; naamKiezen: boolean } | null

let venster: Venster = null
const vensterLuisteraars = new Set<() => void>()
const zetVenster = (v: Venster) => {
  venster = v
  vensterLuisteraars.forEach((f) => f())
}

/** Toont het profielkaartje van iemand (of je eigen) */
export const toonProfiel = (naam: string) => zetVenster({ soort: 'bekijk', naam })
/** Opent je eigen profiel om aan te passen, eventueel meteen met het kiezen van je naam */
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

const initialen = (naam: string) =>
  naam
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('nl')

/** Profielfoto, of de initialen als er geen foto is */
export function Avatar({
  naam,
  pad,
  lokaal,
  groot,
}: {
  naam: string
  pad: string | null
  lokaal?: string | null
  groot?: boolean
}) {
  const url = useProfielFoto(pad, lokaal)
  return (
    <span className={`avatar${groot ? ' avatar--groot' : ''}`} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initialen(naam)}
    </span>
  )
}

function Niveau({ niveau }: { niveau: number }) {
  return (
    <span className="niveau" aria-label={`Niveau ${niveau} van 5: ${NIVEAUS[niveau - 1]}`}>
      <span className="niveau__balk" aria-hidden="true">
        {NIVEAUS.map((_, i) => (
          <span key={i} className={i < niveau ? 'is-aan' : ''} />
        ))}
      </span>
      {NIVEAUS[niveau - 1]}
    </span>
  )
}

/** Een bekeken profiel: van de server, of je eigen (ook als het nog verstuurd moet worden) */
type Bekeken = Pick<ProfielRij, 'naam' | 'ski' | 'niveau' | 'feitje' | 'karaoke' | 'angst' | 'foto_pad'> & {
  fotoLokaal?: string | null
}

function ProfielInhoud({ p }: { p: Bekeken }) {
  return (
    <div className="profielkaart">
      <div className="profielkaart__kop">
        <Avatar naam={p.naam} pad={p.foto_pad} lokaal={p.fotoLokaal} groot />
        <h2 id="venster-titel">{p.naam}</h2>
      </div>
      <dl className="profielkaart__lijst">
        <div>
          <dt>⛷️ Ski of board</dt>
          <dd>{SKI_KEUZES.find((k) => k.waarde === p.ski)?.label}</dd>
        </div>
        <div>
          <dt>📊 Niveau</dt>
          <dd>
            <Niveau niveau={p.niveau} />
          </dd>
        </div>
        <div>
          <dt>🤫 Wat niemand van me weet</dt>
          <dd>{p.feitje}</dd>
        </div>
        {p.karaoke && (
          <div>
            <dt>🎤 Karaokenummer of buslied</dt>
            <dd>{p.karaoke}</dd>
          </div>
        )}
        {p.angst && (
          <div>
            <dt>🥶 Grootste angst</dt>
            <dd>{p.angst}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

// ---------- Invullen ----------

/** Het profielformulier, voor het welkomstscherm en voor "Jouw profiel" */
export function ProfielFormulier({
  profiel,
  onKlaar,
  laterLabel = 'Later invullen',
}: {
  profiel: Profiel
  onKlaar: () => void
  laterLabel?: string
}) {
  const [ski, setSki] = useState(profiel.ski)
  const [niveau, setNiveau] = useState(profiel.niveau)
  const [feitje, setFeitje] = useState(profiel.feitje)
  const [karaoke, setKaraoke] = useState(profiel.karaoke)
  const [angst, setAngst] = useState(profiel.angst)
  const [foto, setFoto] = useState(profiel.foto)
  const [fotoLokaal, setFotoLokaal] = useState(profiel.fotoLokaal)
  const [fotoFout, setFotoFout] = useState<string | null>(null)
  // De gekozen foto (om opnieuw bij te snijden) en de foto die nu bijgesneden wordt
  const [origineel, setOrigineel] = useState<File | null>(null)
  const [bijsnijden, setBijsnijden] = useState<File | null>(null)
  const bestand = useRef<HTMLInputElement>(null)

  const af = isAf({ ski, niveau, feitje })

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
      <FotoBijsnijder
        bestand={bijsnijden}
        onKlaar={(b) => void bijgesneden(b)}
        onAnnuleer={() => setBijsnijden(null)}
      />
    )
  }

  const opslaan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!af) return
    slaProfielOp({ ...profiel, ski, niveau, feitje, karaoke, angst, foto, fotoLokaal })
    onKlaar()
  }

  return (
    <form className="profielformulier" onSubmit={opslaan}>
      <div className="profielformulier__foto">
        <Avatar naam={profiel.naam} pad={foto} lokaal={fotoLokaal} groot />
        <div className="profielformulier__fotoknoppen">
          <button type="button" className="knop knop--secundair knop--klein" onClick={() => bestand.current?.click()}>
            📸 {foto || fotoLokaal ? 'Andere foto' : 'Foto kiezen'}
          </button>
          {origineel && fotoLokaal && (
            <button type="button" className="tekstknop" onClick={() => setBijsnijden(origineel)}>
              Opnieuw bijsnijden
            </button>
          )}
          {(foto || fotoLokaal) && (
            <button
              type="button"
              className="tekstknop"
              onClick={() => {
                setFoto(null)
                setFotoLokaal(null)
                setOrigineel(null)
              }}
            >
              Foto weghalen
            </button>
          )}
          <span className="klein">Optioneel</span>
        </div>
        <input ref={bestand} type="file" accept="image/*" hidden onChange={(e) => kiesFoto(e.target.files?.[0])} />
      </div>
      {fotoFout && <p className="melding melding--fout">{fotoFout}</p>}

      <fieldset className="veld">
        <legend>⛷️ Ski of board</legend>
        <div className="keuzes">
          {SKI_KEUZES.map((k) => (
            <button
              key={k.waarde}
              type="button"
              className={`keuze${ski === k.waarde ? ' is-actief' : ''}`}
              aria-pressed={ski === k.waarde}
              onClick={() => setSki(k.waarde)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="veld">
        <legend>📊 Niveau</legend>
        <div className="keuzes keuzes--lijst">
          {NIVEAUS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`keuze${niveau === i + 1 ? ' is-actief' : ''}`}
              aria-pressed={niveau === i + 1}
              onClick={() => setNiveau(i + 1)}
            >
              <span className="keuze__nummer">{i + 1}</span>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <Tekstveld
        label="🤫 Leuk feitje dat niemand van je weet"
        waarde={feitje}
        max={MAX.feitje}
        onWijzig={setFeitje}
        placeholder="Ik heb ooit een speer gegooid op het NK"
        lang
      />
      <Tekstveld
        label="🎤 Karaokenummer of buslied"
        waarde={karaoke}
        max={MAX.karaoke}
        onWijzig={setKaraoke}
        placeholder="Bijv. Dancing Queen"
        optioneel
      />
      <Tekstveld
        label="🥶 Grootste angst"
        waarde={angst}
        max={MAX.angst}
        onWijzig={setAngst}
        placeholder="Spinnen, stoeltjeslift, stilte in een lift met onbekenden"
        optioneel
      />

      {!af && <p className="klein">Vul ski of board, je niveau en een feitje in om op te slaan.</p>}
      <button type="submit" className="knop knop--primair knop--breed" disabled={!af}>
        Opslaan
      </button>
      <button type="button" className="knop knop--secundair knop--breed" onClick={onKlaar}>
        {laterLabel}
      </button>
    </form>
  )
}

function Tekstveld({
  label,
  waarde,
  max,
  onWijzig,
  placeholder,
  lang,
  optioneel,
}: {
  label: string
  waarde: string
  max: number
  onWijzig: (w: string) => void
  placeholder: string
  lang?: boolean
  optioneel?: boolean
}) {
  const props = {
    className: 'invoer',
    value: waarde,
    maxLength: max,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onWijzig(e.target.value),
  }
  return (
    <label className="veld">
      <span className="veld__kop">
        <span>
          {label}
          {optioneel && <span className="veld__optioneel"> (optioneel)</span>}
        </span>
        <span className={`teller${waarde.length >= max ? ' teller--klaar' : ''}`}>
          {waarde.length}/{max}
        </span>
      </span>
      {lang ? <textarea rows={3} {...props} /> : <input {...props} />}
    </label>
  )
}

// ---------- Het venster ----------

/** Eén keer in App: toont een profielkaartje of je eigen profiel om aan te passen */
export function ProfielVenster() {
  const v = useVenster()
  const sluit = () => zetVenster(null)

  useEffect(() => {
    if (!v) return
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && zetVenster(null)
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [v])

  if (!v) return null
  return (
    <div className="dialoog-achtergrond" onClick={sluit}>
      <div
        className="dialoog dialoog--hoog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="venster-titel"
        onClick={(e) => e.stopPropagation()}
      >
        {v.soort === 'bekijk' ? (
          <Bekijk naam={v.naam} onSluit={sluit} />
        ) : (
          <MijnProfiel naamKiezen={v.naamKiezen} onSluit={sluit} />
        )}
      </div>
    </div>
  )
}

function Bekijk({ naam, onSluit }: { naam: string; onSluit: () => void }) {
  const [mijnNaam] = useOpgeslagen<string | null>('naam', null)
  const mijn = useMijnProfiel()
  const { perNaam } = useProfielen()
  const backend = useBackend()
  const [wissen, setWissen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  const eigen = mijnNaam !== null && sleutel(mijnNaam) === sleutel(naam)
  const rij = perNaam.get(sleutel(naam))
  const p: Bekeken | null =
    eigen && mijn && isAf(mijn)
      ? { ...mijn, ski: mijn.ski!, niveau: mijn.niveau!, foto_pad: mijn.foto, fotoLokaal: mijn.fotoLokaal }
      : !eigen && rij
        ? rij
        : null

  return (
    <>
      {p ? (
        <ProfielInhoud p={p} />
      ) : (
        <>
          <div className="profielkaart__kop">
            <Avatar naam={naam} pad={null} groot />
            <h2 id="venster-titel">{naam}</h2>
          </div>
          <p>{eigen ? 'Je hebt je profiel nog niet ingevuld.' : `${naam} heeft nog geen profiel ingevuld.`}</p>
        </>
      )}
      {eigen && (
        <button type="button" className="knop knop--primair knop--breed" onClick={() => openMijnProfiel()}>
          {p ? 'Aanpassen' : 'Profiel invullen'}
        </button>
      )}
      {!eigen && rij && backend.beheerder && (
        <button type="button" className="knop knop--gevaar knop--breed" onClick={() => setWissen(true)}>
          Profiel wissen (beheer)
        </button>
      )}
      {fout && <p className="melding melding--fout">{fout}</p>}
      <button type="button" className="knop knop--secundair knop--breed" onClick={onSluit}>
        Sluiten
      </button>
      {rij && (
        <BevestigDialoog
          open={wissen}
          titel={`Profiel van ${naam} wissen?`}
          tekst="Het hele profiel en de profielfoto verdwijnen. Diegene kan daarna een nieuw profiel invullen."
          bevestigLabel="Wissen"
          gevaarlijk
          onAnnuleer={() => setWissen(false)}
          onBevestig={() => {
            setWissen(false)
            void wisProfiel(rij).then((f) => (f ? setFout(f) : onSluit()))
          }}
        />
      )}
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
        <h2 id="venster-titel">Wie ben jij?</h2>
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
          className="knop knop--secundair knop--breed"
          onClick={() => (naam && !naamKiezen ? setKiezen(false) : onSluit())}
        >
          Annuleren
        </button>
      </>
    )
  }

  return (
    <>
      <h2 id="venster-titel">Jouw profiel</h2>
      <p className="profiel__naamregel">
        <strong>{naam}</strong>
        <button type="button" className="tekstknop" onClick={() => setKiezen(true)}>
          Andere naam kiezen
        </button>
      </p>
      {/* Opnieuw beginnen zodra het profiel van de server binnen is (na het kiezen van een naam) */}
      <ProfielFormulier
        key={`${profiel.naam}|${profiel.verstuurd ? 'server' : 'lokaal'}`}
        profiel={profiel}
        onKlaar={onSluit}
        laterLabel={isAf(profiel) ? 'Annuleren' : 'Later invullen'}
      />
    </>
  )
}
