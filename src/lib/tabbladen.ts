import type { KeyboardEvent } from 'react'

/**
 * Toetsenbord voor een rij tabbladen (role="tablist"): pijltje links/rechts naar het vorige of
 * volgende tabblad (rondom), Home/End naar het eerste of laatste. Zet op elk tabblad
 * tabIndex={actief ? 0 : -1}, dan is de hele rij één tab-stop.
 */
export function tabToetsen<T>(waarden: readonly T[], huidig: T, kies: (w: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const nu = waarden.indexOf(huidig)
    const stap = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    const nieuw =
      e.key === 'Home' ? 0 : e.key === 'End' ? waarden.length - 1 : stap ? (nu + stap + waarden.length) % waarden.length : -1
    if (nieuw < 0) return
    e.preventDefault()
    kies(waarden[nieuw])
    ;(e.currentTarget.children[nieuw] as HTMLElement | undefined)?.focus()
  }
}
