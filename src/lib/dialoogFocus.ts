import { useEffect, useRef } from 'react'

/** Knoppen en links; geen invulvelden, anders springt op een telefoon meteen het toetsenbord open */
const FOCUSBAAR = 'button:not([disabled]), [href], summary'

/**
 * Focus naar een dialoog zodra hij opent (een element met data-autofocus, anders de eerste knop),
 * en bij sluiten terug naar waar je was. Zo hoort een schermlezer wat er in beeld kwam.
 */
export function useDialoogFocus<T extends HTMLElement>(open = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const vorige = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const el = ref.current
    const doel = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSBAAR) ?? el
    doel?.focus({ preventScroll: true })
    return () => {
      if (vorige?.isConnected) vorige.focus({ preventScroll: true })
    }
  }, [open])
  return ref
}
