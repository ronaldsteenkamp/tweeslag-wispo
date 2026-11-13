import { RadOnderdeel } from '../components/Rad'
import { SchermKop } from '../components/SchermKop'
import { useNieuweKoppen } from '../lib/nieuweKoppen'

/** Rad: klos, piste, drankje, eigen rad en het casino. Geeft geen punten en werkt offline. */
export default function Rad() {
  const nieuweKop = useNieuweKoppen()
  return (
    <div className="scherm">
      {nieuweKop ? <SchermKop titel="Rad" ondertitel="Klos, piste, drankje, eigen rad of casino" /> : <h1>Rad</h1>}
      <RadOnderdeel />
    </div>
  )
}
