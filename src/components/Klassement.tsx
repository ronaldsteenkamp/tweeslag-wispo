import { useMemo, useState, type FormEvent } from 'react'
import { useBackend } from '../lib/backend'
import { useData } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'
import { useKlassement, useSyncStatus, verwijderCorrectie, voegCorrectieToe } from '../lib/scorebord'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { BevestigDialoog } from './BevestigDialoog'
import { toonProfiel } from './Profiel'
import { Icoon } from './Icoon'
import { Verbinding } from './Verbinding'

const SYNC_TEKST = {
  uit: 'Geen backend: je score staat alleen op deze telefoon.',
  wacht: 'Je score wordt verstuurd zodra er verbinding is.',
  bezig: 'Score versturen…',
  verstuurd: 'Je score is verstuurd ✓',
  fout: 'Versturen lukte niet. De app probeert het later opnieuw.',
}

function tijdstip(ms: number) {
  const d = new Date(ms)
  return datumISO(d) === datumISO(new Date()) ? tijdUUMM(d) : `${datumLabel(datumISO(d), 'kort')} ${tijdUUMM(d)}`
}

/** Klassement per kamer en per persoon, met correcties en (voor beheerders) bonuspunten geven */
export function Klassement() {
  const backend = useBackend()
  const sync = useSyncStatus()
  const { klassement, mislukt } = useKlassement(backend.status !== 'uit')
  const { data: kamersData } = useData('kamers')
  const [naam] = useOpgeslagen<string | null>('naam', null)

  const kamerNaam = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of kamersData?.kamers ?? []) if (k.naam) m.set(k.nummer, k.naam)
    return m
  }, [kamersData])
  const eigenKamer = kamersData?.kamers.find((k) => naam && k.bewoners.includes(naam))?.nummer ?? null
  const kamerLabel = (nr: string | null) => (nr ? `${nr}${kamerNaam.get(nr) ? ` · ${kamerNaam.get(nr)}` : ''}` : '–')

  if (backend.status === 'uit') {
    return (
      <section className="kaartje">
        <h2>Klassement</h2>
        <p>Er is geen backend ingesteld, dus er is geen gedeeld klassement. Je eigen score staat hierboven.</p>
      </section>
    )
  }

  const geenVerbinding = backend.status !== 'verbonden'

  return (
    <>
      <div className="kaartje klassement__status">
        <Verbinding />
        <p className="klein">{SYNC_TEKST[sync.status]}</p>
      </div>

      {!klassement ? (
        <p className="laadtekst">{geenVerbinding || mislukt ? 'Geen verbinding. Het klassement verschijnt zodra er internet is.' : 'Klassement laden…'}</p>
      ) : (
        <>
          {(geenVerbinding || mislukt) && (
            <p className="melding">Geen verbinding. Dit is de stand van {tijdstip(klassement.opgehaald)}.</p>
          )}

          <section className="kaartje">
            <h2>🏆 Kamers</h2>
            <ol className="ranglijst">
              {klassement.kamers.map((k, i) => (
                <li key={k.kamer} className={k.kamer === eigenKamer ? 'is-eigen' : ''}>
                  <span className="ranglijst__plek">{i + 1}</span>
                  <span className="ranglijst__naam">
                    {kamerLabel(k.kamer)}
                    <small>
                      {k.aantal} {k.aantal === 1 ? 'persoon' : 'personen'}
                      {k.kamer_bonus !== 0 && ` · bonus ${k.kamer_bonus > 0 ? '+' : ''}${k.kamer_bonus}`}
                    </small>
                  </span>
                  <span className="ranglijst__punten">{k.totaal}</span>
                </li>
              ))}
            </ol>
            {klassement.kamers.length === 0 && <p className="klein">Nog geen scores.</p>}
          </section>

          <section className="kaartje">
            <h2>⛷️ Personen</h2>
            <ol className="ranglijst">
              {klassement.personen.map((p, i) => (
                <li key={p.naam} className={p.naam === naam ? 'is-eigen' : ''}>
                  <span className="ranglijst__plek">{i + 1}</span>
                  <span className="ranglijst__naam">
                    <button type="button" className="ranglijst__persoon" onClick={() => toonProfiel(p.naam)}>
                      {p.naam}
                      {p.naam === naam && <span className="label label--accent">jij</span>}
                    </button>
                    <small>
                      kamer {kamerLabel(p.kamer)}
                      {p.correcties !== 0 && ` · bonus ${p.correcties > 0 ? '+' : ''}${p.correcties}`}
                    </small>
                  </span>
                  <span className="ranglijst__punten">{p.totaal}</span>
                </li>
              ))}
            </ol>
            {klassement.personen.length === 0 && <p className="klein">Nog niemand.</p>}
          </section>

          {klassement.correcties.length > 0 && (
            <section className="kaartje">
              <h2>Bonuspunten en correcties</h2>
              <ul className="correcties">
                {klassement.correcties.map((c) => (
                  <CorrectieRegel key={c.id} c={c} kamerLabel={kamerLabel} beheerder={backend.beheerder} />
                ))}
              </ul>
            </section>
          )}

          {backend.beheerder && (
            <BonusFormulier
              namen={klassement.personen.map((p) => p.naam)}
              kamers={(kamersData?.kamers ?? []).map((k) => k.nummer)}
              kamerLabel={kamerLabel}
            />
          )}

          <p className="klein klassement__voet">Bijgewerkt om {tijdstip(klassement.opgehaald)} · ververst vanzelf</p>
        </>
      )}
    </>
  )
}

function CorrectieRegel({
  c,
  kamerLabel,
  beheerder,
}: {
  c: { id: number; naam: string | null; kamer: string | null; punten: number; reden: string }
  kamerLabel: (nr: string | null) => string
  beheerder: boolean
}) {
  const [vragen, setVragen] = useState(false)
  return (
    <li>
      <span className={`correcties__punten${c.punten < 0 ? ' is-min' : ''}`}>
        {c.punten > 0 ? '+' : ''}
        {c.punten}
      </span>
      <span className="correcties__tekst">
        <strong>{c.naam ?? `kamer ${kamerLabel(c.kamer)}`}</strong> · {c.reden}
      </span>
      {beheerder && (
        <>
          <button type="button" className="icoonknop" aria-label="Correctie verwijderen" onClick={() => setVragen(true)}>
            <Icoon naam="kruis" />
          </button>
          <BevestigDialoog
            open={vragen}
            titel="Correctie verwijderen?"
            tekst={`${c.punten > 0 ? '+' : ''}${c.punten} voor ${c.naam ?? `kamer ${kamerLabel(c.kamer)}`}: ${c.reden}`}
            bevestigLabel="Verwijderen"
            gevaarlijk
            onAnnuleer={() => setVragen(false)}
            onBevestig={() => {
              setVragen(false)
              void verwijderCorrectie(c.id)
            }}
          />
        </>
      )}
    </li>
  )
}

function BonusFormulier({
  namen,
  kamers,
  kamerLabel,
}: {
  namen: string[]
  kamers: string[]
  kamerLabel: (nr: string | null) => string
}) {
  const [soort, setSoort] = useState<'kamer' | 'persoon'>('kamer')
  const [doel, setDoel] = useState('')
  const [punten, setPunten] = useState('25')
  const [reden, setReden] = useState('')
  const [melding, setMelding] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  const opties = soort === 'kamer' ? kamers : [...namen].sort((a, b) => a.localeCompare(b, 'nl'))
  const getal = Number(punten)
  const geldig = doel && reden.trim() && Number.isInteger(getal) && getal !== 0 && Math.abs(getal) <= 1000

  const verstuur = async (e: FormEvent) => {
    e.preventDefault()
    if (!geldig) return
    setBezig(true)
    const fout = await voegCorrectieToe(soort === 'kamer' ? { kamer: doel, punten: getal, reden } : { naam: doel, punten: getal, reden })
    setBezig(false)
    if (fout) setMelding(`Lukte niet: ${fout}`)
    else {
      setMelding(`${getal > 0 ? '+' : ''}${getal} voor ${soort === 'kamer' ? `kamer ${kamerLabel(doel)}` : doel} ✓`)
      setReden('')
    }
  }

  return (
    <section className="kaartje bonus">
      <h2>⭐ Bonuspunten of correctie (beheer)</h2>
      <form className="bonus__formulier" onSubmit={verstuur}>
        <div className="segment" role="tablist" aria-label="Voor wie">
          {(['kamer', 'persoon'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={soort === s}
              className={`segment__knop${soort === s ? ' is-actief' : ''}`}
              onClick={() => {
                setSoort(s)
                setDoel('')
              }}
            >
              {s === 'kamer' ? 'Kamer' : 'Persoon'}
            </button>
          ))}
        </div>
        <label className="verdelen__veld">
          <span>{soort === 'kamer' ? 'Kamer' : 'Persoon'}</span>
          <select className="invoer" value={doel} onChange={(e) => setDoel(e.target.value)} required>
            <option value="">Kies…</option>
            {opties.map((o) => (
              <option key={o} value={o}>
                {soort === 'kamer' ? kamerLabel(o) : o}
              </option>
            ))}
          </select>
        </label>
        <label className="verdelen__veld">
          <span>Punten (min-teken voor aftrek)</span>
          <input className="invoer" inputMode="numeric" value={punten} onChange={(e) => setPunten(e.target.value.replace(/[^\d-]/g, ''))} />
        </label>
        <label className="verdelen__veld">
          <span>Reden (zien alle deelnemers)</span>
          <input
            className="invoer"
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            maxLength={120}
            placeholder="Bijv. beste après-ski-outfit"
          />
        </label>
        <button type="submit" className="knop knop--primair knop--breed" disabled={!geldig || bezig}>
          {bezig ? 'Bezig…' : 'Toekennen'}
        </button>
        {melding && <p className="klein">{melding}</p>}
      </form>
    </section>
  )
}
