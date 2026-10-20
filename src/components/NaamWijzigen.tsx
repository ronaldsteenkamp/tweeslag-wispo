import { useEffect } from 'react'
import { useData } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'
import { NaamKiezer, useAlleNamen } from './NaamKiezer'

/** Venster om (opnieuw) je naam te kiezen, bijvoorbeeld als je per ongeluk de verkeerde koos */
export function NaamWijzigen({ open, onSluit }: { open: boolean; onSluit: () => void }) {
  const { data, fout } = useData('kamers')
  const namen = useAlleNamen(data)
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)

  useEffect(() => {
    if (!open) return
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && onSluit()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [open, onSluit])

  if (!open) return null
  return (
    <div className="dialoog-achtergrond" onClick={onSluit}>
      <div
        className="dialoog dialoog--hoog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="naam-wijzigen-titel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="naam-wijzigen-titel">Wie ben jij?</h2>
        <p>{naam ? `Nu gekozen: ${naam}. Tik op je eigen naam.` : 'Tik op je naam.'}</p>
        {data ? (
          <NaamKiezer
            namen={namen}
            onKies={(n) => {
              setNaam(n)
              onSluit()
            }}
          />
        ) : (
          <p className="laadtekst">{fout ? 'De namenlijst kon niet geladen worden.' : 'Even laden…'}</p>
        )}
        <button type="button" className="knop knop--secundair knop--breed" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </div>
  )
}
