import type { BadgeId } from '../lib/badges'

/*
 * Eigen lijn-iconen voor de badges (24×24, ronde uiteinden), in dezelfde stijl als Icoon.tsx.
 * De badge zelf is een rond stickertje in de kleur van zijn soort (zie .badge--<soort> in profiel.css).
 */
const PADEN: Record<BadgeId, string> = {
  // Voorbereiding
  'open-boek': 'M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6.5v13',
  bijnaam: 'M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0zM8 8.2a.2.2 0 1 0 0-.01',
  'vaste-gast': 'M7 2.5h10a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1zM9 12.5l3-2.5 3 2.5V16H9zM11 19h2',
  wekker: 'M12 20.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 10v3.5l2 1.5M4 6.5l3-3M20 6.5l-3-3',
  ingepakt: 'M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M4 7h16v13H4zM4 12h16M10 12v2h4v-2M9.5 16.5l1.8 1.8 3.2-3.3',
  'vroege-vogel': 'M3.5 13c2.5 4 7.5 5.5 11.5 2.5l5.5-4-3.5-.5A4.5 4.5 0 0 0 9 8.5C7.5 10.5 5.5 12.3 3.5 13zM14.2 9.3h.01M9.5 20.5l1.5-3M13 20.5l.8-3.3',
  // Spel
  'challenge-jager': 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12l7-7M16 5h3v3',
  bingo: 'M5.5 4h13v13h-13zM5.5 11.5h13M8 20v-3M16 20v-3M8.5 14.25h.01M15.5 14.25h.01M5.5 7.5h13',
  'volle-kaart': 'M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16',
  'high-roller':
    'M12 9.5c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 6.5v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4M4 10.5v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4M4 14.5v3c0 1.7 3.6 3 8 3s8-1.3 8-3v-3',
  lot: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 10.5V3.5M13.3 12.75l6.06 3.5M10.7 12.75l-6.06 3.5M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  blut: 'M3.5 8h15a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-15zM3.5 8l11-4.5L16 8M16.5 14.25h.01M8 3.5 6.5 2M5 5.5 3 5',
  // Eer: stemmingen, klassement, fotomuur
  'stem-van-de-dag': 'M4 17.5 3 8l5 4 4-6.5 4 6.5 5-4-1 9.5zM4 20.5h16',
  stemvee: 'M4 12h16v8.5H4zM8 12V4.5h8V12M10 8.5l1.5 1.5L14 7',
  waarzegger: 'M12 15.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM6.5 20.5h11l-2-5h-7zM9.5 8a2.8 2.8 0 0 1 2.5-1.8',
  fotograaf: 'M4 8h3.5l2-2.5h5L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  koploper: 'M8 3.5l2.5 5M16 3.5l-2.5 5M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM11 13.5l1.5-1v5',
  kamerkampioen: 'M3 20V9M3 16h18v4M21 16v-3a3 3 0 0 0-3-3h-7v6M7 13.5a1.8 1.8 0 1 0 0-.01M16 2.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z',
  // Op de berg
  bergbeklimmer: 'M2.5 20.5 9 9l3.5 5.5L15 11l6.5 9.5zM15 11V3.5l4 1.5-4 1.5',
  'eerste-lift': 'M3 17.5h18M7 17.5a5 5 0 0 1 10 0M12 4.5v3M4.9 8.9 7 11M19.1 8.9 17 11M6 21h12',
  ijskonijn: 'M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0zM12 9v8M17 6h3M17 9.5h2',
  nachtuil: 'M5 9 4 4l4.5 2.5h7L20 4l-1 5v6a7 7 0 0 1-14 0zM9.5 11.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM14.5 11.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM11 17.5h2',
}

export function BadgeIcoon({ id, grootte = 22 }: { id: BadgeId; grootte?: number }) {
  return (
    <svg
      width={grootte}
      height={grootte}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PADEN[id]} />
    </svg>
  )
}
