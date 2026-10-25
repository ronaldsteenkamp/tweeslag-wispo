import { Icoon, type IcoonNaam } from './Icoon'

export type Tab = 'home' | 'planning' | 'paklijst' | 'kamers' | 'kaart' | 'rad' | 'spel'

export const TABS: { id: Tab; label: string; icoon: IcoonNaam }[] = [
  { id: 'home', label: 'Home', icoon: 'home' },
  { id: 'planning', label: 'Planning', icoon: 'planning' },
  { id: 'paklijst', label: 'Paklijst', icoon: 'paklijst' },
  { id: 'kamers', label: 'Kamers', icoon: 'kamers' },
  { id: 'kaart', label: 'Kaart', icoon: 'kaart' },
  { id: 'rad', label: 'Rad', icoon: 'rad' },
  { id: 'spel', label: 'Spel', icoon: 'spel' },
]

export function TabBalk({ actief, onKies }: { actief: Tab; onKies: (t: Tab) => void }) {
  return (
    <nav className="tabbalk" aria-label="Hoofdmenu">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab${t.id === actief ? ' tab--actief' : ''}`}
          aria-current={t.id === actief ? 'page' : undefined}
          onClick={() => onKies(t.id)}
        >
          <Icoon naam={t.icoon} grootte={26} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
