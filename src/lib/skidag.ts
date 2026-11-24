import { cm, urenVan, zichtTekst, type WeerLocatie } from './weer'

/*
 * "Wordt het een goede skidag?" — een inschatting van de app uit het weerbericht. Alleen over
 * skiën op de pistes: nooit over lawines of off-piste (daarvoor is er alleen het officiële
 * bulletin). Wind en zicht wegen zwaarder dan verse sneeuw, zodat het scherm bij storm nooit
 * juicht. Niet over liften die open of dicht zijn: dat weten we niet.
 */

export type Niveau = 'goed' | 'matig' | 'slecht'

export interface Skidag {
  niveau: Niveau
  kop: string
  sub: string
  /** Kern voor elders (kort): 'poeder', 'storm', ... */
  soort: 'storm' | 'wolk' | 'mist' | 'poeder' | 'wind' | 'sneeuwdag' | 'regen' | 'zon' | 'grijs'
}

/** Skiuren waarover we oordelen */
const VAN = 9
const TOT = 17

const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)
const som = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Datum van de dag ervoor ('JJJJ-MM-DD') */
function gisteren(datum: string) {
  const d = new Date(`${datum}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Verse sneeuw voor de ochtend van `datum`: van de middag ervoor (16 uur) tot 12 uur, in cm */
export function versSneeuw(loc: WeerLocatie | undefined, datum: string): number {
  return som([...urenVan(loc, gisteren(datum), 16, 24), ...urenVan(loc, datum, 0, 12)].map((u) => u.sneeuw))
}

export function skidag(locaties: WeerLocatie[], datum: string): Skidag | null {
  const boven = locaties.find((l) => l.id === 'gletsjer')
  const midden = locaties.find((l) => l.id === 'midden')
  const dorp = locaties.find((l) => l.id === 'dorp')
  const dag = urenVan(boven, datum, VAN, TOT)
  if (!boven || dag.length < 4) return null
  const dagMidden = urenVan(midden, datum, VAN, TOT)
  const dagDorp = urenVan(dorp, datum, VAN, TOT)

  const stoten = Math.round(max(dag.map((u) => u.stoten ?? u.wind * 1.5)))
  // Verse sneeuw voor de ochtend: van gisteren 16 uur tot vandaag 12 uur, boven
  const vers = versSneeuw(boven, datum)
  const sneeuwUren = dag.filter((u) => u.sneeuw >= 0.2)
  const laatsteSneeuwUur = sneeuwUren.length ? +sneeuwUren[sneeuwUren.length - 1].tijd.slice(11, 13) + 1 : null
  const zichtMidden = dagMidden.map((u) => u.zicht).filter((z): z is number => typeof z === 'number')
  const zichtBoven = dag.map((u) => u.zicht).filter((z): z is number => typeof z === 'number')
  const mistUren = zichtMidden.filter((z) => z < 300).length
  const regenDorp = dagDorp.filter((u) => [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(u.code)).length
  const dagBoven = boven.dagen.find((d) => d.datum === datum)
  const zonUren = dagBoven?.zonUren ?? 0
  const nulgraden = dagBoven?.nulgraden ?? 0

  if (stoten >= 80)
    return {
      niveau: 'slecht',
      soort: 'storm',
      kop: 'Boven niet. Storm op de gletsjer.',
      sub: `Stoten tot ${stoten} km/u boven 3000 m. Hoge liften gaan dan meestal dicht: kijk eerst in de app van Les 2 Alpes wat er draait.`,
    }

  if (mistUren >= 4) {
    const bovenHelder = zichtBoven.length > 0 && Math.min(...zichtBoven) >= 5000
    const minZicht = Math.min(...zichtMidden)
    return bovenHelder
      ? {
          niveau: 'matig',
          soort: 'wolk',
          kop: 'Door de wolk heen, dan zon.',
          sub: `Halverwege zit je in de wolk: plat licht, ${zichtTekst(minZicht)} zicht. Op de gletsjer is het helder.`,
        }
      : {
          niveau: 'matig',
          soort: 'mist',
          kop: 'Weinig zicht vandaag.',
          sub: `Mist op de berg, soms maar ${zichtTekst(minZicht)} zicht. Rustig aan en blijf bij elkaar.`,
        }
  }

  if (vers >= 15) {
    const tot = laatsteSneeuwUur && laatsteSneeuwUur <= 14 ? laatsteSneeuwUur : null
    return {
      niveau: sneeuwUren.length >= 6 ? 'matig' : 'goed',
      soort: 'poeder',
      kop: `Poederdag. ${cm(vers)} vers.`,
      sub:
        sneeuwUren.length >= 6
          ? 'Het blijft de hele dag sneeuwen: veel poeder, weinig zicht.'
          : tot
            ? `Tot een uur of ${tot} sneeuwt het nog en zie je weinig. Daarna klaart het op.`
            : 'Uitgesneeuwd: verse sneeuw en gewoon zicht.',
    }
  }

  if (stoten >= 55)
    return {
      niveau: 'matig',
      soort: 'wind',
      kop: 'Stevige wind boven.',
      sub: `Stoten tot ${stoten} km/u op de gletsjer. Reken erop dat de hoogste liften kunnen stilstaan.`,
    }

  if (regenDorp >= 3)
    return {
      niveau: 'matig',
      soort: 'regen',
      kop: 'Beneden nat, boven sneeuw.',
      sub: `Regen in het dorp; boven ${nulgraden ? `${nulgraden.toLocaleString('nl-NL')} m` : 'de vriesgrens'} valt het als sneeuw.`,
    }

  if (sneeuwUren.length >= 3)
    return {
      niveau: 'matig',
      soort: 'sneeuwdag',
      kop: 'Sneeuwdag.',
      sub: `${cm(som(dag.map((u) => u.sneeuw)))} erbij in de loop van de dag; het zicht is beperkt.`,
    }

  if (zonUren >= 6)
    return {
      niveau: 'goed',
      soort: 'zon',
      kop: 'Ja. Blauw en zon.',
      sub:
        nulgraden >= 2800
          ? 'Warm voor de tijd van het jaar: na de middag worden de lage pistes zwaar.'
          : '’s Ochtends stug en snel, na de middag zachter.',
    }

  return { niveau: 'goed', soort: 'grijs', kop: 'Grijs, maar prima te doen.', sub: 'Bewolkt, droog en niet te veel wind.' }
}

export const NIVEAU_WOORD: Record<Niveau, string> = { goed: 'Goede skidag', matig: 'Halve skidag', slecht: 'Slechte skidag' }
