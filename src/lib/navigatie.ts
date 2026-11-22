import { config } from '../config'
import type { IcoonNaam } from '../components/Icoon'
import { nu } from './nu'
import { lokaalNaarDate } from './tijd'

/*
 * De tabbalk: vijf tabs, waarvan de middelste met de reis meeschuift (ontwerp: mockups/navigatie.html).
 *   vóór vertrek  Home · Planning · Paklijst · Spel · Groep
 *   tijdens       Home · Planning · Kaart    · Spel · Groep
 *   na thuiskomst Home · Planning · Clubblad · Spel · Groep
 * Wat niet in de balk staat, blijft bereikbaar: Paklijst en Kaart als subscherm (vanaf Home), het
 * clubblad altijd onder Groep, het rad onder Spel.
 */

export type Tab = 'home' | 'planning' | 'paklijst' | 'kaart' | 'fotos' | 'spel' | 'groep'
export type ReisFase = 'voor' | 'tijdens' | 'na'

export interface TabInfo {
  id: Tab
  label: string
  icoon: IcoonNaam
}

const vertrek = lokaalNaarDate(config.vertrek)
const thuiskomst = lokaalNaarDate(config.thuiskomst)

export function reisFase(moment: Date = nu()): ReisFase {
  if (moment < vertrek) return 'voor'
  if (moment < thuiskomst) return 'tijdens'
  return 'na'
}

const FASE_TAB: Record<ReisFase, TabInfo> = {
  voor: { id: 'paklijst', label: 'Paklijst', icoon: 'paklijst' },
  tijdens: { id: 'kaart', label: 'Kaart', icoon: 'kaart' },
  na: { id: 'fotos', label: 'Clubblad', icoon: 'clubblad' },
}

export function tabsVoor(fase: ReisFase = reisFase()): TabInfo[] {
  return [
    { id: 'home', label: 'Home', icoon: 'home' },
    { id: 'planning', label: 'Planning', icoon: 'planning' },
    FASE_TAB[fase],
    { id: 'spel', label: 'Spel', icoon: 'spel' },
    { id: 'groep', label: 'Groep', icoon: 'groep' },
  ]
}
