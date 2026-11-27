import React from 'react'
import { flushSync } from 'react-dom'
import ReactDOM from 'react-dom/client'
import App from './App'
import { resetCasinoAlsNodig } from './components/Roulette'
import { startBackend } from './lib/backend'
import { wachtOp } from './lib/data'
import { vangInstallatieMelding } from './lib/installatie'
import { bepaalIcoonVersie } from './lib/icoonversie'
import { startKamerverdeling } from './lib/kamerverdeling'
import { resetVoortgangAlsNodig, startPersoonsdata } from './lib/persoonsdata'
import { startProfielen } from './lib/profiel'
import { startBijnamen } from './lib/bijnamen'
import { startKamernamen } from './lib/kamernamen'
import { startScorebord } from './lib/scorebord'
import { startTestperiode } from './lib/testperiode'
import { startLocatie } from './lib/locatie'
import { startMeldingen } from './lib/meldingen'
import { startFotoWachtrij } from './lib/fotowachtrij'
import { startStukjesWachtrij } from './lib/stukjes'
import { startStemming } from './lib/stemming'
import { startBadges } from './lib/badgesTelefoon'
import { startRadUitslagen } from './lib/radUitslagen'
import { startZuinig } from './lib/zuinig'
import './styles/theme.css'
import './styles/app.css'

// Safari negeert user-scalable=no: knijpen naar de pagina hier tegenhouden (de kaart zoomt zelf)
document.addEventListener('gesturestart', (e) => e.preventDefault())

// Zo vroeg mogelijk, anders missen we het beforeinstallprompt-event van Chrome
vangInstallatieMelding()
// Zuinig op de berg: zelf aangezet, of vanzelf bij weinig batterij (zie lib/zuinig.ts)
startZuinig()
// Vóór het welkomstscherm: is dit een app die er al stond met het oude icoon? (zie icoonversie.ts)
bepaalIcoonVersie()
// Gedeelde functies (alleen als Supabase is ingesteld; anders gebeurt er niets)
startBackend()
// Eenmalig: voortgang van iedereen wissen (zie persoonsdata.ts)
resetVoortgangAlsNodig()
// Vóór alles wat persoonlijke waarden schrijft (testperiode, casino-reset, badges)
startPersoonsdata()
startTestperiode()
startScorebord()
startProfielen()
startBijnamen()
startKamernamen()
startKamerverdeling()
startStemming()
startMeldingen()
startLocatie()
startFotoWachtrij()
startStukjesWachtrij()
startRadUitslagen()
resetCasinoAlsNodig()
// Na het casino-reset: anders telt een oude stand nog voor High roller of Blut
startBadges()

/*
 * Het laadscherm (logo, in index.html) blijft heel even staan tot de lettertypes en de gegevens
 * voor Home er zijn. Anders tekent Home eerst met een ander lettertype en zonder paklijst en
 * planning, en verspringt alles als die binnenkomen. Nooit langer dan 1,5 seconde (slecht bereik).
 */
const LETTERTYPES = ['400 1em Barlow', '600 1em Barlow', '600 1em "Barlow Condensed"', '700 1em "Barlow Condensed"']
const klaarVoorHome = Promise.all([
  ...LETTERTYPES.map((f) => document.fonts?.load(f).catch(() => {})),
  wachtOp(['planning', 'paklijst', 'kamers']),
])

/**
 * Home groeit onder het vervagende laadscherm van iets kleiner naar volledig scherm, vanuit het
 * midden van wat je ziet: zo voelt openen als een gewone app die opengaat, niet als een plaatje dat
 * wegvaagt. Niet bij minder beweging of Zuinig op de berg (daar staan animaties uit).
 */
function groeiHome() {
  const root = document.getElementById('root')
  const html = document.documentElement
  if (!root?.animate || html.hasAttribute('data-zuinig') || matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  // Tijdens het groeien zijn vaste onderdelen (tabbalk) vast ten opzichte van #root i.p.v. het scherm.
  // Daarom #root even precies schermhoog maken, dan blijft de tabbalk onderaan het scherm staan.
  // Bij het opstarten staat de pagina bovenaan, dus er verspringt niets.
  if (window.scrollY > 0) return
  const s = root.style
  s.height = '100dvh'
  s.overflow = 'hidden'
  s.transformOrigin = '50% 50%'
  const a = root.animate([{ transform: 'scale(0.94)' }, { transform: 'none' }], {
    duration: 420,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
  })
  const herstel = () => {
    s.removeProperty('height')
    s.removeProperty('overflow')
    s.removeProperty('transform-origin')
  }
  a.finished.then(herstel, herstel)
}

/**
 * Laadscherm laten wegvagen zodra de app echt op het scherm staat: twee frames na het tekenen en
 * dan nog even, zodat iOS alles onder het laadscherm al geschilderd heeft voordat het vervagen
 * begint (anders soms heel even een zwart vlak).
 */
function verbergLaadscherm() {
  const laden = document.getElementById('laden')
  if (!laden) return void document.documentElement.classList.add('is-geladen')
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      window.setTimeout(() => {
        laden.classList.add('weg')
        groeiHome()
        let klaar = false
        const weg = () => {
          if (klaar) return
          klaar = true
          laden.remove()
          // Pas nu glas (backdrop-filter) op de tabbalk: tijdens het opstarten tekent iOS dat soms zwart
          document.documentElement.classList.add('is-geladen')
        }
        // Alleen het vervagen van het laadscherm zelf telt (het groeien van het logo bubbelt ook op)
        laden.addEventListener('transitionend', (e) => {
          if (e.target === laden && e.propertyName === 'opacity') weg()
        })
        window.setTimeout(weg, 700)
      }, 80),
    ),
  )
}

Promise.race([klaarVoorHome, new Promise((r) => window.setTimeout(r, 1500))]).finally(() => {
  const root = ReactDOM.createRoot(document.getElementById('root')!)
  // Synchroon tekenen, zodat Home er al staat als het laadscherm begint te vervagen
  flushSync(() =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
  verbergLaadscherm()
})
