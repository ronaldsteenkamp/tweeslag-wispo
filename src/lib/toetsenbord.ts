import { useEffect } from 'react'

/**
 * Zolang een invoerveld focus heeft (het toetsenbord staat open), krijgt <html> de class
 * 'toetsenbord-open'. De tabbalk schuift dan weg, zodat hij niets bedekt.
 */
export function useToetsenbord() {
  useEffect(() => {
    const isVeld = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes((el as HTMLInputElement).type)))
    const aan = (e: FocusEvent) => {
      if (isVeld(e.target)) document.documentElement.classList.add('toetsenbord-open')
    }
    const uit = (e: FocusEvent) => {
      if (!isVeld(e.relatedTarget)) document.documentElement.classList.remove('toetsenbord-open')
    }
    document.addEventListener('focusin', aan)
    document.addEventListener('focusout', uit)
    return () => {
      document.removeEventListener('focusin', aan)
      document.removeEventListener('focusout', uit)
    }
  }, [])
}
