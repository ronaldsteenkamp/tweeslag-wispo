import { useSyncExternalStore } from 'react'

/*
 * Is de app 'druk'? Een rad draait of het casino rolt. Dan wacht de update-melding
 * (components/UpdateMelding.tsx) tot dat klaar is, zodat hij niet midden in de spanning verschijnt.
 * Per bron een vlag: zet hem aan bij het beginnen en weer uit als het klaar is (of bij het sluiten).
 */
const bronnen = new Set<string>()
const luisteraars = new Set<() => void>()

export function zetDruk(bron: string, aan: boolean) {
  if (aan === bronnen.has(bron)) return
  if (aan) bronnen.add(bron)
  else bronnen.delete(bron)
  for (const f of luisteraars) f()
}

export function isDruk() {
  return bronnen.size > 0
}

export function useDruk() {
  return useSyncExternalStore(
    (f) => {
      luisteraars.add(f)
      return () => luisteraars.delete(f)
    },
    isDruk,
    () => false,
  )
}
