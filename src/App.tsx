import { useCallback, useEffect, useState } from 'react'
import { TabBalk, TABS, type Tab } from './components/TabBalk'
import { UpdateMelding } from './components/UpdateMelding'
import { Welkom } from './components/Welkom'
import { haalAllesVooraf } from './lib/data'
import { lees, useOpgeslagen } from './lib/opslag'
import Home from './screens/Home'
import Planning from './screens/Planning'
import Paklijst from './screens/Paklijst'
import Kamers from './screens/Kamers'
import Kaart from './screens/Kaart'
import Spel from './screens/Spel'

function tabUitAdres(): Tab {
  const h = window.location.hash.slice(1)
  return TABS.some((t) => t.id === h) ? (h as Tab) : 'home'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabUitAdres)
  // Wie al een naam heeft gekozen (van voor het welkomstscherm bestond) hoeft het niet te zien
  const [welkomGehad, setWelkomGehad] = useOpgeslagen('welkom.gehad', lees<string | null>('naam', null) !== null)
  const welkomKlaar = useCallback(() => setWelkomGehad(true), [setWelkomGehad])

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
    (t: Tab) => {
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
        {tab === 'home' && <Home naarTab={kies} />}
        {tab === 'planning' && <Planning />}
        {tab === 'paklijst' && <Paklijst />}
        {tab === 'kamers' && <Kamers />}
        {tab === 'kaart' && <Kaart />}
        {tab === 'spel' && <Spel />}
      </main>
      {!welkomGehad && <Welkom onKlaar={welkomKlaar} />}
      <UpdateMelding />
      <TabBalk actief={tab} onKies={kies} />
    </>
  )
}
