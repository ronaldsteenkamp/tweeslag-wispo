import { RadOnderdeel } from '../components/Rad'

/** Rad: klos, piste, drankje, eigen rad en het casino. Geeft geen punten en werkt offline. */
export default function Rad() {
  return (
    <div className="scherm">
      <h1>Rad</h1>
      <RadOnderdeel />
    </div>
  )
}
