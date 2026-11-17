import { useEffect, useRef, useState } from 'react'
import type { PisteKleur } from '../../lib/data'

/*
 * Wat de vier raderen delen: Klos (Après-rad), Drankje (Pisteboord), Piste (Liftbord) en Eigen
 * (Kompas). Rad.tsx bepaalt de inhoud en de tekst van de uitslag; elk rad tekent zichzelf, draait
 * en onthult de uitslag op zijn eigen manier. Opmaak in styles/rad.css.
 */

export interface Optie {
  waarde: string
  /** Wat er in beeld komt, als dat anders is dan de waarde (bijv. een bijnaam) */
  tekst?: string
  kleur?: PisteKleur
}

export interface RadUitslag {
  /** Kleine regel boven de uitslag, bijv. "De klos van de avond" */
  label: string
  tekst: string
  /** Opdracht of ondertitel */
  zin?: string
  /** Volledige zin voor schermlezers */
  live: string
  /** Onder de knop na de uitslag, bijv. "Sten mag nu draaien" */
  volgende?: string
}

export interface MachineProps {
  opties: Optie[]
  /** Welk vak wint (eerlijk getrokken; Rad.tsx doet hier ook het Menno-grapje) */
  kies: (lijst: Optie[]) => number
  uitslag: (o: Optie) => RadUitslag
  naUitslag?: (o: Optie) => void
  geluid: boolean
  zetGeluid: (aan: boolean) => void
  onBezig: (bezig: boolean) => void
  /** Tekst als er minder dan twee vakken zijn */
  tekort: string
}

export const tekstVan = (o: Optie) => o.tekst ?? o.waarde
export const rond = (g: number) => ((g % 360) + 360) % 360

/**
 * De lijst waarmee gedraaid wordt blijft staan tot de uitslag er is (ook als er intussen iets
 * verandert), daarna volgt hij de instellingen weer. Ook de uitslag en "bezig" staan hier.
 */
export function useMachine(p: MachineProps) {
  const [lijst, setLijst] = useState(p.opties)
  const [bezig, setBezigStaat] = useState(false)
  const [uitslag, setUitslag] = useState<{ i: number; u: RadUitslag } | null>(null)
  const bezigRef = useRef(false)
  const props = useRef(p)
  props.current = p

  useEffect(() => {
    if (bezigRef.current) return
    setLijst(p.opties)
    setUitslag(null)
  }, [p.opties])

  // Weg van dit rad terwijl het draait: dan mag er weer van rad gewisseld worden
  useEffect(() => () => props.current.onBezig(false), [])

  const zetBezig = (b: boolean) => {
    bezigRef.current = b
    setBezigStaat(b)
    props.current.onBezig(b)
  }
  return { lijst, bezig, bezigRef, zetBezig, uitslag, setUitslag, props }
}

/** Geluid en trillen aan/uit (zelfde instelling voor alle raderen en het casino) */
export function GeluidKnop({ aan, zet, className }: { aan: boolean; zet: (aan: boolean) => void; className: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => zet(!aan)}
      aria-pressed={aan}
      aria-label="Geluid en trillen"
      title={aan ? 'Geluid en trillen aan' : 'Geluid en trillen uit'}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {aan ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
      </svg>
    </button>
  )
}
