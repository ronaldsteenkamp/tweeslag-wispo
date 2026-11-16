import { useState, type FormEvent } from 'react'
import { DataStatus } from '../components/DataStatus'
import { NaamKiezer, useAlleNamen } from '../components/NaamKiezer'
import { openMijnProfiel, toonProfiel } from '../components/Profiel'
import { SchermKop } from '../components/SchermKop'
import { useNieuweKoppen } from '../lib/nieuweKoppen'
import { config } from '../config'
import { useData, type Kamer } from '../lib/data'
import { useToonNaam } from '../lib/bijnamen'
import { kamernaamFout, MAX_KAMERNAAM } from '../lib/kamernaamregels'
import { slaKamernaamOp, useEigenKamernamen, useKamerNaam } from '../lib/kamernamen'
import { useOpgeslagen } from '../lib/opslag'
import { profielAfVoor } from '../lib/profiel'

export default function Kamers({ naarVerdelen, naarBeheer }: { naarVerdelen: () => void; naarBeheer: () => void }) {
  const { data, fout } = useData('kamers')
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const [wijzigen, setWijzigen] = useState(false)
  const nieuweKop = useNieuweKoppen()

  const alleNamen = useAlleNamen(data)
  const toon = useToonNaam()
  const isReisleiding = naam !== null && config.reisleiding.includes(naam)

  if (!data) {
    return (
      <div className="scherm">
        {nieuweKop ? <SchermKop titel="Kamers" /> : <h1>Kamers</h1>}
        <DataStatus fout={fout} />
      </div>
    )
  }

  const naamBekend = naam !== null && alleNamen.includes(naam)
  if (!naamBekend || wijzigen) {
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
            setWijzigen(false)
            window.scrollTo(0, 0)
            if (!profielAfVoor(n)) openMijnProfiel()
          }}
        />
        {naamBekend && (
          <button type="button" className="knop knop--secundair knop--breed" onClick={() => setWijzigen(false)}>
            Annuleren
          </button>
        )}
      </div>
    )
  }

  const eigenKamer = data.kamers.find((k) => k.bewoners.includes(naam))
  const andere = data.kamers.filter((k) => k !== eigenKamer)
  const zonderKamer = data.zonderKamer

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

      {eigenKamer && (
        <section className="kaartje kamer kamer--eigen" aria-label="Jouw kamer">
          <p className="kamer__label">Jouw kamer</p>
          <KamerInhoud kamer={eigenKamer} jij={naam} />
          <KamernaamVeld kamer={eigenKamer} kamers={data.kamers} />
          <button type="button" className="tekstknop" onClick={() => setWijzigen(true)}>
            Ben je niet {toon(naam)}? Kies een andere naam
          </button>
        </section>
      )}

      {!eigenKamer && (
        <section className="kaartje kamer kamer--eigen" aria-label="Jouw kamer">
          <p className="kamer__label">Jouw kamer</p>
          <p>Je hebt nog geen kamer. De reisleiding maakt de kamerverdeling; daarna staat je kamer hier.</p>
          <button type="button" className="tekstknop" onClick={() => setWijzigen(true)}>
            Ben je niet {toon(naam)}? Kies een andere naam
          </button>
        </section>
      )}

      <h2 className="tussenkop">Alle kamers</h2>

      {andere.map((k) => (
        <section className="kaartje kamer" key={k.nummer + (k.naam ?? '')}>
          <KamerInhoud kamer={k} jij={naam} />
        </section>
      ))}

      {zonderKamer.length > 0 && (
        <section className="kaartje kamer">
          <div className="kamer__kop">
            <h2>Nog geen kamer</h2>
          </div>
          <Bewoners namen={zonderKamer} jij={naam} />
        </section>
      )}

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

function KamerInhoud({ kamer, jij }: { kamer: Kamer; jij: string }) {
  const kamerNaam = useKamerNaam()(kamer)
  return (
    <>
      <div className="kamer__kop">
        <span className="kamer__nummer">{kamer.nummer}</span>
        {kamerNaam && <h2>{kamerNaam}</h2>}
        {kamer.bedden !== undefined && (
          <span className="kamer__bedden">
            {kamer.bedden} bedden
            {kamer.bedden > kamer.bewoners.length && ` · ${kamer.bedden - kamer.bewoners.length} vrij`}
          </span>
        )}
      </div>
      <Bewoners namen={kamer.bewoners} jij={jij} />
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
        ✏️ {huidig ? 'Naam van de kamer aanpassen' : 'Geef je kamer een naam'}
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

function Bewoners({ namen, jij }: { namen: string[]; jij: string }) {
  const toon = useToonNaam()
  return (
    <ul className="bewoners">
      {namen.map((b) => (
        <li key={b} className={b === jij ? 'is-jij' : ''}>
          <button type="button" className="bewoners__naam" onClick={() => toonProfiel(b)}>
            {toon(b)}
            {b === jij && <span className="label label--accent">jij</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
