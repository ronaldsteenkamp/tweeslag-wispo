import { useEffect } from 'react'

/*
 * Houdt het scherm aan zolang `actief` waar is en de app zichtbaar is (Screen Wake Lock API).
 * Alleen op schermen waar je meekijkt zonder te tikken (kaart, rad, busbingo): overal aan kost in
 * de kou te veel batterij, en een vergeten telefoon in je jaszak blijft dan ook aan.
 * De telefoon laat het slot zelf los als je van de app wegschakelt; bij terugkomen vragen
 * we het opnieuw aan. Lukt het niet (bijv. batterijbesparing), dan proberen we het bij
 * de volgende tik nog eens. Kan de browser het helemaal niet, dan gebeurt er niets.
 */
export function useSchermWakker(actief: boolean) {
  useEffect(() => {
    if (!actief || !('wakeLock' in navigator)) return
    let slot: WakeLockSentinel | null = null
    let weg = false

    const vraag = async () => {
      if (weg || document.visibilityState !== 'visible' || (slot && !slot.released)) return
      try {
        slot = await navigator.wakeLock.request('screen')
        // Intussen naar een ander scherm: meteen weer loslaten
        if (weg) void slot.release()
      } catch {
        slot = null
      }
    }

    const opZichtbaar = () => void vraag()
    document.addEventListener('visibilitychange', opZichtbaar)
    document.addEventListener('pointerdown', opZichtbaar)
    void vraag()
    return () => {
      weg = true
      document.removeEventListener('visibilitychange', opZichtbaar)
      document.removeEventListener('pointerdown', opZichtbaar)
      void slot?.release()
    }
  }, [actief])
}
