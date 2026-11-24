import { Fragment, type ReactNode } from 'react'

/**
 * "VakanCie" in een tekst die in kapitalen staat: daar valt de grap van de hoofdletter C weg
 * (VAKANCIE). Daarom krijgt "Cie" een eigen kleur (class .cie, zie styles/vakancie.css).
 * Andere tekst blijft zoals hij is.
 */
export function metCie(tekst: string): ReactNode {
  const delen = tekst.split(/(VakanCie)/)
  if (delen.length === 1) return tekst
  return delen.map((d, i) =>
    d === 'VakanCie' ? (
      <Fragment key={i}>
        Vakan<span className="cie">Cie</span>
      </Fragment>
    ) : (
      d
    ),
  )
}
