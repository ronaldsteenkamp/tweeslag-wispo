import { useMemo, useState } from 'react'
import { useBackend } from '../lib/backend'
import { alleDeelnemers, useData } from '../lib/data'
import { useNu } from '../lib/nu'
import { useOpgeslagen } from '../lib/opslag'
import { stem, useStemmingen, winnaars, type StemmingInfo, type StemStand } from '../lib/stemming'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { BevestigDialoog } from './BevestigDialoog'
import { Icoon } from './Icoon'
import { Verbinding } from './Verbinding'

/** '21:30' voor vandaag, anders 'vr 12 om 12:00' */
export function wanneer(ms: number, nu: Date) {
  const d = new Date(ms)
  return datumISO(d) === datumISO(nu) ? tijdUUMM(d) : `${datumLabel(datumISO(d), 'kort')} om ${tijdUUMM(d)}`
}

const stemmenTekst = (n: number) => `${n} ${n === 1 ? 'stem' : 'stemmen'}`

/** Dagelijkse stemming: open vragen, wat er nog komt en de uitslagen */
export function Stemmen() {
  const nu = useNu(5000)
  const backend = useBackend()
  const { stemmingen, stand, mislukt } = useStemmingen(backend.status !== 'uit')
  const { data: kamers } = useData('kamers')
  const [naam] = useOpgeslagen<string | null>('naam', null)

  const alleNamen = useMemo(() => alleDeelnemers(kamers), [kamers])

  if (backend.status === 'uit') {
    return (
      <section className="kaartje">
        <h2>Stemmen</h2>
        <p>Er is geen backend ingesteld, dus stemmen kan niet.</p>
      </section>
    )
  }

  const t = nu.getTime()
  const open = stemmingen.filter((s) => s.open <= t && t < s.sluit)
  const komend = stemmingen.filter((s) => t < s.open)
  const gesloten = stemmingen.filter((s) => s.sluit <= t).sort((a, b) => b.sluit - a.sluit)
  const volgende = komend[0]
  const geenVerbinding = backend.status !== 'verbonden'

  return (
    <>
      <div className="kaartje klassement__status">
        <Verbinding />
        <p className="klein">
          {geenVerbinding || mislukt
            ? 'Stemmen kan alleen met internet.'
            : 'Eén stem per vraag. De uitslag zie je na de sluitingstijd.'}
        </p>
      </div>

      {stemmingen.length === 0 && <p className="laadtekst">Er zijn (nog) geen stemmingen.</p>}

      {open.map((s) => (
        <StemKaart
          key={s.id}
          s={s}
          nu={nu}
          stand={stand}
          naam={naam}
          kandidaten={s.kandidaten.length ? s.kandidaten : alleNamen}
          kanStemmen={!geenVerbinding}
        />
      ))}

      {volgende && (
        <div className="kaartje teaser">
          <Icoon naam="slot" />
          <p>
            <strong>Volgende stemming:</strong> {komend.filter((s) => s.open === volgende.open).map((s) => s.vraag).join(', ')}{' '}
            · opent {wanneer(volgende.open, nu)}
          </p>
        </div>
      )}

      {gesloten.length > 0 && <h2 className="tussenkop">Uitslagen</h2>}
      {gesloten.map((s) => (
        <UitslagKaart key={s.id} s={s} stand={stand} naam={naam} />
      ))}

      {stemmingen.length > 0 && <AlleStemmingen stemmingen={stemmingen} nu={nu} beheerder={backend.beheerder} />}

      {stand && (geenVerbinding || mislukt) && (
        <p className="klein klassement__voet">Laatst bijgewerkt om {wanneer(stand.opgehaald, nu)}</p>
      )}
    </>
  )
}

function StemKaart({
  s,
  nu,
  stand,
  naam,
  kandidaten,
  kanStemmen,
}: {
  s: StemmingInfo
  nu: Date
  stand: StemStand | null
  naam: string | null
  kandidaten: string[]
  kanStemmen: boolean
}) {
  const [keuze, setKeuze] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const mijn = stand?.mijn[s.id]
  const totaal = stand?.totalen[s.id] ?? 0
  const eigen = naam?.toLowerCase()

  const bevestig = async () => {
    if (!keuze) return
    const k = keuze
    setKeuze(null)
    setBezig(true)
    setFout(null)
    const f = await stem(s.id, k)
    setBezig(false)
    setFout(f)
  }

  return (
    <section className="kaartje stemming">
      <div className="kaartje__kop">
        <h2>{s.vraag}</h2>
        <span className="label label--accent">open</span>
      </div>
      <p className="klein">
        Sluit {wanneer(s.sluit, nu)} · {stemmenTekst(totaal)} tot nu toe
      </p>

      {mijn ? (
        <p className="stemming__gestemd">
          <Icoon naam="vink" grootte={22} />
          <span>
            Je stemde op <strong>{mijn}</strong>. De uitslag komt {wanneer(s.sluit, nu).includes(' om ') ? 'op' : 'om'}{' '}
            {wanneer(s.sluit, nu)}.
          </span>
        </p>
      ) : !naam ? (
        <p className="melding">Kies eerst je naam op Home, dan kun je stemmen.</p>
      ) : (
        <>
          <div className="stemming__kandidaten">
            {kandidaten.map((k) => {
              const zelf = k.toLowerCase() === eigen
              return (
                <button
                  key={k}
                  type="button"
                  className="knop knop--naam"
                  disabled={zelf || !kanStemmen || bezig}
                  onClick={() => setKeuze(k)}
                >
                  {k}
                  {zelf && <small> (jij)</small>}
                </button>
              )
            })}
          </div>
          {!kanStemmen && <p className="klein">Geen verbinding. Stemmen kan zodra er weer internet is.</p>}
        </>
      )}

      {fout && (
        <p className="melding melding--fout" role="alert">
          {fout}
        </p>
      )}

      <BevestigDialoog
        open={keuze !== null}
        titel={`Stemmen op ${keuze ?? ''}?`}
        tekst={`${s.vraag}. Je kunt je stem daarna niet meer veranderen.`}
        bevestigLabel="Stem"
        onAnnuleer={() => setKeuze(null)}
        onBevestig={() => void bevestig()}
      />
    </section>
  )
}

/** '15:00–21:30', of met dag erbij als hij op een andere dag opent of sluit */
function venster(s: StemmingInfo) {
  const o = new Date(s.open)
  const z = new Date(s.sluit)
  const dag = (d: Date) => (datumISO(d) === s.datum ? '' : `${datumLabel(datumISO(d), 'kort')} `)
  return `${dag(o)}${tijdUUMM(o)} – ${dag(z)}${tijdUUMM(z)}`
}

/** Overzicht van alle stemmingen, per dag */
function AlleStemmingen({ stemmingen, nu, beheerder }: { stemmingen: StemmingInfo[]; nu: Date; beheerder: boolean }) {
  const t = nu.getTime()
  const perDag = new Map<string, StemmingInfo[]>()
  for (const s of [...stemmingen].sort((a, b) => a.datum.localeCompare(b.datum) || a.open - b.open)) {
    perDag.set(s.datum, [...(perDag.get(s.datum) ?? []), s])
  }
  return (
    <details className="kaartje alle-stemmingen">
      <summary>📋 Alle stemmingen ({stemmingen.length})</summary>
      {[...perDag].map(([datum, lijst]) => (
        <div key={datum} className="alle-stemmingen__dag">
          <h3>{datumLabel(datum)}</h3>
          <ul>
            {lijst.map((s) => (
              <li key={s.id} className={s.sluit <= t ? 'is-voorbij' : ''}>
                <span>
                  {s.vraag}
                  <small>
                    {venster(s)}
                    {beheerder && s.alleenLokaal && ' · nog niet op de server'}
                  </small>
                </span>
                {s.open <= t && t < s.sluit ? (
                  <span className="label label--accent">open</span>
                ) : s.sluit <= t ? (
                  <span className="label">gesloten</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  )
}

const MEDAILLES = ['🥇', '🥈', '🥉']

function UitslagKaart({ s, stand, naam }: { s: StemmingInfo; stand: StemStand | null; naam: string | null }) {
  const uitslag = stand?.uitslagen[s.id]
  const totaal = stand?.totalen[s.id]
  // Opgehaald vóór de sluitingstijd? Dan hebben we de uitslag nog niet
  const bekend = !!stand && stand.opgehaald >= s.sluit
  const top = winnaars(uitslag)
  const mijn = stand?.mijn[s.id]

  return (
    <section className="kaartje stemming">
      <div className="kaartje__kop">
        <h2>{s.vraag}</h2>
        <span className="klein">{datumLabel(s.datum, 'kort')}</span>
      </div>
      {!bekend ? (
        <p className="klein">De uitslag verschijnt zodra er verbinding is.</p>
      ) : !uitslag?.length ? (
        <p className="klein">Er is niet gestemd.</p>
      ) : (
        <>
          <p className="stemming__winnaar">
            🏆 {top.map((w) => w.kandidaat).join(' & ')}
            <small>
              {' '}
              · {stemmenTekst(top[0].stemmen)}
              {top.length > 1 ? ' elk (gedeeld)' : ''}
            </small>
          </p>
          <ol className="ranglijst ranglijst--klein">
            {uitslag.map((u, i) => (
              <li key={u.kandidaat} className={u.kandidaat === naam ? 'is-eigen' : ''}>
                <span className="ranglijst__plek">{u.stemmen === top[0].stemmen ? MEDAILLES[0] : MEDAILLES[i] ?? i + 1}</span>
                <span className="ranglijst__naam">{u.kandidaat}</span>
                <span className="ranglijst__punten">{u.stemmen}</span>
              </li>
            ))}
          </ol>
          <p className="klein">
            {stemmenTekst(totaal ?? 0)} in totaal{mijn ? ` · jij stemde op ${mijn}` : ''}
          </p>
        </>
      )}
    </section>
  )
}

/** Op Home: open stemmingen waarop je nog niet stemde, en de laatste winnaars */
export function StemmingOpHome({ naarStemmen }: { naarStemmen: () => void }) {
  const nu = useNu(15000)
  const backend = useBackend()
  const { stemmingen, stand } = useStemmingen(backend.status !== 'uit')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  if (backend.status === 'uit') return null

  const t = nu.getTime()
  const teStemmen = stemmingen.filter((s) => s.open <= t && t < s.sluit && !stand?.mijn[s.id])
  // Winnaars van de laatst gesloten dag(en) met een bekende uitslag
  const gesloten = stemmingen.filter((s) => s.sluit <= t && stand && stand.opgehaald >= s.sluit)
  const laatsteDag = gesloten.sort((a, b) => b.sluit - a.sluit)[0]?.datum
  const vanDieDag = gesloten.filter((s) => s.datum === laatsteDag).sort((a, b) => a.open - b.open || a.id.localeCompare(b.id))

  if (!teStemmen.length && !vanDieDag.length) return null

  return (
    <>
      {teStemmen.length > 0 && naam && (
        <section className="kaartje stemming stemming--home">
          <h2>🗳️ Stemmen maar!</h2>
          <p>
            {teStemmen.map((s) => s.vraag).join(' · ')}
            <br />
            <span className="klein">Sluit {wanneer(Math.min(...teStemmen.map((s) => s.sluit)), nu)}</span>
          </p>
          <button type="button" className="knop knop--accent knop--breed" onClick={naarStemmen}>
            Stem nu
          </button>
        </section>
      )}

      {vanDieDag.length > 0 && (
        <section className="kaartje">
          <div className="kaartje__kop">
            <h2>🏆 Winnaars {datumISO(nu) === laatsteDag ? 'van vandaag' : `van ${datumLabel(laatsteDag!)}`}</h2>
            <button type="button" className="tekstknop" onClick={naarStemmen}>
              Uitslagen <Icoon naam="pijl" grootte={18} />
            </button>
          </div>
          <ul className="winnaars">
            {vanDieDag.map((s) => {
              const top = winnaars(stand?.uitslagen[s.id])
              return (
                <li key={s.id}>
                  <span className="winnaars__vraag">{s.vraag}</span>
                  <strong className="winnaars__naam">
                    {top.length ? top.map((w) => w.kandidaat).join(' & ') : 'niemand gestemd'}
                  </strong>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
