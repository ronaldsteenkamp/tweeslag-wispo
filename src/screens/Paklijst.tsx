import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { Confetti } from '../components/Confetti'
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

const sleutel = (categorie: string, item: string) => `${categorie}::${item}`
const eigenSleutel = (id: string) => `eigen::${id}`

export default function Paklijst() {
  const { data, fout } = useData('paklijst')
  const [vinkjes, setVinkjes] = useOpgeslagen<string[]>('paklijst.vinkjes', [])
  const [eigen, setEigen] = useOpgeslagen<EigenItem[]>('paklijst.eigen', [])
  const [nieuw, setNieuw] = useState('')
  const [resetVragen, setResetVragen] = useState(false)
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

  // ---- Extraatjes met de nieuwe koppen: klare categorieën inklappen, confetti bij 100% ----
  const klareCategorieen = useMemo(
    () =>
      new Set(
        (data?.categorieen ?? [])
          .filter((c) => c.items.length > 0 && c.items.every((i) => aangevinkt.has(sleutel(c.naam, i))))
          .map((c) => c.naam),
      ),
    [data, aangevinkt],
  )
  // Klare categorieën die je zelf weer opengetikt hebt
  const [opengetikt, setOpengetikt] = useState<Set<string>>(() => new Set())
  // Net klaar: nog even open laten, zodat je het laatste vinkje ziet verschijnen
  const [netKlaar, setNetKlaar] = useState<Set<string>>(() => new Set())
  const vorigeKlaar = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!data) return
    const vorige = vorigeKlaar.current
    vorigeKlaar.current = klareCategorieen
    // Bij het openen van het scherm zijn klare categorieën meteen ingeklapt
    if (!vorige) return
    // Niet meer klaar: de volgende keer dat hij klaar is, klapt hij weer in
    setOpengetikt((s) => (Array.from(s).every((n) => klareCategorieen.has(n)) ? s : new Set(Array.from(s).filter((n) => klareCategorieen.has(n)))))
    const net = Array.from(klareCategorieen).filter((n) => !vorige.has(n))
    if (net.length === 0) return
    setNetKlaar((s) => new Set([...s, ...net]))
    window.setTimeout(() => {
      setNetKlaar((s) => new Set(Array.from(s).filter((n) => !net.includes(n))))
    }, 900)
  }, [data, klareCategorieen])

  const klapOpen = (naam: string, open: boolean) => {
    setOpengetikt((s) => {
      const n = new Set(s)
      if (open) n.add(naam)
      else n.delete(naam)
      return n
    })
    if (!open) setNetKlaar((s) => new Set(Array.from(s).filter((x) => x !== naam)))
  }

  // Confetti één keer op het moment dat alles ingepakt is (niet bij het openen van een volle lijst)
  const [confetti, setConfetti] = useState(false)
  const vorigProcent = useRef<number | null>(null)
  useEffect(() => {
    if (!data) return
    const vorig = vorigProcent.current
    vorigProcent.current = procent
    if (vorig === null || vorig === 100 || procent !== 100) return
    setConfetti(true)
    const id = window.setTimeout(() => setConfetti(false), 2600)
    return () => window.clearTimeout(id)
  }, [data, procent])

  const wissel = (s: string) =>
    setVinkjes((oud) => (oud.includes(s) ? oud.filter((x) => x !== s) : [...oud, s]))

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
        const ingeklapt = isKlaar && !opengetikt.has(c.naam) && !netKlaar.has(c.naam)
        const kopTekst = (
          <>
            {c.icoon && <span aria-hidden="true">{c.icoon} </span>}
            {c.naam}
          </>
        )
        if (ingeklapt) {
          return (
            <section className="kaartje categorie categorie--klaar is-ingeklapt" key={c.naam}>
              <h2 className="categorie__regel">
                <button type="button" aria-expanded={false} onClick={() => klapOpen(c.naam, true)}>
                  <span>{kopTekst}</span>
                  <span className="teller teller--klaar">Klaar ✓</span>
                </button>
              </h2>
            </section>
          )
        }
        return (
          <section className={`kaartje categorie${isKlaar ? ' categorie--klaar' : ''}`} key={c.naam}>
            <div className="kaartje__kop">
              <h2>{kopTekst}</h2>
              {isKlaar ? (
                <button
                  type="button"
                  className="teller teller--klaar categorie__inklappen"
                  aria-expanded={true}
                  aria-label={`${c.naam} is klaar, inklappen`}
                  onClick={() => klapOpen(c.naam, false)}
                >
                  Klaar ✓
                </button>
              ) : (
                <span className={`teller${inCategorie === c.items.length ? ' teller--klaar' : ''}`}>
                  {inCategorie}/{c.items.length}
                </span>
              )}
            </div>
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

      <button
        type="button"
        className="knop knop--secundair knop--breed"
        onClick={() => setResetVragen(true)}
        disabled={klaar === 0}
      >
        <Icoon naam="herstel" /> Alles resetten
      </button>

      <BevestigDialoog
        open={resetVragen}
        titel="Alle vinkjes weghalen?"
        tekst="Je begint dan weer met een lege paklijst. Je eigen items blijven staan."
        bevestigLabel="Ja, resetten"
        gevaarlijk
        onAnnuleer={() => setResetVragen(false)}
        onBevestig={() => {
          setVinkjes([])
          setResetVragen(false)
        }}
      />

      {nieuweKop && confetti && (
        <div className="paklijst__confetti">
          <Confetti />
        </div>
      )}
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
