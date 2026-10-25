import { useEffect, useMemo, useRef, useState } from 'react'
import { Aftelklok } from '../components/Aftelklok'
import { DataStatus } from '../components/DataStatus'
import { Icoon } from '../components/Icoon'
import { FotoUpload } from '../components/FotoUpload'
import { Klassement } from '../components/Klassement'
import { RadOnderdeel } from '../components/Rad'
import { Stemmen } from '../components/Stemmen'
import { Sneeuw } from '../components/Sneeuw'
import { config } from '../config'
import { backendIngesteld } from '../lib/backend'
import { bingoScore, maakKaart, MIDDEN, vakjeTekst } from '../lib/bingo'
import { useData, type ChallengeDag, type Spel as SpelData } from '../lib/data'
import { testOntgrendeld, useNu } from '../lib/nu'
import { lees, schrijf, useOpgeslagen } from '../lib/opslag'
import { datumISO, datumLabel, lokaalNaarDate } from '../lib/tijd'

const spelOpen = lokaalNaarDate(config.spelOpen)
const openMoment = (d: ChallengeDag) => lokaalNaarDate(`${d.datum}T${d.openOm ?? config.challengesOpenOm}`)

export default function Spel() {
  const nu = useNu(1000)
  const { data, fout } = useData('spel')

  if (!testOntgrendeld && nu < spelOpen) {
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
          <Aftelklok doel={spelOpen} nu={nu} />
          <p className="klein">Wat er gaat gebeuren? Geheim! 🤫</p>
        </section>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="scherm">
        <h1>Spel</h1>
        <DataStatus fout={fout} />
      </div>
    )
  }

  return <SpelOpen data={data} nu={nu} />
}

function SpelOpen({ data, nu }: { data: SpelData; nu: Date }) {
  const [onderdeel, setOnderdeel] = useOpgeslagen<'challenges' | 'bingo' | 'rad' | 'stemmen' | 'klassement'>('spel.onderdeel', 'challenges')
  const [gedaan, setGedaan] = useOpgeslagen<string[]>('spel.challenges', [])
  const [gemarkeerd, setGemarkeerd] = useOpgeslagen<string[]>('spel.bingo.vinkjes', [])
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const [fotoVoor, setFotoVoor] = useState<{ id: string; titel: string } | null>(null)
  const [fotoGelukt, setFotoGelukt] = useState<string | null>(null)
  useEffect(() => {
    if (!fotoGelukt) return
    const id = window.setTimeout(() => setFotoGelukt(null), 3500)
    return () => window.clearTimeout(id)
  }, [fotoGelukt])

  // De bingokaart wordt één keer per telefoon geschud en daarna bewaard
  const kaart = useMemo(() => maakKaart(data.bingo.vakjes, lees('spel.bingo.kaart', null)), [data])
  useEffect(() => schrijf('spel.bingo.kaart', kaart), [kaart])
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

  return (
    <div className="scherm">
      <h1>Spel</h1>
      {testOntgrendeld && <p className="melding melding--test">Testmodus: alles is open (?unlock=1)</p>}
      {backendIngesteld && (
        <button type="button" className="knop knop--accent knop--breed" onClick={() => (window.location.hash = '#fotos')}>
          📸 Fotomuur
        </button>
      )}

      <section className="kaartje score golf" aria-live="polite">
        <Sneeuw aantal={14} />
        <p className="score__label">{naam ? `Score van ${naam}` : 'Jouw score'}</p>
        <p className="score__totaal">
          {challengePunten + bingo.totaal} <span>punten</span>
        </p>
        <p className="score__deel">
          Challenges {challengePunten} · Busbingo {bingo.totaal}
        </p>
        <p className="klein">
          {backendIngesteld
            ? 'Je score telt mee in het klassement.'
            : 'Je score staat alleen op deze telefoon. Laat hem zien bij de prijsuitreiking!'}
        </p>
      </section>

      <div className="segment segment--vijf" role="tablist" aria-label="Onderdeel">
        {(['challenges', 'bingo', 'rad', 'stemmen', 'klassement'] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="tab"
            aria-selected={onderdeel === o}
            className={`segment__knop${onderdeel === o ? ' is-actief' : ''}`}
            onClick={() => setOnderdeel(o)}
          >
            {o === 'challenges'
              ? 'Challenges'
              : o === 'bingo'
                ? 'Busbingo'
                : o === 'rad'
                  ? 'Rad'
                  : o === 'stemmen'
                    ? 'Stemmen'
                    : 'Klassement'}
          </button>
        ))}
      </div>

      {onderdeel === 'klassement' ? (
        <Klassement />
      ) : onderdeel === 'rad' ? (
        <RadOnderdeel />
      ) : onderdeel === 'stemmen' ? (
        <Stemmen />
      ) : onderdeel === 'challenges' ? (
        <Challenges
          dagen={data.challenges}
          nu={nu}
          gedaan={gedaanSet}
          onWissel={(id) => setGedaan((oud) => (oud.includes(id) ? oud.filter((x) => x !== id) : [...oud, id]))}
          onFoto={backendIngesteld ? setFotoVoor : undefined}
        />
      ) : (
        <Bingo
          kaart={kaart}
          vrijVakje={data.bingo.vrijVakje ?? '❄️ Vrij'}
          score={bingo}
          punten={data.punten}
          tekort={data.bingo.vakjes.length < 24}
          onWissel={(t) => setGemarkeerd((oud) => (oud.includes(t) ? oud.filter((x) => x !== t) : [...oud, t]))}
        />
      )}

      {fotoVoor && (
        <FotoUpload
          challenge={fotoVoor}
          onSluit={() => setFotoVoor(null)}
          onGelukt={() => {
            // Bewijs geleverd: dan telt de challenge ook als gedaan
            const id = fotoVoor.id
            setGedaan((oud) => (oud.includes(id) ? oud : [...oud, id]))
            setFotoGelukt(`Foto staat op de fotomuur ✓ "${fotoVoor.titel}" is afgevinkt.`)
            setFotoVoor(null)
          }}
        />
      )}
      {fotoGelukt && (
        <div className="feest feest--klein" role="status" onClick={() => setFotoGelukt(null)}>
          📸 {fotoGelukt}
        </div>
      )}
    </div>
  )
}

function Challenges({
  dagen,
  nu,
  gedaan,
  onWissel,
  onFoto,
}: {
  dagen: ChallengeDag[]
  nu: Date
  gedaan: Set<string>
  onWissel: (id: string) => void
  /** Foto als bewijs uploaden (alleen met backend) */
  onFoto?: (c: { id: string; titel: string }) => void
}) {
  const vandaag = datumISO(nu)
  const gesorteerd = [...dagen].sort((a, b) => a.datum.localeCompare(b.datum))
  const open = gesorteerd.filter((d) => testOntgrendeld || nu >= openMoment(d)).reverse()
  const volgende = gesorteerd.find((d) => !testOntgrendeld && nu < openMoment(d))

  return (
    <>
      {volgende && (
        <div className="kaartje teaser">
          <Icoon naam="slot" />
          <p>
            <strong>
              {volgende.items.length} nieuwe challenge{volgende.items.length === 1 ? '' : 's'}
            </strong>{' '}
            op {datumLabel(volgende.datum)} om {volgende.openOm ?? config.challengesOpenOm}
          </p>
        </div>
      )}
      {open.length === 0 && <p className="laadtekst">Nog geen challenges open.</p>}
      {open.map((d) => (
        <section key={d.datum} className="challengedag">
          <h2 className="tussenkop">{d.datum === vandaag ? `Vandaag · ${datumLabel(d.datum)}` : datumLabel(d.datum)}</h2>
          {d.items.map((c) => {
            const klaar = gedaan.has(c.id)
            return (
              <article key={c.id} className={`kaartje challenge${klaar ? ' is-klaar' : ''}`}>
                <div className="challenge__tekst">
                  <h3>{c.titel}</h3>
                  {c.omschrijving && <p>{c.omschrijving}</p>}
                  {onFoto && (
                    <button type="button" className="challenge__foto" onClick={() => onFoto({ id: c.id, titel: c.titel })}>
                      <Icoon naam="camera" grootte={18} /> Foto als bewijs
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className={`challenge__knop${klaar ? ' is-klaar' : ''}`}
                  aria-pressed={klaar}
                  aria-label={`${c.titel}: ${klaar ? 'gedaan' : 'nog niet gedaan'}`}
                  onClick={() => onWissel(c.id)}
                >
                  {klaar ? <Icoon naam="vink" grootte={28} /> : <span>+{c.punten}</span>}
                </button>
              </article>
            )
          })}
        </section>
      ))}
    </>
  )
}

/** Begint een vakje met een emoji, dan staat die groot boven de tekst */
function VakjeInhoud({ tekst }: { tekst: string }) {
  const m = tekst.match(/^([\p{Extended_Pictographic}\p{Regional_Indicator}][\p{Extended_Pictographic}️‍\p{Regional_Indicator}]*)\s+(.*)$/u)
  if (!m) return <span>{tekst}</span>
  return (
    <span className="bingo__inhoud">
      <span className="bingo__emoji" aria-hidden="true">
        {m[1]}
      </span>
      <span>{m[2]}</span>
    </span>
  )
}

function Bingo({
  kaart,
  vrijVakje,
  score,
  punten,
  tekort,
  onWissel,
}: {
  kaart: string[]
  vrijVakje: string
  score: ReturnType<typeof bingoScore>
  punten: SpelData['punten']
  tekort: boolean
  onWissel: (tekst: string) => void
}) {
  const [feest, setFeest] = useState<string | null>(null)
  const vorigeLijnen = useRef(score.lijnen)

  useEffect(() => {
    if (score.lijnen > vorigeLijnen.current) {
      setFeest(score.vol ? `VOLLE KAART! +${punten.bingoVolleKaart}` : `BUSBINGO! +${punten.bingoRij}`)
    }
    vorigeLijnen.current = score.lijnen
  }, [score.lijnen, score.vol, punten])

  useEffect(() => {
    if (!feest) return
    const id = window.setTimeout(() => setFeest(null), 2500)
    return () => window.clearTimeout(id)
  }, [feest])

  return (
    <>
      <p className="klein">
        Busbingo voor in de nachtbus. Tik een vakje aan als je het ziet. {punten.bingoVakje} punten per vakje, {punten.bingoRij} per rij (ook
        kolommen en diagonalen) en {punten.bingoVolleKaart} voor een volle kaart.
      </p>
      {tekort && <p className="melding">Let op: spel.json heeft minder dan 24 busbingovakjes.</p>}
      <div className="bingo" role="grid" aria-label="Busbingo">
        {Array.from({ length: 25 }, (_, i) => {
          const tekst = vakjeTekst(kaart, i)
          const aan = score.aan(i)
          if (i === MIDDEN) {
            return (
              <div key={i} className="bingo__vak bingo__vak--vrij is-aan" role="gridcell">
                <VakjeInhoud tekst={vrijVakje} />
              </div>
            )
          }
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`bingo__vak${aan ? ' is-aan' : ''}`}
              aria-pressed={aan}
              disabled={!tekst}
              onClick={() => tekst && onWissel(tekst)}
            >
              {tekst ? <VakjeInhoud tekst={tekst} /> : '—'}
            </button>
          )
        })}
      </div>
      <p className="bingo__stand">
        {score.vakjes} van 24 vakjes · {score.lijnen} {score.lijnen === 1 ? 'rij' : 'rijen'}
      </p>
      {feest && (
        <div className="feest" role="status">
          🚌 {feest} 🎉
        </div>
      )}
    </>
  )
}
