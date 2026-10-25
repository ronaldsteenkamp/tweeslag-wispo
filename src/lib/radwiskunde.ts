/*
 * Rekenwerk van het rad, los van React en zonder imports, zodat het met `npm test` te testen is.
 * Hoeken in graden: 0 = boven (waar de pijl staat), met de klok mee. Vak i loopt van i·vak tot (i+1)·vak.
 */

/** Getal in [0, 360) */
const rond = (g: number) => ((g % 360) + 360) % 360

/**
 * Eindhoek voor een draai vanaf `nu` waarbij vak `i` (van `n`) onder de pijl stopt.
 * `speling` (0 tot 1) kiest de plek binnen het vak; het middelste 70% zodat het nooit op een grens is.
 * Draait altijd vooruit, minstens `rondjes` hele rondes.
 */
export function doelHoek(i: number, n: number, nu: number, speling: number, rondjes = 4): number {
  const vak = 360 / n
  const doelRest = rond(360 - (i + 0.5) * vak + (speling - 0.5) * vak * 0.7)
  return nu + 360 * rondjes + rond(doelRest - rond(nu))
}

/** Welk vak staat onder de pijl als het rad op `hoek` graden gedraaid is */
export function vakOnderPijl(hoek: number, n: number): number {
  return Math.floor(rond(-hoek) / (360 / n)) % n
}

/** Schudden met een gegeven toeval (getal van 0 tot 1) */
function schud<T>(lijst: T[], toeval: () => number): T[] {
  const a = [...lijst]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(toeval() * (i + 1)))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Een keer verdelen, "gewogen om de beurt": elke kleur spaart punten op naar zijn aantal,
 * wie de meeste heeft is aan de beurt. Startpunten en de volgorde binnen een kleur zijn elke keer anders.
 */
function verspreidEenKeer<T extends { kleur: string }>(lijst: T[], toeval: () => number): T[] {
  const perKleur = new Map<string, T[]>()
  for (const x of schud(lijst, toeval)) perKleur.set(x.kleur, [...(perKleur.get(x.kleur) ?? []), x])
  const groepen = [...perKleur.values()]
  const tegoed = groepen.map((g) => toeval() * g.length)
  const gebruikt = groepen.map(() => 0)
  const uit: T[] = []
  while (uit.length < lijst.length) {
    let beste = -1
    groepen.forEach((g, i) => {
      tegoed[i] += g.length
      if (gebruikt[i] < g.length && (beste < 0 || tegoed[i] > tegoed[beste])) beste = i
    })
    uit.push(groepen[beste][gebruikt[beste]++])
    tegoed[beste] -= lijst.length
  }
  return uit
}

/** Hoeveel buren (rondom, dus ook laatste en eerste) dezelfde kleur hebben */
export const gelijkeBuren = (lijst: { kleur: string }[]) =>
  lijst.filter((x, i) => lijst.length > 1 && x.kleur === lijst[(i + 1) % lijst.length].kleur).length

/** Staan er toch twee dezelfde naast elkaar, dan de tweede ruilen met een vak waar dat minder oplevert */
function herstel<T extends { kleur: string }>(lijst: T[]): T[] {
  const a = [...lijst]
  const n = a.length
  for (let ronde = 0; ronde < n && gelijkeBuren(a) > 0; ronde++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      if (a[i].kleur !== a[j].kleur) continue
      const voor = gelijkeBuren(a)
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue
        ;[a[j], a[k]] = [a[k], a[j]]
        if (gelijkeBuren(a) < voor) break
        ;[a[j], a[k]] = [a[k], a[j]]
      }
    }
  }
  return a
}

/**
 * Pistes zo over het rad verdelen dat de kleuren gelijkmatig rondom liggen en dezelfde kleur zo min
 * mogelijk naast elkaar staat: een paar keer verdelen, de verdeling met de minste gelijke buren houden
 * en die zo nodig nog herstellen.
 */
export function verspreid<T extends { kleur: string }>(lijst: T[], toeval: () => number): T[] {
  let beste = verspreidEenKeer(lijst, toeval)
  for (let poging = 0; poging < 30 && gelijkeBuren(beste) > 0; poging++) {
    const nieuw = verspreidEenKeer(lijst, toeval)
    if (gelijkeBuren(nieuw) < gelijkeBuren(beste)) beste = nieuw
  }
  return gelijkeBuren(beste) > 0 ? herstel(beste) : beste
}

/**
 * Lettergrootte en het aantal tekens dat in een vak past (in eenheden van het rad, straal 100).
 * Tekst loopt van de rand (92) naar binnen tot waar het vak nog hoog genoeg is voor een regel.
 */
export function vakTekst(n: number) {
  const letter = n <= 6 ? 11 : n <= 10 ? 9 : n <= 16 ? 7.5 : 6
  const binnenrand = Math.max(22, (letter * 1.1 * n) / (2 * Math.PI))
  const ruimte = 92 - binnenrand
  return { letter, ruimte, maxTekens: Math.floor(ruimte / (letter * 0.56)) }
}
