import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { FotoBijsnijder } from '../components/FotoBijsnijder'
import { metCie } from '../components/VakanCieNaam'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { useTerugSluit } from '../lib/terugknop'
import { Icoon } from '../components/Icoon'
import { SchermKop } from '../components/SchermKop'
import { config } from '../config'
import { vakancie as tekst } from '../content/vakancie'
import { useBackend } from '../lib/backend'
import { BADGES } from '../lib/badgeregels'
import { PANORAMA } from '../lib/bergen-data'
import { useToonNaam } from '../lib/bijnamen'
import { alleDeelnemers, useData } from '../lib/data'
import type { Foto } from '../lib/fotos'
import { haalGroepsfotoWeg, haalLidFotoWeg, plaatsGroepsfoto, plaatsLidFoto, useGroepsfoto, useLidFoto } from '../lib/groepsfoto'
import { useNu } from '../lib/nu'
import { useOpgeslagen } from '../lib/opslag'
import { sleutel, useMijnProfiel, useProfielen, useProfielFoto } from '../lib/profiel'
import { datumISO } from '../lib/tijd'
import { FotoGroot } from './Fotomuur'
import '../styles/barlow.css'
import '../styles/vakancie.css'

/*
 * "De VakanCie": wie we zijn en waarom deze app er is. Je komt hier door op het Tweeslag-logo
 * onderaan Home of Instellingen te tikken (components/LogoKnop.tsx).
 *
 * Opgebouwd als de binnenkant van de kaft van het clubblad: de groepsfoto als afdruk, een
 * ondertekend stukje, de leden met hun plaatje, wat cijfers, de dankjes en een colofon.
 * Alle teksten staan in src/content/vakancie.ts. De groepsfoto staat in Supabase (lib/groepsfoto.ts).
 * Opmaak in styles/vakancie.css (classes vk-*).
 */

/** Nog in te vullen? (tekst tussen [vierkante haken]) */
const isInvullen = (s: string) => /^\[.*\]$/.test(s.trim())

/** Tekst met [stukjes om in te vullen] geel gemarkeerd, zodat je ze makkelijk terugvindt */
function Invul({ t }: { t: string }) {
  const delen = t.split(/(\[[^\]]+\])/g).filter(Boolean)
  return (
    <>
      {delen.map((d, i) =>
        d.startsWith('[') && d.endsWith(']') ? (
          <mark key={i} className="vk-invullen">
            {d}
          </mark>
        ) : (
          <Fragment key={i}>{d}</Fragment>
        ),
      )}
    </>
  )
}

/** Kopje als in een jaarboek: kleine kapitalen tussen twee lijnen */
function Kopje({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 className="vk-kopje" id={id}>
      <span>{typeof children === 'string' ? metCie(children) : children}</span>
    </h2>
  )
}

export default function VakanCie({
  terug,
  terugLabel = 'Home',
  aantalSchermen,
}: {
  terug: () => void
  terugLabel?: string
  aantalSchermen: number
}) {
  return (
    <div className="scherm vk">
      <SchermKop titel={tekst.kop.titel} boven={tekst.kop.boven} ondertitel={tekst.kop.onder} terug={{ label: terugLabel, onClick: terug }} />
      <Groepsfoto />
      <Brief />
      <Leden />
      <Cijfers aantalSchermen={aantalSchermen} />
      <Dank />
      <Colofon />
    </div>
  )
}

/* ------------------------------------------------------------------ groepsfoto */

function Groepsfoto() {
  const { info, url } = useGroepsfoto()
  const backend = useBackend()
  const [groot, setGroot] = useState(false)
  const g = tekst.groepsfoto
  const verhouding = info?.breedte && info.hoogte ? `${info.breedte} / ${info.hoogte}` : undefined

  // De fotoviewer van het clubblad verwacht een foto uit het clubblad; dit is er één van de VakanCie
  const alsFoto: Foto[] = useMemo(
    () =>
      info && url
        ? [
            {
              id: 'vakancie-groepsfoto',
              user_id: '',
              naam: isInvullen(g.fotograaf) ? 'de VakanCie' : g.fotograaf,
              kamer: null,
              challenge_id: '',
              challenge_titel: g.bijschrift,
              pad: info.pad,
              breedte: info.breedte,
              hoogte: info.hoogte,
              gemaakt: new Date(info.geplaatst ?? Date.now()).toISOString(),
              klein: url,
            },
          ]
        : [],
    [info, url, g.bijschrift, g.fotograaf],
  )

  return (
    <section className="vk-fotoplek" aria-label="Groepsfoto">
      <figure className={`vk-afdruk${info ? '' : ' is-leeg'}`}>
        <div className="vk-afdruk__vlak">
        {(['lb', 'rb', 'lo', 'ro'] as const).map((h) => (
          <span key={h} className={`vk-hoekje vk-hoekje--${h}`} aria-hidden="true" />
        ))}
        {info ? (
          <button type="button" className="vk-afdruk__beeld" style={{ aspectRatio: verhouding }} onClick={() => url && setGroot(true)}>
            {url && <img src={url} alt={g.beschrijving} />}
            <span className="verborgen">. Tik om groot te bekijken.</span>
          </button>
        ) : (
          <div className="vk-afdruk__leeg">
            <Icoon naam="camera" grootte={34} />
            <b>{g.leeg}</b>
            <span>{g.leegOnder}</span>
          </div>
        )}
        </div>
        <figcaption>
          <Invul t={g.bijschrift} />
        </figcaption>
      </figure>
      {backend.beheerder && <GroepsfotoBeheer heeftFoto={!!info} />}
      {groot && alsFoto.length > 0 && (
        <FotoGroot fotos={alsFoto} start={0} kamerLabel={() => ''} kop={() => tekst.kop.titel} onSluit={() => setGroot(false)} />
      )}
    </section>
  )
}

/** Alleen voor beheerders: de groepsfoto plaatsen, vervangen of weghalen */
function GroepsfotoBeheer({ heeftFoto }: { heeftFoto: boolean }) {
  const kiezer = useRef<HTMLInputElement>(null)
  const [bezig, setBezig] = useState(false)
  const [melding, setMelding] = useState<{ fout: boolean; tekst: string } | null>(null)
  const [weghalen, setWeghalen] = useState(false)

  const kies = async (bestand: File | undefined) => {
    if (!bestand) return
    setBezig(true)
    setMelding(null)
    const fout = await plaatsGroepsfoto(bestand)
    setBezig(false)
    setMelding(fout ? { fout: true, tekst: fout } : { fout: false, tekst: 'Geplaatst. Iedereen ziet hem zodra de app verbinding heeft.' })
    if (kiezer.current) kiezer.current.value = ''
  }

  const haalWeg = async () => {
    setWeghalen(false)
    setBezig(true)
    const fout = await haalGroepsfotoWeg()
    setBezig(false)
    setMelding(fout ? { fout: true, tekst: fout } : { fout: false, tekst: 'Weggehaald.' })
  }

  return (
    <div className="vk-beheer">
      <p className="vk-klein">Beheer</p>
      <input
        ref={kiezer}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void kies(e.target.files?.[0])}
      />
      <div className="vk-beheer__knoppen">
        <button type="button" className="knop knop--secundair" disabled={bezig} onClick={() => kiezer.current?.click()}>
          <Icoon naam="camera" grootte={20} />
          {bezig ? 'Bezig…' : heeftFoto ? 'Andere groepsfoto' : 'Groepsfoto plaatsen'}
        </button>
        {heeftFoto && (
          <button type="button" className="tekstknop" disabled={bezig} onClick={() => setWeghalen(true)}>
            Weghalen
          </button>
        )}
      </div>
      {melding && (
        <p className={`vk-beheer__melding${melding.fout ? ' is-fout' : ''}`} role={melding.fout ? 'alert' : 'status'}>
          {melding.tekst}
        </p>
      )}
      <p className="vk-beheer__uitleg">
        Alleen beheerders zien dit. De foto staat in de app (niet op de openbare website) en wordt verkleind tot 1600 pixels,
        zonder locatiegegevens.
      </p>
      <BevestigDialoog
        open={weghalen}
        titel="Groepsfoto weghalen?"
        tekst="Dan staat er weer een lege plek, op alle telefoons zodra ze verbinding hebben."
        bevestigLabel="Weghalen"
        gevaarlijk
        onBevestig={() => void haalWeg()}
        onAnnuleer={() => setWeghalen(false)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ waarom */

function Brief() {
  const toon = useToonNaam()
  const w = tekst.waarom
  return (
    <section className="vk-brief" aria-labelledby="vk-waarom">
      <Kopje id="vk-waarom">{w.kop}</Kopje>
      {w.alineas.map((a, i) => (
        <p key={i}>
          <Invul t={a} />
        </p>
      ))}
      <div className="vk-ondertekening">
        <p className="vk-ondertekening__groet">{w.groet}</p>
        <ul className="vk-handtekeningen">
          {tekst.leden.lijst.map((l, i) => (
            <li key={i}>
              {isInvullen(l.naam) ? <Invul t={l.naam} /> : toon(l.naam)}
              <svg viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d={i % 2 ? 'M2 7C30 3 62 10 92 5S116 4 118 6' : 'M2 5C26 10 58 2 88 7S112 9 118 4'} />
              </svg>
            </li>
          ))}
        </ul>
        <Stempel />
      </div>
    </section>
  )
}

/** Rond stempel van de VakanCie, half over de handtekeningen */
function Stempel() {
  return (
    <svg className="vk-stempel" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <path id="vk-stempel-boog" d="M60 60m-43 0a43 43 0 1 1 86 0a43 43 0 1 1-86 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" strokeWidth="3" strokeDasharray="60 3 40 2 90 4 70" />
      <circle cx="60" cy="60" r="34" fill="none" strokeWidth="1.4" />
      <text>
        <textPath href="#vk-stempel-boog" startOffset="0">
          VAKANCIE · G.S.B.V. TWEESLAG · WISPO 2027 ·
        </textPath>
      </text>
      <path className="vk-stempel__berg" d="M36 74 50 52 57 61 66 44 84 74Z" />
      <path className="vk-stempel__sneeuw" d="M66 44 61 52 64 51 66 54 69 51 71 52Z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ leden */

function Leden() {
  const l = tekst.leden
  return (
    <section className="vk-leden" aria-labelledby="vk-leden-kop">
      <Kopje id="vk-leden-kop">{l.kop}</Kopje>
      <ul className="vk-ledenlijst">
        {l.lijst.map((lid, i) => (
          <Lid key={`${lid.naam}-${i}`} naam={lid.naam} rol={lid.rol} />
        ))}
      </ul>
    </section>
  )
}

/**
 * Eén lid: pasfoto, naam en rol. De foto is de eigen VakanCie-foto (lib/groepsfoto.ts) en anders de
 * profielfoto; de bijnaam komt uit het profiel. Geen pistebordje en niet aanklikbaar.
 */
function Lid({ naam, rol }: { naam: string; rol: string }) {
  const toon = useToonNaam()
  const backend = useBackend()
  const { perNaam } = useProfielen()
  const mijnProfiel = useMijnProfiel()
  const [jij] = useOpgeslagen<string | null>('naam', null)
  const isJij = !!jij && sleutel(jij) === sleutel(naam)
  const rij = perNaam.get(sleutel(naam))
  const profielUrl = useProfielFoto(
    isJij ? (mijnProfiel?.foto ?? null) : (rij?.foto_pad ?? null),
    isJij ? (mijnProfiel?.fotoLokaal ?? null) : null,
  )
  const eigen = useLidFoto(naam)
  const url = eigen.url ?? profielUrl
  const leeg = isInvullen(naam)
  const getoond = leeg ? naam : toon(naam)

  const inhoud = (
    <>
      <span className="vk-pasfoto">
        {url ? (
          <img src={url} alt="" />
        ) : (
          <span className="vk-pasfoto__leeg" aria-hidden="true">
            <b>{leeg ? '?' : getoond.charAt(0).toUpperCase()}</b>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" focusable="false">
              <path className="vk-pasfoto__berg" d="M0 22L22 8 36 18 58 2 76 16 100 8V40H0Z" />
              <path className="vk-pasfoto__sneeuw" d="M0 32C30 26 60 32 100 28V40H0Z" />
            </svg>
          </span>
        )}
      </span>
      <span className="vk-lid__naam">{leeg ? <Invul t={naam} /> : getoond}</span>
      {!leeg && getoond !== naam && <span className="vk-lid__echt">{naam}</span>}
      <span className="vk-lid__rol">
        <Invul t={rol} />
      </span>
    </>
  )

  // Geen knop: de leden zijn alleen om te bekijken (het spelerskaartje opent hier niet)
  return (
    <li className={`vk-lid${leeg ? ' is-invullen' : ''}`}>
      <div className="vk-lid__vak">{inhoud}</div>
      {backend.beheerder && !leeg && <LidFotoBeheer naam={naam} url={eigen.url} heeftFoto={!!eigen.pad} />}
    </li>
  )
}

/**
 * Alleen voor beheerders: de VakanCie-foto van een lid plaatsen, bijsnijden (in- en uitzoomen,
 * verschuiven, net als bij de profielfoto), vervangen of weghalen.
 */
function LidFotoBeheer({ naam, url, heeftFoto }: { naam: string; url: string | null; heeftFoto: boolean }) {
  const kiezer = useRef<HTMLInputElement>(null)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  // De foto die nu in het bijsnijvenster staat
  const [bijsnijden, setBijsnijden] = useState<File | null>(null)

  const kies = (bestand: File | undefined) => {
    if (kiezer.current) kiezer.current.value = ''
    if (!bestand) return
    setFout(null)
    setBijsnijden(bestand)
  }
  /** De foto die er nu staat opnieuw bijsnijden (bijv. een foto die met de hand in Storage is gezet) */
  const opnieuw = async () => {
    if (!url) return
    try {
      const blob = await (await fetch(url)).blob()
      setFout(null)
      setBijsnijden(new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' }))
    } catch {
      setFout('Deze foto kan nu niet geopend worden. Kies hem opnieuw met "Andere foto".')
    }
  }
  const gebruik = async (blob: Blob) => {
    setBijsnijden(null)
    setBezig(true)
    setFout(await plaatsLidFoto(naam, blob))
    setBezig(false)
  }
  const weg = async () => {
    setBezig(true)
    setFout(await haalLidFotoWeg(naam))
    setBezig(false)
  }

  return (
    <div className="vk-lidbeheer">
      <input ref={kiezer} type="file" accept="image/*" hidden onChange={(e) => kies(e.target.files?.[0])} />
      <button type="button" className="tekstknop" disabled={bezig} onClick={() => kiezer.current?.click()}>
        <Icoon naam="camera" grootte={18} />
        {bezig ? 'Bezig…' : heeftFoto ? 'Andere foto' : 'Foto plaatsen'}
        <span className="verborgen"> voor {naam}</span>
      </button>
      {heeftFoto && url && (
        <button type="button" className="tekstknop" disabled={bezig} onClick={() => void opnieuw()}>
          <Icoon naam="zoek" grootte={18} />
          Bijsnijden<span className="verborgen"> (foto van {naam})</span>
        </button>
      )}
      {heeftFoto && (
        <button type="button" className="tekstknop" disabled={bezig} onClick={() => void weg()}>
          Weghalen<span className="verborgen"> (foto van {naam})</span>
        </button>
      )}
      {fout && (
        <p className="vk-beheer__melding is-fout" role="alert">
          {fout}
        </p>
      )}
      {bijsnijden && (
        <Bijsnijvenster naam={naam} bestand={bijsnijden} onKlaar={(b) => void gebruik(b)} onSluit={() => setBijsnijden(null)} />
      )}
    </div>
  )
}

/** Het bijsnijden in een venster over de pagina, met de bijsnijder van de profielfoto (4:5, zonder naamband) */
function Bijsnijvenster({
  naam,
  bestand,
  onKlaar,
  onSluit,
}: {
  naam: string
  bestand: File
  onKlaar: (blob: Blob) => void
  onSluit: () => void
}) {
  const venster = useDialoogFocus<HTMLDivElement>(true)
  // Terugknop of terugvegen sluit het venster, niet de pagina
  useTerugSluit(true, onSluit)
  useEffect(() => {
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && onSluit()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [onSluit])

  // Naar body, zodat het vegen tussen tabs (transform op de inhoud) het venster niet meeneemt
  return createPortal(
    <div className="dialoog-achtergrond">
      <div ref={venster} className="dialoog dialoog--hoog vk-bijsnijvenster" role="dialog" aria-modal="true" aria-labelledby="vk-bijsnij-titel">
        <h2 id="vk-bijsnij-titel">Foto van {naam}</h2>
        <FotoBijsnijder bestand={bestand} band={null} onKlaar={onKlaar} onAnnuleer={onSluit} />
      </div>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ cijfers */

const DAG = 86_400_000
const dagNummer = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / DAG)

function Cijfers({ aantalSchermen }: { aantalSchermen: number }) {
  const nu = useNu(60_000)
  const { data: spel } = useData('spel')
  const { data: paklijst } = useData('paklijst')
  const { data: stemmingen } = useData('stemmingen')
  const { data: rad } = useData('rad')

  const vertrekDag = dagNummer(config.vertrek.slice(0, 10))
  const thuisDag = dagNummer(config.thuiskomst.slice(0, 10))
  const vandaag = dagNummer(datumISO(nu))
  const nachtjes = vertrekDag - vandaag

  const rijen: { getal: ReactNode; tekst: string }[] = []
  if (nachtjes > 0) rijen.push({ getal: nachtjes, tekst: nachtjes === 1 ? 'nachtje tot de bus' : 'nachtjes tot de bus' })
  else rijen.push({ getal: thuisDag - vertrekDag, tekst: 'nachten van huis, de bus meegeteld' })
  rijen.push({ getal: aantalSchermen, tekst: 'schermen in de app' })
  rijen.push({ getal: BADGES.length, tekst: 'badges om te verdienen' })
  if (spel) rijen.push({ getal: spel.challenges.reduce((s, d) => s + d.items.length, 0), tekst: 'challenges in het spel' })
  rijen.push({ getal: PANORAMA.toppen.length, tekst: 'bergtoppen bij naam in het panorama' })
  if (rad) rijen.push({ getal: rad.pistes.length, tekst: 'pistes bij naam op het rad' })
  if (paklijst) rijen.push({ getal: paklijst.categorieen.reduce((s, c) => s + c.items.length, 0), tekst: 'dingen op de paklijst' })
  if (stemmingen) {
    const echt = stemmingen.stemmingen.filter((s) => !s.id.startsWith('test-')).length
    if (echt) rijen.push({ getal: echt, tekst: 'stemmingen over elkaar' })
  }
  for (const e of tekst.weetjes.extra) rijen.push({ getal: <Invul t={e.getal} />, tekst: e.tekst })

  return (
    <section className="vk-cijfers" aria-labelledby="vk-cijfers-kop">
      <Kopje id="vk-cijfers-kop">{tekst.weetjes.kop}</Kopje>
      <ul>
        {rijen.map((r) => (
          <li key={r.tekst}>
            <b>{r.getal}</b>
            <span>{r.tekst}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ dank */

function Dank() {
  const { data: kamers } = useData('kamers')
  const d = tekst.dank
  const aantal = kamers ? alleDeelnemers(kamers).length : null
  // Zolang de kamerlijst nog niet geladen is: "alle mensen" in plaats van een getal
  const deelnemers = d.deelnemers.replace('{aantal}', aantal ? String(aantal) : 'alle')
  return (
    <section className="vk-dank" aria-labelledby="vk-dank-kop">
      <Kopje id="vk-dank-kop">{d.kop}</Kopje>
      <p className="vk-dank__groot">{deelnemers}</p>
      <p className="vk-zacht">{d.bronnenIntro}</p>
      <ul className="vk-bronnen">
        {d.bronnen.map((b) => (
          <li key={b.wat}>
            <b>{b.wat}</b>
            <span>{b.wie}</span>
            <a href={b.link} target="_blank" rel="noopener">
              {b.linkTekst}
              <Icoon naam="extern" grootte={15} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ colofon */

function Colofon() {
  return (
    <footer className="vk-colofon">
      <p className="vk-klein">Colofon</p>
      <p>
        {config.appNaam} · versie {__BOUWDATUM__.split('-').reverse().join('/')}
      </p>
      <p>
        <Invul t={tekst.voet.contact} />
      </p>
      <p className="vk-colofon__slot">
        Gemaakt voor de wispo naar {config.bestemming}, {config.vertrek.slice(0, 4)}
      </p>
    </footer>
  )
}
