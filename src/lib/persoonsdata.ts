import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { config } from '../config'
import { abonneer, bewaard, lees, schrijf, schrijfEnMeld, volgSchrijven, wisEnMeld } from './opslag'
import { PERSOONLIJK, PERSOONLIJKE_SLEUTELS, REGELS_VERSIE, voegAllesSamen, type Versie } from './persoonsdataregels'
import { spelBegint } from './testperiode'

/*
 * Persoonsdata: alles wat iemand zelf bijhoudt (paklijst, badges, gezien-lijsten, spel, casino)
 * hoort bij de naam, niet bij de telefoon. Kiest iemand zijn naam op een andere telefoon of in
 * een andere browser, dan komt alles mee. Net als bij het profiel: geen pincode, alleen het
 * apparaat dat de naam op dit moment heeft (kies_naam) mag schrijven. Tabel: persoonsdata
 * (migratie 0014). Welke sleutels en hoe ze samengevoegd worden: persoonsdataregels.ts.
 *
 * Werkwijze:
 *  - Elke schrijfactie op een persoonlijke sleutel (via opslag.ts) krijgt een moment en komt in
 *    de "nog versturen"-wachtrij; versturen gebeurt zodra er verbinding is (ook offline op de berg).
 *  - Bij het kiezen (of terugkrijgen) van een naam haalt de telefoon EERST de gegevens van die
 *    naam op en voegt ze samen met wat hier staat. Pas daarna wordt er iets verstuurd, ook door
 *    het scorebord (klaarVoorVersturen). Zo overschrijft een nieuwe telefoon niets met een lege stand.
 *  - Wisselt iemand naar een andere naam, dan verdwijnen de gegevens van de vorige naam van deze
 *    telefoon: ze staan op de server en komen terug als die naam hier weer gekozen wordt. Alleen
 *    wat nog niet verstuurd was (bijv. zonder bereik) blijft hier apart bewaard, tot dan.
 *  - Op de telefoon staat dus alleen een kopie van de gekozen naam, zodat alles ook zonder bereik
 *    werkt. Zonder naam (overgeslagen) staat het alleen hier en gaat het mee naar de eerste naam.
 *
 * Zonder backend gebeurt hier niets en blijft alles zoals het was: alleen op deze telefoon.
 */

const META = 'persoonsdata'
const APART = 'persoonsdata.apart'
const TABEL = 'persoonsdata'

interface Meta {
  /** Bij welke naam de persoonlijke waarden op deze telefoon horen */
  naam: string | null
  /** Moment van de laatste wijziging per sleutel; 0 = van vóór het ophalen (telt niet als nieuwer) */
  bijgewerkt: Record<string, number>
  /** Nog naar de server */
  teVersturen: string[]
  /** De gegevens van deze naam zijn al een keer opgehaald en samengevoegd */
  opgehaald: boolean
  /** Met welke REGELS_VERSIE er voor het laatst samengevoegd is */
  versie?: number
}

/** Gegevens van andere namen die eerder op deze telefoon gekozen waren */
type Apart = Record<string, { waarden: Record<string, unknown>; meta: Meta }>

const naamSleutel = (n: string) => n.trim().toLowerCase()
const leesMeta = () => lees<Meta | null>(META, null)

let stil = false
/** Schrijven zonder dat het als eigen wijziging telt */
function stilSchrijven(f: () => void) {
  stil = true
  try {
    f()
  } finally {
    stil = false
  }
}
const zetMeta = (m: Meta) => stilSchrijven(() => schrijf(META, m))

// ---------- Bijhouden wat er verandert ----------

function bijSchrijven(sleutel: string) {
  if (stil || !(sleutel in PERSOONLIJK)) return
  const m = leesMeta()
  if (!m) return
  const vorige = m.bijgewerkt[sleutel] ?? 0
  // Vóór het ophalen telt een wijziging nog niet als nieuwer dan de server (bijv. de casino-reset
  // of een net geschudde bingokaart op een nieuwe telefoon)
  const moment = m.opgehaald ? Math.max(Date.now(), vorige + 1) : 0
  zetMeta({
    ...m,
    bijgewerkt: { ...m.bijgewerkt, [sleutel]: moment },
    teVersturen: m.teVersturen.includes(sleutel) ? m.teVersturen : [...m.teVersturen, sleutel],
  })
  void verstuur()
}

// ---------- Naam kiezen of wisselen ----------

function huidigeWaarden(): Record<string, unknown> {
  const uit: Record<string, unknown> = {}
  for (const s of PERSOONLIJKE_SLEUTELS) if (bewaard(s)) uit[s] = lees<unknown>(s, null)
  return uit
}

/** Staat er van deze naam iets op de telefoon dat (nog) niet op de server staat? */
const heeftOnverstuurd = (m: Meta) => !m.opgehaald || m.teVersturen.length > 0

function wisselNaam(nieuw: string | null) {
  const m = leesMeta()
  if (!m) return
  if (m.naam !== null && nieuw !== null && naamSleutel(m.naam) === naamSleutel(nieuw)) {
    if (m.naam !== nieuw) zetMeta({ ...m, naam: nieuw })
    return
  }
  if (m.naam === nieuw) return

  const apart = lees<Apart>(APART, {})
  let volgende: Meta
  if (m.naam !== null) {
    // Gegevens van de vorige naam hier weghalen: ze staan op de server. Alleen als er nog iets
    // niet verstuurd is (of nooit opgehaald), apart bewaren tot die naam hier terugkomt.
    if (heeftOnverstuurd(m)) apart[naamSleutel(m.naam)] = { waarden: huidigeWaarden(), meta: m }
    else delete apart[naamSleutel(m.naam)]
    stilSchrijven(() => PERSOONLIJKE_SLEUTELS.forEach(wisEnMeld))
    volgende = { naam: nieuw, bijgewerkt: {}, teVersturen: [], opgehaald: false, versie: REGELS_VERSIE }
  } else {
    // Nog geen naam: wat hier staat hoorde bij niemand en gaat mee naar de eerste naam
    volgende = { ...m, naam: nieuw, opgehaald: false }
  }
  if (nieuw !== null) {
    const eerder = apart[naamSleutel(nieuw)]
    if (eerder) {
      delete apart[naamSleutel(nieuw)]
      stilSchrijven(() => {
        for (const [s, w] of Object.entries(eerder.waarden)) if (s in PERSOONLIJK) schrijfEnMeld(s, w)
      })
      // Wat er toen nog niet verstuurd was blijft in de wachtrij; eerst opnieuw ophalen
      volgende = { ...eerder.meta, naam: nieuw, opgehaald: false }
    }
  }
  stilSchrijven(() => schrijf(APART, apart))
  zetMeta(volgende)
  meldKlaar()
  void haalOp()
}

// ---------- Ophalen en samenvoegen ----------

let tabelOntbreekt = false
let ophalen: Promise<void> | null = null

interface Rij {
  sleutel: string
  waarde: unknown
  bijgewerkt: string
}

function haalOp(): Promise<void> {
  ophalen ??= haalOpNu().finally(() => {
    ophalen = null
  })
  return ophalen
}

async function haalOpNu() {
  const m = leesMeta()
  const b = backendStand()
  if (!m || !m.naam || m.opgehaald) return
  // Lezen mag alleen het apparaat dat deze naam heeft
  if (b.status !== 'verbonden' || b.gekoppeld?.naam !== m.naam) return
  const cb = supabase()
  if (!cb) return
  try {
    const c = await cb
    const [{ data, error }, eigen] = await Promise.all([
      c.from(TABEL).select('sleutel, waarde, bijgewerkt').eq('naam', m.naam),
      // Echt van dit apparaat? Anders geeft de server (RLS) gewoon niets terug, en zou dat lijken
      // op een lege stand. 'gekoppeld' kan uit de bewaarde stand komen terwijl een ander apparaat
      // de naam inmiddels heeft.
      c.rpc('is_eigen_naam', { p_naam: m.naam }),
    ])
    if (!error && (eigen.error || eigen.data !== true)) return
    if (error) {
      // Migratie nog niet gedraaid: dan werkt alles zoals vroeger (alleen deze telefoon)
      if (error.code === '42P01' || error.code === 'PGRST205') {
        tabelOntbreekt = true
        meldKlaar()
      }
      return
    }
    let rijen = (data ?? []) as Rij[]
    // Na een reset op deze telefoon: ook de gegevens van deze naam op de server wissen, anders
    // komen ze hier meteen weer terug (bijv. als een telefoon met een oudere versie van de app
    // ze na het wissen nog verstuurd heeft). Eén keer per reset per naam: staat de rij 'reset' al
    // op deze reset, dan heeft een andere telefoon van dezelfde naam het al gedaan.
    if (lees<string | null>(WIS_SERVER, null) === RESET) {
      if (rijen.find((r) => r.sleutel === RESET_RIJ)?.waarde !== RESET) {
        const weg = await c.from(TABEL).delete().eq('naam', m.naam)
        if (weg.error) return
        const merk = await c.from(TABEL).upsert({ naam: m.naam, sleutel: RESET_RIJ, waarde: RESET }, { onConflict: 'naam,sleutel' })
        if (merk.error) return
        rijen = []
      }
      schrijf(WIS_SERVER, null)
    }

    // Intussen een andere naam gekozen: niets doen
    const nu = leesMeta()
    if (!nu || nu.naam !== m.naam || nu.opgehaald) return

    const server: Record<string, Versie> = {}
    for (const r of rijen) {
      if (r.sleutel in PERSOONLIJK) server[r.sleutel] = { waarde: r.waarde, bijgewerkt: Date.parse(r.bijgewerkt) || 0 }
    }
    const lokaal: Record<string, Versie> = {}
    for (const s of PERSOONLIJKE_SLEUTELS) {
      if (bewaard(s)) lokaal[s] = { waarde: lees<unknown>(s, null), bijgewerkt: nu.bijgewerkt[s] ?? 0 }
    }
    const { stand, teVersturen } = voegAllesSamen(lokaal, server, {
      nu: Date.now(),
      spelBegint: config.spelTestperiode ? spelBegint.getTime() : null,
    })

    // Eerst de wachtrij en "opgehaald" vastleggen, dan de waarden zetten: wie daarop reageert
    // (bijv. het scorebord) verstuurt dan meteen de samengevoegde stand
    zetMeta({
      naam: nu.naam,
      bijgewerkt: Object.fromEntries(Object.entries(stand).map(([s, v]) => [s, v.bijgewerkt])),
      teVersturen,
      opgehaald: true,
      versie: REGELS_VERSIE,
    })
    stilSchrijven(() => {
      for (const [s, v] of Object.entries(stand)) {
        if (JSON.stringify(lokaal[s]?.waarde) !== JSON.stringify(v.waarde)) schrijfEnMeld(s, v.waarde)
      }
    })
    meldKlaar()
    void verstuur()
  } catch {
    // Volgende keer opnieuw (bij weer verbinding)
  }
}

// ---------- Versturen ----------

let bezig = false

async function verstuur() {
  const m = leesMeta()
  const b = backendStand()
  if (bezig || !m || !m.naam || !m.opgehaald || !m.teVersturen.length) return
  // Schrijven mag alleen het apparaat dat de naam nu heeft
  if (b.status !== 'verbonden' || b.gekoppeld?.naam !== m.naam) return
  const cb = supabase()
  if (!cb) return
  bezig = true
  let gelukt = false
  const verstuurd = new Map<string, number>()
  try {
    const c = await cb
    const rijen = m.teVersturen
      .filter((s) => s in PERSOONLIJK && bewaard(s))
      .map((s) => {
        const moment = m.bijgewerkt[s] || Date.now()
        verstuurd.set(s, m.bijgewerkt[s] ?? 0)
        return { naam: m.naam, sleutel: s, waarde: lees<unknown>(s, null), bijgewerkt: new Date(moment).toISOString() }
      })
    if (rijen.length) {
      const { error } = await c.from(TABEL).upsert(rijen, { onConflict: 'naam,sleutel' })
      if (error?.code === '42501') {
        // Geweigerd: de naam hoort nu bij een ander apparaat. Niet blijven proberen met deze
        // (verouderde) stand, maar eerst opnieuw ophalen en samenvoegen als de naam hier terugkomt.
        const nu = leesMeta()
        if (nu && nu.naam === m.naam) zetMeta({ ...nu, opgehaald: false })
      }
      if (error) throw error
    }
    // Uit de wachtrij, behalve wat er tijdens het versturen opnieuw veranderd is
    const nu = leesMeta()
    if (nu && nu.naam === m.naam) {
      const klaar = (s: string) => verstuurd.has(s) && (nu.bijgewerkt[s] ?? 0) === verstuurd.get(s)
      zetMeta({ ...nu, teVersturen: nu.teVersturen.filter((s) => bewaard(s) && !klaar(s)) })
    }
    gelukt = true
  } catch {
    // Volgende keer opnieuw
  } finally {
    bezig = false
  }
  if (gelukt && leesMeta()?.teVersturen.length) void verstuur()
}

// ---------- Klaar om te versturen (voor het scorebord) ----------

const klaarLuisteraars = new Set<() => void>()
function meldKlaar() {
  klaarVoorVersturen() && klaarLuisteraars.forEach((f) => f())
}

/**
 * Mag de stand van deze telefoon naar de server? Pas als de gegevens van de naam opgehaald en
 * samengevoegd zijn (of als er geen backend of nog geen tabel is).
 */
export function klaarVoorVersturen(): boolean {
  if (!backendIngesteld || tabelOntbreekt) return true
  const m = leesMeta()
  return !!m && m.opgehaald && m.naam === lees<string | null>('naam', null)
}

/**
 * Staat er voortgang (paklijst, spel, badges...) op deze telefoon die nog niet op de server staat?
 * Bijvoorbeeld om te waarschuwen voordat iemand de app van het beginscherm haalt.
 */
export function voortgangNogNietVerstuurd(): boolean {
  if (!backendIngesteld || tabelOntbreekt) return false
  const m = leesMeta()
  return !!m && heeftOnverstuurd(m)
}

/** Seintje zodra de stand klaar is om te versturen */
export function abonneerKlaar(f: () => void): () => void {
  klaarLuisteraars.add(f)
  return () => {
    klaarLuisteraars.delete(f)
  }
}

// ---------- Iedereen opnieuw beginnen ----------

/**
 * Eenmalig alle voortgang wissen op de telefoons, behalve bij de namen in BEHOUDEN. Op de server
 * wordt hetzelfde gewist (met de hand, in de SQL Editor); zonder dit zou een telefoon zijn oude
 * stand meteen weer terugsturen. Nog een keer iedereen resetten: datum ophogen.
 */
const RESET = '2026-11-18c'
const RESET_SLEUTEL = 'persoonsdata.reset'
/** Nog te doen na een reset: de serverstand van de naam wissen */
const WIS_SERVER = 'persoonsdata.wisServer'
/** Rij op de server (geen persoonlijke sleutel) die zegt van welke reset de stand is */
const RESET_RIJ = 'reset'
/** Namen waarvan de voortgang blijft staan (sinds 2026-11-18b: niemand) */
const BEHOUDEN: string[] = []
/** Naast de persoonlijke sleutels: wat er verder bij de voortgang hoort */
const OOK_WISSEN = ['spel.testmoment', 'spel.stand.vorige', 'spel.stand.huidig', 'rad.teVersturen', 'apparaat.eigenaar']

export function resetVoortgangAlsNodig() {
  if (!backendIngesteld || lees<string | null>(RESET_SLEUTEL, null) === RESET) return
  const naam = lees<string | null>('naam', null)
  const behouden = (n: string) => BEHOUDEN.includes(naamSleutel(n))
  if (!naam || !behouden(naam)) {
    for (const s of [...PERSOONLIJKE_SLEUTELS, ...OOK_WISSEN, META]) wisEnMeld(s)
    // Bij het eerstvolgende ophalen ook de serverstand van de naam wissen (zie haalOpNu)
    schrijf(WIS_SERVER, RESET)
  }
  // Apart gezette gegevens van andere namen ook weg
  const apart = lees<Apart>(APART, {})
  schrijf(APART, Object.fromEntries(Object.entries(apart).filter(([n]) => behouden(n))))
  schrijf(RESET_SLEUTEL, RESET)
}

// ---------- Starten ----------

let gestart = false

/** Eén keer bij het starten, vóór alles wat persoonlijke waarden schrijft */
export function startPersoonsdata() {
  if (gestart || !backendIngesteld) return
  gestart = true
  if (!leesMeta()) {
    // Eerste start na deze update: alles wat hier al staat gaat naar de server (na ophalen en
    // samenvoegen, voor het geval de naam al op een ander apparaat gegevens heeft)
    const aanwezig = PERSOONLIJKE_SLEUTELS.filter(bewaard)
    zetMeta({
      naam: lees<string | null>('naam', null),
      bijgewerkt: Object.fromEntries(aanwezig.map((s) => [s, 0])),
      teVersturen: aanwezig,
      opgehaald: false,
      versie: REGELS_VERSIE,
    })
  } else {
    const m = leesMeta()!
    // Nieuwe persoonlijke sleutels (bijv. de eigen raderen): nog een keer ophalen en samenvoegen,
    // zodat wat hier al stond naar de server gaat (of de stand van de server hier komt)
    if (m.versie !== REGELS_VERSIE) {
      const nieuw = PERSOONLIJKE_SLEUTELS.filter((s) => !(s in m.bijgewerkt) && bewaard(s))
      zetMeta({
        ...m,
        bijgewerkt: { ...m.bijgewerkt, ...Object.fromEntries(nieuw.map((s) => [s, 0])) },
        opgehaald: false,
        versie: REGELS_VERSIE,
      })
    }
  }
  // Apart bewaarde namen zonder iets onverstuurds horen niet op deze telefoon: weg ermee
  const apart = lees<Apart>(APART, {})
  const houden = Object.fromEntries(Object.entries(apart).filter(([, a]) => heeftOnverstuurd(a.meta)))
  if (Object.keys(houden).length !== Object.keys(apart).length) stilSchrijven(() => schrijf(APART, houden))
  volgSchrijven(bijSchrijven)
  wisselNaam(lees<string | null>('naam', null))
  abonneer('naam', (n) => wisselNaam((n as string | null | undefined) ?? null))

  const probeer = () => {
    void haalOp().then(() => verstuur())
  }
  abonneerBackend(probeer)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') probeer()
  })
  window.addEventListener('online', () => window.setTimeout(probeer, 2000))
  window.setInterval(probeer, 60_000)
}
