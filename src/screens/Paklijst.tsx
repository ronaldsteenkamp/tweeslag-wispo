import { useMemo, useState, type FormEvent } from 'react'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { useData } from '../lib/data'
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
        <h1>Paklijst</h1>
        <DataStatus fout={fout} />
      </div>
    )
  }

  return (
    <div className="scherm">
      <h1>Paklijst</h1>

      <div className="kaartje voortgang" aria-live="polite">
        <div className="voortgang__tekst">
          <strong>{klaar === totaal && totaal > 0 ? 'Alles ingepakt! 🎉' : `${klaar} van ${totaal} ingepakt`}</strong>
          <span>{procent}%</span>
        </div>
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
      </div>

      {data.categorieen.map((c) => {
        const inCategorie = c.items.filter((i) => aangevinkt.has(sleutel(c.naam, i))).length
        return (
          <section className="kaartje categorie" key={c.naam}>
            <div className="kaartje__kop">
              <h2>
                {c.icoon && <span aria-hidden="true">{c.icoon} </span>}
                {c.naam}
              </h2>
              <span className={`teller${inCategorie === c.items.length ? ' teller--klaar' : ''}`}>
                {inCategorie}/{c.items.length}
              </span>
            </div>
            <ul className="vinklijst">
              {c.items.map((item) => {
                const s = sleutel(c.naam, item)
                return (
                  <li key={s}>
                    <VinkRegel tekst={item} aan={aangevinkt.has(s)} onWissel={() => wissel(s)} />
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
    </div>
  )
}

function VinkRegel({ tekst, aan, onWissel }: { tekst: string; aan: boolean; onWissel: () => void }) {
  return (
    <label className={`vinkregel${aan ? ' is-aan' : ''}`}>
      <input type="checkbox" checked={aan} onChange={onWissel} />
      <span className="vinkregel__vak" aria-hidden="true">
        {aan && <Icoon naam="vink" grootte={22} />}
      </span>
      <span className="vinkregel__tekst">{tekst}</span>
    </label>
  )
}
