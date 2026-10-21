import { useEffect, useRef, useState } from 'react'
import { useData } from '../lib/data'
import { useInstallatie } from '../lib/installatie'
import { useOpgeslagen } from '../lib/opslag'
import { InstallatieUitleg } from './InstallatieBanner'
import { NaamKiezer, useAlleNamen } from './NaamKiezer'
import { Sneeuw } from './Sneeuw'

/**
 * Welkomstscherm bij de allereerste keer openen (bijvoorbeeld via de QR-code):
 * eerst je naam kiezen, daarna de app op je beginscherm zetten.
 */
export function Welkom({ onKlaar }: { onKlaar: () => void }) {
  const { data, fout } = useData('kamers')
  const namen = useAlleNamen(data)
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const { platform, geinstalleerd, kanDirectInstalleren } = useInstallatie()
  const [stap, setStap] = useState<'naam' | 'installeren'>('naam')
  const vak = useRef<HTMLDivElement>(null)

  // Installeren heeft alleen zin als de app nog niet op het beginscherm staat
  const kanInstalleren = !geinstalleerd && (platform !== 'anders' || kanDirectInstalleren)

  useEffect(() => {
    vak.current?.scrollTo(0, 0)
  }, [stap])

  // Is de app intussen geïnstalleerd (Android), dan zijn we klaar
  useEffect(() => {
    if (stap === 'installeren' && geinstalleerd) onKlaar()
  }, [stap, geinstalleerd, onKlaar])

  const naNaam = () => (kanInstalleren ? setStap('installeren') : onKlaar())

  return (
    <div className="welkom" role="dialog" aria-modal="true" aria-labelledby="welkom-titel" ref={vak}>
      <header className="welkom__kop golf">
        <Sneeuw aantal={20} />
        <img src={`${import.meta.env.BASE_URL}img/2slag-wit.svg`} alt="Tweeslag" className="welkom__logo" />
        <p className="welkom__onder">Wispo 2027 · Les Deux Alpes</p>
        <h1 id="welkom-titel">{stap === 'naam' ? 'Welkom! Wie ben jij?' : naam ? `Hoi ${naam}!` : 'Hoi!'}</h1>
      </header>

      <div className="welkom__inhoud">
        {stap === 'naam' ? (
          <>
            <p>Kies je naam. Dan zie je meteen je kamer en staat je naam bij je spelscore.</p>
            {data ? (
              <NaamKiezer
                namen={namen}
                onKies={(n) => {
                  setNaam(n)
                  naNaam()
                }}
              />
            ) : (
              <p className="laadtekst">
                {fout ? 'De namenlijst kon niet geladen worden. Je kunt je naam later kiezen bij Kamers.' : 'Even laden…'}
              </p>
            )}
            <button type="button" className="tekstknop welkom__later" onClick={naNaam}>
              Sla over, ik kies later
            </button>
          </>
        ) : (
          <>
            <h2>📲 Zet de app op je beginscherm</h2>
            <p>
              Dan staat hij tussen je andere apps, opent hij schermvullend en werkt hij ook op de berg zonder bereik.
            </p>
            <div className="kaartje installatie">
              <InstallatieUitleg direct />
            </div>
            <button type="button" className="knop knop--secundair knop--breed" onClick={onKlaar}>
              {kanDirectInstalleren ? 'Later' : 'Klaar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
