import { useEffect, useRef, useState } from 'react'
import { useData } from '../lib/data'
import { useInstallatie } from '../lib/installatie'
import { useOpgeslagen } from '../lib/opslag'
import { InstallatieUitleg } from './InstallatieBanner'
import { profielAfVoor, useMijnProfiel } from '../lib/profiel'
import { NaamKiezer, useAlleNamen } from './NaamKiezer'
import { ProfielFormulier } from './Profiel'
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
  const [stap, setStap] = useState<'naam' | 'profiel' | 'installeren'>('naam')
  const profiel = useMijnProfiel()
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
        <h1 id="welkom-titel">
          {stap === 'naam' ? 'Welkom! Wie ben jij?' : stap === 'profiel' ? 'Vertel iets over jezelf' : naam ? `Hoi ${naam}!` : 'Hoi!'}
        </h1>
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
                  // Heeft deze naam al een profiel (bijv. van een andere telefoon), dan meteen door
                  if (profielAfVoor(n)) naNaam()
                  else setStap('profiel')
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
        ) : stap === 'profiel' && profiel ? (
          <>
            <p>
              Zo leren de anderen je een beetje kennen. Druk op iemands naam (bij Kamers of in het klassement) om
              diens profiel te zien.
            </p>
            <ProfielFormulier profiel={profiel} onKlaar={naNaam} />
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
            {platform === 'ios' && (
              <p className="klein">
                Op een iPhone heeft de app op je beginscherm een eigen geheugen, los van Safari. Kies daar je naam dus nog
                één keer. Gebruik daarna die app: Safari vergeet je naam als je de site een week niet opent.
              </p>
            )}
            <button type="button" className="knop knop--secundair knop--breed" onClick={onKlaar}>
              {kanDirectInstalleren ? 'Later' : 'Klaar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
