import { alleDeelnemers, type Kamers } from './data'

/*
 * Het rekenwerk achter "Kamerverdeling maken" (screens/Verdelen.tsx): een concept op deze telefoon,
 * bijwerken met kamers.json, verdelen en terugschrijven naar kamers.json.
 */

export interface ConceptKamer {
  id: string
  nummer: string
  naam: string
  bedden: number
  bewoners: string[]
}

export interface Concept {
  verblijf: string
  kamers: ConceptKamer[]
  /** Deelnemers die nog geen kamer hebben */
  over: string[]
  /** Namen en verblijf uit kamers.json toen het concept voor het laatst is bijgewerkt */
  basis?: Basis
  /** De verdeling op de server waar dit concept op voortbouwt ('bijgewerkt'), of null als er nog geen was */
  serverVersie?: string | null
}

interface Basis {
  namen: string[]
  verblijf: string
}

const basisVan = (data: Kamers): Basis => ({ namen: alleDeelnemers(data).sort(), verblijf: data.verblijf ?? '' })

const UITLEG =
  "Kamers met nummer, een naam (mag je weglaten), het aantal bedden en de bewoners. Wie nog geen kamer heeft staat onder zonderKamer. ALLEEN VOORNAMEN, geen achternamen. Twee mensen met dezelfde naam? Schrijf dan bijvoorbeeld 'Lisa' en 'Lisa 2'. Iedereen kiest in de app zijn naam uit deze lijst. Tip: maak de verdeling in de app via Kamers → Kamerverdeling maken."

export const nieuwId = () => Math.random().toString(36).slice(2, 9)

export function uitData(data: Kamers, serverVersie: string | null): Concept {
  return {
    serverVersie,
    verblijf: data.verblijf ?? '',
    kamers: data.kamers.map((k) => ({
      id: nieuwId(),
      nummer: k.nummer,
      naam: k.naam ?? '',
      bedden: k.bedden ?? Math.max(k.bewoners.length, 2),
      bewoners: [...k.bewoners],
    })),
    over: [...data.zonderKamer],
    basis: basisVan(data),
  }
}

/**
 * Brengt wijzigingen in kamers.json (bijv. nieuwe deelnemers of een andere naam van het verblijf)
 * over naar een concept dat al op deze telefoon stond, zonder de eigen indeling kwijt te raken.
 * Geeft null als er niets veranderd is.
 */
export function bijwerken(c: Concept, data: Kamers): { concept: Concept; tekst: string } | null {
  const nu = basisVan(data)
  if (c.basis && JSON.stringify(c.basis) === JSON.stringify(nu)) return null
  const inConcept = new Set([...c.over, ...c.kamers.flatMap((k) => k.bewoners)])
  const erbij = nu.namen.filter((n) => !inConcept.has(n) && !c.basis?.namen.includes(n))
  // Alleen weghalen wat eerder uit kamers.json kwam; zelf toegevoegde namen blijven staan
  const weg = (c.basis?.namen ?? []).filter((n) => !nu.namen.includes(n) && inConcept.has(n))
  // Verblijf alleen overnemen als het hier niet zelf is aangepast (oude concepten: de voorbeeldnaam)
  const eigenVerblijf = c.basis ? c.verblijf !== c.basis.verblijf : c.verblijf.trim() !== '' && !/voorbeeld/i.test(c.verblijf)
  const verblijf = !eigenVerblijf && nu.verblijf && nu.verblijf !== c.verblijf ? nu.verblijf : c.verblijf
  const concept: Concept = {
    ...c,
    verblijf,
    over: [...c.over.filter((n) => !weg.includes(n)), ...erbij],
    kamers: c.kamers.map((k) => ({ ...k, bewoners: k.bewoners.filter((b) => !weg.includes(b)) })),
    basis: nu,
  }
  const delen = [
    erbij.length ? `${erbij.join(', ')} ${erbij.length === 1 ? 'staat' : 'staan'} erbij bij "Nog in te delen".` : '',
    weg.length ? `${weg.join(', ')} ${weg.length === 1 ? 'is' : 'zijn'} uit de lijst gehaald.` : '',
    verblijf !== c.verblijf ? `Verblijf is nu "${verblijf}".` : '',
  ].filter(Boolean)
  return { concept, tekst: delen.join(' ') }
}

/** kamers.json in dezelfde, goed leesbare vorm als het origineel: één kamer per regel */
export function naarJson(c: Concept): string {
  const regel = (k: ConceptKamer) => {
    const delen = [`"nummer": ${JSON.stringify(k.nummer.trim())}`]
    if (k.naam.trim()) delen.push(`"naam": ${JSON.stringify(k.naam.trim())}`)
    delen.push(`"bedden": ${k.bedden}`)
    delen.push(`"bewoners": [${k.bewoners.map((b) => JSON.stringify(b)).join(', ')}]`)
    return `    { ${delen.join(', ')} }`
  }
  return [
    '{',
    `  "_uitleg": ${JSON.stringify(UITLEG)},`,
    `  "verblijf": ${JSON.stringify(c.verblijf.trim())},`,
    '  "kamers": [',
    c.kamers.map(regel).join(',\n'),
    c.over.length ? '  ],' : '  ]',
    ...(c.over.length ? [`  "zonderKamer": [${c.over.map((b) => JSON.stringify(b)).join(', ')}]`] : []),
    '}',
    '',
  ].join('\n')
}

function schud<T>(lijst: T[]): T[] {
  const a = [...lijst]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Haalt een naam overal weg (uit de lijst en uit alle kamers) */
export const zonder = (c: Concept, naam: string): Concept => ({
  ...c,
  over: c.over.filter((n) => n !== naam),
  kamers: c.kamers.map((k) => ({ ...k, bewoners: k.bewoners.filter((b) => b !== naam) })),
})

/** Om de beurt een persoon per kamer met een vrij bed, zodat de kamers ongeveer even vol raken */
export function verdeelAutomatisch(concept: Concept): Concept {
  const over = schud(concept.over)
  const kamers = concept.kamers.map((k) => ({ ...k, bewoners: [...k.bewoners] }))
  let geplaatst = true
  while (over.length && geplaatst) {
    geplaatst = false
    for (const k of [...kamers].sort((a, b) => a.bewoners.length / a.bedden - b.bewoners.length / b.bedden)) {
      if (!over.length) break
      if (k.bewoners.length < k.bedden) {
        k.bewoners.push(over.shift()!)
        geplaatst = true
      }
    }
  }
  return { ...concept, kamers, over }
}
