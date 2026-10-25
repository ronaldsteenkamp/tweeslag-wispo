import { useEffect, useState, type FormEvent } from 'react'
import { Verbinding } from '../components/Verbinding'
import { controleerCode, stuurInlogmail, stuurProfiel, uitloggen, useBackend, verbind } from '../lib/backend'
import { alleDeelnemers, useData } from '../lib/data'
import { haalLogboek, stuurBericht, type LogRegel } from '../lib/meldingen'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { synchroniseerStemmingen, trekStemIn, useStemmingen, useStemmingSync } from '../lib/stemming'
import { tijdUUMM } from '../lib/tijd'

/** Beheer voor de reisleiding: verbinding, dit apparaat en inloggen met e-mail */
export default function Beheer({ terug }: { terug: () => void }) {
  const b = useBackend()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [mailVerstuurd, setMailVerstuurd] = useState(false)
  const [melding, setMelding] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  const verstuur = async (e: FormEvent) => {
    e.preventDefault()
    setBezig(true)
    setMelding(null)
    const fout = await stuurInlogmail(email)
    setBezig(false)
    if (fout) setMelding(`Versturen lukte niet: ${fout}`)
    else setMailVerstuurd(true)
  }

  const logIn = async (e: FormEvent) => {
    e.preventDefault()
    setBezig(true)
    setMelding(null)
    const fout = await controleerCode(email, code)
    setBezig(false)
    if (fout) setMelding(`Inloggen lukte niet: ${fout}`)
    else {
      setCode('')
      setMailVerstuurd(false)
    }
  }

  return (
    <div className="scherm beheer">
      <button type="button" className="tekstknop" onClick={terug}>
        ← Terug naar Kamers
      </button>
      <h1>Beheer</h1>

      <section className="kaartje">
        <div className="kaartje__kop">
          <h2>Verbinding</h2>
          <Verbinding />
        </div>
        {b.status === 'uit' && (
          <p>
            Er is nog geen backend ingesteld. De app werkt gewoon, maar gedeelde functies (scorebord, stemming,
            meldingen en foto's) staan uit. Zie het hoofdstuk <em>Backend (Supabase)</em> in de README.
          </p>
        )}
        {b.status === 'offline' && (
          <>
            <p>Geen verbinding met de server. Alles wat je doet wordt bewaard en later verstuurd.</p>
            <button type="button" className="knop knop--secundair knop--breed" onClick={() => void verbind()}>
              Opnieuw proberen
            </button>
          </>
        )}
      </section>

      {b.status !== 'uit' && (
        <section className="kaartje">
          <h2>Dit apparaat</h2>
          <dl className="beheer__feiten">
            <div>
              <dt>Gebruiker</dt>
              <dd>
                {b.userId ? (b.anoniem ? `Anoniem · …${b.userId.slice(-6)}` : b.email) : 'Nog niet aangemeld'}
              </dd>
            </div>
            <div>
              <dt>Gekoppeld als</dt>
              <dd>
                {b.gekoppeld
                  ? `${b.gekoppeld.naam}${b.gekoppeld.kamer ? ` · kamer ${b.gekoppeld.kamer}` : ''}`
                  : 'Nog niet (kies je naam, of wacht op verbinding)'}
              </dd>
            </div>
            <div>
              <dt>Beheerder</dt>
              <dd>{b.beheerder ? 'Ja ✓' : 'Nee'}</dd>
            </div>
          </dl>
          {b.status === 'verbonden' && !b.gekoppeld && (
            <button type="button" className="tekstknop" onClick={() => void stuurProfiel(true, true)}>
              Naam opnieuw versturen
            </button>
          )}
        </section>
      )}

      {b.status === 'verbonden' && b.anoniem && (
        <section className="kaartje">
          <h2>Inloggen als reisleiding</h2>
          <p>
            Je krijgt een mail met een inloglink. Tik erop in de browser waarin je wilt beheren. Op Android werkt dat
            ook voor de geïnstalleerde app. Op een iPhone opent de link in Safari: doe het beheer dan in Safari (de app
            op het beginscherm heeft een eigen opslag).
          </p>
          {!mailVerstuurd ? (
            <form className="beheer__formulier" onSubmit={verstuur}>
              <label className="verborgen" htmlFor="beheer-email">
                E-mailadres
              </label>
              <input
                id="beheer-email"
                className="invoer"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="jouw@mailadres.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="knop knop--primair knop--breed" disabled={bezig || !email.includes('@')}>
                {bezig ? 'Bezig…' : 'Stuur inlogmail'}
              </button>
            </form>
          ) : (
            <form className="beheer__formulier" onSubmit={logIn}>
              <p className="klein">Mail verstuurd naar {email}. Tik op de link in de mail. Staat er een code in, dan kun je die hier invullen.</p>
              <label className="verborgen" htmlFor="beheer-code">
                Code uit de mail
              </label>
              <input
                id="beheer-code"
                className="invoer beheer__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code uit de mail"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
              />
              <button type="submit" className="knop knop--primair knop--breed" disabled={bezig || code.length < 6}>
                {bezig ? 'Bezig…' : 'Inloggen'}
              </button>
              <button type="button" className="tekstknop" onClick={() => setMailVerstuurd(false)}>
                Ander adres of opnieuw sturen
              </button>
            </form>
          )}
        </section>
      )}

      {!b.anoniem && b.userId && (
        <section className="kaartje">
          <h2>Ingelogd</h2>
          {!b.beheerder && (
            <p className="melding">
              Dit adres staat nog niet in de tabel <code>beheerders</code>. Voeg het toe in Supabase (SQL Editor):
              <br />
              <code>insert into public.beheerders (email) values ('{b.email}');</code>
            </p>
          )}
          <button type="button" className="knop knop--secundair knop--breed" onClick={() => void uitloggen()}>
            Uitloggen
          </button>
        </section>
      )}

      {b.beheerder && b.status === 'verbonden' && <MeldingBeheer />}
      {b.beheerder && b.status === 'verbonden' && <StemmingBeheer />}

      {melding && (
        <p className="melding melding--fout" role="alert">
          {melding}
        </p>
      )}
    </div>
  )
}

/** Stemmingen: stemmingen.json naar de server zetten en een stem intrekken */
function StemmingBeheer() {
  const { resultaat, bezig } = useStemmingSync()
  const { stemmingen } = useStemmingen()
  const { data: kamers } = useData('kamers')
  const [stemming, setStemming] = useState('')
  const [kiezer, setKiezer] = useState('')
  const [melding, setMelding] = useState<string | null>(null)
  const namen = alleDeelnemers(kamers).sort((a, b) => a.localeCompare(b, 'nl'))
  const nu = Date.now()
  // Intrekken heeft alleen zin terwijl de stemming nog open is
  const open = stemmingen.filter((s) => !s.alleenLokaal && s.open <= nu && nu < s.sluit)

  const intrekken = async (e: FormEvent) => {
    e.preventDefault()
    setMelding(null)
    const fout = await trekStemIn(stemming, kiezer)
    setMelding(fout ?? `De stem van ${kiezer} is ingetrokken. ${kiezer} kan opnieuw stemmen.`)
  }

  return (
    <section className="kaartje">
      <h2>Stemmingen</h2>
      <p className="klein">
        De vragen uit <code>stemmingen.json</code> en de namen uit <code>kamers.json</code> gaan vanzelf naar de server
        als je de app als beheerder opent.
      </p>
      {resultaat && (
        <p className="klein">
          Gecontroleerd om {tijdUUMM(new Date(resultaat.tijd))}: {resultaat.aantal} stemmingen,{' '}
          {resultaat.bijgewerkt ? `${resultaat.bijgewerkt} bijgewerkt` : 'alles was al up-to-date'}
          {resultaat.verwijderd > 0 && `, ${resultaat.verwijderd} weggehaald`}.
          {resultaat.extra.length > 0 &&
            ` Niet meer in de JSON, maar er is al op gestemd (blijft staan): ${resultaat.extra.join(', ')}.`}
        </p>
      )}
      {resultaat?.fouten.map((f) => (
        <p key={f} className="melding melding--fout">
          {f}
        </p>
      ))}
      <button type="button" className="knop knop--secundair knop--breed" disabled={bezig} onClick={() => void synchroniseerStemmingen()}>
        {bezig ? 'Bezig…' : 'Nu bijwerken'}
      </button>

      {open.length > 0 && (
        <form className="beheer__formulier" onSubmit={intrekken}>
          <h3>Stem intrekken</h3>
          <p className="klein">Heeft iemand per ongeluk verkeerd gestemd? Haal de stem weg, dan kan diegene opnieuw stemmen. Je ziet niet wat er gestemd is.</p>
          <select className="invoer" value={stemming} onChange={(e) => setStemming(e.target.value)} required>
            <option value="">Stemming…</option>
            {open.map((s) => (
              <option key={s.id} value={s.id}>
                {s.vraag}
              </option>
            ))}
          </select>
          <select className="invoer" value={kiezer} onChange={(e) => setKiezer(e.target.value)} required>
            <option value="">Van wie…</option>
            {namen.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button type="submit" className="knop knop--gevaar knop--breed" disabled={!stemming || !kiezer}>
            Stem intrekken
          </button>
          {melding && <p className="klein">{melding}</p>}
        </form>
      )}
    </section>
  )
}

const SCHERMEN = [
  ['#home', 'Home'],
  ['#planning', 'Planning'],
  ['#paklijst', 'Paklijst'],
  ['#kamers', 'Kamers'],
  ['#kaart', 'Kaart'],
  ['#rad', 'Rad'],
  ['#spel', 'Spel'],
  ['#stemmen', 'Stemmen'],
  ['#fotos', 'Fotomuur'],
  ['#weer', 'Weer'],
] as const

/** Meldingen: bericht aan iedereen, aantal aangemelde apparaten en wat er verstuurd is */
function MeldingBeheer() {
  const [titel, setTitel] = useState('')
  const [tekst, setTekst] = useState('')
  const [url, setUrl] = useState('#home')
  const [vragen, setVragen] = useState(false)
  const [bezig, setBezig] = useState(false)
  const [melding, setMelding] = useState<string | null>(null)
  const [log, setLog] = useState<{ regels: LogRegel[]; apparaten: number; personen: number } | null>(null)

  const laadLog = () => void haalLogboek().then(setLog)
  useEffect(laadLog, [])

  const verstuur = async () => {
    setVragen(false)
    setBezig(true)
    setMelding(null)
    const { data, fout } = await stuurBericht(titel, tekst, url)
    setBezig(false)
    if (fout) setMelding(`Versturen lukte niet: ${fout}`)
    else {
      setMelding(`Verstuurd naar ${data?.gelukt ?? 0} apparaat/apparaten${data?.mislukt ? ` (${data.mislukt} mislukt)` : ''} ✓`)
      setTitel('')
      setTekst('')
      laadLog()
    }
  }

  return (
    <section className="kaartje">
      <h2>Meldingen</h2>
      <p className="klein">
        {log
          ? `${log.apparaten} apparaat/apparaten met meldingen aan (${log.personen} ${log.personen === 1 ? 'persoon' : 'personen'}).`
          : 'Laden…'}
      </p>
      <form
        className="beheer__formulier"
        onSubmit={(e) => {
          e.preventDefault()
          if (titel.trim()) setVragen(true)
        }}
      >
        <h3>Bericht aan iedereen</h3>
        <input className="invoer" value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={60} placeholder="Titel, bijv. Bus 15 min later" required />
        <textarea className="invoer" value={tekst} onChange={(e) => setTekst(e.target.value)} maxLength={300} rows={3} placeholder="Tekst (mag leeg)" />
        <label className="verdelen__veld">
          <span>Openen op</span>
          <select className="invoer" value={url} onChange={(e) => setUrl(e.target.value)}>
            {SCHERMEN.map(([u, n]) => (
              <option key={u} value={u}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="knop knop--primair knop--breed" disabled={bezig || !titel.trim()}>
          {bezig ? 'Bezig…' : 'Versturen'}
        </button>
        {melding && <p className="klein">{melding}</p>}
      </form>
      <BevestigDialoog
        open={vragen}
        titel="Bericht versturen?"
        tekst={`Iedereen met meldingen aan krijgt: "${titel}"${tekst ? ` – ${tekst}` : ''}`}
        bevestigLabel="Versturen"
        onAnnuleer={() => setVragen(false)}
        onBevestig={() => void verstuur()}
      />

      {log && log.regels.length > 0 && (
        <>
          <h3>Laatst verstuurd</h3>
          <ul className="meldingen-log">
            {log.regels.map((r) => (
              <li key={r.id}>
                {r.titel}
                <small>
                  {new Date(r.gemaakt).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ·{' '}
                  {r.soort} · {r.aantal} ontvangen
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="klein">
        Automatisch gaan er ook meldingen uit: 30 minuten voor planningsitems met <code>"melding": true</code>, als de
        challenges van de dag opengaan en als de uitslag van een stemming bekend is.
      </p>
    </section>
  )
}
