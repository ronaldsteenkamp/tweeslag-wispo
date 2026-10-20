import { useEffect, useState } from 'react'
import { lokaalNaarDate } from './tijd'

// Testhulp: ?nu=2027-03-08T10:00 (of ?nu=2027-03-08) doet alsof het dat moment is.
// ?unlock=1 opent het spel en alle challenges direct.
const params = new URLSearchParams(window.location.search)

const geladenOp = Date.now()
const nepTijd = (() => {
  const waarde = params.get('nu')
  if (!waarde) return null
  const t = lokaalNaarDate(waarde.includes('T') ? waarde : `${waarde}T09:00`).getTime()
  return Number.isNaN(t) ? null : t
})()

export const testOntgrendeld = params.get('unlock') === '1'

export function nu(): Date {
  return nepTijd === null ? new Date() : new Date(nepTijd + (Date.now() - geladenOp))
}

/** Huidige tijd die elke `interval` ms ververst */
export function useNu(interval = 1000): Date {
  const [tijd, setTijd] = useState(nu)
  useEffect(() => {
    const id = window.setInterval(() => setTijd(nu()), interval)
    const bijTerugkomst = () => setTijd(nu())
    document.addEventListener('visibilitychange', bijTerugkomst)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', bijTerugkomst)
    }
  }, [interval])
  return tijd
}
