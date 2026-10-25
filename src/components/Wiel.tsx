import { useCallback, useRef } from 'react'

/*
 * Gedeeld door het rad en de roulette: een draai-animatie die uitloopt (ease-out), een
 * tikgeluidje als er een vak langs de pijl gaat, en prefers-reduced-motion (dan meteen klaar).
 */

export const minderBeweging = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Loopt langzaam uit, zoals een rad dat wordt losgelaten */
const uitlopen = (t: number) => 1 - Math.pow(1 - t, 4)

let geluid: AudioContext | null = null

/** Kort tikje (Web Audio, geen bestand nodig). Alleen na een tik van de gebruiker toegestaan. */
export function tik() {
  try {
    geluid ??= new AudioContext()
    if (geluid.state === 'suspended') void geluid.resume()
    const nu = geluid.currentTime
    const osc = geluid.createOscillator()
    const volume = geluid.createGain()
    osc.type = 'square'
    osc.frequency.value = 1700
    volume.gain.setValueAtTime(0.05, nu)
    volume.gain.exponentialRampToValueAtTime(0.0001, nu + 0.03)
    osc.connect(volume).connect(geluid.destination)
    osc.start(nu)
    osc.stop(nu + 0.035)
  } catch {
    // Geen geluid mogelijk: dan maar stil
  }
}

/**
 * Draait iets (via onFrame) van de huidige hoek naar `doel` graden in `duur` ms.
 * `vak` = grootte van één vak in graden: bij elke vakgrens die voorbijkomt volgt onTik.
 */
export function useDraai() {
  const hoek = useRef(0)
  const frame = useRef<number | null>(null)

  const draai = useCallback(
    (opties: { doel: number; duur: number; onFrame: (hoek: number, t: number) => void; vak?: number; onTik?: () => void }) =>
      new Promise<void>((klaar) => {
        if (frame.current) cancelAnimationFrame(frame.current)
        const start = hoek.current
        const { doel, onFrame, vak, onTik } = opties
        const duur = minderBeweging() ? 0 : opties.duur
        if (duur === 0) {
          hoek.current = doel
          onFrame(doel, 1)
          klaar()
          return
        }
        const begin = performance.now()
        let laatsteVak = vak ? Math.floor(start / vak) : 0
        let laatsteTik = 0
        const stap = (nu: number) => {
          const t = Math.min(1, (nu - begin) / duur)
          const h = start + (doel - start) * uitlopen(t)
          hoek.current = h
          onFrame(h, t)
          if (vak && onTik) {
            const v = Math.floor(h / vak)
            // Niet vaker dan ~30 tikjes per seconde, anders wordt het een zoem
            if (v !== laatsteVak && nu - laatsteTik > 33) {
              onTik()
              laatsteTik = nu
            }
            laatsteVak = v
          }
          if (t < 1) frame.current = requestAnimationFrame(stap)
          else {
            frame.current = null
            klaar()
          }
        }
        frame.current = requestAnimationFrame(stap)
      }),
    [],
  )

  return { hoek, draai }
}

/** Punt op een cirkel; 0° is boven, met de klok mee */
export const punt = (r: number, graden: number) => {
  const rad = ((graden - 90) * Math.PI) / 180
  return [r * Math.cos(rad), r * Math.sin(rad)] as const
}

/** SVG-pad van een taartpunt van `van` tot `tot` graden (0 = boven) */
export function taartpunt(r: number, van: number, tot: number, binnen = 0) {
  const [x1, y1] = punt(r, van)
  const [x2, y2] = punt(r, tot)
  const groot = tot - van > 180 ? 1 : 0
  if (!binnen) return `M0 0 L${x1} ${y1} A${r} ${r} 0 ${groot} 1 ${x2} ${y2} Z`
  const [x3, y3] = punt(binnen, tot)
  const [x4, y4] = punt(binnen, van)
  return `M${x1} ${y1} A${r} ${r} 0 ${groot} 1 ${x2} ${y2} L${x3} ${y3} A${binnen} ${binnen} 0 ${groot} 0 ${x4} ${y4} Z`
}
