/** Types voor sneeuw.js (de module zelf is gewoon JavaScript, zonder dependencies). */

type Diep<T> = { [K in keyof T]?: T[K] extends object ? Diep<T[K]> : T[K] }

export interface SneeuwConfig {
  doel: HTMLElement | null
  vast: boolean
  dichtheid: number
  maxVlokken: number
  minVlokken: number
  maxDpr: number
  maxFps: number
  autoKwaliteit: boolean
  kwaliteitOndergrens: number
  minKwaliteit: number
  aantalVormen: number
  spriteGrootte: number
  lagen: Record<'ver' | 'midden' | 'dichtbij' | 'voorgrond', {
    aan: boolean
    aandeel: number
    grootte: [number, number]
    val: [number, number]
    zwaai: [number, number]
    dekking: number
    vaag: number
    wind: number
    min?: number
  }>
  draaiSnelheid: [number, number]
  kanteling: [number, number]
  kantelTempo: [number, number]
  kleur: string
  rand: string
  randBreedte: number
  intensiteit: { min: number; max: number; periode: number; detail: number }
  bries: number
  storm: {
    aan: boolean
    gemiddeldeWacht: number
    eersteNa: number
    opbouw: [number, number]
    duur: [number, number]
    afzwakken: [number, number]
    wind: number
    vlagen: number
    turbulentie: number
    valFactor: number
    waas: number
    nawaaien: number
    bewegingsonscherpte: boolean
  }
  vervaging: {
    modus: 'auto' | 'css' | 'canvas'
    selector: string
    donker: string
    tekst: string
    tekstDoorzicht: number
    vaag: number
    doorzicht: number
    onderlaag: boolean
  }
  minderBeweging: 'rustig' | 'stil'
  aan: boolean | null
  opslagSleutel: string | null
  seed: number | null
}

export interface SneeuwStatus {
  seed: number
  fps: number
  jsMs: number
  vlokken: number
  zichtbaar: number
  kwaliteit: number
  intensiteit: number
  storm: 'rust' | 'opbouw' | 'vol' | 'af'
  stormKracht: number
  wind: number
  volgendeStorm: number
  modus: 'css' | 'canvas'
  dpr: number
  minderBeweging: boolean
  canvasFilter: boolean
  vormen: string[]
}

export interface Sneeuw {
  zetAan(waarde: boolean): void
  isAan(): boolean
  zetZichtbaar(waarde: boolean): void
  pauzeer(): void
  hervat(): void
  storm(richting?: 'links' | 'rechts'): void
  stopStorm(): void
  zetIntensiteit(waarde: number | null): void
  zetLaag(naam: keyof SneeuwConfig['lagen'], waarde: boolean): void
  zetDichtheid(waarde: number): void
  zetVervaging(opties: { modus?: SneeuwConfig['vervaging']['modus']; vaag?: number; doorzicht?: number }): void
  zetKleur(opties: { kleur?: string; rand?: string }): void
  zetMinderBeweging(waarde: boolean | null): void
  zetAutoKwaliteit(waarde: boolean): void
  nieuweSeed(): void
  status(): SneeuwStatus
  config: SneeuwConfig
  vernietig(): void
}

export const STANDAARD: SneeuwConfig
export function startSneeuw(eigen?: Diep<SneeuwConfig>): Sneeuw
