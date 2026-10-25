/*
 * Hoe een echt roulettewiel beweegt, als plan voor de animatie in het casino.
 *
 * - Het wiel (de rotor) draait langzaam met de klok mee (~15–25 toeren per minuut) en remt
 *   maar heel weinig af; het draait na de landing van het balletje nog even door.
 * - De croupier gooit het balletje de andere kant op langs de rand (de baan, ~2 toeren per
 *   seconde). Wrijving en luchtweerstand remmen het af.
 * - Onder een kritieke snelheid houdt de rand het niet meer vast: het rolt de schuine
 *   helling af. Omdat het naar binnen gaat, draait het juist even sneller (impulsmoment).
 * - Onderweg kan het tegen een van de acht diamanten ketsen: flink trager en een sprongetje.
 * - In het wiel hupt het over een paar vakjes (tikje op elk schotje) en blijft dan liggen.
 *
 * De uitslag ligt van tevoren vast (eerlijk toeval, zie rad.ts). De baan van het balletje
 * wordt eerst vrij gesimuleerd; daarna krijgt het wiel precies de snelheid waarmee het
 * gekozen vakje op het juiste moment onder het balletje ligt.
 *
 * Hoeken in graden, 0 = boven, met de klok mee positief. Afstanden in SVG-eenheden.
 */

export const R_BAAN = 103 // midden van de baan langs de rand
export const R_DIAMANT = 94 // de diamanten op de helling
export const R_ROTOR = 88 // buitenrand van het draaiende deel
export const R_VAKJE = 70 // waar het balletje in een vakje ligt
/** Waar de diamanten staan (op de vaste rand, draaien niet mee) */
export const DIAMANTEN = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => a + 22.5)

const DT = 1 / 1000
const OPGOOI = 0.35 // s: balletje uit het vakje de baan op
const A_ROL = 65 // °/s² rolwrijving
const B_LUCHT = 0.00025 // luchtweerstand (∝ snelheid²)
const W_KRITIEK = 250 // °/s: hieronder valt het balletje van de rand
const G_HELLING = 60 // eenheden/s²: de helling trekt naar binnen
const G_EXTRA = 220
const TAU_WIEL = 14 // s: het wiel remt maar langzaam af
const AANLOOP_WIEL = 0.6 // s: van oude naar nieuwe wielsnelheid (de croupier geeft een zet)
const W_WIEL_MIN = 90 // °/s
const UITROLLEN = 3.5 // s: na de landing remt het wiel af tot stilstand

export interface Stand {
  wiel: number
  bal: number
  straal: number
  /** Hoeksnelheid van het balletje (°/s), voor de bewegingsstaart en het rolgeluid */
  balSnelheid: number
  wielSnelheid: number
  /** Rolt het balletje nog los over de rand of helling? */
  rolt: boolean
}

export interface Tikje {
  t: number
  volume: number
  toon: number
}

export interface Worp {
  /** s: het balletje ligt stil in het vakje */
  landing: number
  /** s: ook het wiel staat stil */
  einde: number
  tikjes: Tikje[]
  stand: (t: number) => Stand
}

const zacht = (x: number) => x * x * (3 - 2 * x)
const mod = (x: number, m: number) => ((x % m) + m) % m

export function planWorp(o: {
  wiel: number
  wielSnelheid: number
  bal: number
  balStraal: number
  getal: number
  vakken: number
  toeval: () => number
}): Worp {
  const { toeval } = o
  const vak = 360 / o.vakken
  const tikjes: Tikje[] = []

  // ---- 1. Het balletje over de baan en de helling (los van het wiel) ----
  const baan: { a: number; r: number; w: number }[] = [] // elke ms
  const w0 = -(700 + 200 * toeval())
  let t = 0
  let a = o.bal
  let r = o.balStraal
  let vr = 0
  let w = 0
  let losGelaten = false
  while (t < 20) {
    baan.push({ a, r, w })
    if (t < OPGOOI) {
      const f = t / OPGOOI
      w = w0 * f
      r = o.balStraal + (R_BAAN - o.balStraal) * zacht(f)
    } else {
      const s = Math.abs(w)
      w += (A_ROL + B_LUCHT * s * s) * DT // w is negatief: naar nul toe
      if (!losGelaten && s > W_KRITIEK) r = R_BAAN
      else {
        losGelaten = true
        const trek = Math.max(0, 1 - (s / W_KRITIEK) ** 2)
        vr -= (G_HELLING + G_EXTRA * trek) * DT
        const rOud = r
        r += vr * DT
        if (r > R_BAAN) {
          r = R_BAAN
          vr = -Math.abs(vr) * 0.3
        }
        w *= (rOud / r) ** 2 // naar binnen = sneller rond
      }
    }
    const aOud = a
    a += w * DT
    if (losGelaten && Math.abs(r - R_DIAMANT) < 3.2) {
      for (const d of DIAMANTEN) {
        if (Math.floor((aOud - d) / 360) !== Math.floor((a - d) / 360)) {
          w *= 0.6 + 0.25 * toeval()
          vr = 20 + 25 * toeval()
          tikjes.push({ t, volume: 0.09, toon: 1100 + 300 * toeval() })
        }
      }
    }
    t += DT
    if (t > OPGOOI && r <= R_ROTOR) break
  }
  const t1 = t
  const a1 = a
  tikjes.push({ t: t1, volume: 0.07, toon: 2600 })

  // ---- 2. Het wiel: snelheid zo kiezen dat het goede vakje onder het balletje komt ----
  const E = (x: number) => TAU_WIEL * (1 - Math.exp(-x / TAU_WIEL))
  const F = (x: number) => (TAU_WIEL ** 2 - TAU_WIEL * (x + TAU_WIEL) * Math.exp(-x / TAU_WIEL)) / AANLOOP_WIEL
  // ∫ van de oude en de nieuwe snelheid (met de aanloop en het langzame afremmen erin)
  const J2 = (x: number) => (x <= AANLOOP_WIEL ? F(x) : F(AANLOOP_WIEL) + E(x) - E(AANLOOP_WIEL))
  const J1 = (x: number) => (x <= AANLOOP_WIEL ? E(x) - F(x) : E(AANLOOP_WIEL) - F(AANLOOP_WIEL))
  const pEind = (o.getal + 0.5) * vak // midden van het vakje, gezien vanaf het wiel
  const hupjes = 1 + 3 * toeval() // zoveel vakjes stuitert het nog terug
  const pIn = pEind + hupjes * vak
  const basis = o.wiel + o.wielSnelheid * J1(t1) + W_WIEL_MIN * J2(t1)
  const wN = W_WIEL_MIN + mod(a1 - pIn - basis, 360) / J2(t1)
  const wielHoek = (x: number) => o.wiel + o.wielSnelheid * J1(x) + wN * J2(x)
  const wielV = (x: number) => {
    const f = Math.min(1, x / AANLOOP_WIEL)
    return (o.wielSnelheid * (1 - f) + wN * f) * Math.exp(-x / TAU_WIEL)
  }

  // ---- 3. Hupjes over de schotjes, gezien vanaf het wiel ----
  const d3 = 1.1 + 0.15 * hupjes
  const landing = t1 + d3
  const p = (u: number) => pEind + (pIn - pEind) * (1 - u) ** 3
  const vakNr = (x: number) => Math.floor((x - pEind) / vak + 0.5)
  for (let u = 0, vorig = vakNr(pIn); u <= 1; u += 0.002) {
    const nu = vakNr(p(u))
    if (nu !== vorig) tikjes.push({ t: t1 + u * d3, volume: 0.015 + 0.05 * (1 - u), toon: 2300 + 1200 * toeval() })
    vorig = nu
  }

  const wielLanding = wielHoek(landing)
  const wielLandingV = wielV(landing)

  const stand = (x: number): Stand => {
    if (x < t1) {
      const i = Math.min(baan.length - 1, Math.max(0, x / DT))
      const i0 = Math.floor(i)
      const b0 = baan[i0]
      const b1 = baan[Math.min(baan.length - 1, i0 + 1)]
      const f = i - i0
      return {
        wiel: wielHoek(x),
        wielSnelheid: wielV(x),
        bal: b0.a + (b1.a - b0.a) * f,
        straal: b0.r + (b1.r - b0.r) * f,
        balSnelheid: b0.w,
        rolt: true,
      }
    }
    if (x < landing) {
      const u = (x - t1) / d3
      const pu = p(u)
      const hoogte = 70 + 12 * (1 - u) ** 2 * Math.abs(Math.sin((Math.PI * (pu - pEind)) / vak))
      const b = zacht(Math.min(1, u / 0.15))
      const wh = wielHoek(x)
      return {
        wiel: wh,
        wielSnelheid: wielV(x),
        bal: wh + pu,
        straal: R_ROTOR * (1 - b) + hoogte * b,
        balSnelheid: wielV(x) + (-3 * (pIn - pEind) * (1 - u) ** 2) / d3,
        rolt: false,
      }
    }
    const s = Math.min(UITROLLEN, x - landing)
    const wh = wielLanding + wielLandingV * (s - (s * s) / (2 * UITROLLEN))
    const v = wielLandingV * (1 - s / UITROLLEN)
    return { wiel: wh, wielSnelheid: v, bal: wh + pEind, straal: R_VAKJE, balSnelheid: v, rolt: false }
  }

  return { landing, einde: landing + UITROLLEN, tikjes, stand }
}
