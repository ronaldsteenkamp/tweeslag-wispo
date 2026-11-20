import { useEffect, useRef } from 'react'
import { useOpgeslagen } from '../lib/opslag'
import { startSneeuw, type Sneeuw } from '../lib/sneeuw'
import '../styles/sneeuw.css'

/** Schermen waar de sneeuw stilstaat en verborgen is (de kaart vult het scherm; beheer is werk) */
const ZONDER_SNEEUW = new Set(['kaart', 'verdelen', 'beheer'])

/**
 * Vallende sneeuw achter alle schermen (zie lib/sneeuw.js voor hoe het werkt en alle instellingen).
 * Aan/uit staat in 'sneeuw.aan' (schakelaar onderaan Home). Gekozen uit mockups/sneeuw.html.
 *
 * Vervaging: modus 'canvas' op alle toestellen. De module tekent vlokken achter de donkere koppen
 * zelf vaag; dat ziet er hetzelfde uit als backdrop-filter, is lichter (vooral op iOS) en maakt
 * van de koppen geen 'containing block' voor vaste elementen erin.
 */
export function SneeuwAchtergrond({ scherm }: { scherm: string }) {
  const [aan] = useOpgeslagen('sneeuw.aan', true)
  const sneeuw = useRef<Sneeuw | null>(null)
  const beginAan = useRef(aan)

  useEffect(() => {
    const s = startSneeuw({
      aan: beginAan.current,
      opslagSleutel: null, // bewaren gaat via opslag.ts
      vervaging: {
        modus: 'canvas',
        donker: '.schermkop, .homekop, .pakkop, .radm--apres',
        selector: '.schermkop, .homekop, .pakkop, .radm--apres',
        // Tekst direct op het papier: vlokken erachter zacht en zwak, zodat ze nooit scherp door
        // de letters lopen (Home-rijen, programmaboekje, paklijst, weer, smoelenboek, dagkaart)
        tekst: '.homerij, .route, .tijdlijn, .blad, .inhoudsopgave, .pak-lijst, .weer__blok, .ks-blz, .stempelkaart',
      },
    })
    sneeuw.current = s
    return () => {
      s.vernietig()
      sneeuw.current = null
    }
  }, [])

  useEffect(() => {
    if (sneeuw.current && sneeuw.current.isAan() !== aan) sneeuw.current.zetAan(aan)
  }, [aan])

  useEffect(() => {
    document.documentElement.dataset.scherm = scherm
    sneeuw.current?.zetZichtbaar(!ZONDER_SNEEUW.has(scherm))
  }, [scherm])

  return null
}
