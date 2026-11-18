import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Aftelklok } from '../components/Aftelklok'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { FotoUpload } from '../components/FotoUpload'
import { Klassement } from '../components/Klassement'
import { Stemmen } from '../components/Stemmen'
import { Sneeuw } from '../components/Sneeuw'
import { GeluidKnop } from '../components/rad/basis'
import { InktFilter, Stempel } from '../components/Stempelkaart'
import { config } from '../config'
import { backendIngesteld, useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { bingoScore, LIJNEN, maakKaart, MIDDEN, vakjeTekst } from '../lib/bingo'
import { useData, type ChallengeDag, type Spel as SpelData } from '../lib/data'
import { testOntgrendeld, useNu } from '../lib/nu'
import { lees, useOpgeslagen } from '../lib/opslag'
import { useNieuweKoppen } from '../lib/nieuweKoppen'
import { KLASSEMENT_CACHE, type Klassement as KlassementData } from '../lib/scorebord'
import { SchermKop } from '../components/SchermKop'
import { klank, minderBeweging, trilSpel, useSpelGeluid } from '../lib/spelgeluid'
import { tabToetsen } from '../lib/tabbladen'
import { datumISO, datumLabel, lokaalNaarDate } from '../lib/tijd'
import '../styles/barlow.css'
import '../styles/spel.css'

const spelOpen = lokaalNaarDate(config.spelOpen)
const ONDERDELEN = ['challenges', 'bingo', 'stemmen', 'klassement'] as const
const openMoment = (d: ChallengeDag) => lokaalNaarDate(`${d.datum}T${d.openOm ?? config.challengesOpenOm}`)
/** Emoji vooraan een tekst (uit spel.json) weglaten: het Spel praat in drukwerk, niet in emoji */
const zonderEmoji = (t: string) => t.replace(/^[\p{Extended_Pictographic}\p{Regional_Indicator}][\p{Extended_Pictographic}️‍\p{Regional_Indicator}]*\s*/u, '')

export default function Spel() {
  // Challenges gaan op hele minuten open; de aftelklok tikt zelf elke seconde
  const nu = useNu(10_000)
  const { data, fout } = useData('spel')
  const nieuweKop = useNieuweKoppen()

  if (!testOntgrendeld && !config.spelTestperiode && nu < spelOpen) {
    return (
      <div className="scherm">
        <section className="slot golf">
          <Sneeuw />
          <div className="slot__icoon">
            <Icoon naam="slot" grootte={56} />
          </div>
          <h1>Het spel is nog op slot</h1>
          <p>
            Het gaat open op {datumLabel(config.spelOpen.slice(0, 10))} om {config.spelOpen.slice(11)}, als de bus
            bijna vertrekt.
          </p>
          <Aftelklok doel={spelOpen} />
          <p className="klein">Wat er gaat gebeuren? Dat lees je dan op de eerste dagkaart.</p>
        </section>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="scherm">
        {nieuweKop ? <SchermKop titel="Spel" /> : <h1>Spel</h1>}
        <DataStatus fout={fout} />
      </div>
    )
  }

  return <SpelOpen data={data} nu={nu} />
}

function SpelOpen({ data, nu }: { data: SpelData; nu: Date }) {
  const [onderdeel, setOnderdeel] = useOpgeslagen<'challenges' | 'bingo' | 'stemmen' | 'klassement'>('spel.onderdeel', 'challenges')
  const [gedaan, setGedaan] = useOpgeslagen<string[]>('spel.challenges', [])
  // Het rad stond eerst hier; het is nu een eigen tabblad
  useEffect(() => {
    if ((onderdeel as string) === 'rad') setOnderdeel('challenges')
  }, [onderdeel, setOnderdeel])
  const [gemarkeerd, setGemarkeerd] = useOpgeslagen<string[]>('spel.bingo.vinkjes', [])
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const toon = useToonNaam()
  const [geluid, setGeluid] = useSpelGeluid()
  const [fotoVoor, setFotoVoor] = useState<{ id: string; titel: string } | null>(null)
  const [fotoGelukt, setFotoGelukt] = useState<string | null>(null)
  // De challenge die net een stempel kreeg (voor de bonk en het geluid)
  const [netGedaan, setNetGedaan] = useState<string | null>(null)
  useEffect(() => {
    if (!fotoGelukt) return
    const id = window.setTimeout(() => setFotoGelukt(null), 4000)
    return () => window.clearTimeout(id)
  }, [fotoGelukt])

  // De bingokaart wordt één keer per telefoon geschud en daarna bewaard. Wist het begin van het
  // echte spel hem (ook terwijl dit scherm openstaat), dan komt er meteen een nieuwe.
  const [bewaardeKaart, setBewaardeKaart] = useOpgeslagen<unknown>('spel.bingo.kaart', null)
  const kaart = useMemo(() => maakKaart(data.bingo.vakjes, bewaardeKaart), [data, bewaardeKaart])
  useEffect(() => {
    if (JSON.stringify(kaart) !== JSON.stringify(bewaardeKaart)) setBewaardeKaart(kaart)
  }, [kaart, bewaardeKaart, setBewaardeKaart])
  // Vinkjes van vakjes die niet (meer) op de kaart staan weg, bijv. van de oude pistebingo
  useEffect(() => {
    const opKaart = new Set(kaart)
    if (gemarkeerd.some((t) => !opKaart.has(t))) setGemarkeerd(gemarkeerd.filter((t) => opKaart.has(t)))
  }, [kaart, gemarkeerd, setGemarkeerd])

  const gedaanSet = useMemo(() => new Set(gedaan), [gedaan])
  const gemarkeerdSet = useMemo(() => new Set(gemarkeerd), [gemarkeerd])

  const challengePunten = data.challenges
    .flatMap((d) => d.items)
    .reduce((som, c) => som + (gedaanSet.has(c.id) ? c.punten : 0), 0)
  const bingo = bingoScore(kaart, gemarkeerdSet, data.punten)

  // Voor de nieuwe kop: je plek in het klassement, zoals het laatst is opgehaald (als dat er is)
  const nieuweKop = useNieuweKoppen()
  const mijnPlek = useMemo(() => {
    // Zonder backend is er geen klassement (een oude bewaarde stand niet tonen)
    if (!nieuweKop || !naam || !backendIngesteld) return null
    const personen = lees<KlassementData | null>(KLASSEMENT_CACHE, null)?.personen ?? []
    const ik = personen.find((p) => p.naam === naam)
    if (!ik) return null
    return { plek: 1 + personen.filter((p) => p.totaal > ik.totaal).length, van: personen.length, punten: ik.totaal }
    // nu: af en toe opnieuw lezen, want het klassement wordt op de achtergrond bijgewerkt
  }, [nieuweKop, naam, nu])

  const stempelen = (id: string) => {
    setNetGedaan(id)
    klank('stempel', geluid)
    trilSpel('stempel', geluid)
  }

  return (
    <div className="scherm spel">
      <InktFilter />
      {nieuweKop ? (
        // Met de nieuwe kop staat de score in de kop (geen tweede donkerblauw blok eronder)
        <SchermKop
          titel="Spel"
          boven={naam ? `Score van ${toon(naam)}` : 'Jouw score'}
          ondertitel={`Challenges ${challengePunten} · Busbingo ${bingo.totaal}`}
          rechts={
            <span aria-live="polite">
              <span className="schermkop__groot">{challengePunten + bingo.totaal}</span>
              <br />
              <span className="schermkop__klein">punten</span>
            </span>
          }
        >
          <p className="schermkop__notitie">
            {mijnPlek
              ? `${mijnPlek.plek}e plek van ${mijnPlek.van} in het klassement`
              : backendIngesteld
                ? 'Je score telt mee in het klassement.'
                : 'Je score staat alleen op deze telefoon. Laat hem zien bij de prijsuitreiking!'}
          </p>
        </SchermKop>
      ) : (
        <h1>Spel</h1>
      )}
      {testOntgrendeld && <p className="melding melding--test">Testmodus: alles is open (?unlock=1)</p>}

      <div className="spel__balk">
        {backendIngesteld && (
          <button type="button" className="spelknop spelknop--licht" onClick={() => (window.location.hash = '#fotos')}>
            <Icoon naam="camera" grootte={22} /> Fotomuur
          </button>
        )}
        <GeluidKnop aan={geluid} zet={setGeluid} className="spel__geluid" />
      </div>

      <div
        className="spel__tabs"
        role="tablist"
        aria-label="Onderdeel"
        onKeyDown={tabToetsen(ONDERDELEN, onderdeel, setOnderdeel)}
      >
        {ONDERDELEN.map((o) => (
          <button
            key={o}
            type="button"
            role="tab"
            aria-selected={onderdeel === o}
            tabIndex={onderdeel === o ? 0 : -1}
            onClick={() => {
              if (o !== onderdeel) klank('tik', geluid)
              setOnderdeel(o)
            }}
          >
            {o === 'challenges' ? 'Challenges' : o === 'bingo' ? 'Busbingo' : o === 'stemmen' ? 'Stemmen' : 'Klassement'}
          </button>
        ))}
      </div>

      {onderdeel === 'klassement' ? (
        <Klassement />
      ) : onderdeel === 'stemmen' ? (
        <Stemmen />
      ) : onderdeel === 'challenges' ? (
        <Challenges
          dagen={data.challenges}
          nu={nu}
          gedaan={gedaanSet}
          netGedaan={netGedaan}
          geluid={geluid}
          naam={naam ? toon(naam) : null}
          onWissel={(id) => {
            const was = gedaanSet.has(id)
            setGedaan((oud) => (oud.includes(id) ? oud.filter((x) => x !== id) : [...oud, id]))
            if (!was) stempelen(id)
            else klank('papier', geluid)
          }}
          onFoto={backendIngesteld ? setFotoVoor : undefined}
        />
      ) : (
        <Bingo
          kaart={kaart}
          score={bingo}
          punten={data.punten}
          tekort={data.bingo.vakjes.length < 24}
          geluid={geluid}
          onWissel={(t) => setGemarkeerd((oud) => (oud.includes(t) ? oud.filter((x) => x !== t) : [...oud, t]))}
        />
      )}

      {fotoVoor && (
        <FotoUpload
          challenge={fotoVoor}
          onSluit={() => setFotoVoor(null)}
          onGelukt={(later) => {
            // Bewijs geleverd: dan telt de challenge als gedaan (een extra inzending geeft geen extra punten)
            const id = fotoVoor.id
            const extra = gedaanSet.has(id)
            setGedaan((oud) => (oud.includes(id) ? oud : [...oud, id]))
            if (!extra) stempelen(id)
            const waar = later ? 'Foto bewaard. Hij gaat naar de fotomuur zodra er bereik is.' : 'Foto staat op de fotomuur.'
            setFotoGelukt(extra ? `${waar} Extra inzending voor "${fotoVoor.titel}".` : `${waar} Stempel erop voor "${fotoVoor.titel}".`)
            setFotoVoor(null)
          }}
        />
      )}
      {fotoGelukt && (
        <div className="spel__toast" role="status" onClick={() => setFotoGelukt(null)}>
          <Icoon naam="camera" grootte={22} /> {fotoGelukt}
        </div>
      )}
    </div>
  )
}

function Challenges({
  dagen,
  nu,
  gedaan,
  netGedaan,
  geluid,
  naam,
  onWissel,
  onFoto,
}: {
  dagen: ChallengeDag[]
  nu: Date
  gedaan: Set<string>
  netGedaan: string | null
  geluid: boolean
  naam: string | null
  onWissel: (id: string) => void
  /** Foto als bewijs uploaden (alleen met backend) */
  onFoto?: (c: { id: string; titel: string }) => void
}) {
  const vandaag = datumISO(nu)
  const gesorteerd = [...dagen].sort((a, b) => a.datum.localeCompare(b.datum))
  const nummer = (d: ChallengeDag) => gesorteerd.indexOf(d) + 1
  // Een dagkaart gaat pas op zijn eigen dag open (ook in de testperiode). Beheerders zien alle
  // dagen alvast, om ze te kunnen controleren; met ?unlock=1 kan dat ook om te testen.
  const { beheerder } = useBackend()
  const alleOpen = testOntgrendeld || beheerder
  const isOpen = (d: ChallengeDag) => nu >= openMoment(d)
  const open = gesorteerd.filter((d) => alleOpen || isOpen(d)).reverse()
  const volgende = alleOpen ? undefined : gesorteerd.find((d) => !isOpen(d))
  // Openscheuren alleen bij de nieuwste dag die echt voor iedereen open is
  const nieuwsteOpen = [...gesorteerd].reverse().find(isOpen)
  // Een nieuwe dagkaart moet je eerst openscheuren (één keer per dag per telefoon)
  const [gezien, setGezien] = useOpgeslagen<string[]>('spel.dagkaarten', [])
  const [scheurt, setScheurt] = useState<string | null>(null)
  const [netOpen, setNetOpen] = useState<string | null>(null)

  const scheurOpen = (d: ChallengeDag) => {
    if (scheurt) return
    klank('scheur', geluid)
    trilSpel('tik', geluid)
    setScheurt(d.datum)
    window.setTimeout(
      () => {
        setGezien((oud) => (oud.includes(d.datum) ? oud : [...oud, d.datum]))
        setScheurt(null)
        setNetOpen(d.datum)
        // De regels worden één voor één "gedrukt"
        if (!minderBeweging()) d.items.forEach((_, i) => window.setTimeout(() => klank('papier', geluid), 150 + i * 220))
      },
      minderBeweging() ? 0 : 480,
    )
  }

  return (
    <>
      {open.length === 0 && <p className="laadtekst">Nog geen challenges open.</p>}
      {open.map((d) => {
        const nieuw = d === nieuwsteOpen && !gezien.includes(d.datum)
        const vooruit = !isOpen(d)
        const klaar = d.items.filter((c) => gedaan.has(c.id)).length
        const te = d.items.reduce((s, c) => s + c.punten, 0)
        return (
          <section
            key={d.datum}
            className={`dagkaart${vooruit ? ' dagkaart--vooruit' : ''}${nieuw ? ' is-dicht' : ''}${scheurt === d.datum ? ' scheurt' : ''}${netOpen === d.datum ? ' net-open' : ''}`}
          >
            <div className="dagkaart__kop">
              {vooruit && (
                <span className="dagkaart__beheer">
                  Alleen voor beheerders · voor iedereen open op {datumLabel(d.datum, 'kort')} om {d.openOm ?? config.challengesOpenOm}
                </span>
              )}
              <span className="spel__caps">{d.datum === vandaag ? `Vandaag · ${datumLabel(d.datum)}` : datumLabel(d.datum)}</span>
              <h2 className="dagkaart__titel">Dagkaart nr. {nummer(d)}</h2>
            </div>
            {nieuw ? (
              <>
                <div className="dagkaart__perforatie" aria-hidden="true">
                  <span>Scheur hier</span>
                </div>
                <button type="button" className="dagkaart__stub" onClick={() => scheurOpen(d)}>
                  <span>
                    <b>Scheur open</b>
                    <small>
                      {d.items.length} challenge{d.items.length === 1 ? '' : 's'} · samen {te} punten
                    </small>
                  </span>
                  <Icoon naam="pijl" grootte={30} />
                </button>
                <p className="dagkaart__dicht">Nog dicht. Geen spieken.</p>
              </>
            ) : (
              <>
                <p className="dagkaart__stand spel__caps">
                  {klaar} van {d.items.length} gestempeld
                </p>
                <ol className="stempelkaart">
                  {d.items.map((c, j) => {
                    const isKlaar = gedaan.has(c.id)
                    const inhoud = (
                      <>
                        <span className="ch__tekst">
                          <b>{c.titel}</b>
                          {c.omschrijving && <span>{c.omschrijving}</span>}
                          {onFoto && (
                            <em>
                              <Icoon naam="camera" grootte={18} /> {isKlaar ? 'Betere inzending?' : 'Foto als bewijs'}
                            </em>
                          )}
                        </span>
                        <span className="ch__vak" aria-hidden="true">
                          {isKlaar ? (
                            <Stempel nieuw={netGedaan === c.id}>
                              Gedaan
                              <b>+{c.punten}</b>
                            </Stempel>
                          ) : (
                            `+${c.punten}`
                          )}
                        </span>
                      </>
                    )
                    return (
                      <li key={c.id} style={{ '--i': j } as React.CSSProperties}>
                        {onFoto ? (
                          // Met fotomuur: punten krijg je alleen door een foto in te sturen, niet zelf aan te vinken
                          <button
                            type="button"
                            className={`ch${isKlaar ? ' is-klaar' : ''}${netGedaan === c.id ? ' net-gedaan' : ''}`}
                            aria-label={`${c.titel}: ${isKlaar ? `gestempeld, ${c.punten} punten. Nog een foto insturen` : `stuur een foto in voor ${c.punten} punten`}`}
                            onClick={() => onFoto({ id: c.id, titel: c.titel })}
                          >
                            {inhoud}
                          </button>
                        ) : (
                          // Zonder backend (geen fotomuur) blijft zelf afstempelen de enige manier
                          <button
                            type="button"
                            className={`ch${isKlaar ? ' is-klaar' : ''}${netGedaan === c.id ? ' net-gedaan' : ''}`}
                            aria-pressed={isKlaar}
                            aria-label={`${c.titel}: ${isKlaar ? 'gestempeld' : `nog niet gedaan, ${c.punten} punten`}`}
                            onClick={() => onWissel(c.id)}
                          >
                            {inhoud}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ol>
                {klaar === d.items.length && d.items.length > 0 && (
                  <p className="dagkaart__vol">Kaart vol.{naam ? ` Netjes, ${naam}.` : ' Netjes.'}</p>
                )}
              </>
            )}
          </section>
        )
      })}
      {volgende && (
        <div className="dagkaart dagkaart--teaser">
          <Icoon naam="slot" />
          <p>
            <strong>Dagkaart nr. {nummer(volgende)}</strong> ligt klaar op {datumLabel(volgende.datum)} om{' '}
            {volgende.openOm ?? config.challengesOpenOm}.
          </p>
        </div>
      )}
    </>
  )
}

function Bingo({
  kaart,
  score,
  punten,
  tekort,
  geluid,
  onWissel,
}: {
  kaart: string[]
  score: ReturnType<typeof bingoScore>
  punten: SpelData['punten']
  tekort: boolean
  geluid: boolean
  onWissel: (tekst: string) => void
}) {
  const raster = useRef<HTMLDivElement>(null)
  const volle = LIJNEN.filter((l) => l.every(score.aan))
  // Welke rijen er al gevierd zijn: een rij uit- en weer aanzetten geeft geen tweede feest
  const [gevierdOpslag, setGevierd] = useOpgeslagen<string[]>('spel.bingo.gevierd', [])
  const gevierd = Array.isArray(gevierdOpslag) ? gevierdOpslag : []
  const [melding, setMelding] = useState<{ tekst: string; sub: string; n: number } | null>(null)
  const [nieuweLijn, setNieuweLijn] = useState<string | null>(null)
  const [netAan, setNetAan] = useState<number | null>(null)
  const [centra, setCentra] = useState<[number, number][]>([])

  // Middelpunten van de vakjes, voor de rode strepen door volle rijen
  useLayoutEffect(() => {
    const meet = () => {
      const el = raster.current
      if (!el) return
      setCentra([...el.children].filter((c) => c.classList.contains('lotto__vak')).map((c) => {
        const v = c as HTMLElement
        return [v.offsetLeft + v.offsetWidth / 2, v.offsetTop + v.offsetHeight / 2]
      }))
    }
    meet()
    const ro = new ResizeObserver(meet)
    if (raster.current) ro.observe(raster.current)
    return () => ro.disconnect()
  }, [])

  const sleutels = volle.map((l) => l.join('-'))
  const nieuw = sleutels.filter((s) => !gevierd.includes(s))
  useEffect(() => {
    if (!nieuw.length) return
    setNieuweLijn(nieuw[nieuw.length - 1])
    setMelding(
      score.vol
        ? { tekst: 'Volle kaart!', sub: `+${punten.bingoVolleKaart}`, n: Date.now() }
        : { tekst: 'Bingo!', sub: `+${punten.bingoRij}`, n: Date.now() },
    )
    klank('bel', geluid)
    trilSpel('bingo', geluid)
    setGevierd([...gevierd, ...nieuw])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nieuw.join('|')])

  useEffect(() => {
    if (!melding) return
    const id = window.setTimeout(() => setMelding(null), 1900)
    return () => window.clearTimeout(id)
  }, [melding])

  return (
    <>
      <p className="spel__uitleg">
        Busbingo voor in de nachtbus. Zie je het, omcirkel het. {punten.bingoVakje} punten per vakje, {punten.bingoRij} per rij
        (ook kolommen en diagonalen) en {punten.bingoVolleKaart} voor een volle kaart.
      </p>
      {tekort && <p className="melding">Let op: spel.json heeft minder dan 24 busbingovakjes.</p>}
      <div className="lotto" role="grid" aria-label="Busbingo" ref={raster}>
        {Array.from({ length: 25 }, (_, i) => {
          const tekst = vakjeTekst(kaart, i)
          const aan = score.aan(i)
          if (i === MIDDEN) {
            return (
              <div key={i} className="lotto__vak lotto__vak--vrij" role="gridcell" aria-label="Vrij vakje">
                2SLAG
                <br />
                vrij
              </div>
            )
          }
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`lotto__vak${aan ? ' is-aan' : ''}${netAan === i ? ' net-aan' : ''}`}
              aria-pressed={aan}
              disabled={!tekst}
              onClick={() => {
                if (!tekst) return
                setNetAan(aan ? null : i)
                klank(aan ? 'papier' : 'pen', geluid)
                if (!aan) trilSpel('tik', geluid)
                onWissel(tekst)
              }}
            >
              <span>{tekst ? zonderEmoji(tekst) : '—'}</span>
              <svg className="lotto__cirkel" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M52 9C80 8 93 30 91 53 89 79 66 93 45 91 19 89 7 67 9 45 11 23 29 10 58 11" />
              </svg>
            </button>
          )
        })}
        {centra.length === 25 && (
          <svg className="lotto__strepen" aria-hidden="true">
            {volle.map((l) => {
              const [a, b] = [centra[l[0]], centra[l[4]]]
              return <line key={l.join('-')} className={nieuweLijn === l.join('-') ? 'is-nieuw' : ''} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            })}
          </svg>
        )}
      </div>
      <p className="lotto__stand">
        {score.vakjes} van 24 vakjes · {score.lijnen} {score.lijnen === 1 ? 'rij' : 'rijen'} · {score.totaal} punten
      </p>
      {melding && (
        <div key={melding.n} className="spel__meld" role="status">
          {melding.tekst}
          <small>{melding.sub}</small>
        </div>
      )}
    </>
  )
}
