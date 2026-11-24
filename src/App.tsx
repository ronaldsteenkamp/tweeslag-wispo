import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeMelding } from './components/Badges'
import { ProfielVenster } from './components/Profiel'
import { TabBalk } from './components/TabBalk'
import { UpdateMelding } from './components/UpdateMelding'
import { Welkom } from './components/Welkom'
import { config } from './config'
import { haalAllesVooraf } from './lib/data'
import { reisFase, tabsVoor, type Tab } from './lib/navigatie'
import { verwerkKopSchakelaar } from './lib/nieuweKoppen'
import { useNu } from './lib/nu'
import { lees, schrijfEnMeld, useOpgeslagen } from './lib/opslag'
import { useSchermWakker } from './lib/wakker'
import { useTabSwipe } from './lib/tabswipe'
import { useToetsenbord } from './lib/toetsenbord'
import Home from './screens/Home'
import Planning from './screens/Planning'
import Paklijst from './screens/Paklijst'
import Groep from './screens/Groep'
import Fotomuur, { GEZIEN } from './screens/Fotomuur'
import { useBackend } from './lib/backend'
import { useFotos } from './lib/fotos'
import Spel from './screens/Spel'
import Weer from './screens/Weer'
import Instellingen from './screens/Instellingen'
import VakanCie from './screens/VakanCie'

// Wat niet bij het openen nodig is, laadt pas als je erheen gaat (kleinere eerste bundel)
const Kaart = lazy(() => import('./screens/Kaart'))
const Verdelen = lazy(() => import('./screens/Verdelen'))
const Beheer = lazy(() => import('./screens/Beheer'))

/** Alle schermen: de tabs van de balk en de subschermen daaronder */
type Scherm = Tab | 'verdelen' | 'weer' | 'beheer' | 'instellingen' | 'vakancie'
const SCHERMEN: Scherm[] = ['home', 'planning', 'paklijst', 'kaart', 'fotos', 'spel', 'groep', 'verdelen', 'weer', 'beheer', 'instellingen', 'vakancie']

/** vanScherm: een subscherm geopend vanuit een ander subscherm (de VakanCie vanuit Instellingen) */
type Stap = { subscherm?: boolean; tabStap?: boolean; van?: Tab; vanScherm?: Scherm } | null
/** Staat er een geschiedenis-stap onder dit subscherm (gezet door kies of bij het opstarten)? */
const isSubschermStap = () => (window.history.state as Stap)?.subscherm === true
/** Staat er Home onder deze tab in de geschiedenis? */
const isTabStap = () => (window.history.state as Stap)?.tabStap === true
/** Vanaf welke tab het subscherm geopend is (Weer kan vanaf Home én Planning) */
const subschermVan = () => (window.history.state as Stap)?.van

/** De tab in de balk waar een scherm onder valt (dat licht op, en daar gaat terug heen) */
function hoofdTab(s: Scherm, tabs: Tab[]): Tab {
  if ((tabs as string[]).includes(s)) return s as Tab
  if (s === 'verdelen' || s === 'beheer') return 'groep'
  return 'home' // weer, instellingen, en paklijst/kaart als ze niet in de balk staan
}

function tabUitAdres(tabs: Tab[]): Scherm {
  const h = window.location.hash.slice(1)
  // #nieuwekop / #oudekop: schakelaar voor de nieuwe schermkoppen (zie lib/nieuweKoppen.ts)
  if (verwerkKopSchakelaar(h)) {
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}#home`)
    return 'home'
  }
  // schrijfEnMeld en niet schrijf: Spel en Groep kunnen al openstaan (als buurscherm voor het vegen)
  // en moeten dan meteen naar het juiste onderdeel, anders zie je eerst het vorige (bijv. Appartementen)
  // Vanuit een melding over de uitslag: meteen naar Spel → Stand
  if (h === 'stemmen' || h === 'klassement') {
    schrijfEnMeld('spel.onderdeel', 'stand')
    return 'spel'
  }
  // Oude adressen (van voor de tabbalk met vijf tabs)
  if (h === 'rad') {
    schrijfEnMeld('spel.onderdeel', 'rad')
    return 'spel'
  }
  if (h === 'kamers') {
    schrijfEnMeld('groep.onderdeel', 'kamers')
    return 'groep'
  }
  // Het clubblad: een eigen tab na de reis, anders onder Groep
  if (h === 'fotos' && !tabs.includes('fotos')) {
    schrijfEnMeld('groep.onderdeel', 'clubblad')
    return 'groep'
  }
  return (SCHERMEN as string[]).includes(h) ? (h as Scherm) : 'home'
}

export default function App() {
  // De middelste tab schuift mee met de reis (Paklijst → Kaart → Clubblad); eens per minuut kijken
  const fase = reisFase(useNu(60_000))
  const tabInfo = useMemo(() => tabsVoor(fase), [fase])
  const TABS = useMemo(() => tabInfo.map((t) => t.id), [tabInfo])

  const [tab, setTab] = useState<Scherm>(() => tabUitAdres(TABS))
  // De tab waar het huidige subscherm bij hoort: Weer vanaf Planning hoort bij Planning
  const [van, setVan] = useState<Tab | undefined>(subschermVan)
  const basisTab = (s: Scherm): Tab => (s === 'weer' && van && TABS.includes(van) ? van : hoofdTab(s, TABS))
  const isSubscherm = (s: Scherm) => s !== hoofdTab(s, TABS)
  // Wie al een naam heeft gekozen (van voor het welkomstscherm bestond) hoeft het niet te zien
  const [welkomGehad, setWelkomGehad] = useOpgeslagen('welkom.gehad', lees<string | null>('naam', null) !== null)
  const welkomKlaar = useCallback(() => setWelkomGehad(true), [setWelkomGehad])
  const [naam] = useOpgeslagen<string | null>('naam', null)
  // De kamerverdeling is alleen voor de reisleiding (zie config.ts)
  const magVerdelen = naam !== null && config.reisleiding.includes(naam)
  // Op de kaart, bij het rad en bij de busbingo gaat het scherm niet op slot (elders wel, voor de batterij)
  const [spelOnderdeel] = useOpgeslagen<string>('spel.onderdeel', 'challenges')
  const [groepOnderdeel] = useOpgeslagen<string>('groep.onderdeel', 'kamers')
  useSchermWakker(tab === 'kaart' || (tab === 'spel' && (spelOnderdeel === 'bingo' || spelOnderdeel === 'rad')))
  useToetsenbord()

  // Badge op de tabbalk: nieuwe kiekjes in het clubblad (nog niet geopend, en niet van jezelf)
  const backend = useBackend()
  const { fotos } = useFotos(6, backend.status !== 'uit')
  const [gezien] = useOpgeslagen<string[]>(GEZIEN, [])
  const nieuweFotos = fotos?.filter((f) => f.user_id !== backend.userId && !gezien.includes(f.id)).length ?? 0
  const badges = nieuweFotos ? { [TABS.includes('fotos') ? 'fotos' : 'groep']: nieuweFotos } : {}

  useEffect(() => {
    const opHash = () => {
      setTab(tabUitAdres(tabsVoor().map((t) => t.id)))
      setVan(subschermVan())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', opHash)
    // Direct geopend op een subscherm of een andere tab dan Home: Home (of de tab eronder) als stap in
    // de geschiedenis, zodat terug daar uitkomt in plaats van de app te sluiten.
    const begin = tabUitAdres(tabsVoor().map((t) => t.id))
    const { pathname, search } = window.location
    const tabs = tabsVoor().map((t) => t.id)
    if (begin !== hoofdTab(begin, tabs) && !isSubschermStap()) {
      window.history.replaceState(null, '', `${pathname}${search}#${hoofdTab(begin, tabs)}`)
      window.history.pushState({ subscherm: true }, '', `${pathname}${search}#${begin}`)
    } else if (begin !== 'home' && begin === hoofdTab(begin, tabs) && !isTabStap()) {
      window.history.replaceState(null, '', `${pathname}${search}#home`)
      window.history.pushState({ tabStap: true }, '', `${pathname}${search}#${begin}`)
    }
    return () => window.removeEventListener('hashchange', opHash)
  }, [])

  useEffect(() => {
    // Alle data meteen ophalen (wat bij het starten al binnen is niet nog eens), en alles nogmaals
    // zodra de service worker de pagina overneemt (bij de allereerste keer openen), zodat alles
    // offline klaarstaat.
    haalAllesVooraf()
    const opnieuw = () => haalAllesVooraf(true)
    navigator.serviceWorker?.addEventListener('controllerchange', opnieuw)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', opnieuw)
  }, [])

  /*
   * Wisselen. Tikken op de tabbalk wisselt direct (zoals Instagram); alleen vegen schuift.
   * Geschiedenis: Home ← tab ← subscherm. Terug gaat dus eerst naar de tab, dan naar Home, en pas
   * vanaf Home sluit terug de app (zoals Android-apps dat doen).
   */
  const kies = useCallback(
    (t: Scherm) => {
      if (t === tab) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const { pathname, search } = window.location
      const adres = `${pathname}${search}#${t}`
      // Terug van een subscherm naar zijn tab: een stap terug (de hashchange zet de tab). Ligt er nog
      // een subscherm onder (de VakanCie vanuit Instellingen), dan twee stappen.
      if (isSubscherm(tab) && t === basisTab(tab) && isSubschermStap()) {
        window.history.go((window.history.state as Stap)?.vanScherm ? -2 : -1)
        return
      }
      // Naar de VakanCie vanuit een ander subscherm (Instellingen): een stap erbovenop, zodat terug
      // weer bij dat subscherm uitkomt
      if (t === 'vakancie' && isSubscherm(tab)) {
        const stap: Stap = { subscherm: true, van: basisTab(tab), vanScherm: tab }
        window.history.pushState(stap, '', adres)
        setVan(stap.van)
        setTab(t)
        window.scrollTo(0, 0)
        return
      }
      if (isSubscherm(t) && !isSubscherm(tab)) {
        // Naar een subscherm (Weer, Instellingen, ...): een nieuwe stap
        const stap: Stap = { subscherm: true, van: tab as Tab }
        window.history.pushState(stap, '', adres)
        setVan(stap.van)
      } else if (!isSubscherm(t)) {
        const huidig = basisTab(tab)
        if (isSubscherm(tab) && isSubschermStap()) {
          // Vanuit een subscherm naar een andere tab: de subscherm-stap vervangen
          window.history.replaceState(t === 'home' ? null : { tabStap: true }, '', adres)
        } else if (t === 'home' && isTabStap()) {
          // Een stap terug, maar Home meteen tonen: wachten op de hashchange gaf na het vegen een
          // frame waarin de oude tab weer even in beeld stond (knipperen)
          window.history.back()
        } else if (huidig === 'home' && t !== 'home') {
          window.history.pushState({ tabStap: true }, '', adres)
        } else {
          window.history.replaceState(window.history.state, '', adres)
        }
        setVan(undefined)
      } else {
        window.history.replaceState(window.history.state, '', adres)
      }
      setTab(t)
      window.scrollTo(0, 0)
    },
    [tab, van, TABS],
  )

  // Vegen tussen de tabs van de tabbalk (niet tijdens het welkomstscherm). Vanuit een
  // subscherm ga je naar de buren van de tab waar het onder valt.
  const tabIndex = TABS.indexOf(basisTab(tab))
  // Tijdens het vegen: het buurscherm dat naast het huidige ligt (zie tabswipe.ts)
  const [buur, setBuur] = useState<1 | -1 | null>(null)
  const buurTab = buur ? TABS[tabIndex + buur] : undefined
  // De buurschermen alvast (onzichtbaar) klaarzetten zodra de tab rustig in beeld is: dan hoeft er
  // bij het begin van een veeg niets opgebouwd te worden. Niet de kaart: die laadt kaartdata.
  const [klaarVoor, setKlaarVoor] = useState<string | null>(null)
  useEffect(() => {
    if (!welkomGehad) return
    // Safari kent requestIdleCallback pas sinds kort: anders na een halve seconde
    const ric = typeof window.requestIdleCallback === 'function'
    // startTransition: React bouwt de buren in kleine stukjes op, tussen de frames door
    const zet = () => startTransition(() => setKlaarVoor(tab))
    const wacht = ric ? window.requestIdleCallback(zet, { timeout: 1200 }) : setTimeout(zet, 500)
    return () => (ric ? window.cancelIdleCallback(wacht) : clearTimeout(wacht))
  }, [tab, welkomGehad])
  // Het scherm waar je net vandaan veegde is nu een buur: dat blijft gewoon staan (zelfde key)
  const [vorigeTab, setVorigeTab] = useState<string | null>(null)
  const klaarBuren = ([-1, 1] as const)
    .map((r) => ({ r, id: TABS[tabIndex + r] }))
    .filter((b): b is { r: -1 | 1; id: Tab } => !!b.id && b.id !== 'kaart' && (klaarVoor === tab || b.id === vorigeTab))
  useTabSwipe({
    aan: welkomGehad,
    kan: (richting) => !!TABS[tabIndex + richting],
    onBuur: setBuur,
    onWissel: (richting) => {
      setBuur(null)
      setVorigeTab(tab)
      const volgende = TABS[tabIndex + richting]
      if (volgende) kies(volgende)
    },
  })

  const scherm = (s: Scherm) => {
    switch (s) {
      case 'home':
        return (
          <Home
            naarTab={kies}
            naarWeer={() => kies('weer')}
            naarInstellingen={() => kies('instellingen')}
            naarVakancie={() => kies('vakancie')}
          />
        )
      case 'weer':
        return <Weer terug={() => kies(basisTab('weer'))} />
      case 'instellingen':
        return <Instellingen terug={() => kies('home')} naarVakancie={() => kies('vakancie')} />
      case 'vakancie': {
        // Terug naar waar je vandaan kwam: Home, of Instellingen als je daar op het logo tikte
        const onder = (window.history.state as Stap)?.vanScherm
        return (
          <VakanCie
            terug={() => (isSubschermStap() ? window.history.back() : kies('home'))}
            terugLabel={onder === 'instellingen' ? 'Instellingen' : 'Home'}
            aantalSchermen={SCHERMEN.length}
          />
        )
      }
      case 'beheer':
        return <Beheer terug={() => kies('groep')} />
      case 'planning':
        return <Planning naarWeer={() => kies('weer')} />
      case 'paklijst':
        return <Paklijst terug={TABS.includes('paklijst') ? undefined : () => kies('home')} />
      case 'groep':
        return <Groep naarVerdelen={() => kies('verdelen')} naarBeheer={() => kies('beheer')} />
      case 'kaart':
        return <Kaart terug={TABS.includes('kaart') ? undefined : () => kies('home')} />
      case 'spel':
        return <Spel />
      case 'fotos':
        return <Fotomuur naarSpel={() => kies('spel')} />
      case 'verdelen':
        return magVerdelen ? (
          <Verdelen terug={() => kies('groep')} />
        ) : (
          <Groep naarVerdelen={() => kies('verdelen')} naarBeheer={() => kies('beheer')} />
        )
    }
  }
  /** Extra class voor de stijl van wat er in een tab staat (Groep toont Kamers of het clubblad, Spel het rad) */
  const extraKlasse = (s: Scherm) =>
    s === 'groep'
      ? ` inhoud--${groepOnderdeel === 'clubblad' ? 'fotos' : 'kamers'}`
      : s === 'spel' && spelOnderdeel === 'rad'
        ? ' inhoud--rad'
        : ''

  return (
    <>
      {/* Elk scherm in een eigen vak met de tab als key. Tijdens het vegen staat het buurscherm
          ernaast; na het wisselen wórdt dat vak het huidige scherm (zelfde key, zelfde element),
          zodat er niets opnieuw opgebouwd wordt: geen knipperen, geen opnieuw ladende kaart. */}
      <main>
        {[
          { id: tab as Scherm, r: 0 as const },
          ...klaarBuren,
          ...(buurTab && !klaarBuren.some((b) => b.id === buurTab) ? [{ r: buur!, id: buurTab }] : []),
        ].map((b) =>
          b.r === 0 ? (
            <div
              key={b.id}
              className={`inhoud inhoud--${b.id}${extraKlasse(b.id)} huidig`}
              ref={(el) => el?.removeAttribute('inert')}
            >
              <Suspense fallback={<div className="scherm" />}>{scherm(b.id)}</Suspense>
            </div>
          ) : (
            <div
              key={b.id}
              className={`inhoud inhoud--${b.id}${extraKlasse(b.id)} buurpaneel buurpaneel--${b.r > 0 ? 'rechts' : 'links'}${b.r === buur ? '' : ' is-rust'}`}
              aria-hidden="true"
              ref={(el) => el?.setAttribute('inert', '')}
            >
              <Suspense fallback={null}>{scherm(b.id)}</Suspense>
            </div>
          ),
        )}
      </main>
      {!welkomGehad && <Welkom onKlaar={welkomKlaar} />}
      <ProfielVenster />
      <BadgeMelding />
      <UpdateMelding />
      <TabBalk tabs={tabInfo} actief={basisTab(tab)} onKies={kies} badges={badges} />
    </>
  )
}
