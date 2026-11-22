import { useEffect } from 'react'
import { Icoon } from './Icoon'
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
        <Icoon naam="draai" grootte={20} />
        <span>Nieuwe versie klaar. Je vinkjes en je plaatje blijven bewaard.</span>
        <div className="toast__knoppen">
          <button type="button" className="knop knop--klein knop--secundair" onClick={() => setNieuweVersie(false)}>
            Later
          </button>
          <button type="button" className="knop knop--klein knop--primair" onClick={() => updateServiceWorker(true)}>
            Vernieuw
          </button>
        </div>
      </div>
    )
  }
  if (offlineKlaar) {
    return (
      <div className="toast toast--succes" role="status">
        <Icoon naam="vink" grootte={20} />
        <span>Wispo werkt nu ook zonder bereik.</span>
      </div>
    )
  }
  return null
}
