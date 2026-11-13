import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Feestregen } from '../components/Feestregen'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { SchermKop } from '../components/SchermKop'
import { useData } from '../lib/data'
import { useNieuweKoppen } from '../lib/nieuweKoppen'
import { useOpgeslagen } from '../lib/opslag'

interface EigenItem {
  id: string
  naam: string
}

/** Zo lang blijft een net voltooide categorie open (je ziet het laatste vinkje), daarna klapt hij dicht */
const KLAP_PAUZE = 900
/** Duur van het dichtklappen; gelijk aan de overgang van .categorie__inhoud in app.css */
const KLAP_DUUR = 300

const sleutel = (categorie: string, item: string) => `${categorie}::${item}`
const eigenSleutel = (id: string) => `eigen::${id}`

export default function Paklijst() {
  const { data, fout } = useData('paklijst')
  const [vinkjes, setVinkjes] = useOpgeslagen<string[]>('paklijst.vinkjes', [])
  const [eigen, setEigen] = useOpgeslagen<EigenItem[]>('paklijst.eigen', [])
  const [nieuw, setNieuw] = useState('')
  const nieuweKop = useNieuweKoppen()

  const aangevinkt = useMemo(() => new Set(vinkjes), [vinkjes])

  const alleSleutels = useMemo(() => {
    const s: string[] = []
    for (const c of data?.categorieen ?? []) for (const i of c.items) s.push(sleutel(c.naam, i))
    for (const e of eigen) s.push(eigenSleutel(e.id))
    return s
  }, [data, eigen])

  const klaar = alleSleutels.filter((s) => aangevinkt.has(s)).length
  const totaal = alleSleutels.length
  const procent = totaal ? Math.round((klaar / totaal) * 100) : 0

  // ---- Extraatjes met de nieuwe koppen: klare categorieën inklappen, feest bij 100% ----
  const klareCategorieen = useMemo(
    () =>
      new Set(
        (data?.categorieen ?? [])
          .filter((c) => c.items.length > 0 && c.items.every((i) => aangevinkt.has(sleutel(c.naam, i))))
          .map((c) => c.naam),
      ),
    [data, aangevinkt],
  )
  // Klare categorieën zijn ingeklapt, behalve deze. Een categorie die net klaar is, komt hier
  // meteen bij het laatste vinkje in (in dezelfde tekenbeurt) en gaat er na een korte pauze weer
  // uit: zo zie je het vinkje verschijnen en klapt hij daarna één keer soepel dicht.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const klapTimers = useRef(new Map<string, number>())
  useEffect(() => {
    const timers = klapTimers.current
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])
  const zetOpen = (naam: string, isOpen: boolean) => {
    window.clearTimeout(klapTimers.current.get(naam))
    klapTimers.current.delete(naam)
    setOpen((s) => {
      if (s.has(naam) === isOpen) return s
      const n = new Set(s)
      if (isOpen) n.add(naam)
      else n.delete(naam)
      return n
    })
  }

  /** Op de kop van een klare categorie tikken: open of weer dicht */
  const wisselOpen = (naam: string, nuIngeklapt: boolean) => zetOpen(naam, nuIngeklapt)

  // Feest over het hele scherm op het moment dat alles ingepakt is (niet bij het openen van een volle lijst).
  // Een nummer i.p.v. aan/uit: nog een keer 100% halen start een nieuw feest.
  const [feest, setFeest] = useState(0)
  const vorigProcent = useRef<number | null>(null)
  const scrollTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(scrollTimer.current), [])
  useEffect(() => {
    if (!data) return
    const vorig = vorigProcent.current
    vorigProcent.current = procent
    // Toch niet meer alles ingepakt voordat we naar boven gingen: blijven staan
    if (procent !== 100) window.clearTimeout(scrollTimer.current)
    if (vorig === null || vorig === 100 || procent !== 100) return
    setFeest((n) => n + 1)
    // Helemaal naar boven, naar "Alles ingepakt!" in de kop. Klapt de laatste categorie nog dicht,
    // dan eerst dat afwachten (pauze + dichtklappen), zodat de pagina niet onder het scrollen krimpt.
    if (!nieuweKop) return
    const zacht = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wacht = klapTimers.current.size > 0 ? KLAP_PAUZE + (zacht ? KLAP_DUUR : 0) + 50 : 0
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => window.scrollTo({ top: 0, behavior: zacht ? 'smooth' : 'auto' }), wacht)
  }, [data, procent, nieuweKop])

  const wissel = (s: string) => {
    const wordtAan = !aangevinkt.has(s)
    setVinkjes((oud) => (oud.includes(s) ? oud.filter((x) => x !== s) : [...oud, s]))
    if (!nieuweKop) return
    const c = data?.categorieen.find((cat) => cat.items.some((i) => sleutel(cat.naam, i) === s))
    if (!c) return
    if (!wordtAan) {
      // Niet meer klaar: de volgende keer dat hij klaar is, klapt hij weer in
      zetOpen(c.naam, false)
      return
    }
    const wordtKlaar = c.items.every((i) => sleutel(c.naam, i) === s || aangevinkt.has(sleutel(c.naam, i)))
    if (!wordtKlaar) return
    zetOpen(c.naam, true)
    klapTimers.current.set(
      c.naam,
      window.setTimeout(() => zetOpen(c.naam, false), KLAP_PAUZE),
    )
  }

  const voegToe = (e: FormEvent) => {
    e.preventDefault()
    const naam = nieuw.trim()
    if (!naam) return
    setEigen((oud) => [...oud, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), naam }])
    setNieuw('')
  }

  const verwijder = (id: string) => {
    setEigen((oud) => oud.filter((x) => x.id !== id))
    setVinkjes((oud) => oud.filter((x) => x !== eigenSleutel(id)))
  }

  if (!data) {
    return (
      <div className="scherm">
        {nieuweKop ? <SchermKop titel="Paklijst" /> : <h1>Paklijst</h1>}
        <DataStatus fout={fout} />
      </div>
    )
  }

  const allesKlaar = klaar === totaal && totaal > 0
  const balk = (
    <div
      className="voortgang__balk"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={procent}
      aria-label="Voortgang paklijst"
    >
      <div style={{ width: `${procent}%` }} />
    </div>
  )

  return (
    <div className="scherm">
      {nieuweKop ? (
        <SchermKop
          titel="Paklijst"
          ondertitel={<span aria-live="polite">{allesKlaar ? 'Alles ingepakt! 🎉' : `${klaar} van ${totaal} ingepakt · ${procent}%`}</span>}
        >
          {balk}
        </SchermKop>
      ) : (
        <h1>Paklijst</h1>
      )}

      {/* Het oude voortgangskaartje: met de nieuwe kop staat de voortgang in de kop */}
      {!nieuweKop && <div className="kaartje voortgang" aria-live="polite">
        <div className="voortgang__tekst">
          <strong>{allesKlaar ? 'Alles ingepakt! 🎉' : `${klaar} van ${totaal} ingepakt`}</strong>
          <span>{procent}%</span>
        </div>
        {balk}
      </div>}

      {data.categorieen.map((c) => {
        const inCategorie = c.items.filter((i) => aangevinkt.has(sleutel(c.naam, i))).length
        // Met de nieuwe koppen: een klare categorie krijgt een groene rand en klapt in tot één regel
        const isKlaar = nieuweKop && klareCategorieen.has(c.naam)
        const ingeklapt = isKlaar && !open.has(c.naam)
        const kopTekst = (
          <>
            {c.icoon && <span aria-hidden="true">{c.icoon} </span>}
            {c.naam}
          </>
        )
        const lijst = (
          <ul className="vinklijst">
            {c.items.map((item) => {
              const s = sleutel(c.naam, item)
              return (
                <li key={s}>
                  <VinkRegel tekst={item} aan={aangevinkt.has(s)} onWissel={() => wissel(s)} animeer={nieuweKop} />
                </li>
              )
            })}
          </ul>
        )
        if (!nieuweKop) {
          // Zoals het altijd was
          return (
            <section className="kaartje categorie" key={c.naam}>
              <div className="kaartje__kop">
                <h2>{kopTekst}</h2>
                <span className={`teller${inCategorie === c.items.length ? ' teller--klaar' : ''}`}>
                  {inCategorie}/{c.items.length}
                </span>
              </div>
              {lijst}
            </section>
          )
        }
        const lijstId = `paklijst-${c.naam.replace(/\W+/g, '-')}`
        return (
          <section
            className={`kaartje categorie${isKlaar ? ' categorie--klaar' : ''}${ingeklapt ? ' is-ingeklapt' : ''}`}
            key={c.naam}
          >
            {isKlaar ? (
              // Klaar: de hele kop is een knop die de categorie open- en dichtklapt
              <h2 className="categorie__kop">
                <button
                  type="button"
                  className="categorie__knop"
                  aria-expanded={!ingeklapt}
                  aria-controls={lijstId}
                  onClick={() => wisselOpen(c.naam, ingeklapt)}
                >
                  <span className="categorie__naam">{kopTekst}</span>
                  <span className="teller teller--klaar">
                    Klaar ✓<span className="categorie__pijl" aria-hidden="true" />
                  </span>
                </button>
              </h2>
            ) : (
              <div className="kaartje__kop">
                <h2>{kopTekst}</h2>
                <span className="teller">
                  {inCategorie}/{c.items.length}
                </span>
              </div>
            )}
            <div className="categorie__inhoud" id={lijstId}>
              {lijst}
            </div>
          </section>
        )
      })}

      <section className="kaartje categorie">
        <div className="kaartje__kop">
          <h2>
            <span aria-hidden="true">✏️ </span>Mijn eigen items
          </h2>
          {eigen.length > 0 && (
            <span className="teller">
              {eigen.filter((e) => aangevinkt.has(eigenSleutel(e.id))).length}/{eigen.length}
            </span>
          )}
        </div>
        {eigen.length > 0 && (
          <ul className="vinklijst">
            {eigen.map((e) => (
              <li key={e.id} className="vinklijst__eigen">
                <VinkRegel
                  tekst={e.naam}
                  aan={aangevinkt.has(eigenSleutel(e.id))}
                  onWissel={() => wissel(eigenSleutel(e.id))}
                />
                <button
                  type="button"
                  className="icoonknop"
                  aria-label={`${e.naam} verwijderen`}
                  onClick={() => verwijder(e.id)}
                >
                  <Icoon naam="kruis" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="toevoegen" onSubmit={voegToe}>
          <label className="verborgen" htmlFor="nieuw-item">
            Nieuw item
          </label>
          <input
            id="nieuw-item"
            className="invoer"
            value={nieuw}
            onChange={(e) => setNieuw(e.target.value)}
            placeholder="Bijv. oplader camera"
            maxLength={80}
            enterKeyHint="done"
          />
          <button type="submit" className="knop knop--primair" disabled={!nieuw.trim()} aria-label="Toevoegen">
            <Icoon naam="plus" />
          </button>
        </form>
      </section>


      {nieuweKop && feest > 0 && <Feestregen key={feest} onKlaar={() => setFeest(0)} />}
    </div>
  )
}

function VinkRegel({
  tekst,
  aan,
  onWissel,
  animeer = false,
}: {
  tekst: string
  aan: boolean
  onWissel: () => void
  /** Korte vinkanimatie bij het aanvinken (alleen met de nieuwe koppen) */
  animeer?: boolean
}) {
  const [net, setNet] = useState(false)
  return (
    <label className={`vinkregel${aan ? ' is-aan' : ''}${net ? ' is-net' : ''}`}>
      <input
        type="checkbox"
        checked={aan}
        onChange={() => {
          setNet(animeer && !aan)
          onWissel()
        }}
      />
      <span className="vinkregel__vak" aria-hidden="true" onAnimationEnd={() => setNet(false)}>
        {aan && <Icoon naam="vink" grootte={22} />}
      </span>
      <span className="vinkregel__tekst">{tekst}</span>
    </label>
  )
}
