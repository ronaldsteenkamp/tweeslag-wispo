import { useOpgeslagen } from './opslag'
import { audio, minderBeweging, ruisStoot, toon, tril as radTril } from './radmotor'

/*
 * Geluid en trillen van het Spel ("stempelkaart"): alles gesynthetiseerd met Web Audio, dus geen
 * bestanden en het werkt offline. Eén knop in het Spel zet geluid en trillen samen aan of uit
 * (instelling 'spel.geluid', los van het rad).
 */

export const GELUID_SLEUTEL = 'spel.geluid'

export function useSpelGeluid() {
  return useOpgeslagen<boolean>(GELUID_SLEUTEL, true)
}

export type Klank = 'stempel' | 'pen' | 'papier' | 'scheur' | 'bel' | 'tik' | 'fout'

let laatste = 0

/** Speel een klank. `aan`: de instelling van de geluidknop */
export function klank(soort: Klank, aan: boolean) {
  if (!aan) return
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.01
  // Twee keer dezelfde klank vlak na elkaar (dubbel tikken) klinkt als één
  if (t - laatste < 0.03 && soort === 'tik') return
  laatste = t
  switch (soort) {
    case 'stempel':
      // Doffe bonk van een rubberen stempel op papier
      toon(c, t, 'sine', 120, 48, 0.17, 0.5)
      ruisStoot(c, t, 'lowpass', 700, 0.7, 0.08, 0.45)
      break
    case 'pen':
      // Viltstift die een rondje zet
      ruisStoot(c, t, 'bandpass', 4200, 4, 0.16, 0.12)
      ruisStoot(c, t + 0.06, 'bandpass', 3600, 4, 0.1, 0.08)
      break
    case 'papier':
      ruisStoot(c, t, 'bandpass', 3400, 0.6, 0.12, 0.1)
      break
    case 'scheur':
      // Perforatie die het begeeft: een reeks korte rukjes
      for (let i = 0; i < 14; i++) ruisStoot(c, t + i * 0.024, 'bandpass', 2500 + Math.random() * 2500, 0.8, 0.03, 0.1 + Math.random() * 0.12)
      break
    case 'bel':
      // Koeienbel, twee keer geschud (zelfde bel als het Après-rad)
      for (const [d, s] of [[0, 0.24], [0.22, 0.16]]) {
        const f = c.createBiquadFilter()
        f.type = 'bandpass'
        f.frequency.value = 1350
        f.Q.value = 2.2
        f.connect(c.destination)
        toon(c, t + d, 'square', 412, 0, 0.75, s * 0.5, f)
        toon(c, t + d, 'square', 607, 0, 0.6, s * 0.5, f)
      }
      break
    case 'tik':
      toon(c, t, 'sine', 1500, 0, 0.035, 0.1)
      break
    case 'fout':
      toon(c, t, 'square', 150, 0, 0.16, 0.06)
      break
  }
}

const TRIL: Record<string, number[]> = {
  tik: [8],
  stempel: [28],
  bingo: [20, 40, 20, 40, 70],
  winnaar: [60, 70, 60, 70, 180],
  fout: [40, 30, 40],
}

export function trilSpel(patroon: keyof typeof TRIL, aan: boolean) {
  if (aan) radTril(TRIL[patroon], patroon === 'tik')
}

// Doorlopend krasgeluid zolang een vinger over het kraslot gaat
let kras: { bron: AudioBufferSourceNode; versterk: GainNode } | null = null
export function krasGeluid(aanzetten: boolean, aan: boolean) {
  // Uitzetten moet altijd kunnen, ook als het geluid net uit is gezet
  const c = aanzetten && !aan ? null : audio()
  if (!c) return
  if (aanzetten && !kras) {
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const bron = c.createBufferSource()
    bron.buffer = buf
    bron.loop = true
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 3200
    f.Q.value = 0.9
    const versterk = c.createGain()
    versterk.gain.value = 0.06
    bron.connect(f).connect(versterk).connect(c.destination)
    bron.start()
    kras = { bron, versterk }
  } else if (!aanzetten && kras) {
    kras.versterk.gain.setTargetAtTime(0, c.currentTime, 0.03)
    kras.bron.stop(c.currentTime + 0.15)
    kras = null
  }
}

export { minderBeweging }
