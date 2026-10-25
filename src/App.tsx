import { useCallback, useEffect, useState } from 'react'
import { ProfielVenster } from './components/Profiel'
import { TabBalk, TABS, type Tab } from './components/TabBalk'
import { UpdateMelding } from './components/UpdateMelding'
import { Welkom } from './components/Welkom'
import { config } from './config'
import { haalAllesVooraf } from './lib/data'
import { lees, schrijf, useOpgeslagen } from './lib/opslag'
import { useSchermWakker } from './lib/wakker'
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

  return (
    <>
      <main className={`inhoud inhoud--${tab}`}>
        {tab === 'home' && <Home naarTab={kies} naarWeer={() => kies('weer')} />}
        {tab === 'weer' && <Weer terug={() => kies('home')} />}
        {tab === 'beheer' && <Beheer terug={() => kies('kamers')} />}
        {tab === 'planning' && <Planning />}
        {tab === 'paklijst' && <Paklijst />}
        {tab === 'kamers' && <Kamers naarVerdelen={() => kies('verdelen')} naarBeheer={() => kies('beheer')} />}
        {tab === 'kaart' && <Kaart />}
        {tab === 'rad' && <Rad />}
        {tab === 'spel' && <Spel />}
        {tab === 'fotos' && <Fotomuur terug={() => kies('spel')} />}
        {tab === 'verdelen' &&
          (magVerdelen ? (
            <Verdelen terug={() => kies('kamers')} />
          ) : (
            <Kamers naarVerdelen={() => kies('verdelen')} naarBeheer={() => kies('beheer')} />
          ))}
      </main>
      {!welkomGehad && <Welkom onKlaar={welkomKlaar} />}
      <ProfielVenster />
      <UpdateMelding />
      <TabBalk
        actief={tab === 'verdelen' || tab === 'beheer' ? 'kamers' : tab === 'weer' ? 'home' : tab === 'fotos' ? 'spel' : tab}
        onKies={kies}
      />
    </>
  )
}
