export const MIDDEN = 12 // het vrije vakje in een 5x5-kaart

/** Alle 12 bingolijnen: 5 rijen, 5 kolommen, 2 diagonalen */
export const LIJNEN: number[][] = (() => {
  const l: number[][] = []
  for (let i = 0; i < 5; i++) {
    l.push([0, 1, 2, 3, 4].map((k) => i * 5 + k))
    l.push([0, 1, 2, 3, 4].map((r) => r * 5 + i))
  }
  l.push([0, 6, 12, 18, 24])
  l.push([4, 8, 12, 16, 20])
  return l
})()

function schud<T>(lijst: T[]): T[] {
  const a = [...lijst]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Maakt de 24 vakjes van deze telefoon. De eerder opgeslagen volgorde blijft staan;
 * vakjes die uit spel.json zijn verdwenen worden aangevuld met nieuwe, willekeurige vakjes.
 */
export function maakKaart(vakjes: string[], opgeslagen: unknown): string[] {
  const uniek = [...new Set(vakjes)]
  const oud = Array.isArray(opgeslagen) && opgeslagen.length === 24 ? (opgeslagen as unknown[]) : []
  const kaart: (string | null)[] = Array.from({ length: 24 }, (_, i) =>
    typeof oud[i] === 'string' && uniek.includes(oud[i] as string) ? (oud[i] as string) : null,
  )
  const gebruikt = new Set(kaart)
  const over = schud(uniek.filter((v) => !gebruikt.has(v)))
  return kaart.map((v) => v ?? over.pop() ?? '')
}

/** Vakje-index (0..24) → tekst; het midden is vrij */
export function vakjeTekst(kaart: string[], index: number): string | null {
  if (index === MIDDEN) return null
  return kaart[index < MIDDEN ? index : index - 1] ?? ''
}

export function bingoScore(
  kaart: string[],
  gemarkeerd: Set<string>,
  punten: { bingoVakje: number; bingoRij: number; bingoVolleKaart: number },
) {
  const aan = (i: number) => {
    const t = vakjeTekst(kaart, i)
    return t === null || (t !== '' && gemarkeerd.has(t))
  }
  let vakjes = 0
  for (let i = 0; i < 25; i++) if (i !== MIDDEN && aan(i)) vakjes++
  const lijnen = LIJNEN.filter((l) => l.every(aan)).length
  const vol = vakjes === 24
  return {
    vakjes,
    lijnen,
    vol,
    aan,
    totaal: vakjes * punten.bingoVakje + lijnen * punten.bingoRij + (vol ? punten.bingoVolleKaart : 0),
  }
}
