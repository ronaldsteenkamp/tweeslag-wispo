import '../styles/vakancie.css'
import { metCie } from './VakanCieNaam'

/**
 * Het Tweeslag-logo onderaan Home en Instellingen, als knop naar de pagina over de VakanCie.
 * Ziet eruit als voorheen, met een klein regeltje eronder als hint en een lichte druk-animatie.
 */
export function LogoKnop({ grootte, onKlik }: { grootte: number; onKlik: () => void }) {
  return (
    <button type="button" className="logoknop" onClick={onKlik} aria-label="Over de VakanCie">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={grootte} height={grootte} loading="lazy" />
      <span className="logoknop__hint" aria-hidden="true">
        {/* In één span: de hint is een flexbox, losse stukken zouden uit elkaar staan */}
        <span>{metCie('Over de VakanCie')}</span>
      </span>
    </button>
  )
}
