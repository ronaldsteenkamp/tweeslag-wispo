import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Meldt dat de app offline klaarstaat, of dat er een nieuwe versie is */
export function UpdateMelding() {
  const {
    offlineReady: [offlineKlaar, setOfflineKlaar],
    needRefresh: [nieuweVersie, setNieuweVersie],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registratie) {
      if (!registratie) return
      // Elk uur kijken of er een nieuwe versie van de app is
      window.setInterval(() => {
        if (navigator.onLine) registratie.update().catch(() => {})
      }, 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineKlaar) return
    const id = window.setTimeout(() => setOfflineKlaar(false), 5000)
    return () => window.clearTimeout(id)
  }, [offlineKlaar, setOfflineKlaar])

  if (nieuweVersie) {
    return (
      <div className="toast" role="status">
        <span>Er is een nieuwe versie van de app.</span>
        <div className="toast__knoppen">
          <button type="button" className="knop knop--klein knop--secundair" onClick={() => setNieuweVersie(false)}>
            Later
          </button>
          <button type="button" className="knop knop--klein knop--primair" onClick={() => updateServiceWorker(true)}>
            Vernieuwen
          </button>
        </div>
      </div>
    )
  }
  if (offlineKlaar) {
    return (
      <div className="toast toast--succes" role="status">
        <span>✓ De app werkt nu ook zonder internet.</span>
      </div>
    )
  }
  return null
}
