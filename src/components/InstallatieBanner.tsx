import { useState } from 'react'
import { useInstallatie } from '../lib/installatie'
import { useOpgeslagen } from '../lib/opslag'
import { Icoon } from './Icoon'

const WEEK = 7 * 24 * 60 * 60 * 1000

/** Installatieknop (Android/Chrome) of de stappen voor iPhone en Android */
export function InstallatieUitleg({ direct = false }: { direct?: boolean }) {
  const { platform, kanDirectInstalleren, installeer } = useInstallatie()
  const [uitleg, setUitleg] = useState(direct)

  if (kanDirectInstalleren) {
    return (
      <button type="button" className="knop knop--primair knop--breed" onClick={installeer}>
        Installeren
      </button>
    )
  }
  if (!uitleg) {
    return (
      <button type="button" className="knop knop--primair knop--breed" onClick={() => setUitleg(true)}>
        Hoe doe ik dat?
      </button>
    )
  }
  if (platform === 'ios') {
    return (
      <ol className="stappen">
        <li>
          Tik op de <strong>Deel-knop</strong>{' '}
          <span className="stappen__icoon">
            <Icoon naam="deel" grootte={20} />
          </span>{' '}
          onderaan in Safari (op een iPad bovenaan).
        </li>
        <li>
          Scroll naar beneden en kies <strong>Zet op beginscherm</strong>.
        </li>
        <li>
          Tik rechtsboven op <strong>Voeg toe</strong>.
        </li>
        <li className="klein">Zie je de optie niet? Open deze pagina dan in Safari.</li>
      </ol>
    )
  }
  return (
    <ol className="stappen">
      <li>
        Tik in Chrome rechtsboven op het menu{' '}
        <span className="stappen__icoon">
          <Icoon naam="menu" grootte={20} />
        </span>
        .
      </li>
      <li>
        Kies <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong>.
      </li>
      <li>
        Bevestig met <strong>Installeren</strong>.
      </li>
    </ol>
  )
}

export function InstallatieBanner() {
  const { platform, geinstalleerd, kanDirectInstalleren } = useInstallatie()
  const [verborgenOp, setVerborgenOp] = useOpgeslagen<number>('installatie.verborgen', 0)

  if (geinstalleerd) return null
  if (Date.now() - verborgenOp < WEEK) return null
  if (platform === 'anders' && !kanDirectInstalleren) return null

  return (
    <section className="kaartje installatie" aria-labelledby="installatie-titel">
      <button
        type="button"
        className="installatie__sluit"
        aria-label="Melding verbergen"
        onClick={() => setVerborgenOp(Date.now())}
      >
        <Icoon naam="kruis" />
      </button>
      <h2 id="installatie-titel">📲 Zet de app op je beginscherm</h2>
      <p>Dan opent hij schermvullend en werkt hij ook op de berg zonder bereik.</p>
      <InstallatieUitleg />
    </section>
  )
}
