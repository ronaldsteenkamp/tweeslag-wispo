import { useState, type FormEvent } from 'react'
import { Verbinding } from '../components/Verbinding'
import { controleerCode, stuurInlogmail, stuurProfiel, uitloggen, useBackend, verbind } from '../lib/backend'

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
            <button type="button" className="tekstknop" onClick={() => void stuurProfiel(true)}>
              Naam opnieuw versturen
            </button>
          )}
        </section>
      )}

      {b.status === 'verbonden' && b.anoniem && (
        <section className="kaartje">
          <h2>Inloggen als reisleiding</h2>
          <p>
            Je krijgt een mail met een inloglink én een code. Gebruik je de app op het beginscherm van een iPhone,
            typ dan de code over: de link opent in Safari, en dat is een andere opslag dan de app.
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
              <p className="klein">Mail verstuurd naar {email}. Tik op de link, of vul hier de code in.</p>
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

      {melding && (
        <p className="melding melding--fout" role="alert">
          {melding}
        </p>
      )}
    </div>
  )
}
