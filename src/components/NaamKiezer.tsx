import { useMemo, useRef, useState } from 'react'
import { useToonNaam } from '../lib/bijnamen'
import { alleDeelnemers, type Kamers } from '../lib/data'
import { Icoon } from './Icoon'

/** Kleine letters en zonder accenten, zodat 'esmee' ook 'Esmée' vindt */
export const normaal = (s: string) => s.toLocaleLowerCase('nl').normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Alle deelnemers uit kamers.json (ook wie nog geen kamer heeft), op alfabet */
export function useAlleNamen(kamers?: Kamers) {
  return useMemo(() => alleDeelnemers(kamers).sort((a, b) => a.localeCompare(b, 'nl')), [kamers])
}

/** Raster met grote naamknoppen en een zoekveld */
export function NaamKiezer({ namen, onKies }: { namen: string[]; onKies: (n: string) => void }) {
  const [zoek, setZoek] = useState('')
  // Aan het zoeken: het zoekveld staat bovenaan en de lijst houdt zijn hoogte, zodat de pagina
  // niet korter wordt bij elke letter (anders schuift alles naar beneden, achter het toetsenbord)
  const [zoekend, setZoekend] = useState(false)
  const veld = useRef<HTMLDivElement>(null)
  const toon = useToonNaam()
  const q = normaal(zoek)
  const lijst = q ? namen.filter((n) => normaal(n).includes(q) || normaal(toon(n)).includes(q)) : namen

  const naarBoven = () => {
    setZoekend(true)
    // Na het openen van het toetsenbord (dat schuift zelf ook nog)
    window.setTimeout(() => veld.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250)
  }

  return (
    <>
      {namen.length > 8 && (
        <div className="zoekveld zoekveld--naam" ref={veld}>
          <Icoon naam="zoek" />
          <label className="verborgen" htmlFor="zoek-naam">
            Zoek je naam
          </label>
          <input
            id="zoek-naam"
            type="search"
            className="invoer"
            placeholder="Zoek je naam"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            onFocus={naarBoven}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      )}
      <div className={`namenraster${zoekend ? ' namenraster--zoekend' : ''}`}>
        {lijst.map((n) => (
          <button key={n} type="button" className="knop knop--naam" onClick={() => onKies(n)}>
            {n}
            {/* Hier de echte naam (je kiest wie je bent), met de bijnaam erbij */}
            {toon(n) !== n && <small className="knop__bijnaam">{toon(n)}</small>}
          </button>
        ))}
      </div>
      {lijst.length === 0 && <p className="laadtekst">Geen naam gevonden. Vraag de reisleiding om je toe te voegen.</p>}
    </>
  )
}
