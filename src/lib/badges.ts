import { useEffect, useMemo } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { bingoScore, maakKaart } from './bingo'
import { useData, type Spel } from './data'
import { schrijfEnMeld, useOpgeslagen } from './opslag'
import { isAf, sleutel, useMijnProfiel, useProfielen } from './profiel'
import { useStemmingen, winnaars } from './stemming'

/*
 * Badges: kleine plaatjes op je profiel die je vanzelf krijgt door wat je in de app doet.
 * Er hoeft niemand iets voor in te vullen en de server rekent niets uit: alles volgt uit
 * gegevens die er al zijn (spelvoortgang, fotomuur, stemmingen, klassement, profielen).
 *
 * Twee soorten:
 *  - verdiend: eenmaal gehaald blijft hij (zolang de gegevens er zijn);
 *  - wisselt: gaat naar wie op dat moment voorop staat (bij gelijke stand allebei).
 *
 * Je eigen badges komen zoveel mogelijk van deze telefoon, zodat ze meteen verschijnen (ook
 * zonder bereik). Die van anderen komen van de server en worden lokaal bewaard.
 */

export type BadgeId =
  | 'open-boek'
  | 'ingepakt'
  | 'challenge-jager'
  | 'bingo'
  | 'volle-kaart'
  | 'stem-van-de-dag'
  | 'fotograaf'
  | 'koploper'

export const CHALLENGES_NODIG = 10
export const FOTOS_NODIG = 3

export interface Feiten {
  profielVol: boolean
  ingepakt: boolean
  challenges: number
  bingoLijnen: number
  volleKaart: boolean
  stemWinst: number
  fotos: number
  totaal: number
}

export interface BadgeDef {
  id: BadgeId
  emoji: string
  naam: string
  /** Waarvoor je hem krijgt */
  uitleg: string
  /** Wat je nog moet doen (met je eigen voortgang erbij) */
  nogTeDoen: (f: Feiten) => string
  /** Gaat naar wie voorop staat */
  wisselt?: boolean
  /** Kan alleen met de server (fotomuur, stemmingen, klassement) */
  server?: boolean
}

export const BADGES: BadgeDef[] = [
  {
    id: 'open-boek',
    emoji: '✍️',
    naam: 'Open boek',
    uitleg: 'Profiel helemaal ingevuld, met foto',
    nogTeDoen: () => 'Vul je profiel helemaal in, met een foto',
  },
  {
    id: 'ingepakt',
    emoji: '🎒',
    naam: 'Ingepakt',
    uitleg: 'De hele paklijst afgevinkt',
    nogTeDoen: () => 'Vink je hele paklijst af',
  },
  {
    id: 'challenge-jager',
    emoji: '🎯',
    naam: 'Challenge-jager',
    uitleg: `${CHALLENGES_NODIG} challenges gedaan`,
    nogTeDoen: (f) => `Doe ${CHALLENGES_NODIG} challenges (nu ${f.challenges})`,
  },
  {
    id: 'bingo',
    emoji: '🚌',
    naam: 'Bingo!',
    uitleg: 'Een rij op de busbingo',
    nogTeDoen: () => 'Haal een rij op de busbingo',
  },
  {
    id: 'volle-kaart',
    emoji: '🏆',
    naam: 'Volle kaart',
    uitleg: 'De hele busbingokaart vol',
    nogTeDoen: () => 'Maak je busbingokaart helemaal vol',
  },
  {
    id: 'stem-van-de-dag',
    emoji: '👑',
    naam: 'Stem van de dag',
    uitleg: 'Een dagelijkse stemming gewonnen',
    nogTeDoen: () => 'Win een dagelijkse stemming',
    server: true,
  },
  {
    id: 'fotograaf',
    emoji: '📸',
    naam: 'Fotograaf',
    uitleg: "De meeste foto's op de fotomuur",
    nogTeDoen: (f) => `Zet de meeste foto's op de fotomuur, minstens ${FOTOS_NODIG} (nu ${f.fotos})`,
    wisselt: true,
    server: true,
  },
  {
    id: 'koploper',
    emoji: '🥇',
    naam: 'Koploper',
    uitleg: 'Nu de nummer 1 van het klassement',
    nogTeDoen: () => 'Sta bovenaan in het klassement',
    wisselt: true,
    server: true,
  },
]

export const badgeDef = (id: BadgeId) => BADGES.find((b) => b.id === id)!

/** Badges die in deze versie van de app te halen zijn (zonder server alleen de eigen) */
export const TE_HALEN = BADGES.filter((b) => backendIngesteld || !b.server)

export interface Badge {
  id: BadgeId
  /** Aantal keer (alleen bij Stem van de dag) */
  aantal?: number
}

// ---------- Van de server ----------

interface ServerPersoon {
  naam: string
  challenges: number
  bingoVakjes: number
  bingoPunten: number
  ingepakt: boolean
  totaal: number
}

interface ServerStand {
  personen: ServerPersoon[]
  /** Aantal foto's per naam (kleine letters) */
  fotos: Record<string, number>
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

async function haal() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  try {
    const c = await cb
    const [v, k, f] = await Promise.all([
      // * en niet de kolomnamen: dan werkt het ook als 'ingepakt' (migratie 0011) er nog niet is
      c.from('voortgang').select('*, deelnemers(naam)'),
      c.from('klassement_personen').select('naam, totaal'),
      c.from('fotos').select('naam'),
    ])
    const fout = v.error ?? k.error ?? f.error
    if (fout) throw fout
    type VRij = {
      challenges?: string[]
      bingo?: string[]
      bingo_punten?: number
      ingepakt?: boolean
      deelnemers?: { naam: string } | { naam: string }[] | null
    }
    const perNaam = new Map<string, ServerPersoon>()
    for (const r of (k.data ?? []) as { naam: string; totaal: number }[]) {
      perNaam.set(sleutel(r.naam), { naam: r.naam, challenges: 0, bingoVakjes: 0, bingoPunten: 0, ingepakt: false, totaal: r.totaal ?? 0 })
    }
    for (const r of (v.data ?? []) as VRij[]) {
      const d = Array.isArray(r.deelnemers) ? r.deelnemers[0] : r.deelnemers
      if (!d?.naam) continue
      const p = perNaam.get(sleutel(d.naam)) ?? { naam: d.naam, challenges: 0, bingoVakjes: 0, bingoPunten: 0, ingepakt: false, totaal: 0 }
      p.challenges = r.challenges?.length ?? 0
      p.bingoVakjes = r.bingo?.length ?? 0
      p.bingoPunten = r.bingo_punten ?? 0
      p.ingepakt = r.ingepakt === true
      perNaam.set(sleutel(d.naam), p)
    }
    const fotos: Record<string, number> = {}
    for (const r of (f.data ?? []) as { naam: string }[]) fotos[sleutel(r.naam)] = (fotos[sleutel(r.naam)] ?? 0) + 1
    schrijfEnMeld<ServerStand>(CACHE, { personen: [...perNaam.values()], fotos, opgehaald: Date.now() })
  } catch {
    // Dan blijft de bewaarde stand staan
  }
}

/** Het aantal bingorijen terugrekenen uit de punten (de server kent de kaart niet) */
function lijnenUitPunten(vakjes: number, punten: number, p: Spel['punten'] | undefined) {
  if (!p || !p.bingoRij) return 0
  const vol = vakjes >= 24
  const rest = punten - vakjes * p.bingoVakje - (vol ? p.bingoVolleKaart : 0)
  return Math.max(0, Math.round(rest / p.bingoRij))
}

// ---------- Uitrekenen ----------

/** Feiten → badges. leiders: de hoogste stand van iedereen (voor de badges die wisselen). */
export function badgesUit(f: Feiten, leiders: { fotos: number; totaal: number }): Badge[] {
  const uit: Badge[] = []
  if (f.profielVol) uit.push({ id: 'open-boek' })
  if (f.ingepakt) uit.push({ id: 'ingepakt' })
  if (f.challenges >= CHALLENGES_NODIG) uit.push({ id: 'challenge-jager' })
  if (f.bingoLijnen > 0) uit.push({ id: 'bingo' })
  if (f.volleKaart) uit.push({ id: 'volle-kaart' })
  if (f.stemWinst > 0) uit.push({ id: 'stem-van-de-dag', aantal: f.stemWinst })
  if (f.fotos >= FOTOS_NODIG && f.fotos === leiders.fotos) uit.push({ id: 'fotograaf' })
  if (f.totaal > 0 && f.totaal === leiders.totaal) uit.push({ id: 'koploper' })
  return uit
}

/**
 * Badges van iedereen. actief: de stand van de server ophalen (bij openen, elke minuut en
 * als de verbinding terugkomt). Niet actief: alleen de bewaarde stand gebruiken.
 */
export function useBadges(actief = false) {
  const [stand] = useOpgeslagen<ServerStand | null>(CACHE, null)
  const { data: spel } = useData('spel')
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const [gedaan] = useOpgeslagen<string[]>('spel.challenges', [])
  const [vinkjes] = useOpgeslagen<string[]>('spel.bingo.vinkjes', [])
  const [kaart] = useOpgeslagen<unknown>('spel.bingo.kaart', null)
  const [ingepakt] = useOpgeslagen<boolean>('paklijst.ingepakt', false)
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
    const server = backendIngesteld ? stand : null
    const serverPer = new Map((server?.personen ?? []).map((p) => [sleutel(p.naam), p]))

    // Eigen spelvoortgang van deze telefoon (dezelfde berekening als het scherm Spel)
    const mijnSpel = (() => {
      if (!spel) return null
      const ids = new Set(spel.challenges.flatMap((d) => d.items.map((c) => c.id)))
      const k = kaart ? maakKaart(spel.bingo.vakjes, kaart) : []
      const b = k.length ? bingoScore(k, new Set(vinkjes), spel.punten) : null
      return { challenges: gedaan.filter((id) => ids.has(id)).length, lijnen: b?.lijnen ?? 0, vol: b?.vol ?? false }
    })()

    const feitenVan = (n: string): Feiten => {
      const s = sleutel(n)
      const sp = serverPer.get(s)
      const eigen = !!naam && sleutel(naam) === s
      const rij = profielen.get(s)
      const profielVol = eigen
        ? !!mijnProfiel && isAf(mijnProfiel) && !!(mijnProfiel.foto || mijnProfiel.fotoLokaal)
        : !!rij && isAf(rij) && !!rij.foto_pad
      const vakjes = sp?.bingoVakjes ?? 0
      return {
        profielVol,
        ingepakt: eigen ? ingepakt || !!sp?.ingepakt : !!sp?.ingepakt,
        challenges: eigen && mijnSpel ? mijnSpel.challenges : (sp?.challenges ?? 0),
        bingoLijnen: eigen && mijnSpel ? mijnSpel.lijnen : lijnenUitPunten(vakjes, sp?.bingoPunten ?? 0, spel?.punten),
        volleKaart: eigen && mijnSpel ? mijnSpel.vol : vakjes >= 24,
        stemWinst: gewonnen.get(s) ?? 0,
        fotos: server?.fotos[s] ?? 0,
        totaal: sp?.totaal ?? 0,
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
      spelGeladen: !!spel,
    }
  }, [stand, spel, naam, gedaan, vinkjes, kaart, ingepakt, mijnProfiel, profielen, stemmingen, stemstand])
}
