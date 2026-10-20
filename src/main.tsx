import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { vangInstallatieMelding } from './lib/installatie'
import './styles/theme.css'
import './styles/app.css'

// Zo vroeg mogelijk, anders missen we het beforeinstallprompt-event van Chrome
vangInstallatieMelding()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
