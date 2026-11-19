import { useEffect, useRef, useState } from 'react'
import { useToonNaam } from '../lib/bijnamen'
import { useData } from '../lib/data'
import { useInstallatie } from '../lib/installatie'
import { useOpgeslagen } from '../lib/opslag'
import { InstallatieUitleg } from './InstallatieBanner'
import { profielBestaatVoor, useMijnProfiel } from '../lib/profiel'
import { NaamKiezer, useAlleNamen } from './NaamKiezer'
import { BijnaamVeld, ProfielFormulier } from './Profiel'
import { Sneeuw } from './Sneeuw'
// Ingebakken in de bundel (?inline), zodat het logo er bij de allereerste keer openen meteen staat
import woordmerk from '../assets/2slag-winter.svg?inline'
import '../styles/barlow.css'
import '../styles/welkom.css'

/**
 * Welkomstscherm bij de allereerste keer openen (bijvoorbeeld via de QR-code):
 * eerst je naam kiezen (je skipas pakken), daarna je plaatje en de app op je beginscherm zetten.
 * Kop zoals Home (donkerblauw, berg met vlag), papier eronder. Opmaak in styles/welkom.css.
 */
export function Welkom({ onKlaar }: { onKlaar: () => void }) {
  const { data, fout } = useData('kamers')
  const namen = useAlleNamen(data)
  const [naam, setNaam] = useOpgeslagen<string | null>('naam', null)
  const { platform, geinstalleerd, kanDirectInstalleren } = useInstallatie()
  const [stap, setStap] = useState<'naam' | 'profiel' | 'installeren'>('naam')
  const profiel = useMijnProfiel()
  const toon = useToonNaam()
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
      <header className="welkom__kop">
        <Sneeuw aantal={8} />
        <img src={woordmerk} alt="Tweeslag" className="welkom__logo" width={86} height={40} />
        <h1 id="welkom-titel">
          {stap === 'naam' ? 'Pak je skipas' : stap === 'profiel' ? 'Maak je plaatje' : naam ? `Hoi ${toon(naam)}` : 'Bijna klaar'}
        </h1>
        {stap === 'naam' && (
          <p className="welkom__zin">Er hangt er een met jouw naam. Daarmee weet de app welke kamer en score bij jou horen.</p>
        )}
        <svg className="welkom__berg" viewBox="0 0 390 120" preserveAspectRatio="none" aria-hidden="true">
          <path className="berg" d="M0 120V96L40 78 70 86 110 52 140 64 175 24 205 40 235 30 262 54 300 70 340 66 390 92V120Z" />
          <path className="schaduw" d="M175 24 205 40 196 74 168 70ZM110 52 140 64 128 86ZM235 30 262 54 246 70Z" />
          <path className="dal" d="M0 120V110C70 100 140 112 210 106S340 98 390 108V120Z" />
          <path d="M175 24V6" stroke="#fff" strokeWidth="1.6" />
          <path className="vlag" d="M175 6l14 5-14 5Z" />
        </svg>
      </header>

      <div className="welkom__inhoud">
        {stap === 'naam' ? (
          <>
            {data ? (
              <NaamKiezer
                skipas
                namen={namen}
                onKies={(n) => {
                  setNaam(n)
                  // Heeft deze naam al een profiel (bijv. van een andere telefoon), dan meteen door
                  if (profielBestaatVoor(n)) naNaam()
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
              Iedereen krijgt een plaatje in het Tweeslag-album. Vul in wat je wilt; de rest kan later, of nooit. Bij
              Kamers zie je de plaatjes van de anderen.
            </p>
            <BijnaamVeld namen={namen} />
            <ProfielFormulier profiel={profiel} onKlaar={naNaam} />
          </>
        ) : (
          <>
            <h2>Zet de app op je beginscherm</h2>
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
