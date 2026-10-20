import type { DataFout } from '../lib/data'

/** Laat zien dat data laadt, of waarom het niet lukt */
export function DataStatus({ fout }: { fout?: DataFout }) {
  if (!fout) return <p className="laadtekst">Even laden…</p>
  if (fout.soort === 'json') {
    return (
      <div className="kaartje melding melding--fout" role="alert">
        <strong>Er zit een fout in {fout.bestand}.json</strong>
        <p>Controleer komma's, aanhalingstekens en haakjes. Tip: plak de inhoud in jsonlint.com.</p>
        <p className="klein">{fout.message}</p>
      </div>
    )
  }
  return (
    <div className="kaartje melding" role="status">
      <strong>Geen verbinding</strong>
      <p>Deze gegevens zijn nog niet op je telefoon bewaard. Open de app één keer met internet, daarna werkt hij ook offline.</p>
    </div>
  )
}
