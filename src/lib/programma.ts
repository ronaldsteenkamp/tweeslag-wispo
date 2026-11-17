import type { Dag, PlanningItem } from './data'
import { lokaalNaarDate, tijdUUMM } from './tijd'

/*
 * Status van de items van één dag (Planning, "programmaboekje").
 * - Eindtijd: 'eind' uit de planning, anders het begin van het volgende item dat iedereen doet
 *   (niet 'optioneel', niet 'vervallen'), anders 90 minuten. 'Optioneel' zonder eind: 90 minuten.
 *   Over middernacht telt door.
 * - 'straks' is het eerstvolgende item dat nog moet beginnen.
 * - Vrije tijd: een gat van minstens 2,5 uur overdag. Ontstaat alleen als er eindtijden in de
 *   planning staan (zonder eindtijd loopt elk item tot het volgende).
 * Alle tijden in Nederlandse/Franse tijd (config.tijdzone), los van de telefoon.
 */

export type Status = 'voorbij' | 'bezig' | 'straks' | 'later' | 'vervallen'

export interface ItemMetStatus extends PlanningItem {
  start: Date
  einde: Date
  status: Status
  /** Minuten tot het begin (negatief als begonnen) */
  totBegin: number
  /** Minuten tot het einde */
  totEinde: number
}

export interface VrijeTijd {
  van: string
  tot: string
  start: Date
  einde: Date
  status: 'voorbij' | 'bezig' | 'later'
}

const MIN = 60_000
const DAG = 86_400_000

export const isVervallen = (i: PlanningItem) => i.vervallen !== undefined

export function dagStatus(dag: Dag, nu: Date): { items: ItemMetStatus[]; vrij: VrijeTijd[] } {
  const t = nu.getTime()
  const begin = (i: PlanningItem) => lokaalNaarDate(`${dag.datum}T${i.tijd}`)
  const vast = dag.items.filter((i) => !i.optioneel && !isVervallen(i))

  const items: ItemMetStatus[] = dag.items.map((i) => {
    const start = begin(i)
    let einde: Date
    if (i.eind) {
      einde = lokaalNaarDate(`${dag.datum}T${i.eind}`)
      if (einde <= start) einde = new Date(einde.getTime() + DAG)
    } else if (i.optioneel) {
      // Iets voor wie wil loopt niet tot het volgende van het hoofdprogramma
      einde = new Date(start.getTime() + 90 * MIN)
    } else {
      const volgende = vast.find((x) => begin(x) > start)
      einde = volgende ? begin(volgende) : new Date(start.getTime() + 90 * MIN)
    }
    let status: Status = 'later'
    if (isVervallen(i)) status = 'vervallen'
    else if (t >= einde.getTime()) status = 'voorbij'
    else if (t >= start.getTime()) status = 'bezig'
    return { ...i, start, einde, status, totBegin: (start.getTime() - t) / MIN, totEinde: (einde.getTime() - t) / MIN }
  })
  const straks = items.find((i) => i.status === 'later')
  if (straks) straks.status = 'straks'

  // Gaten in het programma van iedereen
  const vrij: VrijeTijd[] = []
  const reeks = items.filter((i) => !i.optioneel && !isVervallen(i))
  let bezetTot = reeks[0]?.einde
  for (let k = 0; bezetTot && k < reeks.length - 1; k++) {
    if (reeks[k].einde > bezetTot) bezetTot = reeks[k].einde
    const van = bezetTot
    const tot = reeks[k + 1].start
    const vanTijd = tijdUUMM(van)
    if ((tot.getTime() - van.getTime()) / MIN >= 150 && vanTijd >= '09:00' && vanTijd < '22:00') {
      vrij.push({
        van: vanTijd,
        tot: tijdUUMM(tot),
        start: van,
        einde: tot,
        status: t >= tot.getTime() ? 'voorbij' : t >= van.getTime() ? 'bezig' : 'later',
      })
    }
  }
  return { items, vrij }
}

/** '25 min', '1 u 10 min', '2 uur', '3 dagen' */
export function duur(minuten: number): string {
  const m = Math.max(0, Math.round(minuten))
  if (m < 60) return `${m} min`
  const u = Math.floor(m / 60)
  if (u >= 24) {
    const d = Math.round(u / 24)
    return `${d} ${d === 1 ? 'dag' : 'dagen'}`
  }
  const r = m % 60
  return r ? `${u} u ${r} min` : `${u} uur`
}
