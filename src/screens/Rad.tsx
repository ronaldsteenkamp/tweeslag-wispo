import { RadOnderdeel } from '../components/Rad'
import { SchermKop } from '../components/SchermKop'
import { useNieuweKoppen } from '../lib/nieuweKoppen'

/** Rad: klos, piste, drankje, eigen rad en het casino. Geeft geen punten en werkt offline. */
export default function Rad() {
  const nieuweKop = useNieuweKoppen()
  return (
    <div className="scherm">
      {nieuweKop ? (
        // De keuze van het rad staat in de kop, zodat het rad zelf hoger op het scherm komt
        <RadOnderdeel
          kop={(keuzebalk) => (
            <SchermKop titel="Rad">{keuzebalk && <div className="schermkop__keuze">{keuzebalk}</div>}</SchermKop>
          )}
        />
      ) : (
        <>
          <h1>Rad</h1>
          <RadOnderdeel />
        </>
      )}
    </div>
  )
}
