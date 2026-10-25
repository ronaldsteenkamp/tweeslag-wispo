import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startBackend } from './lib/backend'
import { vangInstallatieMelding } from './lib/installatie'
import { startKamerverdeling } from './lib/kamerverdeling'
import { startProfielen } from './lib/profiel'
import { startScorebord } from './lib/scorebord'
import { startTestperiode } from './lib/testperiode'
import { startLocatie } from './lib/locatie'
import { startMeldingen } from './lib/meldingen'
import { startStemming } from './lib/stemming'
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
startKamerverdeling()
startStemming()
startMeldingen()
startLocatie()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
