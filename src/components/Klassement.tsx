import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useBackend } from '../lib/backend'
import { metEchteNaam, useToonNaam } from '../lib/bijnamen'
import { useData } from '../lib/data'
import { useKamerNaam } from '../lib/kamernamen'
import { useOpgeslagen } from '../lib/opslag'
import { tabToetsen } from '../lib/tabbladen'
import { useKlassement, useSyncStatus, verwijderCorrectie, voegCorrectieToe, type Klassement as KlassementData } from '../lib/scorebord'
import { minderBeweging } from '../lib/spelgeluid'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { BevestigDialoog } from './BevestigDialoog'
import { toonProfiel } from './Profiel'
import { Icoon } from './Icoon'
import { Verbinding } from './Verbinding'

const SYNC_TEKST = {
  uit: 'Niet gekoppeld: je score staat alleen op deze telefoon.',
  wacht: 'Je score wordt verstuurd zodra er verbinding is.',
  bezig: 'Score versturen…',
  verstuurd: 'Je score is verstuurd.',
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
  const toon = useToonNaam()

  const naamVanKamer = useKamerNaam()
  const kamerNaam = useMemo(() => {
    const m = new Map<string, string>()
    for (const k of kamersData?.kamers ?? []) {
      const n = naamVanKamer(k)
      if (n) m.set(k.nummer, n)
    }
    return m
  }, [kamersData, naamVanKamer])
  const eigenKamer = kamersData?.kamers.find((k) => naam && k.bewoners.includes(naam))?.nummer ?? null
  const vorige = useVorigeStand(klassement)
  const kamerLabel = (nr: string | null) => (nr ? `${nr}${kamerNaam.get(nr) ? ` · ${kamerNaam.get(nr)}` : ''}` : '–')

  if (backend.status === 'uit') {
    return (
      <p className="spel__voetnoot">Het klassement is in deze versie niet gekoppeld. Je eigen score staat hierboven.</p>
    )
  }

  const geenVerbinding = backend.status !== 'verbonden'

  return (
    <>
      <div className="spel__status">
        <Verbinding />
        <p>{SYNC_TEKST[sync.status]}</p>
      </div>

      {!klassement ? (
        <p className="laadtekst">{geenVerbinding || mislukt ? 'Geen verbinding. Het klassement verschijnt zodra er internet is.' : 'Klassement laden…'}</p>
      ) : (
        <>
          {(geenVerbinding || mislukt) && (
            <p className="spel__voetnoot">Geen verbinding. Dit is de stand van {tijdstip(klassement.opgehaald)}.</p>
          )}

          <StandSoorten
            personen={
              <RangLijst
                rijen={klassement.personen.map((p) => ({
                  sleutel: p.naam,
                  punten: p.totaal,
                  eigen: p.naam === naam,
                  naam: (
                    <button type="button" className="r__persoon naam" onClick={() => toonProfiel(p.naam)}>
                      {toon(p.naam)}
                    </button>
                  ),
                  onder: `${kamerLabel(p.kamer)}${p.correcties !== 0 ? ` · bonus ${p.correcties > 0 ? '+' : ''}${p.correcties}` : ''}`,
                }))}
                vorige={vorige?.personen}
                leeg="Nog niemand."
              />
            }
            kamers={
              <RangLijst
                rijen={klassement.kamers.map((k) => ({
                  sleutel: k.kamer,
                  punten: k.totaal,
                  eigen: k.kamer === eigenKamer,
                  naam: <b className="naam">{kamerLabel(k.kamer)}</b>,
                  onder: `${k.aantal} ${k.aantal === 1 ? 'persoon' : 'personen'}${k.kamer_bonus !== 0 ? ` · bonus ${k.kamer_bonus > 0 ? '+' : ''}${k.kamer_bonus}` : ''}`,
                }))}
                vorige={vorige?.kamers}
                leeg="Nog geen scores."
              />
            }
            mijnPlek={(() => {
              const i = klassement.personen.findIndex((p) => p.naam === naam)
              return i < 0 ? null : { plek: plekVan(klassement.personen.map((p) => p.totaal), i), van: klassement.personen.length }
            })()}
            sinds={vorige?.datum ?? null}
          />

          {klassement.correcties.length > 0 && (
            <section className="spel__blok">
              <h2 className="spel__tussenkop">Bonuspunten en correcties</h2>
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

          <p className="spel__voetnoot">Bijgewerkt om {tijdstip(klassement.opgehaald)} · ververst vanzelf</p>
        </>
      )}
    </>
  )
}

/** Plek met gedeelde plekken: 50, 50, 40 punten geeft 1, 1, 3 */
const plekVan = (punten: number[], i: number) => 1 + punten.filter((p) => p > punten[i]).length

interface StandFoto {
  datum: string
  personen: Record<string, number>
  kamers: Record<string, number>
}

/*
 * Voor de pijltjes (↑2 ↓1): de stand van de vorige dag dat je keek. Per dag wordt de laatst
 * geziene stand bewaard; komt er een nieuwe dag, dan schuift die door naar "vorige".
 */
function useVorigeStand(klassement: KlassementData | null) {
  const [vorige, setVorige] = useOpgeslagen<StandFoto | null>('spel.stand.vorige', null)
  const [huidig, setHuidig] = useOpgeslagen<StandFoto | null>('spel.stand.huidig', null)
  useEffect(() => {
    if (!klassement || !klassement.personen.length) return
    const datum = datumISO(new Date(klassement.opgehaald))
    const plekken = <T,>(lijst: T[], sleutel: (x: T) => string, punten: (x: T) => number) => {
      const p = lijst.map(punten)
      return Object.fromEntries(lijst.map((x, i) => [sleutel(x), plekVan(p, i)]))
    }
    const foto: StandFoto = {
      datum,
      personen: plekken(klassement.personen, (p) => p.naam, (p) => p.totaal),
      kamers: plekken(klassement.kamers, (k) => k.kamer, (k) => k.totaal),
    }
    if (huidig && huidig.datum < datum) setVorige(huidig)
    if (!huidig || huidig.datum <= datum) setHuidig(foto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klassement?.opgehaald])
  return vorige && huidig && vorige.datum < huidig.datum ? vorige : null
}

/** Personen en kamers als twee tabbladen, zoals de uitslagen in het clubblad */
function StandSoorten({
  personen,
  kamers,
  mijnPlek,
  sinds,
}: {
  personen: ReactNode
  kamers: ReactNode
  mijnPlek: { plek: number; van: number } | null
  sinds: string | null
}) {
  const [soort, setSoort] = useOpgeslagen<'personen' | 'kamers'>('spel.stand.soort', 'personen')
  return (
    <section className="clubblad">
      {mijnPlek && (
        <p className="clubblad__mijn">
          <b>{mijnPlek.plek}</b>e plek van {mijnPlek.van}
        </p>
      )}
      <div
        className="spel__tabs spel__tabs--klein"
        role="tablist"
        aria-label="Stand"
        onKeyDown={tabToetsen(['personen', 'kamers'] as const, soort, setSoort)}
      >
        {(['personen', 'kamers'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={soort === s} tabIndex={soort === s ? 0 : -1} onClick={() => setSoort(s)}>
            {s === 'personen' ? 'Personen' : 'Kamers'}
          </button>
        ))}
      </div>
      {soort === 'personen' ? personen : kamers}
      {sinds && <p className="spel__voetnoot">Pijltjes: verschil met de stand die je op {datumLabel(sinds, 'kort')} zag.</p>}
    </section>
  )
}

interface Rij {
  sleutel: string
  punten: number
  eigen: boolean
  naam: ReactNode
  onder: string
}

/** Ranglijst met gedeelde plekken (4=), pijltjes en rijen die naar hun nieuwe plek schuiven */
function RangLijst({ rijen, vorige, leeg }: { rijen: Rij[]; vorige?: Record<string, number>; leeg: string }) {
  const lijst = useRef<HTMLOListElement>(null)
  const posities = useRef(new Map<string, number>())
  const punten = rijen.map((r) => r.punten)

  // FLIP: verandert de volgorde terwijl je kijkt, dan schuiven de rijen naar hun nieuwe plek
  useLayoutEffect(() => {
    const ol = lijst.current
    if (!ol) return
    const nieuw = new Map<string, number>()
    for (const li of ol.children) {
      const el = li as HTMLElement
      const top = el.offsetTop
      nieuw.set(el.dataset.sleutel!, top)
      const oud = posities.current.get(el.dataset.sleutel!)
      if (oud !== undefined && oud !== top && !minderBeweging()) {
        el.animate([{ transform: `translateY(${oud - top}px)` }, { transform: 'none' }], { duration: 800, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
    }
    posities.current = nieuw
  })

  if (!rijen.length) return <p className="spel__voetnoot">{leeg}</p>
  return (
    <ol className="clubblad__lijst" ref={lijst}>
      {rijen.map((r, i) => {
        const plek = plekVan(punten, i)
        const gedeeld = punten.filter((p) => p === r.punten).length > 1
        const was = vorige?.[r.sleutel]
        const verschil = was === undefined ? 0 : was - plek
        return (
          <li key={r.sleutel} data-sleutel={r.sleutel} className={`${r.eigen ? 'is-eigen ' : ''}${plek === 1 ? 'is-eerste' : plek <= 3 ? 'is-top' : ''}`}>
            <span className="r__plek">
              {plek}
              {gedeeld ? '=' : ''}
            </span>
            <span className="r__naam">
              {r.naam}
              {r.eigen && <span className="verborgen"> (jij)</span>}
              <small>{r.onder}</small>
            </span>
            <span className={`r__pijl${verschil > 0 ? ' op' : verschil < 0 ? ' neer' : ''}`}>
              {vorige && (verschil > 0 ? '↑' + verschil : verschil < 0 ? '↓' + -verschil : '–')}
              {vorige && (
                <span className="verborgen">
                  {verschil ? `${Math.abs(verschil)} ${Math.abs(verschil) === 1 ? 'plek' : 'plekken'} ${verschil > 0 ? 'gestegen' : 'gezakt'}` : 'gelijk gebleven'}
                </span>
              )}
            </span>
            <span className="r__pnt">{r.punten}</span>
          </li>
        )
      })}
    </ol>
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
  const toon = useToonNaam()
  const wie = c.naam !== null ? toon(c.naam) : `kamer ${kamerLabel(c.kamer)}`
  return (
    <li>
      <span className={`correcties__punten${c.punten < 0 ? ' is-min' : ''}`}>
        {c.punten > 0 ? '+' : ''}
        {c.punten}
      </span>
      <span className="correcties__tekst">
        <strong>{wie}</strong> · {c.reden}
      </span>
      {beheerder && (
        <>
          <button type="button" className="icoonknop" aria-label="Correctie verwijderen" onClick={() => setVragen(true)}>
            <Icoon naam="kruis" />
          </button>
          <BevestigDialoog
            open={vragen}
            titel="Correctie verwijderen?"
            tekst={`${c.punten > 0 ? '+' : ''}${c.punten} voor ${wie}: ${c.reden}`}
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
  const toon = useToonNaam()

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
      setMelding(`${getal > 0 ? '+' : ''}${getal} voor ${soort === 'kamer' ? `kamer ${kamerLabel(doel)}` : toon(doel)}`)
      setReden('')
    }
  }

  return (
    <section className="spel__blok bonus">
      <h2 className="spel__tussenkop">Bonuspunten of correctie (beheer)</h2>
      <form className="bonus__formulier" onSubmit={verstuur}>
        <div
          className="segment"
          role="tablist"
          aria-label="Voor wie"
          onKeyDown={tabToetsen(['kamer', 'persoon'] as const, soort, (s) => {
            setSoort(s)
            setDoel('')
          })}
        >
          {(['kamer', 'persoon'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={soort === s}
              tabIndex={soort === s ? 0 : -1}
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
                {soort === 'kamer' ? kamerLabel(o) : metEchteNaam(toon, o)}
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
