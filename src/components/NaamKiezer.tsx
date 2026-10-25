import { useMemo, useState } from 'react'
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
  const q = normaal(zoek)
  const lijst = q ? namen.filter((n) => normaal(n).includes(q)) : namen
  return (
    <>
      {namen.length > 8 && (
        <div className="zoekveld">
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
            autoComplete="off"
          />
        </div>
      )}
      <div className="namenraster">
        {lijst.map((n) => (
          <button key={n} type="button" className="knop knop--naam" onClick={() => onKies(n)}>
            {n}
          </button>
        ))}
      </div>
      {lijst.length === 0 && <p className="laadtekst">Geen naam gevonden. Vraag de reisleiding om je toe te voegen.</p>}
    </>
  )
}
