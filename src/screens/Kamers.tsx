import { useState, type CSSProperties, type FormEvent } from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { NaamKiezer, normaal, useAlleNamen } from '../components/NaamKiezer'
import { openMijnProfiel, Pistebord, toonProfiel } from '../components/Profiel'
import { SchermKop } from '../components/SchermKop'
import { useNieuweKoppen } from '../lib/nieuweKoppen'
import { config } from '../config'
import { useData, type Kamer } from '../lib/data'
import { useToonNaam } from '../lib/bijnamen'
import { kamernaamFout, MAX_KAMERNAAM } from '../lib/kamernaamregels'
import { slaKamernaamOp, useEigenKamernamen, useKamerNaam } from '../lib/kamernamen'
import { useOpgeslagen } from '../lib/opslag'
import { profielBestaatVoor, sleutel, useMijnProfiel, useProfielen, useProfielFoto } from '../lib/profiel'

export default function Kamers({ naarVerdelen, naarBeheer }: { naarVerdelen: () => void; naarBeheer: () => void }) {
  const { data, fout } = useData('kamers')
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const nieuweKop = useNieuweKoppen()

  const alleNamen = useAlleNamen(data)
  const toon = useToonNaam()
  const kamerNaamVan = useKamerNaam()
  const [zoek, setZoek] = useState('')
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
  const naamBekend = naam !== null && alleNamen.includes(naam)
  if (!naamBekend) {
    return (
      <div className="scherm">
        {nieuweKop ? <SchermKop titel="Wie ben jij?" boven="Kamers" /> : <h1>Wie ben jij?</h1>}
        <p>
          {naam !== null && !naamBekend
            ? 'Je naam staat niet meer in de kamerlijst. Kies hem opnieuw.'
            : 'Kies je naam, dan zie je je eigen kamer meteen bovenaan.'}{' '}
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

  const eigenKamer = data.kamers.find((k) => k.bewoners.includes(naam))
  const andere = data.kamers.filter((k) => k !== eigenKamer)
  const zonderKamer = data.zonderKamer

  // Zoeken: op naam, bijnaam of kamernummer/-naam
  const q = normaal(zoek)
  const past = (n: string) => !q || normaal(n).includes(q) || normaal(toon(n)).includes(q)
  const kamerPast = (k: Kamer) => !!q && (normaal(k.nummer) === q || normaal(kamerNaamVan(k) ?? '').includes(q))
  const toont = (k: Kamer) => kamerPast(k) || k.bewoners.some(past)
  /** Past de kamer zelf, dan iedereen erin tonen; anders alleen wie past */
  const filterVoor = (k: Kamer) => (kamerPast(k) ? () => true : past)
  const gevonden = data.kamers.some(toont) || zonderKamer.some(past)

  // Met de nieuwe kop: "Jij slaapt in kamer N met …" (de anderen met hun bijnaam, zoals overal)
  const kamergenoten = eigenKamer?.bewoners.filter((b) => b !== naam).map(toon) ?? []
  const eigenOndertitel = eigenKamer
    ? `Jij slaapt in kamer ${eigenKamer.nummer}${kamergenoten.length ? ` met ${opsomming(kamergenoten)}` : ''}`
    : data.verblijf

  return (
    <div className="scherm">
      {nieuweKop ? (
        <SchermKop titel="Kamers" ondertitel={eigenOndertitel} boven={eigenKamer ? data.verblijf : undefined} />
      ) : (
        <>
          <h1>Kamers</h1>
          {data.verblijf && <p className="ondertitel">{data.verblijf}</p>}
        </>
      )}

      <div className="albumzoek">
        <div className="zoekveld">
          <Icoon naam="zoek" />
          <label className="verborgen" htmlFor="zoek-plaatje">
            Zoek op naam, bijnaam of kamer
          </label>
          <input
            id="zoek-plaatje"
            type="search"
            className="invoer"
            placeholder="Zoek een plaatje"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </div>

      {eigenKamer && toont(eigenKamer) && (
        <section className="albumpagina albumpagina--eigen" aria-label="Jouw kamer">
          <KamerInhoud kamer={eigenKamer} jij={naam} alleNamen={alleNamen} filter={filterVoor(eigenKamer)} eigen />
          {!q && <KamernaamVeld kamer={eigenKamer} kamers={data.kamers} />}
        </section>
      )}

      {!eigenKamer && !q && (
        <section className="albumpagina albumpagina--eigen" aria-label="Jouw kamer">
          <p>Je hebt nog geen kamer. De reisleiding maakt de kamerverdeling; daarna staat je kamer hier.</p>
        </section>
      )}

      {!q && <h2 className="albumtussenkop">Alle kamers</h2>}

      {andere
        .filter(toont)
        .map((k) => (
          <section className="albumpagina" key={k.nummer + (k.naam ?? '')}>
            <KamerInhoud kamer={k} jij={naam} alleNamen={alleNamen} filter={filterVoor(k)} />
          </section>
        ))}

      {zonderKamer.some(past) && (
        <section className="albumpagina">
          <div className="albumpagina__kop">
            <h2>Nog geen kamer</h2>
          </div>
          <Bewoners namen={zonderKamer.filter(past)} jij={naam} alleNamen={alleNamen} kamer={null} />
        </section>
      )}

      {q && !gevonden && <p className="laadtekst">Niemand gevonden. Zoek op voornaam, bijnaam of kamernummer.</p>}

      {isReisleiding && (
        <>
          <button type="button" className="knop knop--secundair knop--breed" onClick={naarVerdelen}>
            🛏️ Kamerverdeling maken (reisleiding)
          </button>
          <button type="button" className="knop knop--secundair knop--breed" onClick={naarBeheer}>
            ⚙️ Beheer (reisleiding)
          </button>
        </>
      )}
    </div>
  )
}

/** "Anna, Bram en Cas" */
function opsomming(namen: string[]): string {
  return namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`
}

function KamerInhoud({
  kamer,
  jij,
  alleNamen,
  filter,
  eigen = false,
}: {
  kamer: Kamer
  jij: string
  alleNamen: string[]
  filter: (n: string) => boolean
  eigen?: boolean
}) {
  const kamerNaam = useKamerNaam()(kamer)
  const vrij = kamer.bedden !== undefined && kamer.bedden > kamer.bewoners.length ? kamer.bedden - kamer.bewoners.length : 0
  return (
    <>
      <div className="albumpagina__kop">
        <h2>{kamerNaam ?? `Kamer ${kamer.nummer}`}</h2>
        <span>
          {eigen ? 'Jouw kamer · ' : ''}
          {kamerNaam ? `Kamer ${kamer.nummer}` : ''}
          {vrij > 0 && `${kamerNaam ? ' · ' : ''}${vrij} vrij`}
        </span>
      </div>
      <Bewoners namen={kamer.bewoners.filter(filter)} jij={jij} alleNamen={alleNamen} kamer={kamer.nummer} />
    </>
  )
}

/**
 * De bewoners passen zelf de naam van hun kamer aan. Leeg laten = weer de naam van de reisleiding.
 * Opslaan kan alleen met internet; de server controleert of je echt in deze kamer slaapt.
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
        {huidig ? 'Naam van de kamer aanpassen' : 'Geef je kamer een naam'}
      </button>
    )
  }
  return (
    <form className="kamernaam" onSubmit={(e) => void bewaar(e)}>
      <label htmlFor="kamernaam-veld">Naam van kamer {kamer.nummer}</label>
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

/** De bewoners als plaatjes in het album: twee naast elkaar, tik voor het hele plaatje */
function Bewoners({ namen, jij, alleNamen, kamer }: { namen: string[]; jij: string; alleNamen: string[]; kamer: string | null }) {
  const { perNaam } = useProfielen()
  const mijn = useMijnProfiel()
  return (
    <ul className="album">
      {namen.map((b, i) => {
        const eigen = b === jij
        const rij = perNaam.get(sleutel(b))
        const foto = eigen ? { pad: mijn?.foto ?? null, lokaal: mijn?.fotoLokaal ?? null } : { pad: rij?.foto_pad ?? null, lokaal: null }
        const niveau = eigen ? (mijn?.niveau ?? null) : (rij?.niveau ?? null)
        return (
          <li key={b}>
            <MiniPlaatje
              naam={b}
              jij={eigen}
              pad={foto.pad}
              lokaal={foto.lokaal}
              niveau={niveau}
              nummer={alleNamen.indexOf(b) + 1}
              kamer={kamer}
              draai={DRAAI[i % DRAAI.length]}
            />
          </li>
        )
      })}
    </ul>
  )
}

const DRAAI = [-1.5, 1.2, 0.6, -0.8]

function MiniPlaatje(props: {
  naam: string
  jij: boolean
  pad: string | null
  lokaal: string | null
  niveau: number | null
  nummer: number
  kamer: string | null
  draai: number
}) {
  const { naam, jij, niveau, nummer, kamer, draai } = props
  const url = useProfielFoto(props.pad, props.lokaal)
  const toon = useToonNaam()
  const getoond = toon(naam)
  const label = `${naam}${getoond !== naam ? `, ${getoond}` : ''}${kamer ? `, kamer ${kamer}` : ''}${jij ? ', jij' : ''}`
  const naamregel = (
    <span className="mini__naam">
      {getoond}
      {jij && <span className="mini__jij">jij</span>}
    </span>
  )
  return (
    <button type="button" className={`mini${url ? '' : ' mini--leeg'}${jij ? ' is-jij' : ''}`} onClick={() => toonProfiel(naam)} aria-label={label}>
      {url ? (
        <span className="mini__beeld" style={{ '--draai': `${draai}deg` } as CSSProperties}>
          <img src={url} alt="" />
          {niveau && <Pistebord niveau={niveau} className="mini__piste" />}
          {naamregel}
        </span>
      ) : (
        <>
          <span className="mini__beeld" aria-hidden="true">
            <b>{String(nummer).padStart(2, '0')}</b>
          </span>
          {naamregel}
        </>
      )}
    </button>
  )
}
