import { useMemo, useState } from 'react'
import { useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { alleDeelnemers, useData } from '../lib/data'
import { useNu } from '../lib/nu'
import { useOpgeslagen } from '../lib/opslag'
import { klank, trilSpel, useSpelGeluid } from '../lib/spelgeluid'
import { stem, useStemmingen, winnaars, type StemmingInfo, type StemStand, type Uitslag } from '../lib/stemming'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { Icoon } from './Icoon'
import { normaal } from './NaamKiezer'
import { HoudKnop, Kraslot, Stempel } from './Stempelkaart'
import { Verbinding } from './Verbinding'

/** '21:30' voor vandaag, anders 'vr 12 om 12:00' */
export function wanneer(ms: number, nu: Date) {
  const d = new Date(ms)
  return datumISO(d) === datumISO(nu) ? tijdUUMM(d) : `${datumLabel(datumISO(d), 'kort')} om ${tijdUUMM(d)}`
}

const stemmenTekst = (n: number) => `${n} ${n === 1 ? 'stem' : 'stemmen'}`

/** Dagelijkse stemming: open stembiljetten, wat er nog komt en de uitslagen (eerst openkrassen) */
export function Stemmen() {
  const nu = useNu(5000)
  const backend = useBackend()
  const { stemmingen, stand, mislukt } = useStemmingen(backend.status !== 'uit')
  const { data: kamers } = useData('kamers')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const [geluid] = useSpelGeluid()

  const alleNamen = useMemo(() => alleDeelnemers(kamers), [kamers])

  if (backend.status === 'uit') {
    return <p className="spel__voetnoot">Er is geen backend ingesteld, dus stemmen kan niet.</p>
  }

  const t = nu.getTime()
  const open = stemmingen.filter((s) => s.open <= t && t < s.sluit)
  const komend = stemmingen.filter((s) => t < s.open)
  const gesloten = stemmingen.filter((s) => s.sluit <= t).sort((a, b) => b.sluit - a.sluit)
  const volgende = komend[0]
  const geenVerbinding = backend.status !== 'verbonden'

  return (
    <>
      <div className="spel__status">
        <Verbinding />
        <p>{geenVerbinding || mislukt ? 'Stemmen kan alleen met internet.' : 'Eén stem per vraag. De uitslag krassen we open na de sluitingstijd.'}</p>
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
          geluid={geluid}
        />
      ))}

      {volgende && (
        <div className="dagkaart dagkaart--teaser">
          <Icoon naam="slot" />
          <p>
            <strong>Volgende stemming:</strong> {komend.filter((s) => s.open === volgende.open).map((s) => s.vraag).join(', ')} · opent{' '}
            {wanneer(volgende.open, nu)}
          </p>
        </div>
      )}

      {gesloten.length > 0 && <h2 className="spel__tussenkop">Uitslagen</h2>}
      {gesloten.map((s) => (
        <UitslagKaart key={s.id} s={s} stand={stand} naam={naam} geluid={geluid} />
      ))}

      {stemmingen.length > 0 && <AlleStemmingen stemmingen={stemmingen} nu={nu} beheerder={backend.beheerder} />}

      {stand && (geenVerbinding || mislukt) && <p className="spel__voetnoot">Laatst bijgewerkt om {wanneer(stand.opgehaald, nu)}</p>}
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
  geluid,
}: {
  s: StemmingInfo
  nu: Date
  stand: StemStand | null
  naam: string | null
  kandidaten: string[]
  kanStemmen: boolean
  geluid: boolean
}) {
  const [keuze, setKeuze] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [zoek, setZoek] = useState('')
  const [netGestemd, setNetGestemd] = useState(false)
  const mijn = stand?.mijn[s.id]
  const q = normaal(zoek)
  const toon = useToonNaam()
  const zichtbaar = (q ? kandidaten.filter((k) => normaal(k).includes(q) || normaal(toon(k)).includes(q)) : kandidaten)
    .slice()
    .sort((a, b) => toon(a).localeCompare(toon(b), 'nl'))
  const totaal = stand?.totalen[s.id] ?? 0
  const eigen = naam?.toLowerCase()

  const bevestig = async () => {
    if (!keuze) return
    const k = keuze
    setBezig(true)
    setFout(null)
    const f = await stem(s.id, k)
    setBezig(false)
    setFout(f)
    if (!f) {
      setKeuze(null)
      setNetGestemd(true)
      klank('stempel', geluid)
      trilSpel('stempel', geluid)
    } else {
      klank('fout', geluid)
      trilSpel('fout', geluid)
    }
  }

  return (
    <section className="biljet">
      <div className="biljet__kop">
        <span className="spel__caps">
          Stembiljet · sluit {wanneer(s.sluit, nu)} · {stemmenTekst(totaal)}
        </span>
        <h2 className="biljet__vraag">{s.vraag}</h2>
      </div>

      {mijn ? (
        <div className="biljet__gestemd">
          <Stempel nieuw={netGestemd}>
            Gestemd op
            <b className="naam">{toon(mijn)}</b>
          </Stempel>
          <p>Je stem zit in de bus. De uitslag krassen we open {wanneer(s.sluit, nu).includes(' om ') ? 'op' : 'om'} {wanneer(s.sluit, nu)}.</p>
        </div>
      ) : !naam ? (
        <p className="spel__voetnoot">Kies eerst je naam op Home, dan kun je stemmen.</p>
      ) : (
        <>
          {/* Zoals bij het kiezen van je naam: met veel namen eerst zoeken */}
          {kandidaten.length > 8 && (
            <label className="biljet__zoek">
              <Icoon naam="zoek" grootte={22} />
              <span className="verborgen">Zoek een naam</span>
              <input
                type="search"
                placeholder="Zoek een naam"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
          )}
          <div className="biljet__namen">
            {zichtbaar.map((k) => {
              const zelf = k.toLowerCase() === eigen
              return (
                <button
                  key={k}
                  type="button"
                  className="biljet__naam"
                  aria-pressed={keuze === k}
                  aria-disabled={zelf || !kanStemmen || bezig}
                  onClick={() => {
                    if (zelf || !kanStemmen || bezig) {
                      klank('fout', geluid)
                      trilSpel('fout', geluid)
                      if (zelf) setFout('Op jezelf stemmen? Mooi geprobeerd.')
                      return
                    }
                    setFout(null)
                    klank('pen', geluid)
                    trilSpel('tik', geluid)
                    setKeuze(keuze === k ? null : k)
                  }}
                >
                  <span className="biljet__hokje" aria-hidden="true">
                    <svg viewBox="0 0 40 40">
                      <path d="M9 9l22 22M31 8L9 31" />
                    </svg>
                  </span>
                  <span className="naam">
                    {toon(k)}
                    {zelf && <small> (jij)</small>}
                  </span>
                </button>
              )
            })}
          </div>
          {zichtbaar.length === 0 && <p className="laadtekst">Geen naam gevonden met ‘{zoek}’.</p>}
          {!kanStemmen && <p className="spel__voetnoot">Geen verbinding. Stemmen kan zodra er weer internet is.</p>}
          <div className={`biljet__stem${keuze ? ' heeft-keuze' : ''}`}>
            {keuze ? (
              <>
                <HoudKnop onKlaar={() => void bevestig()} disabled={bezig} geluid={geluid}>
                  {bezig ? 'Bezig…' : 'Houd vast: stem'}
                </HoudKnop>
                <p>
                  Op <b>{toon(keuze)}</b>. Daarna kun je je stem niet meer veranderen.
                </p>
              </>
            ) : (
              <p>Kruis één naam aan. Op jezelf stemmen telt niet.</p>
            )}
          </div>
        </>
      )}

      {fout && (
        <p className="spel__fout" role="alert">
          {fout}
        </p>
      )}
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
    <details className="programma">
      <summary>Alle stemmingen ({stemmingen.length})</summary>
      {[...perDag].map(([datum, lijst]) => (
        <div key={datum} className="programma__dag">
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
                {s.open <= t && t < s.sluit ? <span className="programma__label is-open">open</span> : s.sluit <= t ? <span className="programma__label">gesloten</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  )
}

/** Plaats met gedeelde plekken: 10, 10, 7, 5 stemmen geeft 1, 1, 3, 4 */
const plaats = (uitslag: Uitslag[], i: number) => 1 + uitslag.filter((u) => u.stemmen > uitslag[i].stemmen).length

function UitslagKaart({ s, stand, naam, geluid }: { s: StemmingInfo; stand: StemStand | null; naam: string | null; geluid: boolean }) {
  const uitslag = stand?.uitslagen[s.id]
  const totaal = stand?.totalen[s.id]
  // Opgehaald vóór de sluitingstijd? Dan hebben we de uitslag nog niet
  const bekend = !!stand && stand.opgehaald >= s.sluit
  const top = winnaars(uitslag)
  const mijn = stand?.mijn[s.id]
  const toon = useToonNaam()
  // Een nieuwe uitslag krast je eerst open (één keer per telefoon)
  const [gekrast, setGekrast] = useOpgeslagen<string[]>('spel.gekrast', [])
  const [netOpen, setNetOpen] = useState(false)
  const dicht = bekend && !!uitslag?.length && top.length > 0 && !gekrast.includes(s.id)
  const winnaarNamen = top.map((w) => toon(w.kandidaat)).join(' & ')

  return (
    <section className={`uitslag${netOpen ? ' net-open' : ''}`}>
      <div className="biljet__kop">
        <span className="spel__caps">
          {datumLabel(s.datum, 'kort')}
          {totaal ? ` · ${stemmenTekst(totaal)}` : ''}
        </span>
        <h2 className="biljet__vraag">{s.vraag}</h2>
      </div>
      {!bekend ? (
        <p className="spel__voetnoot">De uitslag verschijnt zodra er verbinding is.</p>
      ) : !uitslag?.length || !top.length ? (
        <p className="spel__voetnoot">Er is niet gestemd.</p>
      ) : (
        <>
          <div className="uitslag__winnaar">
            <div className="uitslag__plek">
              1<small>{top.length > 1 ? 'GEDEELD' : 'PLEK'}</small>
            </div>
            {dicht ? (
              <Kraslot
                geluid={geluid}
                label={`Kraslot met de winnaar van: ${s.vraag}`}
                onOpen={() => {
                  setGekrast((oud) => (oud.includes(s.id) ? oud : [...oud, s.id]))
                  setNetOpen(true)
                  klank('bel', geluid)
                  trilSpel('winnaar', geluid)
                }}
              >
                <Winnaar namen={winnaarNamen} stemmen={top[0].stemmen} gedeeld={top.length > 1} />
              </Kraslot>
            ) : (
              <div className="kraslot is-open">
                <div className="kraslot__inhoud">
                  <Winnaar namen={winnaarNamen} stemmen={top[0].stemmen} gedeeld={top.length > 1} />
                </div>
              </div>
            )}
            {!dicht && (
              <Stempel nieuw={netOpen} className="uitslag__stempel">
                Dag-
                <b>winnaar</b>
              </Stempel>
            )}
          </div>
          {!dicht && (
            <>
              <ol className="uitslag__lijst">
                {uitslag.map((u, i) => {
                  const p = plaats(uitslag, i)
                  const gedeeld = uitslag.filter((x) => x.stemmen === u.stemmen).length > 1
                  return (
                    <li key={u.kandidaat} className={u.kandidaat === naam ? 'is-eigen' : ''}>
                      <span className="r__plek">
                        {p}
                        {gedeeld ? '=' : ''}
                      </span>
                      <span className="r__naam">
                        <b className="naam">{toon(u.kandidaat)}</b>
                      </span>
                      <span className="r__pnt">{u.stemmen}</span>
                    </li>
                  )
                })}
              </ol>
              <p className="spel__voetnoot">
                {stemmenTekst(totaal ?? 0)} in totaal{mijn ? ` · jij stemde op ${toon(mijn)}` : ''}
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}

function Winnaar({ namen, stemmen, gedeeld }: { namen: string; stemmen: number; gedeeld: boolean }) {
  return (
    <>
      <p className={`uitslag__naam naam${namen.length > 16 ? ' is-lang' : ''}`}>{namen}</p>
      <p className="uitslag__extra">
        {stemmenTekst(stemmen)}
        {gedeeld ? ' elk, gedeelde eerste plek' : ''}
      </p>
    </>
  )
}

/** Op Home: open stemmingen waarop je nog niet stemde, en de laatste winnaars */
export function StemmingOpHome({ naarStemmen }: { naarStemmen: () => void }) {
  const nu = useNu(15000)
  const backend = useBackend()
  const { stemmingen, stand } = useStemmingen(backend.status !== 'uit')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const toon = useToonNaam()
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
                    {top.length ? top.map((w) => toon(w.kandidaat)).join(' & ') : 'niemand gestemd'}
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
