import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  titel: string
  tekst?: string
  bevestigLabel: string
  annuleerLabel?: string
  gevaarlijk?: boolean
  onBevestig: () => void
  onAnnuleer: () => void
}

/** Bevestiging binnen de app zelf (geen browser-alert) */
export function BevestigDialoog({
  open,
  titel,
  tekst,
  bevestigLabel,
  annuleerLabel = 'Annuleren',
  gevaarlijk,
  onBevestig,
  onAnnuleer,
}: Props) {
  const annuleerKnop = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    annuleerKnop.current?.focus()
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && onAnnuleer()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [open, onAnnuleer])

  if (!open) return null
  return (
    <div className="dialoog-achtergrond" onClick={onAnnuleer}>
      <div
        className="dialoog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialoog-titel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialoog-titel">{titel}</h2>
        {tekst && <p>{tekst}</p>}
        <div className="dialoog__knoppen">
          <button ref={annuleerKnop} type="button" className="knop knop--secundair" onClick={onAnnuleer}>
            {annuleerLabel}
          </button>
          <button
            type="button"
            className={`knop ${gevaarlijk ? 'knop--gevaar' : 'knop--primair'}`}
            onClick={onBevestig}
          >
            {bevestigLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
