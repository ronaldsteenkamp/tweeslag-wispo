import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startBackend } from './lib/backend'
import { vangInstallatieMelding } from './lib/installatie'
import './styles/theme.css'
import './styles/app.css'

// Zo vroeg mogelijk, anders missen we het beforeinstallprompt-event van Chrome
vangInstallatieMelding()
// Gedeelde functies (alleen als Supabase is ingesteld; anders gebeurt er niets)
startBackend()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
