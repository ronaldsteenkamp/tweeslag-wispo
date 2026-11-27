import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PANORAMA as P } from '../lib/bergen-bijgestuurd'
import { isDruk } from '../lib/druk'
import { lees, schrijf } from '../lib/opslag'
import '../styles/update.css'

/*
 * Meldt dat er een nieuwe versie is ("Verse sneeuw", ontwerp: mockups/vernieuwen-a.html), of dat de
 * app offline klaarstaat.
 *
 * - Verschijnt niet midden in iets: niet terwijl een rad draait of het casino rolt (lib/druk.ts) en
 *   niet boven een open dialoog of blad. Dan wacht hij tot dat even klaar is.
 * - Later kan altijd. Dan komt hij klein terug: bij de volgende keer openen of na een half uur.
 * - 'Wat is er nieuw' komt uit public/data/nieuw.json (zie README). Fout of geen bestand: blokje weg.
 * - De animatie speelt één keer (alleen transform en opacity); bij minder beweging of Zuinig staat
 *   meteen de eindstand (app.css zet de duur dan op bijna 0).
 */

const LATER = 'update.later'
const NIEUW_GEZIEN = 'update.nieuwGezien'
/** Na Later komt het knopje terug na deze tijd (of eerder, bij het opnieuw openen) */
const TERUG_NA = 30 * 60 * 1000
/** Hoe lang 'Later' telt bij het opnieuw starten van de app: daarna weer de grote melding */
const LATER_GELDT = 24 * 60 * 60 * 1000

type Stand = 'groot' | 'klein' | 'weg' | 'bezig'

interface Nieuw {
  versie?: string
  regels: string[]
}

/** public/data/nieuw.json lezen; alles wat niet klopt telt als 'geen nieuws' */
async function haalNieuw(): Promise<Nieuw | null> {
  try {
    const antwoord = await fetch(`${import.meta.env.BASE_URL}data/nieuw.json`, { cache: 'no-store' })
    if (!antwoord.ok) return null
    const data: unknown = await antwoord.json()
    if (!data || typeof data !== 'object') return null
    const { versie, regels } = data as { versie?: unknown; regels?: unknown }
    if (!Array.isArray(regels)) return null
    const schoon = regels
      .filter((r): r is string => typeof r === 'string')
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, 3)
    if (!schoon.length) return null
    const v = typeof versie === 'string' || typeof versie === 'number' ? String(versie) : undefined
    // Dit nieuws heb je al gezien bij een vorige update (nieuw.json is niet bijgewerkt)
    if (v && lees<string | null>(NIEUW_GEZIEN, null) === v) return null
    return { versie: v, regels: schoon }
  } catch {
    return null
  }
}

/** Staat er een dialoog of blad open (niet in het buurscherm dat bij het vegen klaarligt)? */
function dialoogOpen() {
  for (const el of document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open], .dialoog-achtergrond'))
    if (!el.closest('.buurpaneel, [inert]')) return true
  return false
}

export function UpdateMelding() {
  const {
    offlineReady: [offlineKlaar, setOfflineKlaar],
    needRefresh: [nieuweVersie, setNieuweVersie],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registratie) {
      if (!registratie) return
      // Elk uur kijken of er een nieuwe versie van de app is
      window.setInterval(() => {
        if (navigator.onLine) registratie.update().catch(() => {})
      }, 60 * 60 * 1000)
    },
  })

  // Eerder vandaag al Later gezegd? Dan bij het opstarten meteen het kleine knopje
  const [stand, setStand] = useState<Stand>(() =>
    Date.now() - lees<number>(LATER, 0) < LATER_GELDT ? 'klein' : 'groot',
  )
  const [mag, setMag] = useState(false)
  const [nieuw, setNieuw] = useState<Nieuw | null>(null)

  // Wachten tot de app rustig is: twee keer achter elkaar niets bezig (zo zie je ook de uitslag nog)
  useEffect(() => {
    if (!nieuweVersie || mag) return
    let rustig = 0
    const kijk = () => {
      rustig = isDruk() || dialoogOpen() ? 0 : rustig + 1
      if (rustig >= 2) setMag(true)
    }
    const id = window.setInterval(kijk, 800)
    return () => window.clearInterval(id)
  }, [nieuweVersie, mag])

  useEffect(() => {
    if (!nieuweVersie) return
    let weg = false
    haalNieuw().then((n) => !weg && setNieuw(n))
    return () => {
      weg = true
    }
  }, [nieuweVersie])

  // Na Later: terug als klein knopje, na een half uur of zodra je de app weer opent
  useEffect(() => {
    if (stand !== 'weg') return
    const terug = () => {
      setStand('klein')
      setNieuweVersie(true)
    }
    const id = window.setTimeout(terug, TERUG_NA)
    const zichtbaar = () => document.visibilityState === 'visible' && terug()
    document.addEventListener('visibilitychange', zichtbaar)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('visibilitychange', zichtbaar)
    }
  }, [stand, setNieuweVersie])

  useEffect(() => {
    if (!offlineKlaar) return
    const id = window.setTimeout(() => setOfflineKlaar(false), 5000)
    return () => window.clearTimeout(id)
  }, [offlineKlaar, setOfflineKlaar])

  // Lukt het herladen niet (bijv. de nieuwe versie neemt het niet over), dan na 6 s toch herladen
  const reserve = useRef(0)
  useEffect(() => () => window.clearTimeout(reserve.current), [])

  const later = () => {
    schrijf(LATER, Date.now())
    setStand('weg')
    setNieuweVersie(false)
  }
  const vernieuw = () => {
    setStand('bezig')
    schrijf(LATER, 0)
    if (nieuw?.versie) schrijf(NIEUW_GEZIEN, nieuw.versie)
    // Workbox herlaadt zelf alleen als deze pagina bij het openen al door een service worker beheerd
    // werd; bij de allereerste keer openen niet. Daarom ook zelf: zodra de nieuwe versie het overneemt.
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    updateServiceWorker(true).catch(() => window.location.reload())
    reserve.current = window.setTimeout(() => window.location.reload(), 6000)
  }

  if (nieuweVersie && (mag || stand === 'bezig') && stand !== 'weg') {
    if (stand === 'klein')
      return (
        <div className="vm-plek" role="status">
          <button type="button" className="vm-terug" onClick={() => setStand('groot')} aria-label="Nieuwe versie klaar: verse piste openen">
            <span className="vm-terug__plaatje" aria-hidden="true">
              <svg viewBox="0 0 38 38">
                <path className="vm-piste" d="M0 25C10 23 26 24 38 22V38H0Z" />
                <path className="vm-ribbel" strokeWidth=".8" d="M0 28.5H38M0 30.5H38M0 32.5H38" />
                <g transform="translate(9 0)">
                  <g className="vm-rijder vm-rijder--mini">
                    <rect className="vm-dek" x="20" y="27" width="30" height="7" />
                    <rect className="vm-rups" x="1" y="27.5" width="18" height="5" rx="2.5" />
                    <rect className="vm-romp" x="2" y="22" width="16" height="6" rx="1" />
                    <path className="vm-romp" d="M8 22V16.5H14L17 22Z" />
                    <path className="vm-raam" d="M9.5 21V18H13.5L15 21Z" />
                    <path className="vm-schild" d="M18 25 21 24 22.5 33H18Z" />
                    <rect className="vm-zwaai" x="10" y="15" width="2.6" height="1.6" />
                  </g>
                </g>
              </svg>
            </span>
            Verse piste
            <span className="vm-terug__stip" aria-hidden="true" />
          </button>
        </div>
      )

    const bezig = stand === 'bezig'
    return (
      <div className={`vm${bezig ? ' vm--bezig' : ''}`} role="status" aria-live="polite" aria-busy={bezig || undefined}>
        <div className="vm__tekening" aria-hidden="true">
          <Pistetekening key={stand} bezig={bezig} />
        </div>
        {bezig ? (
          <div className="vm__binnen">
            <p className="vm__boven">Even geduld</p>
            <p className="vm__kop">De piste wordt geprepareerd</p>
            <Bewaard tekst="Je vinkjes, score en plaatje rijden mee." />
          </div>
        ) : (
          <div className="vm__binnen">
            <div>
              <p className="vm__boven">Nieuwe versie</p>
              <p className="vm__kop">Er ligt verse sneeuw</p>
            </div>
            {nieuw && (
              <div className="vm__nieuw">
                <p className="vm__nieuw-kop">Wat is er nieuw</p>
                <ul>
                  {nieuw.regels.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <Bewaard tekst="Je vinkjes, score en plaatje blijven gewoon liggen." />
            <div className="vm__knoppen">
              <button type="button" className="vm-knop vm-knop--later" onClick={later}>
                Later
              </button>
              <button type="button" className="vm-knop vm-knop--ga" onClick={vernieuw}>
                Naar de verse piste
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
  if (offlineKlaar) {
    return (
      <div className="vm-plek" role="status">
        <p className="vm-terug vm-terug--offline">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19.5 7" />
          </svg>
          Wispo werkt nu ook zonder bereik
        </p>
      </div>
    )
  }
  return null
}

function Bewaard({ tekst }: { tekst: string }) {
  return (
    <p className="vm__bewaard">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5 10 17.5 19.5 7" />
      </svg>
      {tekst}
    </p>
  )
}

/** Het panorama rond La Meije, de piste met ribbels en de pistebully */
function Pistetekening({ bezig }: { bezig: boolean }) {
  const h = bezig ? 150 : 104
  // de piste ligt bij 'bezig' 24 px lager: dan passen er twee banen op
  const dy = bezig ? 24 : 0
  return (
    <>
      <svg className="vm-pan" viewBox="400 20 560 185" preserveAspectRatio="xMidYMax slice">
        {P.lagen.map((laag, i) => (
          <g key={i}>
            <path className={`vm-l${i}`} d={laag.d} />
            {laag.schaduw && <path className={`vm-s${i}`} d={laag.schaduw} />}
          </g>
        ))}
      </svg>
      <svg viewBox={`0 0 363 ${h}`} preserveAspectRatio="xMidYMax slice">
        <g className="vm-vlokken">
          <circle cx="40" cy="18" r="1.6" />
          <circle cx="110" cy="30" r="1.3" />
          <circle cx="170" cy="12" r="1.8" />
          <circle cx="250" cy="24" r="1.4" />
          <circle cx="318" cy="14" r="1.7" />
          <circle cx="345" cy="38" r="1.2" />
        </g>
        <path className="vm-piste" d={`M0 ${72 + dy}C60 ${64 + dy} 120 ${68 + dy} 180 ${66 + dy}S300 ${60 + dy} 363 ${64 + dy}V${h}H0Z`} />
        <path className="vm-ribbel" d={[80, 83, 86, 89, 92].map((y) => `M0 ${y + dy}H363`).join('')} />
        {bezig && <path className="vm-ribbel" d={[100, 103, 106, 109, 112].map((y) => `M0 ${y + dy}H363`).join('')} />}
        <g transform={`translate(236 ${bezig ? dy + 20 : 0})`}>
          <g className="vm-rijder">
            <rect className="vm-dek" x="78" y="77" width="500" height="18" />
            <g className="vm-bully">
              <path className="vm-schild" d="M60 76 70 72 76 95H62Z" />
              <rect className="vm-rups" x="-12" y="83" width="12" height="9" rx="3" />
              <rect className="vm-rups" x="2" y="82" width="58" height="13" rx="6.5" />
              {[10, 22, 34, 46].map((x) => (
                <circle key={x} className="vm-wiel" cx={x} cy="88.5" r="3" />
              ))}
              <rect className="vm-romp" x="4" y="68" width="54" height="15" rx="2" />
              <path className="vm-romp" d="M26 69V52H47L55 69Z" />
              <path className="vm-raam" d="M30 66V56H45L50 66Z" />
              <path className="vm-raam-licht" d="M32 64V58H36L33 64Z" />
              <rect className="vm-zwaai" x="34" y="48" width="7" height="4" rx="1" />
              <rect className="vm-rups" x="10" y="62" width="3" height="7" />
              <circle className="vm-puf" cx="11" cy="58" r="3" />
              <circle className="vm-puf" cx="11" cy="58" r="3" />
              <circle className="vm-puf" cx="11" cy="58" r="3" />
            </g>
          </g>
        </g>
      </svg>
    </>
  )
}
