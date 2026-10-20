import { useCallback, useEffect, useState } from 'react'
import { TabBalk, TABS, type Tab } from './components/TabBalk'
import { UpdateMelding } from './components/UpdateMelding'
import { Welkom } from './components/Welkom'
import { config } from './config'
import { haalAllesVooraf } from './lib/data'
import { lees, useOpgeslagen } from './lib/opslag'
import Home from './screens/Home'
import Planning from './screens/Planning'
import Paklijst from './screens/Paklijst'
import Kamers from './screens/Kamers'
import Kaart from './screens/Kaart'
import Spel from './screens/Spel'
import Verdelen from './screens/Verdelen'
import Weer from './screens/Weer'
import Beheer from './screens/Beheer'

/** Schermen die niet in de tabbalk staan */
type Scherm = Tab | 'verdelen' | 'weer' | 'beheer'

function tabUitAdres(): Scherm {
  const h = window.location.hash.slice(1)
  if (h === 'verdelen' || h === 'weer' || h === 'beheer') return h
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
        {tab === 'spel' && <Spel />}
        {tab === 'verdelen' &&
          (magVerdelen ? (
            <Verdelen terug={() => kies('kamers')} />
          ) : (
            <Kamers naarVerdelen={() => kies('verdelen')} naarBeheer={() => kies('beheer')} />
          ))}
      </main>
      {!welkomGehad && <Welkom onKlaar={welkomKlaar} />}
      <UpdateMelding />
      <TabBalk actief={tab === 'verdelen' || tab === 'beheer' ? 'kamers' : tab === 'weer' ? 'home' : tab} onKies={kies} />
    </>
  )
}
