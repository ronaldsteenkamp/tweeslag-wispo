import { useEffect, useRef } from 'react'

/*
 * Groot feest over het hele scherm: een regen van confetti en vuurwerk dat op verschillende
 * plekken ontploft (bijvoorbeeld als de paklijst helemaal af is). Getekend op één canvas, zodat
 * honderden stukjes vloeiend blijven lopen. Klikken gaat er gewoon doorheen.
 * Bij 'minder beweging' wordt er niets getoond.
 */

const KLEUREN = ['#f3d36b', '#ffffff', '#099fc4', '#7fd3ea', '#d7263d', '#0e7a55', '#ff9fd0']
// Volle kleuren: het vuurwerk moet ook op de lichte achtergrond van de app goed te zien zijn
const VUURWERK = [
  ['#f3b800', '#d7263d'],
  ['#099fc4', '#0d0058'],
  ['#d7263d', '#f3b800'],
  ['#0e7a55', '#099fc4'],
  ['#e0409a', '#7b2ff7'],
  ['#0d0058', '#f3b800'],
]

interface Snipper {
  x: number
  y: number
  vx: number
  vy: number
  hoek: number
  draai: number
  fladder: number
  b: number
  h: number
  kleur: string
}

interface Vonk {
  x: number
  y: number
  vx: number
  vy: number
  leven: number
  max: number
  kleur: string
}

interface Pijl {
  start: number // ms na begin
  x: number
  y: number // waar hij ontploft
  af: boolean
}

const kies = <T,>(lijst: T[]) => lijst[Math.floor(Math.random() * lijst.length)]

export function Feestregen({ duur = 5200, onKlaar }: { duur?: number; onKlaar?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const klaar = useRef(onKlaar)
  klaar.current = onKlaar

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      klaar.current?.()
      return
    }
    let B = window.innerWidth
    let H = window.innerHeight
    const maat = () => {
      B = window.innerWidth
      H = window.innerHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(B * dpr)
      c.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    maat()
    window.addEventListener('resize', maat)

    // Confetti in drie golven van boven, over de hele breedte
    const snippers: Snipper[] = []
    const golf = (aantal: number, hoogte: number) => {
      for (let i = 0; i < aantal; i++) {
        snippers.push({
          x: Math.random() * B,
          y: -20 - Math.random() * hoogte,
          vx: (Math.random() - 0.5) * 2,
          vy: 2 + Math.random() * 3,
          hoek: Math.random() * Math.PI * 2,
          draai: (Math.random() - 0.5) * 0.3,
          fladder: Math.random() * Math.PI * 2,
          b: 6 + Math.random() * 6,
          h: 9 + Math.random() * 8,
          kleur: kies(KLEUREN),
        })
      }
    }
    golf(140, H * 0.3)
    golf(110, H * 1.1)
    golf(90, H * 1.6)

    // Vuurwerk: een stijgende pijl die bovenin ontploft, kort na elkaar op verschillende plekken
    const pijlen: Pijl[] = Array.from({ length: 9 }, (_, i) => ({
      start: 100 + i * 420 + Math.random() * 200,
      x: B * (0.12 + Math.random() * 0.76),
      y: H * (0.12 + Math.random() * 0.38),
      af: false,
    }))
    const vonken: Vonk[] = []
    const ontplof = (p: Pijl) => {
      const [k1, k2] = kies(VUURWERK)
      const aantal = 90 + Math.floor(Math.random() * 40)
      const kracht = 4.5 + Math.random() * 2.5
      for (let i = 0; i < aantal; i++) {
        const hoek = (i / aantal) * Math.PI * 2 + Math.random() * 0.1
        const v = kracht * (0.55 + Math.random() * 0.45)
        const max = 55 + Math.random() * 35
        vonken.push({ x: p.x, y: p.y, vx: Math.cos(hoek) * v, vy: Math.sin(hoek) * v, leven: max, max, kleur: i % 3 ? k1 : k2 })
      }
    }

    const begin = performance.now()
    let vorige = begin
    let frame = 0
    const stap = (nu: number) => {
      const t = nu - begin
      // Ook op 120 Hz-schermen even snel
      const f = Math.min(3, (nu - vorige) / 16.7)
      vorige = nu
      ctx.clearRect(0, 0, B, H)
      // Op het eind alles zacht laten verdwijnen
      const uit = Math.max(0, Math.min(1, (duur - t) / 700))

      for (const p of pijlen) {
        if (p.af || t < p.start) continue
        const vlucht = (t - p.start) / 450
        if (vlucht >= 1) {
          p.af = true
          ontplof(p)
          continue
        }
        // Spoor van de opstijgende pijl
        const y = H + 10 - (H + 10 - p.y) * (1 - Math.pow(1 - vlucht, 2))
        ctx.globalAlpha = uit * 0.9
        ctx.fillStyle = '#f3b800'
        ctx.beginPath()
        ctx.arc(p.x, y, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = uit * 0.35
        ctx.fillRect(p.x - 1, y, 2, 26)
      }

      for (let i = vonken.length - 1; i >= 0; i--) {
        const v = vonken[i]
        v.vx *= Math.pow(0.975, f)
        v.vy = v.vy * Math.pow(0.975, f) + 0.06 * f
        v.x += v.vx * f
        v.y += v.vy * f
        v.leven -= f
        if (v.leven <= 0) {
          vonken.splice(i, 1)
          continue
        }
        const a = v.leven / v.max
        ctx.globalAlpha = uit * Math.min(1, a * 1.4)
        ctx.strokeStyle = v.kleur
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(v.x, v.y)
        ctx.lineTo(v.x - v.vx * 3, v.y - v.vy * 3)
        ctx.stroke()
        // Twinkelen aan het eind
        if (a < 0.35 && (frame + i) % 4 === 0) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(v.x - 1, v.y - 1, 2, 2)
        }
      }

      for (const s of snippers) {
        s.fladder += 0.08 * f
        s.x += (s.vx + Math.sin(s.fladder) * 0.8) * f
        s.y += s.vy * f
        s.hoek += s.draai * f
        if (s.y < -30 || s.y > H + 30) continue
        ctx.globalAlpha = uit
        ctx.fillStyle = s.kleur
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.hoek)
        // Draaien om de lengteas: het snippertje wordt smaller en breder
        ctx.scale(Math.cos(s.fladder * 1.7), 1)
        ctx.fillRect(-s.b / 2, -s.h / 2, s.b, s.h)
        ctx.restore()
      }
      ctx.globalAlpha = 1
      frame++

      if (t < duur) raf = requestAnimationFrame(stap)
      else klaar.current?.()
    }
    let raf = requestAnimationFrame(stap)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', maat)
    }
  }, [duur])

  return <canvas ref={canvas} className="feestregen" aria-hidden="true" />
}
