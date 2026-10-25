import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { normaal } from '../components/NaamKiezer'
import { config } from '../config'
import { backendIngesteld, useBackend } from '../lib/backend'
import { useData } from '../lib/data'
import { SERVER_VERSIE, slaKamerverdelingOp, type ServerVersie } from '../lib/kamerverdeling'
import { useOpgeslagen } from '../lib/opslag'
import { bijwerken, naarJson, nieuwId, uitData, verdeelAutomatisch, zonder, type Concept, type ConceptKamer } from '../lib/verdeling'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'

/** Kamerverdeling maken (voor de reisleiding). Alles blijft op dit apparaat tot je kamers.json op GitHub zet. */
export default function Verdelen({ terug }: { terug: () => void }) {
  const { data, fout } = useData('kamers')
  const [concept, setConcept] = useOpgeslagen<Concept | null>('verdeling.concept', null)
  const [serverVersie] = useOpgeslagen<ServerVersie | null>(SERVER_VERSIE, null)
  const [mijnNaam] = useOpgeslagen<string | null>('naam', null)
  const [gekozen, setGekozen] = useState<string | null>(null)
  const [nieuweNaam, setNieuweNaam] = useState('')
  const [melding, setMelding] = useState<string | null>(null)
  const [opnieuwVragen, setOpnieuwVragen] = useState(false)
  const [gekopieerd, setGekopieerd] = useState(false)
  const [bijgewerkt, setBijgewerkt] = useState<string | null>(null)
  const backend = useBackend()
  const [opslaanBezig, setOpslaanBezig] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState<string | null>(null)
  const [opslaanFout, setOpslaanFout] = useState<string | null>(null)
  const jsonVak = useRef<HTMLTextAreaElement>(null)

  // Eerste keer: beginnen met de kamers die nu in de app staan. Daarna: wijzigingen in kamers.json
  // (nieuwe deelnemers, verblijf) overnemen in het concept op deze telefoon
  useEffect(() => {
    if (!data) return
    if (!concept) {
      setConcept(uitData(data, serverVersie?.bijgewerkt ?? null))
      return
    }
    const r = bijwerken(concept, data)
    if (!r) return
    setConcept(r.concept)
    if (r.tekst) setBijgewerkt(r.tekst)
    // serverVersie hoort bij data (samen opgehaald); alleen bij het begin nodig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, concept, setConcept])

  useEffect(() => {
    if (!melding) return
    const id = window.setTimeout(() => setMelding(null), 3000)
    return () => window.clearTimeout(id)
  }, [melding])

  const json = useMemo(() => (concept ? naarJson(concept) : ''), [concept])

  if (!concept) {
    return (
      <div className="scherm">
        <h1>Kamerverdeling</h1>
        <DataStatus fout={fout} />
      </div>
    )
  }

  const iedereen = [...concept.over, ...concept.kamers.flatMap((k) => k.bewoners)]
  const bedden = concept.kamers.reduce((s, k) => s + k.bedden, 0)
  const wijzig = (f: (c: Concept) => Concept) => setConcept((oud) => (oud ? f(oud) : oud))
  const wijzigKamer = (id: string, f: (k: ConceptKamer) => ConceptKamer) =>
    wijzig((c) => ({ ...c, kamers: c.kamers.map((k) => (k.id === id ? f(k) : k)) }))

  const plaats = (kamer: ConceptKamer) => {
    if (!gekozen) return
    if (kamer.bewoners.includes(gekozen)) {
      setGekozen(null)
      return
    }
    if (kamer.bewoners.length >= kamer.bedden) {
      setMelding(`Kamer ${kamer.nummer} is vol. Zet er een bed bij of kies een andere kamer.`)
      return
    }
    const naam = gekozen
    wijzig((c) => {
      const z = zonder(c, naam)
      return { ...z, kamers: z.kamers.map((k) => (k.id === kamer.id ? { ...k, bewoners: [...k.bewoners, naam] } : k)) }
    })
    setGekozen(null)
  }

  const naarLijst = (naam: string) => {
    wijzig((c) => {
      const z = zonder(c, naam)
      return { ...z, over: [...z.over, naam] }
    })
    setGekozen(null)
  }

  const kies = (naam: string) => setGekozen((g) => (g === naam ? null : naam))

  const voegNaamToe = (e: FormEvent) => {
    e.preventDefault()
    const naam = nieuweNaam.trim().replace(/\s+/g, ' ')
    if (!naam) return
    if (iedereen.some((n) => normaal(n) === normaal(naam))) {
      setMelding(`${naam} staat er al. Twee dezelfde namen? Schrijf dan bijvoorbeeld "${naam} 2".`)
      return
    }
    wijzig((c) => ({ ...c, over: [...c.over, naam] }))
    setNieuweNaam('')
  }

  const verwijderNaam = (naam: string) => {
    wijzig((c) => zonder(c, naam))
    if (gekozen === naam) setGekozen(null)
  }

  const kamerErbij = () => {
    const hoogste = Math.max(100, ...concept.kamers.map((k) => parseInt(k.nummer, 10)).filter((n) => !Number.isNaN(n)))
    wijzig((c) => ({
      ...c,
      kamers: [...c.kamers, { id: nieuwId(), nummer: String(hoogste + 1), naam: '', bedden: 4, bewoners: [] }],
    }))
  }

  const kamerWeg = (kamer: ConceptKamer) =>
    wijzig((c) => ({ ...c, over: [...c.over, ...kamer.bewoners], kamers: c.kamers.filter((k) => k.id !== kamer.id) }))

  const automatisch = () => {
    const nieuw = verdeelAutomatisch(concept)
    setConcept(nieuw)
    const over = nieuw.over
    if (over.length) setMelding(`Niet genoeg bedden: ${over.join(', ')} ${over.length === 1 ? 'heeft' : 'hebben'} nog geen plek.`)
  }

  const iedereenTerug = () =>
    wijzig((c) => ({ ...c, over: [...c.over, ...c.kamers.flatMap((k) => k.bewoners)], kamers: c.kamers.map((k) => ({ ...k, bewoners: [] })) }))

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      jsonVak.current?.select()
      document.execCommand('copy')
    }
    setGekopieerd(true)
    window.setTimeout(() => setGekopieerd(false), 2500)
  }

  const opslaan = async () => {
    setOpslaanBezig(true)
    setOpslaanFout(null)
    setOpgeslagen(null)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _uitleg, ...kamers } = JSON.parse(json)
    const r = await slaKamerverdelingOp(kamers, concept.serverVersie ?? null)
    setOpslaanBezig(false)
    if ('fout' in r) setOpslaanFout(r.fout)
    else if ('nieuwer' in r)
      setOpslaanFout('Niet opgeslagen: er staat intussen een nieuwere verdeling in de app. Kies hierboven wat je wilt doen.')
    else {
      wijzig((c) => ({ ...c, serverVersie: r.versie }))
      setOpgeslagen(
        `Opgeslagen om ${new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}. Iedereen ziet de nieuwe verdeling zodra zijn app verbinding heeft.`,
      )
    }
  }

  // Iemand anders (of jij op een ander apparaat) sloeg een verdeling op nadat dit concept begon
  const anderOpgeslagen = backendIngesteld && serverVersie && concept.serverVersie !== serverVersie.bijgewerkt ? serverVersie : null
  const wanneerOpgeslagen = (v: ServerVersie) => {
    const d = new Date(v.bijgewerkt)
    return `${datumISO(d) === datumISO(new Date()) ? 'vandaag' : datumLabel(datumISO(d), 'kort')} om ${tijdUUMM(d)}`
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'kamers.json'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="scherm verdelen">
      <button type="button" className="tekstknop" onClick={terug}>
        ← Terug naar Kamers
      </button>
      <h1>Kamerverdeling</h1>
      <p>
        Voor de reisleiding. Tik op een naam en daarna op een kamer. Je werk wordt op deze telefoon bewaard; de groep
        ziet het pas als je onderaan op <strong>Opslaan in de app</strong> tikt.
      </p>

      {anderOpgeslagen && (
        <div className="melding" role="status">
          <p>
            <strong>
              {anderOpgeslagen.door && anderOpgeslagen.door !== mijnNaam ? anderOpgeslagen.door : 'Iemand'} heeft{' '}
              {wanneerOpgeslagen(anderOpgeslagen)} een kamerverdeling in de app opgeslagen.
            </strong>{' '}
            {anderOpgeslagen.door === mijnNaam && '(Met jouw naam, bijvoorbeeld op een ander apparaat.) '}
            Jouw concept op deze telefoon is ouder. Opslaan zou die verdeling overschrijven.
          </p>
          <div className="knoppenrij">
            <button
              type="button"
              className="knop knop--primair knop--klein"
              onClick={() => {
                if (data) setConcept(uitData(data, anderOpgeslagen.bijgewerkt))
                setGekozen(null)
                setOpslaanFout(null)
              }}
            >
              Die overnemen
            </button>
            <button
              type="button"
              className="knop knop--secundair knop--klein"
              onClick={() => {
                wijzig((c) => ({ ...c, serverVersie: anderOpgeslagen.bijgewerkt }))
                setOpslaanFout(null)
              }}
            >
              Mijn versie houden
            </button>
          </div>
        </div>
      )}

      {bijgewerkt && (
        <p className="melding">
          <strong>Bijgewerkt met de lijst uit de app.</strong> {bijgewerkt}{' '}
          <button type="button" className="tekstknop" onClick={() => setBijgewerkt(null)}>
            Oké
          </button>
        </p>
      )}

      <div className="kaartje verdelen__stand">
        <span>
          <strong>{iedereen.length}</strong> deelnemers
        </span>
        <span>
          <strong>{bedden}</strong> bedden
        </span>
        <span className={concept.over.length ? 'verdelen__open' : ''}>
          <strong>{concept.over.length}</strong> nog in te delen
        </span>
      </div>

      <label className="verdelen__veld">
        <span>Verblijf</span>
        <input
          className="invoer"
          value={concept.verblijf}
          onChange={(e) => wijzig((c) => ({ ...c, verblijf: e.target.value }))}
          placeholder="Naam van het verblijf"
        />
      </label>

      <section className="kaartje">
        <h2>Nog in te delen</h2>
        {concept.over.length === 0 ? (
          <p className="klein">Iedereen heeft een kamer. Nieuwe deelnemer? Voeg hem hieronder toe.</p>
        ) : (
          <div className="verdelen__namen">
            {concept.over.map((n) => (
              <span key={n} className={`verdelen__naam${gekozen === n ? ' is-gekozen' : ''}`}>
                <button type="button" onClick={() => kies(n)} aria-pressed={gekozen === n}>
                  {n}
                </button>
                <button type="button" className="verdelen__weg" aria-label={`${n} verwijderen`} onClick={() => verwijderNaam(n)}>
                  <Icoon naam="kruis" grootte={16} />
                </button>
              </span>
            ))}
          </div>
        )}
        <form className="toevoegen" onSubmit={voegNaamToe}>
          <label className="verborgen" htmlFor="nieuwe-deelnemer">
            Nieuwe deelnemer
          </label>
          <input
            id="nieuwe-deelnemer"
            className="invoer"
            value={nieuweNaam}
            onChange={(e) => setNieuweNaam(e.target.value)}
            placeholder="Voornaam toevoegen"
            maxLength={30}
            autoComplete="off"
            enterKeyHint="done"
          />
          <button type="submit" className="knop knop--primair" disabled={!nieuweNaam.trim()} aria-label="Toevoegen">
            <Icoon naam="plus" />
          </button>
        </form>
        <p className="klein">Alleen voornamen: de app is openbaar te bekijken.</p>
      </section>

      {gekozen && (
        <div className="verdelen__hint" role="status">
          Tik op een kamer voor <strong>{gekozen}</strong>
          <button type="button" className="tekstknop" onClick={() => setGekozen(null)}>
            Annuleren
          </button>
        </div>
      )}

      {concept.kamers.map((k) => {
        const vol = k.bewoners.length >= k.bedden
        return (
          <section
            key={k.id}
            className={`kaartje verdelen__kamer${gekozen && !vol && !k.bewoners.includes(gekozen) ? ' is-doel' : ''}`}
          >
            <div className="verdelen__kop">
              <input
                className="invoer verdelen__nummer"
                value={k.nummer}
                onChange={(e) => wijzigKamer(k.id, (x) => ({ ...x, nummer: e.target.value }))}
                aria-label="Kamernummer"
                inputMode="numeric"
              />
              <input
                className="invoer"
                value={k.naam}
                onChange={(e) => wijzigKamer(k.id, (x) => ({ ...x, naam: e.target.value }))}
                placeholder="Naam (mag leeg)"
                aria-label="Naam van de kamer"
              />
              <button type="button" className="icoonknop" aria-label={`Kamer ${k.nummer} verwijderen`} onClick={() => kamerWeg(k)}>
                <Icoon naam="kruis" />
              </button>
            </div>

            <div className="verdelen__bedden">
              <span>Bedden</span>
              <button
                type="button"
                className="kaartknop verdelen__stap"
                aria-label="Bed minder"
                disabled={k.bedden <= Math.max(1, k.bewoners.length)}
                onClick={() => wijzigKamer(k.id, (x) => ({ ...x, bedden: x.bedden - 1 }))}
              >
                <Icoon naam="min" />
              </button>
              <strong>{k.bedden}</strong>
              <button
                type="button"
                className="kaartknop verdelen__stap"
                aria-label="Bed erbij"
                disabled={k.bedden >= 20}
                onClick={() => wijzigKamer(k.id, (x) => ({ ...x, bedden: x.bedden + 1 }))}
              >
                <Icoon naam="plus" />
              </button>
            </div>

            <div className="verdelen__plekken">
              {k.bewoners.map((b) => (
                <span key={b} className={`verdelen__naam is-ingedeeld${gekozen === b ? ' is-gekozen' : ''}`}>
                  <button type="button" onClick={() => kies(b)} aria-pressed={gekozen === b}>
                    🛏️ {b}
                  </button>
                  <button type="button" className="verdelen__weg" aria-label={`${b} terug naar de lijst`} onClick={() => naarLijst(b)}>
                    <Icoon naam="kruis" grootte={16} />
                  </button>
                </span>
              ))}
              {Array.from({ length: Math.max(0, k.bedden - k.bewoners.length) }, (_, i) => (
                <button
                  key={`vrij-${i}`}
                  type="button"
                  className="verdelen__vrij"
                  disabled={!gekozen}
                  onClick={() => plaats(k)}
                >
                  {gekozen ? `+ ${gekozen}` : 'vrij bed'}
                </button>
              ))}
            </div>
          </section>
        )
      })}

      <button type="button" className="knop knop--secundair knop--breed" onClick={kamerErbij}>
        <Icoon naam="plus" /> Kamer toevoegen
      </button>
      <div className="knoppenrij">
        <button type="button" className="knop knop--primair" onClick={automatisch} disabled={concept.over.length === 0}>
          Automatisch verdelen
        </button>
        <button type="button" className="knop knop--secundair" onClick={iedereenTerug} disabled={iedereen.length === concept.over.length}>
          Alles leeg
        </button>
      </div>

      <section className="kaartje">
        <h2>Klaar? Opslaan in de app</h2>
        {concept.over.length > 0 && (
          <p className="melding">
            Let op: {concept.over.join(', ')} {concept.over.length === 1 ? 'heeft' : 'hebben'} nog geen kamer en{' '}
            {concept.over.length === 1 ? 'staat' : 'staan'} in de app onder <em>Nog geen kamer</em>.
          </p>
        )}
        {backendIngesteld &&
          (backend.beheerder ? (
            <>
              <button
                type="button"
                className="knop knop--primair knop--breed"
                onClick={() => void opslaan()}
                disabled={opslaanBezig || backend.status !== 'verbonden'}
              >
                {opslaanBezig ? 'Bezig…' : '💾 Opslaan in de app'}
              </button>
              <p className="klein">
                {backend.status === 'verbonden'
                  ? 'Daarna staat de nieuwe verdeling meteen in ieders app.'
                  : 'Geen verbinding: opslaan kan alleen met internet. Je werk blijft op deze telefoon bewaard.'}
              </p>
            </>
          ) : (
            <>
              <p>Opslaan kan alleen als je op deze telefoon bent ingelogd als beheerder.</p>
              <button
                type="button"
                className="knop knop--secundair knop--breed"
                onClick={() => (window.location.hash = '#beheer')}
              >
                ⚙️ Inloggen als beheerder
              </button>
            </>
          ))}
        {opgeslagen && <p className="melding">✓ {opgeslagen}</p>}
        {opslaanFout && <p className="melding melding--fout">{opslaanFout}</p>}

        <details className="verdelen__github" open={!backendIngesteld}>
          <summary>{backendIngesteld ? 'Of via GitHub (kamers.json)' : 'Via GitHub (kamers.json)'}</summary>
          <ol className="stappen">
            <li>
              Tik op <strong>Kopieer kamers.json</strong>.
            </li>
            <li>
              Open <strong>kamers.json op GitHub</strong>, selecteer alle tekst en plak de nieuwe tekst eroverheen.
            </li>
            <li>
              Tik op <strong>Commit changes</strong>. Na een paar minuten staat de nieuwe verdeling in ieders app.
            </li>
          </ol>
          <div className="knoppenrij">
            <button type="button" className="knop knop--primair" onClick={kopieer}>
              {gekopieerd ? '✓ Gekopieerd' : 'Kopieer kamers.json'}
            </button>
            <a className="knop knop--accent" href={config.kamersBewerkenOpGithub} target="_blank" rel="noopener">
              kamers.json op GitHub
            </a>
          </div>
          <button type="button" className="tekstknop" onClick={download}>
            Of download het bestand
          </button>
          <label className="verborgen" htmlFor="kamers-json">
            Nieuwe kamers.json
          </label>
          <textarea id="kamers-json" ref={jsonVak} className="invoer verdelen__json" readOnly value={json} rows={8} />
          {backendIngesteld && (
            <p className="klein">
              Staat er al een verdeling in de app opgeslagen, dan gaat die voor op kamers.json. Namen die je daarna alleen
              in kamers.json zet, komen in de app onder <em>Nog geen kamer</em>.
            </p>
          )}
        </details>
      </section>

      <button type="button" className="tekstknop" onClick={() => setOpnieuwVragen(true)}>
        Opnieuw beginnen met de kamers uit de app
      </button>

      {melding && (
        <div className="toast" role="status">
          <span>{melding}</span>
        </div>
      )}

      <BevestigDialoog
        open={opnieuwVragen}
        titel="Opnieuw beginnen?"
        tekst="Je wijzigingen op deze telefoon gaan verloren. Je begint weer met de kamers zoals ze nu in de app staan."
        bevestigLabel="Ja, opnieuw"
        gevaarlijk
        onAnnuleer={() => setOpnieuwVragen(false)}
        onBevestig={() => {
          if (data) setConcept(uitData(data, serverVersie?.bijgewerkt ?? null))
          setGekozen(null)
          setOpnieuwVragen(false)
        }}
      />
    </div>
  )
}
