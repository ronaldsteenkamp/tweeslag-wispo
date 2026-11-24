import type { Tab, TabInfo } from '../lib/navigatie'
import { Icoon } from './Icoon'

export type { Tab }

/**
 * De tabbalk: effen papier over de volle breedte, vast aan de onderrand (de home-indicator valt erbinnen),
 * het actieve tab als donkerblauw pistebord
 * (ontwerp: mockups/navigatie.html, richting B). Badges: een getal of een stip voor iets nieuws.
 */
export function TabBalk({
  tabs,
  actief,
  onKies,
  badges = {},
}: {
  tabs: TabInfo[]
  actief: Tab
  onKies: (t: Tab) => void
  badges?: Partial<Record<Tab, number | 'stip'>>
}) {
  return (
    <nav className="tabbalk" aria-label="Hoofdmenu">
      {tabs.map((t) => {
        const b = badges[t.id]
        return (
          <button
            key={t.id}
            type="button"
            className={`tab${t.id === actief ? ' tab--actief' : ''}`}
            aria-current={t.id === actief ? 'page' : undefined}
            onClick={() => onKies(t.id)}
          >
            <span className="tab__icoon">
              <Icoon naam={t.icoon} grootte={24} />
              {b === 'stip' ? (
                <span className="tab__badge tab__badge--stip" aria-label="nieuw" />
              ) : b ? (
                <span className="tab__badge" aria-label={`${b} nieuw`}>
                  {b > 9 ? '9+' : b}
                </span>
              ) : null}
            </span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
