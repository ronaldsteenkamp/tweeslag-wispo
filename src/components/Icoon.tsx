const paden = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5',
  planning: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5M8 14h3M8 17h6',
  paklijst: 'M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M4 7h16v13H4zM4 12h16M10 12v2h4v-2',
  kamers: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 12.5a1.8 1.8 0 1 0 0-.01',
  kaart: 'M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20',
  rad: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 10.5V3.5M13.3 12.75l6.06 3.5M10.7 12.75l-6.06 3.5M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  spel: 'M7 4h10v4.5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13.5V17M8.5 20h7M10 17h4v3h-4z',
  vink: 'M5 12.5 10 17.5 19.5 7',
  plus: 'M12 5v14M5 12h14',
  kruis: 'M6 6l12 12M18 6 6 18',
  zoek: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  slot: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 14.5v2.5',
  deel: 'M12 3.5v11M8 7.5l4-4 4 4M6.5 11H5v9.5h14V11h-1.5',
  pin: 'M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  min: 'M5 12h14',
  herstel: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5',
  pijl: 'M5 12h14M13 6l6 6-6 6',
  links: 'M15 5.5 8.5 12l6.5 6.5',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14',
  stempel: 'M9.5 4h5l-1 6h-3zM7 10h10l1 4H6zM5 14h14v3H5zM7 20h10',
  rechts: 'M9 5.5l6.5 6.5L9 18.5',
  menu: 'M12 5.5v.01M12 12v.01M12 18.5v.01',
  camera: 'M4 8h3.5l2-2.5h5L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  prullenbak: 'M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6',
  // Soorten activiteit in de planning (nieuwe koppen)
  eten: 'M7 3v6.5a2 2 0 0 0 4 0V3M9 3v18M16.5 21V3c-2 1.2-3 3.8-3 7v4h3',
  ski: 'M15 5.5a1.5 1.5 0 1 0 0-.01M8 9l5 1.5-2 4 4 3M3.5 15.5 20 21M17 10.5l-3-1',
  bus: 'M5.5 4h13v13h-13zM5.5 11.5h13M8 20v-3M16 20v-3M8.5 14.25h.01M15.5 14.25h.01M5.5 7.5h13',
  muziek: 'M9 17.5V5.5l10.5-2v12M9 17.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0zM19.5 15.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0z',
  sneeuwvlok: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5',
  // Hoogtepunten in de planning
  bal: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 3.5c2 3 2 8-1 11.5M20.2 10c-3.5-.6-7.5 1.2-9.2 5M5 17c2.5-2.5 6.8-2.8 10.2-1M3.8 10.3c3 1.2 5.6 1.2 8.2-.3',
  vlag: 'M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12',
  glas: 'M7 3.5h10l-1 7a4 4 0 0 1-8 0zM12 14.5v6M8.5 20.5h7M7.6 7.5h8.8',
  lift: 'M2.5 4.5l19 3.5M12 6.3V10M9 10h6a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 15 19H9a2.5 2.5 0 0 1-2.5-2.5v-4A2.5 2.5 0 0 1 9 10zM6.5 14h11',
  // Kaart
  mikpunt: 'M12 18.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  volgen: 'M12 3.5 19.5 20 12 16.2 4.5 20z',
  groep: 'M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19.5a5.5 5.5 0 0 1 11 0M17 11.9a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM15.5 14.4a4.5 4.5 0 0 1 5 5.1',
  uitzenden: 'M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  extern: 'M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7h5',
  // Meldingen (Home)
  bel: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0M12 3v2',
  // Spelerskaartje (profiel)
  board: 'M2.5 12.5c0 2.2 1.3 3.5 3.5 3.5h12c2.2 0 3.5-1.3 3.5-3.5M7.5 16v-4.5H11M14 16v-4.5h3.5',
  allebei: 'M4 8h13l-3-3M20 16H7l3 3',
  bier: 'M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 11h2.2a1.8 1.8 0 0 1 1.8 1.8v2.4a1.8 1.8 0 0 1-1.8 1.8H15M6 8a2.5 2.5 0 0 1 2.4-3 3 3 0 0 1 5.2 0A2.5 2.5 0 0 1 15 8M9 12v5M12 12v5',
  microfoon: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6',
  fluister: 'M4 5h16v11h-9l-4.5 4v-4H4zM8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01',
  bliksem: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  draai: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  potlood: 'M4 20l1.2-4.8L15.6 4.8a2 2 0 0 1 2.9 0l.7.7a2 2 0 0 1 0 2.9L8.8 18.8zM13.6 6.8l3.6 3.6',
  // Navigatie, Instellingen en installeren (stijlbasis)
  clubblad: 'M5 4.5h11v15H6.5A1.5 1.5 0 0 1 5 18zM16 8.5h3V18a1.5 1.5 0 0 1-3 0M8 8h5M8 11.5h5M8 15h3',
  persoon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  instellingen: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  zon: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  maan: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  deelIos: 'M12 3.5v11M8.5 7 12 3.5 15.5 7M7 10.5H5.5v10h13v-10H17',
  plusVierkant: 'M4.5 4.5h15v15h-15zM12 8.5v7M8.5 12h7',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.5M12 7.5h.01',
  letop: 'M12 4 21 19.5H3zM12 10v4.5M12 17h.01',
  berg: 'M2.5 19.5 9 8.5l3.2 5.3L15 9.5l6.5 10zM6.8 12.3 9 14l2-1.6',
  geluid: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  stil: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
  opslaan: 'M5 4.5h11l3 3v12H5zM8 4.5v5h7v-5M8 19.5v-6h8v6',
  // Zuinig op de berg (Instellingen)
  batterij: 'M3.5 8h15v8h-15zM18.5 10.5H21v3h-2.5M6.5 11v2M9.5 11v2',
  offline:'M12 18.5h.01M8.8 15.2a4.5 4.5 0 0 1 6.4 0M5.6 12a9 9 0 0 1 12.8 0M2.5 8.8a13.5 13.5 0 0 1 19 0M3 3l18 18',
} as const

export type IcoonNaam = keyof typeof paden

export function Icoon({ naam, grootte = 24, className }: { naam: IcoonNaam; grootte?: number; className?: string }) {
  return (
    <svg
      className={className}
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
      <path d={paden[naam]} />
    </svg>
  )
}
