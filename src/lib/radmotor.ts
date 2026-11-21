/*
 * De draai van de raderen (Klos, Piste, Drankje, Eigen), los van React. De uitslag ligt altijd al
 * vast (rad.ts, crypto.getRandomValues); dit is alleen hoe het rad daar naartoe beweegt:
 * - aanloop: even terug vóór de duw
 * - uitrollen: 1 - (1-t)^macht, hoe hoger de macht hoe langer het kruipen aan het eind
 * - nagolf: net voorbij het doel en terugveren (of bij het kompas een paar keer slingeren)
 * - een tik bij elke pin die de wijzer passeert (niet vaker dan ~30 per seconde)
 * Alleen `transform` per beeld, geen React-renders tijdens het draaien.
 */

export const minderBeweging = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export interface DraaiOpties {
  van: number
  naar: number
  /** ms van het uitrollen */
  duur: number
  macht?: number
  /** Graden terug vóór de duw (teken = tegen de draairichting in) */
  aanloop?: number
  /** Graden voorbij het doel (met teken van de draairichting) */
  nagolf?: number
  /** Halve slingeringen na het doel: 1,5 = één keer terug, 3,5 = kompasnaald */
  golven?: number
  demping?: number
  nagolfDuur?: number
  /** Graden tussen twee pinnen; dan volgt onTik bij elke pin */
  vak?: number
  onTik?: (snelheid: number) => void
  onFrame: (hoek: number, snelheid: number) => void
}

/** Draait van `van` naar `naar`; `stop()` breekt af (bijv. weg van het scherm) */
export function draai(o: DraaiOpties): { klaar: Promise<void>; stop: () => void } {
  let frame = 0
  let gestopt = false
  const klaar = new Promise<void>((klaarMet) => {
    const aan = o.aanloop ?? 0
    const na = o.nagolf ?? 0
    const A = aan ? 260 : 0
    const B = o.duur
    const C = na ? (o.nagolfDuur ?? 620) : 0
    const p = o.macht ?? 3
    const golven = o.golven ?? 1.5
    const demping = o.demping ?? 3
    const begin = o.van - aan
    const top = o.naar + na
    const hoekOp = (ms: number) => {
      if (ms < A) return o.van - aan * (0.5 - 0.5 * Math.cos((Math.PI * ms) / A))
      ms -= A
      if (ms < B) return begin + (top - begin) * (1 - Math.pow(1 - ms / B, p))
      ms -= B
      if (ms < C) {
        const u = ms / C
        return o.naar + na * Math.cos(u * Math.PI * golven) * Math.exp(-demping * u)
      }
      return o.naar
    }
    const t0 = performance.now()
    let vorige = o.van
    let vorigeT = t0
    let pinNu = o.vak ? Math.floor(o.van / o.vak) : 0
    let laatsteTik = -1e9
    const stap = (nu: number) => {
      if (gestopt) return
      const ms = nu - t0
      const h = hoekOp(ms)
      const snelheid = (Math.abs(h - vorige) / Math.max(1, nu - vorigeT)) * 1000
      if (o.vak) {
        const pin = Math.floor(h / o.vak)
        if (pin !== pinNu) {
          if (nu - laatsteTik > 32) {
            o.onTik?.(snelheid)
            laatsteTik = nu
          }
          pinNu = pin
        }
      }
      vorige = h
      vorigeT = nu
      if (ms < A + B + C) {
        o.onFrame(h, snelheid)
        frame = requestAnimationFrame(stap)
      } else {
        o.onFrame(o.naar, 0)
        klaarMet()
      }
    }
    frame = requestAnimationFrame(stap)
  })
  return {
    klaar,
    stop: () => {
      gestopt = true
      cancelAnimationFrame(frame)
    },
  }
}

// ---------- Geluid: per materiaal een eigen tik en een eigen uitslag (Web Audio, geen bestanden) ----------

export type Materiaal = 'metaal' | 'klep' | 'hout' | 'kompas'

let ctx: AudioContext | null = null
let ruis: AudioBuffer | null = null

export function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    if (!ruis) {
      ruis = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate)
      const d = ruis.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    return ctx
  } catch {
    return null
  }
}

export function ruisStoot(c: AudioContext, t: number, type: BiquadFilterType, freq: number, q: number, duur: number, sterkte: number) {
  const s = c.createBufferSource()
  s.buffer = ruis
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(sterkte, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
  s.connect(f).connect(g).connect(c.destination)
  s.start(t, Math.random() * 0.4)
  s.stop(t + duur + 0.02)
}

export function toon(c: AudioContext, t: number, vorm: OscillatorType, freq: number, eind: number, duur: number, sterkte: number, filter?: AudioNode) {
  const o = c.createOscillator()
  o.type = vorm
  o.frequency.setValueAtTime(freq, t)
  if (eind) o.frequency.exponentialRampToValueAtTime(eind, t + duur * 0.6)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(sterkte, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur)
  o.connect(g).connect(filter ?? c.destination)
  o.start(t)
  o.stop(t + duur + 0.02)
}

/** Eén tik langs een pin; snel = zachter (de tikken lopen in elkaar over) */
export function tik(materiaal: Materiaal, snelheid: number) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  const s = 0.55 + 0.45 * (1 - Math.min(1, snelheid / 1400))
  if (materiaal === 'metaal') {
    // Rubberen slalomvlag tegen een stalen klinknagel
    ruisStoot(c, t, 'highpass', 2600, 0.7, 0.018, 0.22 * s)
    toon(c, t, 'sine', 3150, 0, 0.035, 0.05 * s)
  } else if (materiaal === 'klep') {
    // Een bordje van de trommel dat langs de tong klapt
    ruisStoot(c, t, 'bandpass', 1900, 2.2, 0.02, 0.5 * s)
    ruisStoot(c, t + 0.011, 'bandpass', 1100, 2, 0.025, 0.28 * s)
  } else if (materiaal === 'hout') {
    // Skipunt tegen een houten pen: een doffe tok
    toon(c, t, 'triangle', 820, 430, 0.05, 0.28 * s)
    ruisStoot(c, t, 'lowpass', 1600, 0.8, 0.02, 0.18 * s)
  } else {
    // Klikring van een kompas: zacht en precies
    toon(c, t, 'sine', 4200, 0, 0.018, 0.06 * s)
    ruisStoot(c, t, 'bandpass', 5200, 3, 0.01, 0.12 * s)
  }
}

/** Het geluid bij de uitslag */
export function uitslagGeluid(materiaal: Materiaal) {
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.02
  if (materiaal === 'metaal') {
    // Belletje van het liftstation
    ruisStoot(c, t, 'highpass', 5000, 0.7, 0.01, 0.12)
    toon(c, t, 'sine', 1568, 0, 1.6, 0.16)
    toon(c, t, 'sine', 3925, 0, 0.7, 0.05)
    toon(c, t, 'sine', 5880, 0, 0.35, 0.025)
  } else if (materiaal === 'klep') {
    // Ding-dong van de omroep
    for (const [f, d] of [[659.3, 0], [523.3, 0.42]]) {
      toon(c, t + d, 'sine', f, 0, 1.4, 0.18)
      toon(c, t + d, 'sine', f * 2.01, 0, 0.5, 0.04)
    }
  } else if (materiaal === 'hout') {
    // Koeienbel, drie keer geschud
    for (const [d, sterkte] of [[0, 0.24], [0.2, 0.17], [0.37, 0.12]]) {
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 1350
      f.Q.value = 2.2
      f.connect(c.destination)
      toon(c, t + d, 'square', 412, 0, 0.75, sterkte * 0.5, f)
      toon(c, t + d, 'square', 607, 0, 0.6, sterkte * 0.5, f)
    }
  } else {
    // Koers gevonden: twee tonen omhoog
    for (const [f, d] of [[784, 0], [1175, 0.13]]) {
      toon(c, t + d, 'sine', f, 0, 0.9, 0.14)
      toon(c, t + d, 'triangle', f * 2, 0, 0.25, 0.025)
    }
  }
}

let laatsteTril = 0
/** Trillen (Android; een iPhone ondersteunt dit niet). `kort`: tikken niet laten versmelten tot een zoem */
export function tril(patroon: number | number[], kort = false) {
  try {
    if (!navigator.vibrate) return
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
    const nu = performance.now()
    if (kort && nu - laatsteTril < 70) return
    laatsteTril = nu
    navigator.vibrate(patroon)
  } catch {
    // Niet toegestaan of niet ondersteund
  }
}

// ---------- Vegen ----------

/**
 * Het rad volgt de vinger; loslaten met vaart roept onLos(snelheid in °/s) aan.
 * hoekVan(e): de hoek van de vinger (rond het midden, of langs de trommel). Geeft een opruimfunctie.
 */
export function koppelVegen(
  el: HTMLElement,
  o: {
    hoekVan: (e: PointerEvent) => number
    onSleep: (delta: number) => void
    onLos: (snelheid: number) => void
    uit: () => boolean
    /** Vinger neer (bijv. een lopend terugklikken stoppen, anders vecht dat met de vinger) */
    onNeer?: () => void
  },
) {
  let actief = false
  let laatste = 0
  let som = 0
  let monsters: { t: number; h: number }[] = []
  // Alleen de eerste vinger telt (een tweede vinger liet het rad springen of halverwege stoppen)
  let vinger = -1
  const neer = (e: PointerEvent) => {
    if (o.uit() || actief) return
    o.onNeer?.()
    actief = true
    vinger = e.pointerId
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Vinger al weg
    }
    laatste = o.hoekVan(e)
    som = 0
    monsters = [{ t: e.timeStamp, h: 0 }]
  }
  const beweeg = (e: PointerEvent) => {
    if (!actief || e.pointerId !== vinger) return
    const h = o.hoekVan(e)
    let d = h - laatste
    if (d > 180) d -= 360
    if (d < -180) d += 360
    laatste = h
    som += d
    monsters.push({ t: e.timeStamp, h: som })
    while (monsters.length > 2 && e.timeStamp - monsters[0].t > 110) monsters.shift()
    o.onSleep(d)
  }
  const los = (e: PointerEvent) => {
    if (!actief || e.pointerId !== vinger) return
    actief = false
    const a = monsters[0]
    const b = monsters[monsters.length - 1]
    const dt = (b.t - a.t) / 1000
    o.onLos(dt > 0.01 && e.timeStamp - b.t < 90 ? (b.h - a.h) / dt : 0)
  }
  // Safari op de iPhone houdt zich niet altijd aan touch-action: none (zeker niet op de 3D-gedraaide
  // bordjes van de trommel). Bij rustig slepen nam hij het gebaar dan over als scrollen, met een
  // pointercancel: het rad bleef staan. Zolang de vinger het rad vasthoudt, mag de pagina niet bewegen.
  const geenScroll = (e: TouchEvent) => {
    if (actief && e.cancelable) e.preventDefault()
  }
  el.addEventListener('touchmove', geenScroll, { passive: false })
  el.addEventListener('pointerdown', neer)
  el.addEventListener('pointermove', beweeg)
  el.addEventListener('pointerup', los)
  el.addEventListener('pointercancel', los)
  el.addEventListener('lostpointercapture', los)
  return () => {
    el.removeEventListener('touchmove', geenScroll)
    el.removeEventListener('lostpointercapture', los)
    el.removeEventListener('pointerdown', neer)
    el.removeEventListener('pointermove', beweeg)
    el.removeEventListener('pointerup', los)
    el.removeEventListener('pointercancel', los)
  }
}

/** Hoek van de vinger rond het midden van een element (graden, met de klok mee) */
export function hoekRondMidden(el: HTMLElement, e: PointerEvent) {
  const r = el.getBoundingClientRect()
  return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
}

// ---------- Tekst in een taartpunt ----------

/**
 * Radiale tekst passend maken: eerst over twee regels (als dat mag), dan kleiner (tot data-min),
 * dan afkappen met … De volledige tekst staat altijd in de uitslag. De <text>-elementen worden
 * leeg door React getekend en hier gevuld (React raakt de inhoud dus niet aan).
 */
export function pasTekst(wortel: Element) {
  wortel.querySelectorAll<SVGTextElement>('text[data-ruimte]').forEach((t) => {
    const ruimte = Number(t.dataset.ruimte)
    const vol = t.dataset.vol ?? ''
    const min = Number(t.dataset.min)
    const maat = Number(t.dataset.maat)
    t.setAttribute('font-size', String(maat))
    t.textContent = vol
    let len = t.getComputedTextLength()
    if (len > ruimte && t.dataset.tweeregels && vol.includes(' ')) {
      const woorden = vol.split(' ')
      let beste = 1
      let verschil = Infinity
      for (let k = 1; k < woorden.length; k++) {
        const d = Math.abs(woorden.slice(0, k).join(' ').length - woorden.slice(k).join(' ').length)
        if (d < verschil) {
          verschil = d
          beste = k
        }
      }
      const x = t.getAttribute('x') ?? '0'
      t.textContent = ''
      const regels = [woorden.slice(0, beste).join(' '), woorden.slice(beste).join(' ')].map((r, k) => {
        const ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
        ts.setAttribute('x', x)
        ts.setAttribute('dy', k ? '1.08em' : '-0.54em')
        ts.textContent = r
        t.append(ts)
        return ts
      })
      const l = Math.max(...regels.map((r) => r.getComputedTextLength()))
      if (l > ruimte) t.setAttribute('font-size', Math.max(min, (maat * ruimte) / l).toFixed(2))
      for (const r of regels) {
        let s = r.textContent ?? ''
        while (r.getComputedTextLength() > ruimte && s.length > 2) {
          s = s.slice(0, -1)
          r.textContent = `${s.trimEnd()}…`
        }
      }
      return
    }
    if (len > ruimte) {
      t.setAttribute('font-size', Math.max(min, (maat * ruimte) / len).toFixed(2))
      len = t.getComputedTextLength()
    }
    let s = vol
    while (len > ruimte && s.length > 2) {
      s = s.slice(0, -1)
      t.textContent = `${s.trimEnd()}…`
      len = t.getComputedTextLength()
    }
  })
}

/** Lettergrootte en beschikbare lengte voor radiale tekst (rad met straal 100, tekst eindigt op `buiten`) */
export function radialeTekst(n: number, buiten: number, naaf: number) {
  const letter = n <= 4 ? 13 : n <= 8 ? 11.5 : n <= 12 ? 9.5 : n <= 18 ? 7.6 : n <= 26 ? 6.4 : 5.4
  const binnen = Math.max(naaf + 5, (letter * 1.2 * n) / (2 * Math.PI))
  return { letter, ruimte: buiten - binnen }
}

/** Kleurindex per vak (k kleuren), twee buren nooit gelijk, ook het laatste en het eerste */
export function kleurVolgorde(n: number, k: number) {
  const a = Array.from({ length: n }, (_, i) => i % k)
  if (n > 2 && a[n - 1] === a[0]) {
    for (let c = 0; c < k; c++) {
      if (c !== a[0] && c !== a[n - 2]) {
        a[n - 1] = c
        break
      }
    }
  }
  return a
}
