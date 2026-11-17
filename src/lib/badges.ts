import { useEffect, useMemo } from 'react'
import { config } from '../config'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import {
  BADGES,
  badgesUit,
  eigenStemmen,
  feitenUitTelefoon,
  kamerKampioenen,
  radTelling,
  vroegsteVogels,
  type Feiten,
  type TelefoonBadges,
} from './badgeregels'
import { useVerdiend } from './badgesTelefoon'
import { useEigenBijnaam, useToonNaam } from './bijnamen'
import { bingoScore, maakKaart } from './bingo'
import { useData, type Spel } from './data'
import { lees, schrijfEnMeld, useOpgeslagen } from './opslag'
import { isAf, sleutel, useMijnProfiel, useProfielen } from './profiel'
import { useStemmingen, winnaars } from './stemming'
import { spelBegint } from './testperiode'

export { badgeDef, badgesUit, BADGES, type Badge, type BadgeDef, type BadgeId, type Feiten } from './badgeregels'

/*
 * Badges: kleine plaatjes op je profiel die je vanzelf krijgt door wat je in de app doet.
 * De regels (welke badges, drempels) staan in badgeregels.ts. Hier komen de gegevens vandaan.
 *
 * Twee soorten:
 *  - verdiend: eenmaal gehaald blijft hij (zolang de gegevens er zijn);
 *  - wisselt: gaat naar wie op dat moment voorop staat (bij gelijke stand allebei).
 *
 * Je eigen badges komen zoveel mogelijk van deze telefoon, zodat ze meteen verschijnen (ook
 * zonder bereik). Die van anderen komen van de server en worden lokaal bewaard. Wat alleen de
 * telefoon kan zien (beginscherm, meldingen, casino, de reis, je eigen stemmen) stuurt hij zelf mee naar
 * de server, in voortgang.badges (zie badgesTelefoon.ts en scorebord.ts).
 */

/** Badges die in deze versie van de app te halen zijn (zonder server alleen de eigen) */
export const TE_HALEN = BADGES.filter((b) => backendIngesteld || !b.server)

// ---------- Van de server ----------

/** Ophoger als er iets nieuws in de stand komt: BadgeMelding wacht daarop bij het bijwerken van de app */
export const STAND_VERSIE = 2

interface ServerPersoon {
  naam: string
  challenges: number
  bingoVakjes: number
  bingoPunten: number
  ingepakt: boolean
  /** Wanneer helemaal ingepakt (ms), of null */
  ingepaktOp: number | null
  /** Badges die alleen de telefoon van die persoon kent */
  telefoon: TelefoonBadges
  totaal: number
}

interface ServerStand {
  versie?: number
  personen: ServerPersoon[]
  /** Aantal foto's per naam (kleine letters) */
  fotos: Record<string, number>
  /** Hoe vaak door het klos-rad gekozen, per naam (kleine letters) */
  rad: Record<string, number>
  opgehaald: number
}

const CACHE = 'badges.stand'

let lopend: Promise<void> | null = null

export function haalBadgeStand(): Promise<void> {
  lopend ??= haal().finally(() => {
    lopend = null
  })
  return lopend
}

const leegPersoon = (naam: string, totaal = 0): ServerPersoon => ({
  naam,
  challenges: 0,
  bingoVakjes: 0,
  bingoPunten: 0,
  ingepakt: false,
  ingepaktOp: null,
  telefoon: {},
  totaal,
})

async function haal() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  try {
    const c = await cb
    const [v, k, f, r] = await Promise.all([
      // * en niet de kolomnamen: dan werkt het ook als de kolommen van 0011/0012 er nog niet zijn
      c.from('voortgang').select('*, deelnemers(naam)'),
      c.from('klassement_personen').select('naam, totaal'),
      c.from('fotos').select('naam'),
      // Mag mislukken (tabel uit migratie 0012 nog niet gedraaid)
      c.from('rad_uitslagen').select('naam, gedraaid'),
    ])
    const fout = v.error ?? k.error ?? f.error
    if (fout) throw fout
    type VRij = {
      challenges?: string[]
      bingo?: string[]
      bingo_punten?: number
      ingepakt?: boolean
      ingepakt_op?: string | null
      badges?: unknown
      deelnemers?: { naam: string } | { naam: string }[] | null
    }
    const perNaam = new Map<string, ServerPersoon>()
    for (const rij of (k.data ?? []) as { naam: string; totaal: number }[]) {
      perNaam.set(sleutel(rij.naam), leegPersoon(rij.naam, rij.totaal ?? 0))
    }
    for (const rij of (v.data ?? []) as VRij[]) {
      const d = Array.isArray(rij.deelnemers) ? rij.deelnemers[0] : rij.deelnemers
      if (!d?.naam) continue
      const p = perNaam.get(sleutel(d.naam)) ?? leegPersoon(d.naam)
      p.challenges = rij.challenges?.length ?? 0
      p.bingoVakjes = rij.bingo?.length ?? 0
      p.bingoPunten = rij.bingo_punten ?? 0
      p.ingepakt = rij.ingepakt === true
      const op = rij.ingepakt_op ? Date.parse(rij.ingepakt_op) : NaN
      p.ingepaktOp = Number.isFinite(op) ? op : null
      p.telefoon = rij.badges && typeof rij.badges === 'object' && !Array.isArray(rij.badges) ? (rij.badges as TelefoonBadges) : {}
      perNaam.set(sleutel(d.naam), p)
    }
    const fotos: Record<string, number> = {}
    for (const rij of (f.data ?? []) as { naam: string }[]) fotos[sleutel(rij.naam)] = (fotos[sleutel(rij.naam)] ?? 0) + 1
    // Uitslagen uit de testperiode tellen niet
    const vanaf = config.spelTestperiode ? spelBegint.getTime() : 0
    const uitslagen = r.error ? [] : ((r.data ?? []) as { naam: string; gedraaid: string }[])
    const rad = Object.fromEntries(radTelling(uitslagen.map((u) => ({ naam: u.naam, gedraaid: Date.parse(u.gedraaid) })), vanaf))
    schrijfEnMeld<ServerStand>(CACHE, { versie: STAND_VERSIE, personen: [...perNaam.values()], fotos, rad, opgehaald: Date.now() })
  } catch {
    // Dan blijft de bewaarde stand staan
  }
}

/**
 * Haalt de stand één keer op als de bewaarde stand van een oudere versie is (of er nog geen is),
 * zodra er verbinding is. Voor BadgeMelding, die verder niets ophaalt.
 */
export function useActueleStand() {
  useEffect(() => {
    if (!backendIngesteld) return
    const probeer = () => {
      if (backendStand().status !== 'verbonden') return
      if (lees<ServerStand | null>(CACHE, null)?.versie === STAND_VERSIE) return
      void haalBadgeStand()
    }
    probeer()
    return abonneerBackend(probeer)
  }, [])
}

/** Het aantal bingorijen terugrekenen uit de punten (de server kent de kaart niet) */
function lijnenUitPunten(vakjes: number, punten: number, p: Spel['punten'] | undefined) {
  if (!p || !p.bingoRij) return 0
  const vol = vakjes >= 24
  const rest = punten - vakjes * p.bingoVakje - (vol ? p.bingoVolleKaart : 0)
  return Math.max(0, Math.round(rest / p.bingoRij))
}

// ---------- Uitrekenen ----------

/**
 * Badges van iedereen. actief: de stand van de server ophalen (bij openen, elke minuut en
 * als de verbinding terugkomt). Niet actief: alleen de bewaarde stand gebruiken.
 */
export function useBadges(actief = false) {
  const [stand] = useOpgeslagen<ServerStand | null>(CACHE, null)
  const { data: spel } = useData('spel')
  const { data: kamers } = useData('kamers')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const [gedaan] = useOpgeslagen<string[]>('spel.challenges', [])
  const [vinkjes] = useOpgeslagen<string[]>('spel.bingo.vinkjes', [])
  const [kaart] = useOpgeslagen<unknown>('spel.bingo.kaart', null)
  const [ingepakt] = useOpgeslagen<boolean>('paklijst.ingepakt', false)
  const [fiches] = useOpgeslagen<number>('casino.fiches', 1000)
  const verdiend = useVerdiend()
  const eigenBijnaam = useEigenBijnaam()
  const toon = useToonNaam()
  const mijnProfiel = useMijnProfiel()
  const { perNaam: profielen } = useProfielen()
  const { stemmingen, stand: stemstand } = useStemmingen(actief)

  useEffect(() => {
    if (!actief || !backendIngesteld) return
    void haalBadgeStand()
    const id = window.setInterval(() => void haalBadgeStand(), 60_000)
    let vorige = backendStand().status
    const stop = abonneerBackend(() => {
      const nu = backendStand().status
      if (nu === 'verbonden' && vorige !== 'verbonden') void haalBadgeStand()
      vorige = nu
    })
    return () => {
      window.clearInterval(id)
      stop()
    }
  }, [actief])

  return useMemo(() => {
    // Stemmingen gewonnen, per naam (alleen stemmingen die nu meetellen: geen oude teststemmingen)
    const telt = new Set(stemmingen.map((s) => s.id))
    const gewonnen = new Map<string, number>()
    if (backendIngesteld) {
      for (const [id, uitslag] of Object.entries(stemstand?.uitslagen ?? {})) {
        if (!telt.has(id)) continue
        for (const w of winnaars(uitslag)) gewonnen.set(sleutel(w.kandidaat), (gewonnen.get(sleutel(w.kandidaat)) ?? 0) + 1)
      }
    }
    // Je eigen stemmen (die van anderen zijn geheim; die sturen ze zelf mee)
    const mijnStemmen = backendIngesteld
      ? eigenStemmen(stemmingen, stemstand?.mijn ?? {}, stemstand?.uitslagen ?? {}, Date.now())
      : { geweest: 0, gemist: 0, stemvee: false, waarzegger: 0 }

    const server = backendIngesteld ? stand : null
    const serverPer = new Map((server?.personen ?? []).map((p) => [sleutel(p.naam), p]))
    const ikSleutel = naam ? sleutel(naam) : null

    // 🐦 Vroege vogel: alleen de momenten die op de server staan, ook je eigen. Met alleen je eigen
    // moment van de telefoon (geen server, of migratie 0012 nog niet gedraaid) ben je altijd de eerste.
    const vogels = vroegsteVogels((server?.personen ?? []).map((p) => ({ naam: p.naam, op: p.ingepaktOp })))

    // Eigen spelvoortgang van deze telefoon (dezelfde berekening als het scherm Spel)
    const mijnSpel = (() => {
      if (!spel) return null
      const ids = new Set(spel.challenges.flatMap((d) => d.items.map((c) => c.id)))
      const k = kaart ? maakKaart(spel.bingo.vakjes, kaart) : []
      const b = k.length ? bingoScore(k, new Set(vinkjes), spel.punten) : null
      return { challenges: gedaan.filter((id) => ids.has(id)).length, lijnen: b?.lijnen ?? 0, vol: b?.vol ?? false }
    })()

    // 🛌 Kamerkampioen: de punten per kamer volgens de kamerverdeling (kamers.json) en het klassement
    const kampioenen = server ? kamerKampioenen(kamers?.kamers ?? [], (n) => serverPer.get(sleutel(n))?.totaal ?? 0) : new Set<string>()
    const kampioenNamen = new Set(
      (kamers?.kamers ?? []).filter((k) => kampioenen.has(k.nummer)).flatMap((k) => k.bewoners.filter(Boolean).map(sleutel)),
    )

    const feitenVan = (n: string): Feiten => {
      const s = sleutel(n)
      const sp = serverPer.get(s)
      const eigen = s === ikSleutel
      const rij = profielen.get(s)
      const profielVol = eigen
        ? !!mijnProfiel && isAf(mijnProfiel) && !!(mijnProfiel.foto || mijnProfiel.fotoLokaal)
        : !!rij && isAf(rij) && !!rij.foto_pad
      const vakjes = sp?.bingoVakjes ?? 0
      const telefoon = eigen
        ? {
            vasteGast: !!verdiend['vaste-gast'],
            wekker: !!verdiend.wekker,
            highRoller: !!verdiend['high-roller'],
            blut: !!verdiend.blut,
            stemvee: mijnStemmen.stemvee,
            waarzegger: mijnStemmen.waarzegger,
            bergbeklimmer: !!verdiend.bergbeklimmer,
            eersteLift: !!verdiend['eerste-lift'],
            ijskonijn: !!verdiend.ijskonijn,
            nachtuil: !!verdiend.nachtuil,
          }
        : feitenUitTelefoon(sp?.telefoon)
      return {
        ...telefoon,
        profielVol,
        bijnaam: eigen ? !!eigenBijnaam.bijnaam : toon(n) !== n,
        ingepakt: eigen ? ingepakt || !!sp?.ingepakt : !!sp?.ingepakt,
        vroegeVogel: vogels.has(s),
        challenges: eigen && mijnSpel ? mijnSpel.challenges : (sp?.challenges ?? 0),
        bingoLijnen: eigen && mijnSpel ? mijnSpel.lijnen : lijnenUitPunten(vakjes, sp?.bingoPunten ?? 0, spel?.punten),
        volleKaart: eigen && mijnSpel ? mijnSpel.vol : vakjes >= 24,
        stemWinst: gewonnen.get(s) ?? 0,
        stemmingenGemist: eigen ? mijnStemmen.gemist : 0,
        fotos: server?.fotos[s] ?? 0,
        casinoFiches: eigen ? fiches : 0,
        radGekozen: server?.rad?.[s] ?? 0,
        totaal: sp?.totaal ?? 0,
        kamerkampioen: kampioenNamen.has(s),
      }
    }

    const leiders = {
      fotos: Math.max(0, ...Object.values(server?.fotos ?? {})),
      totaal: Math.max(0, ...(server?.personen ?? []).map((p) => p.totaal)),
    }

    return {
      van: (n: string) => badgesUit(feitenVan(n), leiders),
      feitenVan,
      mijnNaam: naam,
      /** Is er (ooit) een stand van de server binnengekomen? */
      serverBekend: !!server,
      /** Is de stand van de server van deze versie van de app (met alle nieuwe gegevens)? */
      serverActueel: !!server && server.versie === STAND_VERSIE,
      /** Zijn spel.json en de kamers er? Zonder die lijken spelbadges en Kamerkampioen even weg */
      geladen: !!spel && !!kamers,
    }
  }, [
    stand,
    spel,
    kamers,
    naam,
    gedaan,
    vinkjes,
    kaart,
    ingepakt,
    fiches,
    verdiend,
    eigenBijnaam.bijnaam,
    toon,
    mijnProfiel,
    profielen,
    stemmingen,
    stemstand,
  ])
}
