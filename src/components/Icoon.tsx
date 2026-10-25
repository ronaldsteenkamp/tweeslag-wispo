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
  menu: 'M12 5.5v.01M12 12v.01M12 18.5v.01',
  camera: 'M4 8h3.5l2-2.5h5L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  prullenbak: 'M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6',
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
