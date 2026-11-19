import { useMemo, useState, type ReactNode } from 'react'
import { DataStatus } from '../components/DataStatus'
import { Icoon, type IcoonNaam } from '../components/Icoon'
import { InstallatieBanner } from '../components/InstallatieBanner'
import { FotoStrip } from '../components/FotoStrip'
import { MeldingenKaart } from '../components/Meldingen'
import { openMijnProfiel } from '../components/Profiel'
import { Sneeuw } from '../components/Sneeuw'
import { StemmingOpHome } from '../components/Stemmen'
import type { Tab } from '../components/TabBalk'
import { config } from '../config'
import { NAAM_OVERGENOMEN, useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { useData, type Dag } from '../lib/data'
import { useFotos } from '../lib/fotos'
import { heeftIets, useMijnProfiel } from '../lib/profiel'
import { platform } from '../lib/installatie'
import { useNu } from '../lib/nu'
import { schrijf, useOpgeslagen } from '../lib/opslag'
import { dagStatus, duur, type ItemMetStatus } from '../lib/programma'
import { useKlassement } from '../lib/scorebord'
import { paklijstZin } from '../lib/paklijstZinnen'
import { datumISO, datumLabel, lokaalNaarDate, resterend } from '../lib/tijd'
import { cm, graden, useWeer, weerTekst } from '../lib/weer'
import { FotoGroot, useKamerLabel } from './Fotomuur'
import { beeldVoor, soortActiviteit } from './Planning'
// Ingebakken in de bundel (?inline), zodat het logo bij de eerste keer openen meteen in de kop staat
import logoWinter from '../assets/2slag-winter.svg?inline'
import '../styles/barlow.css'
import '../styles/home.css'

/*
 * Home — "Afdaling" (zelfde beeldtaal als de Paklijst): donkerblauwe kop met een besneeuwde berg,
 * papier eronder, pisteborden als iconen. Home verandert per fase:
 * - vóór:       hoeveel dagen nog, en wat je nu al kunt doen (paklijst, profiel, weer)
 * - vertrekdag: het eerstvolgende moment groot, de route van vandaag, wat nog niet in je tas zit
 * - tijdens:    de dag als afdaling, van de ochtend (boven) naar de avond (in het dal)
 * - ná:         een affiche "Groeten uit Les 2 Alpes" met ansichtkaarten en de eindstand
 * Opmaak in styles/home.css.
 */

type Fase = 'voor' | 'vertrekdag' | 'tijdens' | 'na'

const vertrek = lokaalNaarDate(config.vertrek)
const thuiskomst = lokaalNaarDate(config.thuiskomst)
const vertrekTijd = config.vertrek.slice(11)

/** Pistekleur bij een soort activiteit: rustig = groen, op de berg = blauw, feest = rood, verplicht = zwart */
type Kleur = 'groen' | 'blauw' | 'rood' | 'zwart' | 'licht'
function kleurVoor(titel: string): Kleur {
  const t = titel.toLowerCase()
  if (/bus|vertrek|verzamel|aankomst|inlever|uitcheck|inchecken|ophalen/.test(t)) return 'zwart'
  if (/apr[eè]s|feest|karaoke|quiz|spelletjes|prijs/.test(t)) return 'rood'
  if (/ontbijt|lunch|diner|fondue|stop|douche/.test(t)) return 'groen'
  return 'blauw'
}
function icoonVoor(titel: string): IcoonNaam {
  const t = titel.toLowerCase()
  if (/verzamel/.test(t)) return 'groep'
  if (/stop/.test(t)) return 'pin'
  if (/check/.test(t)) return 'kamers'
  return beeldVoor(titel) ?? soortActiviteit(titel)
}

/** Een pistebord: rond of vierkant, met een icoon */
function Bord({ kleur, icoon, vierkant = false }: { kleur: Kleur; icoon: IcoonNaam; vierkant?: boolean }) {
  return (
    <span className={`bord bord--${kleur}${vierkant ? ' bord--vierkant' : ''}`} aria-hidden="true">
      <Icoon naam={icoon} grootte={19} />
    </span>
  )
}

export default function Home({ naarTab, naarWeer }: { naarTab: (t: Tab) => void; naarWeer: () => void }) {
  const nu = useNu(10_000)
  const { data: planning, fout } = useData('planning')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const toon = useToonNaam()
  const profiel = useMijnProfiel()
  const [overgenomen] = useOpgeslagen<string | null>(NAAM_OVERGENOMEN, null)
  const pak = usePaklijstStand()

  const dagen = planning?.dagen ?? []
  const vandaag = datumISO(nu)
  const index = dagen.findIndex((d) => d.datum === vandaag)
  const fase: Fase =
    nu > thuiskomst ? 'na' : nu < vertrek ? (index === 0 ? 'vertrekdag' : 'voor') : 'tijdens'
  const dag = index >= 0 ? dagen[index] : undefined

  const naarStemmen = () => {
    schrijf('spel.onderdeel', 'stemmen')
    naarTab('spel')
  }
  // Alleen zolang er nog helemaal niets op je plaatje staat (niets is verplicht)
  const profielOpen = naam !== null && profiel !== null && !heeftIets(profiel)

  return (
    <div className="scherm home">
      {fase === 'voor' && <KopVoor naam={naam} pak={pak} />}
      {fase === 'vertrekdag' && dag && <KopVertrekdag nu={nu} naam={naam} dag={dag} />}
      {fase === 'tijdens' && <KopDag nu={nu} naam={naam} dag={dag} index={index} aantal={dagen.length} naarWeer={naarWeer} />}
      {fase === 'na' && <KopNa naam={naam} />}

      <div className="home__papier">
        {overgenomen && !naam && (
          <section className="kaartje melding">
            <p>
              <strong>{toon(overgenomen)}</strong> is op een ander apparaat gekozen
              {platform() === 'ios' ? ', bijvoorbeeld in de app op je beginscherm' : ''}. Je score telt daar.
            </p>
            <button type="button" className="knop knop--secundair knop--breed" onClick={() => openMijnProfiel(true)}>
              Toch dit apparaat gebruiken
            </button>
          </section>
        )}

        {fase === 'voor' && (
          <>
            <section>
              <h2 className="home__kopje">Voor de bus</h2>
              <PaklijstRij pak={pak} naarPaklijst={() => naarTab('paklijst')} />
              {profielOpen && <ProfielRij />}
              <WeerRij nu={nu} naarWeer={naarWeer} />
            </section>
            <InstallatieBanner />
            <StemmingOpHome naarStemmen={naarStemmen} />
            <FotoStrip naarFotomuur={() => (window.location.hash = '#fotos')} />
            {dagen[0] && (
              <section>
                <Kopje titel="Zo begint het" knop="Planning" onKlik={() => naarTab('planning')} />
                <p className="home__datum">{datumLabel(dagen[0].datum)}</p>
                <Afdaling dag={dagen[0]} />
              </section>
            )}
          </>
        )}

        {fase === 'vertrekdag' && dag && (
          <>
            <NogInpakken pak={pak} naarPaklijst={() => naarTab('paklijst')} />
            <section>
              <Kopje titel="Vandaag" knop="Planning" onKlik={() => naarTab('planning')} />
              <Afdaling dag={dag} nu={nu} />
            </section>
            <section>
              <h2 className="home__kopje">Voor onderweg</h2>
              <Rij
                bord={<Bord kleur="licht" icoon="bus" vierkant />}
                titel="Busbingo"
                onder="Jouw kaart staat klaar. Wie heeft als eerste een rij vol?"
                onKlik={() => {
                  schrijf('spel.onderdeel', 'bingo')
                  naarTab('spel')
                }}
              />
            </section>
            <InstallatieBanner />
          </>
        )}

        {fase === 'tijdens' && (
          <>
            {dag && (
              <section>
                <Kopje titel="Vandaag" knop="Hele planning" onKlik={() => naarTab('planning')} />
                {dag.intro && <p className="home__intro">{dag.intro}</p>}
                <Afdaling dag={dag} nu={nu} />
              </section>
            )}
            <Borden naam={naam} naarTab={naarTab} />
            <StemmingOpHome naarStemmen={naarStemmen} />
            <FotoStrip naarFotomuur={() => (window.location.hash = '#fotos')} />
            {profielOpen && (
              <section>
                <ProfielRij />
              </section>
            )}
            <section>
              <LiftenRij />
            </section>
            <InstallatieBanner />
          </>
        )}

        {fase === 'na' && <Terugblik naam={naam} naarStemmen={naarStemmen} />}

        {!planning && <DataStatus fout={fout} />}

        {/* Helemaal onderaan */}
        {fase !== 'na' && <MeldingenKaart />}

        <footer className="home__voet">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={68} height={68} loading="lazy" />
          <p>Tweeslag · Wispo 2027 · {config.bestemming}</p>
        </footer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ koppen */

/** Jouw naam rechtsboven: tik voor je profiel (of om een naam te kiezen) */
function IkKnop({ naam }: { naam: string | null }) {
  const toon = useToonNaam()
  const getoond = naam ? toon(naam) : null
  return (
    <button
      type="button"
      className="ik"
      onClick={() => openMijnProfiel()}
      aria-label={getoond ? `${getoond}, tik voor je profiel of een andere naam` : 'Kies je naam'}
    >
      <span>{getoond ?? 'Kies je naam'}</span>
      {getoond && <i aria-hidden="true">{getoond.charAt(0).toUpperCase()}</i>}
    </button>
  )
}

function KopRij({ boven, naam }: { boven: ReactNode; naam: string | null }) {
  return (
    <div className="homekop__rij">
      <p className="homekop__boven">{boven}</p>
      <IkKnop naam={naam} />
    </div>
  )
}

/** De berg onderaan de kop; het dal heeft de kleur van het papier eronder */
function Berg({ vlag = false }: { vlag?: boolean }) {
  return (
    <svg className="homekop__berg" viewBox="0 0 390 120" preserveAspectRatio="none" aria-hidden="true">
      <path className="berg" d="M0 120V96L40 78 70 86 110 52 140 64 175 24 205 40 235 30 262 54 300 70 340 66 390 92V120Z" />
      <path className="schaduw" d="M175 24 205 40 196 74 168 70ZM110 52 140 64 128 86ZM235 30 262 54 246 70Z" />
      <path className="dal" d="M0 120V110C70 100 140 112 210 106S340 98 390 108V120Z" />
      {vlag && (
        <>
          <path d="M175 24V6" stroke="#fff" strokeWidth="1.6" />
          <path className="vlag" d="M175 6l14 5-14 5Z" />
        </>
      )}
    </svg>
  )
}

const tweeCijfers = (n: number) => String(n).padStart(2, '0')

/**
 * Aftellen tot de bus: groot de dagen (of uren), daaronder een klok tot op de seconde (zonder de
 * uren als die al groot staan). Alleen dit
 * stukje ververst elke seconde. De klok is voor schermlezers verborgen (anders elke seconde
 * nieuwe tekst); die lezen de grote regel.
 */
function Aftellen() {
  const nu = useNu(1000)
  const r = resterend(vertrek.getTime() - nu.getTime())
  const groot =
    r.dagen >= 1
      ? `Nog ${r.dagen} ${r.dagen === 1 ? 'dag' : 'dagen'}`
      : r.uren >= 1
        ? `Nog ${r.uren} uur`
        : `Nog ${Math.max(1, r.minuten)} min`
  return (
    <>
      {groot}
      <span className="homekop__klok" aria-hidden="true">
        {r.dagen >= 1 ? (
          <>
            {tweeCijfers(r.uren)}
            <i>u</i>
          </>
        ) : null}
        {tweeCijfers(r.minuten)}
        <i>m</i>
        <b>{tweeCijfers(r.seconden)}</b>
        <i>s</i>
      </span>
    </>
  )
}

// De zin onder het aftellen: een willekeurig item dat nog niet is afgevinkt (zie lib/paklijstZinnen.ts)
function KopVoor({ naam, pak }: { naam: string | null; pak: PakStand }) {
  // Eén keer per keer openen gekozen, zodat de zin niet verspringt terwijl je kijkt
  const [toeval] = useState<[number, number, number]>(() => [Math.random(), Math.random(), Math.random()])
  const zin = paklijstZin(pak.deel === null ? null : pak.open, toeval)
  return (
    <header className="homekop">
      <Sneeuw aantal={8} />
      <KopRij
        boven={<img className="homekop__logo" src={logoWinter} alt={`Tweeslag, Wispo 2027 · ${config.bestemming}`} width={86} height={40} />}
        naam={naam}
      />
      <h1 className="homekop__titel">
        <Aftellen />
        <small>
          tot de bus vertrekt · {datumLabel(config.vertrek.slice(0, 10))}, {vertrekTijd}
        </small>
      </h1>
      <p className="homekop__zin">{zin}</p>
      <Berg vlag />
    </header>
  )
}

function KopVertrekdag({ nu, naam, dag }: { nu: Date; naam: string | null; dag: Dag }) {
  const { items } = dagStatus(dag, nu)
  const doorgaand = items.filter((i) => i.status !== 'vervallen')
  // Het eerstvolgende moment (of wat nu bezig is)
  const hoofd = doorgaand.find((i) => i.status === 'straks') ?? doorgaand.find((i) => i.status === 'bezig') ?? doorgaand[0]
  const route = doorgaand.slice(0, 4)
  return (
    <header className="homekop">
      <Sneeuw aantal={8} />
      <KopRij boven={`${datumLabel(dag.datum)} · vandaag`} naam={naam} />
      {hoofd && (
        <h1 className="homekop__titel">
          {hoofd.tijd}
          <small>
            {hoofd.titel}
            {hoofd.locatie ? ` · ${hoofd.locatie}` : ''}
            {hoofd.status === 'straks' && hoofd.totBegin > 0 ? ` · over ${duur(hoofd.totBegin)}` : ''}
          </small>
        </h1>
      )}
      <ol className="route" aria-label="Vandaag">
        <li className="is-nu">
          <span className="route__tijd">nu</span>
        </li>
        {route.map((i) => (
          <li key={`${i.tijd}-${i.titel}`} className={i.status === 'voorbij' ? 'is-voorbij' : undefined}>
            <span className="route__tijd">{i.tijd}</span>
            <span className="route__wat">{i.titel}</span>
          </li>
        ))}
      </ol>
      <svg className="homekop__berg homekop__berg--laag" viewBox="0 0 390 40" preserveAspectRatio="none" aria-hidden="true">
        <path className="dal" d="M0 40V28C70 18 140 30 210 24S340 16 390 26V40Z" />
      </svg>
    </header>
  )
}

function KopDag({
  nu,
  naam,
  dag,
  index,
  aantal,
  naarWeer,
}: {
  nu: Date
  naam: string | null
  dag?: Dag
  index: number
  aantal: number
  naarWeer: () => void
}) {
  const { weer } = useWeer()
  const vandaag = datumISO(nu)
  const gletsjer = weer?.locaties.find((l) => l.id === 'gletsjer') ?? weer?.locaties[weer.locaties.length - 1]
  const weerDag = gletsjer?.dagen.find((d) => d.datum === vandaag)
  return (
    <header className="homekop homekop--dag">
      <Sneeuw aantal={8} />
      <KopRij
        boven={dag ? `${datumLabel(dag.datum, 'kort')} maart · dag ${index + 1} van ${aantal}` : `Wispo 2027 · ${config.bestemming}`}
        naam={naam}
      />
      <div className="homekop__dagrij">
        <h1 className="homekop__titel">{dag?.titel ?? 'Fijne wintersport'}</h1>
        {gletsjer && weerDag && (
          <button type="button" className="homekop__weer" onClick={naarWeer}>
            <b>{graden(gletsjer.nu.temp)}</b>
            <span>
              {gletsjer.naam.toLowerCase()} · {weerDag.sneeuw >= 0.5 ? `${cm(weerDag.sneeuw)} vers` : weerTekst(weerDag.code).toLowerCase()}
            </span>
            <span className="verborgen">, meer over weer en sneeuw</span>
          </button>
        )}
      </div>
      <svg className="homekop__berg homekop__berg--laag" viewBox="0 0 390 56" preserveAspectRatio="none" aria-hidden="true">
        <path className="berg" d="M0 56V40L50 30 90 36 140 14 180 26 230 8 270 24 320 20 390 38V56Z" />
        <path className="dal" d="M0 56V48C70 42 140 50 210 46S340 40 390 47V56Z" />
      </svg>
    </header>
  )
}

/** Ná de reis: een affiche als ansichtkaart (zand gaat over in sneeuw, de maan is een beachvolleybal) */
function KopNa({ naam }: { naam: string | null }) {
  return (
    <header className="affiche">
      <div className="affiche__sterren" aria-hidden="true" />
      <svg className="affiche__beeld" viewBox="0 0 390 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <g transform="translate(332 210)">
          <circle r="32" fill="#eef0ff" />
          <path
            d="M-32 0C-13-8 6-28 4-32M-23 22C-9 6 19 2 31-8M-8 31C2 17 6-4 19-26"
            fill="none"
            stroke="#b4bbe0"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
        <path d="M0 400V250L40 220 70 232 120 168 150 190 190 150 230 186 260 176 300 206 340 190 390 214V400Z" fill="#26227a" />
        <path d="M0 400V286L60 236 92 250 150 176 214 248 250 236 300 196 360 254 390 244V400Z" fill="#17125e" />
        <path
          d="M150 176 171 197 163 195 156 203 150 196 143 204 137 196 128 199ZM300 196 318 213 310 211 304 218 298 211 291 218 284 211 280 212Z"
          fill="#c9d6f2"
        />
        <path d="M0 400V316L46 290 80 300 128 262 176 302 214 290 268 318 330 286 390 312V400Z" fill="#0a0738" />
        <path d="M0 400V346C40 334 80 330 120 338S180 360 210 352V400Z" fill="#e8d5a8" />
        <path className="dal" d="M96 400C120 378 160 356 214 352S330 336 390 342V400Z" />
        <g stroke="#c9d6f2" strokeLinecap="round">
          <path d="M38 344V300M118 340V296" strokeWidth="3" />
          <path d="M38 302 118 298M38 316 118 312" strokeWidth="1.6" />
          <path d="M48 302V315M58 301V315M68 301V314M78 300V314M88 300V313M98 299V313M108 299V312" strokeWidth=".8" opacity=".75" />
        </g>
        <g strokeWidth="3" strokeLinecap="round">
          <path d="M262 372v-16" stroke="#1e7a4c" />
          <path d="M300 362v-16" stroke="#1d5fc4" />
          <path d="M340 352v-16" stroke="#c4212f" />
          <path d="M372 346v-16" stroke="#17171c" />
        </g>
      </svg>
      <KopRij boven="Tweeslag · Wispo 2027" naam={naam} />
      <h1 className="affiche__titel">
        <em>Groeten uit</em>
        Les 2<br />
        Alpes
      </h1>
      <p className="affiche__onder">5 – 14 maart 2027</p>
      <div className="zegel" aria-hidden="true">
        <svg viewBox="0 0 46 30">
          <path d="M0 30 14 10 22 18 32 4 46 30Z" fill="#0d0058" />
          <path d="M32 4 27 11 30 10 32 13 35 10Z" fill="#fff" />
        </svg>
        <span>2027</span>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ onderdelen */

function Kopje({ titel, knop, onKlik }: { titel: string; knop: string; onKlik: () => void }) {
  return (
    <div className="home__kopje">
      <h2>{titel}</h2>
      <button type="button" onClick={onKlik}>
        {knop} <Icoon naam="pijl" grootte={16} />
      </button>
    </div>
  )
}

function Rij({
  bord,
  titel,
  onder,
  onKlik,
  children,
}: {
  bord: ReactNode
  titel: ReactNode
  onder?: ReactNode
  onKlik: () => void
  children?: ReactNode
}) {
  return (
    <button type="button" className="homerij" onClick={onKlik}>
      {bord}
      <span className="homerij__tekst">
        <b>{titel}</b>
        {onder && <small>{onder}</small>}
        {children}
      </span>
      <Icoon naam="pijl" grootte={18} className="homerij__pijl" />
    </button>
  )
}

/** De dag als afdaling: van boven (ochtend) naar het dal (avond). Met nu: voorbij gedimd, 'nu' groot. */
function Afdaling({ dag, nu }: { dag: Dag; nu?: Date }) {
  const items: (ItemMetStatus | (Dag['items'][number] & { status?: undefined }))[] = nu ? dagStatus(dag, nu).items : dag.items
  if (items.length === 0) return <p className="klein">Nog geen programma.</p>
  // Tot waar de piste al gereden is (tot en met het item dat nu bezig is)
  const laatsteBegonnen = items.reduce((k, i, n) => (i.status === 'voorbij' || i.status === 'bezig' ? n : k), -1)
  const gereden = nu ? Math.max(0, (laatsteBegonnen + 0.5) / items.length) * 100 : 0
  return (
    <div className="afdaling">
      <svg className="afdaling__piste" viewBox="0 0 40 600" preserveAspectRatio="none" aria-hidden="true">
        <path d="M20 6 C 34 80, 6 160, 20 250 S 34 420, 18 594" pathLength={100} className="afdaling__sneeuw" />
        {gereden > 0 && (
          <path
            d="M20 6 C 34 80, 6 160, 20 250 S 34 420, 18 594"
            pathLength={100}
            className="afdaling__gereden"
            strokeDasharray={`${gereden} 100`}
          />
        )}
      </svg>
      <ol>
        {items.map((i, n) => {
          const vervallen = i.vervallen !== undefined
          const bezig = i.status === 'bezig'
          const straks = i.status === 'straks'
          return (
            <li
              key={`${i.tijd}-${i.titel}-${n}`}
              className={`afdaling__item${i.status === 'voorbij' || vervallen ? ' is-voorbij' : ''}${bezig ? ' is-nu' : ''}`}
            >
              <Bord kleur={kleurVoor(i.titel)} icoon={icoonVoor(i.titel)} vierkant={!!i.optioneel} />
              <time>{i.tijd}</time>
              <div>
                {bezig && <span className="afdaling__nu">Nu</span>}
                <h3>
                  {vervallen ? <s>{i.titel}</s> : i.titel}
                  {vervallen && <span className="afdaling__label">gaat niet door</span>}
                  {i.optioneel && !vervallen && <span className="afdaling__label">{i.optioneel}</span>}
                </h3>
                {(bezig || straks || !nu) && i.omschrijving && !vervallen && <p>{i.omschrijving}</p>}
                {straks && 'totBegin' in i && <p className="afdaling__wanneer">Over {duur(i.totBegin)}</p>}
                {(bezig || !nu) && i.locatie && (
                  <p className="afdaling__waar">
                    <Icoon naam="pin" grootte={15} /> {i.locatie}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---- Paklijst ---- */

interface PakStand {
  klaar: number
  totaal: number
  /** 0–1, of null zolang de paklijst niet geladen is */
  deel: number | null
  open: { s: string; naam: string; categorie: string }[]
}

/** Stand van de paklijst; dezelfde sleutels als in screens/Paklijst.tsx */
function usePaklijstStand(): PakStand {
  const { data } = useData('paklijst')
  const [vinkjes] = useOpgeslagen<string[]>('paklijst.vinkjes', [])
  const [eigen] = useOpgeslagen<{ id: string; naam: string }[]>('paklijst.eigen', [])
  return useMemo(() => {
    if (!data) return { klaar: 0, totaal: 0, deel: null, open: [] }
    const aan = new Set(vinkjes)
    const alles = [
      ...data.categorieen.flatMap((c) => c.items.map((i) => ({ s: `${c.naam}::${i}`, naam: i, categorie: c.naam }))),
      ...eigen.map((e) => ({ s: `eigen::${e.id}`, naam: e.naam, categorie: 'Eigen spullen' })),
    ]
    const open = alles.filter((i) => !aan.has(i.s))
    const klaar = alles.length - open.length
    return { klaar, totaal: alles.length, deel: alles.length ? klaar / alles.length : 0, open }
  }, [data, vinkjes, eigen])
}

function PaklijstRij({ pak, naarPaklijst }: { pak: PakStand; naarPaklijst: () => void }) {
  if (pak.deel === null) return null
  const klaar = pak.totaal > 0 && pak.klaar === pak.totaal
  return (
    <Rij
      bord={<Bord kleur="groen" icoon={klaar ? 'vink' : 'paklijst'} />}
      titel="Paklijst"
      onder={klaar ? 'Alles ingepakt' : `${pak.klaar} van ${pak.totaal} ingepakt`}
      onKlik={naarPaklijst}
    >
      {/* De voortgang als stukje afdaling */}
      <svg className="homerij__profiel" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 3 60 6 120 9 180 11 240 13 298 14" className="homerij__profiel-rest" pathLength={100} />
        {pak.klaar > 0 && (
          <path
            d="M2 3 60 6 120 9 180 11 240 13 298 14"
            className="homerij__profiel-klaar"
            pathLength={100}
            strokeDasharray={`${(pak.deel ?? 0) * 100} 100`}
          />
        )}
      </svg>
    </Rij>
  )
}

/** Vertrekdag: wat nog niet is afgevinkt (bij weinig over), anders de paklijst als rij */
function NogInpakken({ pak, naarPaklijst }: { pak: PakStand; naarPaklijst: () => void }) {
  if (pak.deel === null || pak.open.length === 0) return null
  if (pak.open.length > 5)
    return (
      <section>
        <h2 className="home__kopje">Nog inpakken</h2>
        <PaklijstRij pak={pak} naarPaklijst={naarPaklijst} />
      </section>
    )
  return (
    <section>
      <Kopje titel="Nog niet in je tas" knop="Paklijst" onKlik={naarPaklijst} />
      {pak.open.map((i) => (
        <button key={i.s} type="button" className="homerij" onClick={naarPaklijst}>
          <span className="homerij__vakje" aria-hidden="true" />
          <span className="homerij__tekst">
            <b>{i.naam}</b>
            <small>{i.categorie}</small>
          </span>
        </button>
      ))}
    </section>
  )
}

function ProfielRij() {
  return (
    <Rij
      bord={<Bord kleur="rood" icoon="groep" />}
      titel="Je plaatje is nog niet geplakt"
      onder="Een foto, ski of board, je piste. Wat je wilt, niets is verplicht."
      onKlik={() => openMijnProfiel()}
    />
  )
}

/** Vóór de reis: zo is het nu op de berg */
function WeerRij({ nu, naarWeer }: { nu: Date; naarWeer: () => void }) {
  const { weer, laden } = useWeer()
  const vandaag = datumISO(nu)
  const gletsjer = weer?.locaties.find((l) => l.id === 'gletsjer')
  const dorp = weer?.locaties.find((l) => l.id === 'dorp')
  const vers = gletsjer?.dagen.find((d) => d.datum === vandaag)?.sneeuw
  let onder: string
  if (gletsjer && dorp)
    onder = `Gletsjer ${graden(gletsjer.nu.temp)}${vers !== undefined ? `, ${cm(vers)} verse sneeuw` : ''}. Dorp ${graden(dorp.nu.temp)}, ${weerTekst(dorp.nu.code).toLowerCase()}.`
  else onder = laden ? 'Weerbericht laden…' : 'Nog geen weerbericht. Open de app een keer met internet.'
  // Twee regels vrijhouden: het weerbericht komt pas na het openen binnen en is dan langer dan 'laden…'
  return (
    <Rij
      bord={<Bord kleur="blauw" icoon="sneeuwvlok" vierkant />}
      titel="Nu op de berg"
      onder={<span className="homerij__tweeregels">{onder}</span>}
      onKlik={naarWeer}
    />
  )
}

/** Tijdens de reis: drie borden naar Spel, Fotomuur en Kaart */
function Borden({ naam, naarTab }: { naam: string | null; naarTab: (t: Tab) => void }) {
  const backend = useBackend()
  const { klassement } = useKlassement(backend.status !== 'uit')
  const { data: kamers } = useData('kamers')
  const eigenKamer = naam ? kamers?.kamers.find((k) => k.bewoners.includes(naam))?.nummer : undefined
  const plek = eigenKamer && klassement ? klassement.kamers.findIndex((k) => k.kamer === eigenKamer) + 1 : 0
  return (
    <nav className="borden" aria-label="Snel naar">
      <button type="button" onClick={() => naarTab('spel')}>
        <Bord kleur="zwart" icoon="spel" />
        <b>Spel</b>
        <small>{plek > 0 ? `Kamer ${eigenKamer} staat ${plek}e` : 'Challenges van vandaag'}</small>
      </button>
      <button type="button" onClick={() => (window.location.hash = '#fotos')}>
        <Bord kleur="rood" icoon="camera" />
        <b>Foto's</b>
        <small>Het clubblad</small>
      </button>
      <button type="button" onClick={() => naarTab('kaart')}>
        <Bord kleur="blauw" icoon="kaart" vierkant />
        <b>Kaart</b>
        <small>Wie is waar</small>
      </button>
    </nav>
  )
}

/** De officiële app van Les 2 Alpes (liften, pistes, webcams). Een app openen kan niet vanaf een
 *  website; de winkel toont "Openen" als de app er al op staat. */
function LiftenRij() {
  const p = platform()
  const links = config.les2alpesApp
  const href = p === 'ios' ? links.ios : links.android
  return (
    <a className="homerij" href={href} target="_blank" rel="noopener">
      <Bord kleur="blauw" icoon="lift" vierkant />
      <span className="homerij__tekst">
        <b>Liften, pistes en webcams</b>
        <small>Wat er open is, in de officiële app van Les 2 Alpes</small>
      </span>
      <Icoon naam="extern" grootte={18} className="homerij__pijl" />
    </a>
  )
}

/* ---- Ná de reis ---- */

function Terugblik({ naam, naarStemmen }: { naam: string | null; naarStemmen: () => void }) {
  const backend = useBackend()
  const aan = backend.status !== 'uit'
  const { fotos } = useFotos(8, aan)
  const kamerLabel = useKamerLabel()
  const toon = useToonNaam()
  const [open, setOpen] = useState<number | null>(null)
  const { klassement } = useKlassement(aan)
  const { data: kamers } = useData('kamers')
  const eigenKamer = naam ? kamers?.kamers.find((k) => k.bewoners.includes(naam))?.nummer : undefined
  const stand = klassement?.kamers ?? []
  const top = stand.slice(0, 3)
  const eigenPlek = eigenKamer ? stand.findIndex((k) => k.kamer === eigenKamer) : -1
  const naarFotomuur = () => (window.location.hash = '#fotos')

  return (
    <>
      <p className="home__zin">
        Wat een week. Zet je mooiste foto&apos;s in het clubblad, dan maken we er voor de ALV een terugblik van.
      </p>

      {fotos && fotos.length > 0 && (
        <section>
          <Kopje titel="Ansichtkaarten" knop="Clubblad" onKlik={naarFotomuur} />
          <div className="ansichten">
            {fotos.map((f, i) => (
              <button key={f.id} type="button" className="ansicht" onClick={() => setOpen(i)}>
                {f.klein ? <img src={f.klein} alt="" loading="lazy" /> : <span className="ansicht__leeg" />}
                <span className="ansicht__tekst">
                  {f.challenge_titel}, door {toon(f.naam)}
                </span>
              </button>
            ))}
          </div>
          {open !== null && <FotoGroot fotos={fotos} start={open} kamerLabel={kamerLabel} onSluit={() => setOpen(null)} />}
        </section>
      )}
      <button type="button" className="home__knop" onClick={naarFotomuur}>
        Naar het clubblad
      </button>

      {top.length > 0 && (
        <section>
          <Kopje titel="Eindstand" knop="Spel" onKlik={() => (window.location.hash = '#spel')} />
          <ol className="uitslag">
            {[...top, ...(eigenPlek >= 3 ? [stand[eigenPlek]] : [])].map((k) => {
              const plek = stand.indexOf(k) + 1
              const wij = k.kamer === eigenKamer
              return (
                <li key={k.kamer} className={wij ? 'is-wij' : undefined}>
                  <span className="uitslag__plek">{plek}</span>
                  <span className="uitslag__wie">
                    Kamer {kamerLabel(k.kamer)}
                    {wij && <span className="uitslag__wij">jullie</span>}
                  </span>
                  <span className="uitslag__punten">{k.totaal}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <StemmingOpHome naarStemmen={naarStemmen} />
    </>
  )
}
