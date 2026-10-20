import { useBackend, type BackendStatus } from '../lib/backend'

const TEKST: Record<BackendStatus, string> = {
  uit: 'Geen verbinding (niet ingesteld)',
  verbinden: 'Verbinden…',
  verbonden: 'Verbonden',
  offline: 'Geen verbinding',
}

/** Klein label met de verbindingsstatus van de gedeelde functies */
export function Verbinding() {
  const { status } = useBackend()
  return (
    <span className={`verbinding verbinding--${status}`} role="status">
      <span className="verbinding__stip" aria-hidden="true" />
      {TEKST[status]}
    </span>
  )
}
