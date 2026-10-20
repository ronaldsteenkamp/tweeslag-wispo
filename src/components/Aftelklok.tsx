import { resterend } from '../lib/tijd'

export function Aftelklok({ doel, nu }: { doel: Date; nu: Date }) {
  const r = resterend(doel.getTime() - nu.getTime())
  const blokken = [
    { waarde: r.dagen, label: r.dagen === 1 ? 'dag' : 'dagen' },
    { waarde: r.uren, label: 'uur' },
    { waarde: r.minuten, label: 'min' },
    { waarde: r.seconden, label: 'sec' },
  ]
  return (
    <div className="aftelklok" role="timer" aria-label={`Nog ${r.dagen} dagen, ${r.uren} uur en ${r.minuten} minuten`}>
      {blokken.map((b) => (
        <div className="aftelklok__blok" key={b.label}>
          <span className="aftelklok__getal">{String(b.waarde).padStart(2, '0')}</span>
          <span className="aftelklok__label">{b.label}</span>
        </div>
      ))}
    </div>
  )
}
