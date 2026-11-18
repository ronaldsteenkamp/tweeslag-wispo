import React from 'react'
import { flushSync } from 'react-dom'
import ReactDOM from 'react-dom/client'
import App from './App'
import { resetCasinoAlsNodig } from './components/Roulette'
import { startBackend } from './lib/backend'
import { wachtOp } from './lib/data'
import { vangInstallatieMelding } from './lib/installatie'
import { startKamerverdeling } from './lib/kamerverdeling'
import { startProfielen } from './lib/profiel'
import { startBijnamen } from './lib/bijnamen'
import { startKamernamen } from './lib/kamernamen'
import { startScorebord } from './lib/scorebord'
import { startTestperiode } from './lib/testperiode'
import { startLocatie } from './lib/locatie'
import { startMeldingen } from './lib/meldingen'
import { startFotoWachtrij } from './lib/fotowachtrij'
import { startStemming } from './lib/stemming'
import { startBadges } from './lib/badgesTelefoon'
import { startRadUitslagen } from './lib/radUitslagen'
import './styles/theme.css'
import './styles/app.css'

// Safari negeert user-scalable=no: knijpen naar de pagina hier tegenhouden (de kaart zoomt zelf)
document.addEventListener('gesturestart', (e) => e.preventDefault())

// Zo vroeg mogelijk, anders missen we het beforeinstallprompt-event van Chrome
vangInstallatieMelding()
// Gedeelde functies (alleen als Supabase is ingesteld; anders gebeurt er niets)
startBackend()
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
 * Laadscherm laten wegvagen zodra de app echt op het scherm staat: twee frames na het tekenen en
 * dan nog even, zodat iOS alles onder het laadscherm al geschilderd heeft voordat het vervagen
 * begint (anders soms heel even een zwart vlak).
 */
function verbergLaadscherm() {
  const laden = document.getElementById('laden')
  if (!laden) return
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      window.setTimeout(() => {
        laden.classList.add('weg')
        const weg = () => laden.remove()
        laden.addEventListener('transitionend', weg, { once: true })
        window.setTimeout(weg, 600)
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
