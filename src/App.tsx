import { useCallback, useEffect, useState } from 'react'
import { ProfielVenster } from './components/Profiel'
import { TabBalk, TABS, type Tab } from './components/TabBalk'
import { UpdateMelding } from './components/UpdateMelding'
import { Welkom } from './components/Welkom'
import { config } from './config'
import { haalAllesVooraf } from './lib/data'
import { lees, schrijf, useOpgeslagen } from './lib/opslag'
import { useSchermWakker } from './lib/wakker'
import { useTabSwipe } from './lib/tabswipe'
import Home from './screens/Home'
import Planning from './screens/Planning'
import Paklijst from './screens/Paklijst'
import Kamers from './screens/Kamers'
import Kaart from './screens/Kaart'
import Spel from './screens/Spel'
import Rad from './screens/Rad'
import Verdelen from './screens/Verdelen'
import Weer from './screens/Weer'
import Beheer from './screens/Beheer'
import Fotomuur from './screens/Fotomuur'

/** Schermen die niet in de tabbalk staan */
type Scherm = Tab | 'verdelen' | 'weer' | 'beheer' | 'fotos'

/** De tab in de tabbalk waar een scherm onder valt */
function hoofdTab(s: Scherm): Tab {
  if (s === 'verdelen' || s === 'beheer') return 'kamers'
  if (s === 'weer') return 'home'
  if (s === 'fotos') return 'spel'
  return s
}

function tabUitAdres(): Scherm {
  const h = window.location.hash.slice(1)
  // Vanuit een melding over de uitslag: meteen naar Spel → Stemmen
  if (h === 'stemmen') {
    schrijf('spel.onderdeel', 'stemmen')
    return 'spel'
  }
  if (h === 'verdelen' || h === 'weer' || h === 'beheer' || h === 'fotos') return h
  return TABS.some((t) => t.id === h) ? (h as Tab) : 'home'
}

export default function App() {
  const [tab, setTab] = useState<Scherm>(tabUitAdres)
  // Wie al een naam heeft gekozen (van voor het welkomstscherm bestond) hoeft het niet te zien
  const [welkomGehad, setWelkomGehad] = useOpgeslagen('welkom.gehad', lees<string | null>('naam', null) !== null)
  const welkomKlaar = useCallback(() => setWelkomGehad(true), [setWelkomGehad])
  const [naam] = useOpgeslagen<string | null>('naam', null)
  // De kamerverdeling is alleen voor de reisleiding (zie config.ts)
  const magVerdelen = naam !== null && config.reisleiding.includes(naam)
  // Op de kaart, bij het rad en bij de busbingo gaat het scherm niet op slot (elders wel, voor de batterij)
  const [spelOnderdeel] = useOpgeslagen<string>('spel.onderdeel', 'challenges')
  useSchermWakker(tab === 'kaart' || tab === 'rad' || (tab === 'spel' && spelOnderdeel === 'bingo'))

  useEffect(() => {
    const opHash = () => setTab(tabUitAdres())
    window.addEventListener('hashchange', opHash)
    return () => window.removeEventListener('hashchange', opHash)
  }, [])

  useEffect(() => {
    // Alle data meteen ophalen, en nogmaals zodra de service worker de pagina overneemt
    // (bij de allereerste keer openen), zodat alles offline klaarstaat.
    haalAllesVooraf()
    navigator.serviceWorker?.addEventListener('controllerchange', haalAllesVooraf)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', haalAllesVooraf)
  }, [])

  // Tikken op de tabbalk wisselt direct, zonder animatie (zoals Instagram); alleen vegen schuift
  const kies = useCallback(
    (t: Scherm) => {
      if (t === tab) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const { pathname, search } = window.location
      window.history.replaceState(null, '', `${pathname}${search}#${t}`)
      setTab(t)
      window.scrollTo(0, 0)
    },
    [tab],
  )

  // Vegen tussen de tabs van de tabbalk (niet tijdens het welkomstscherm). Vanuit een
  // subscherm (bijv. de fotomuur) ga je naar de buren van de tab waar het onder valt.
  const tabIndex = TABS.findIndex((t) => t.id === hoofdTab(tab))
  // Tijdens het vegen: het buurscherm dat naast het huidige ligt (zie tabswipe.ts)
  const [buur, setBuur] = useState<1 | -1 | null>(null)
  const buurTab = buur ? TABS[tabIndex + buur]?.id : undefined
  useTabSwipe({
    aan: welkomGehad,
    kan: (richting) => !!TABS[tabIndex + richting],
    onBuur: setBuur,
    onWissel: (richting) => {
      setBuur(null)
      const volgende = TABS[tabIndex + richting]
      if (volgende) kies(volgende.id)
    },
  })

  const scherm = (s: Scherm) => {
    switch (s) {
      case 'home':
        return <Home naarTab={kies} naarWeer={() => kies('weer')} />
      case 'weer':
        return <Weer terug={() => kies('home')} />
      case 'beheer':
        return <Beheer terug={() => kies('kamers')} />
      case 'planning':
        return <Planning />
      case 'paklijst':
        return <Paklijst />
      case 'kamers':
        return <Kamers naarVerdelen={() => kies('verdelen')} naarBeheer={() => kies('beheer')} />
      case 'kaart':
        return <Kaart />
      case 'rad':
        return <Rad />
      case 'spel':
        return <Spel />
      case 'fotos':
        return <Fotomuur terug={() => kies('spel')} />
      case 'verdelen':
        return magVerdelen ? (
          <Verdelen terug={() => kies('kamers')} />
        ) : (
          <Kamers naarVerdelen={() => kies('verdelen')} naarBeheer={() => kies('beheer')} />
        )
    }
  }

  return (
    <>
      {/* Elk scherm in een eigen vak met de tab als key. Tijdens het vegen staat het buurscherm
          ernaast; na het wisselen wórdt dat vak het huidige scherm (zelfde key, zelfde element),
          zodat er niets opnieuw opgebouwd wordt: geen knipperen, geen opnieuw ladende kaart. */}
      <main>
        <div key={tab} className={`inhoud inhoud--${tab} huidig`} ref={(el) => el?.removeAttribute('inert')}>
          {scherm(tab)}
        </div>
        {buurTab && (
          // Het buurscherm, zoals het eruitziet als je er bovenaan binnenkomt. Niet aan te raken.
          <div
            key={buurTab}
            className={`inhoud inhoud--${buurTab} buurpaneel buurpaneel--${buur! > 0 ? 'rechts' : 'links'}`}
            aria-hidden="true"
            ref={(el) => el?.setAttribute('inert', '')}
          >
            {scherm(buurTab)}
          </div>
        )}
      </main>
      {!welkomGehad && <Welkom onKlaar={welkomKlaar} />}
      <ProfielVenster />
      <UpdateMelding />
      <TabBalk
        actief={hoofdTab(tab)}
        onKies={kies}
      />
    </>
  )
}
