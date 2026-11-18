import type { WeerSoort } from '../lib/weer'

/*
 * Eigen weericonen (geen emoji): lijnen van 1,75 op een raster van 24, in de tekstkleur.
 * Met `label` zijn ze een plaatje met tekst voor schermlezers; zonder label worden ze overgeslagen.
 * Zelfde tekeningen als in mockups/weer-gedeeld.js.
 */

export type IcoonNaam = WeerSoort | 'wind' | 'vlok' | 'nulgraden' | 'zicht' | 'zonop' | 'klok' | 'offline' | 'link'

const WOLK = 'M6.5 18.5h11a3.75 3.75 0 0 0 .4-7.48A5.5 5.5 0 0 0 7.3 10a4.25 4.25 0 0 0-.8 8.5z'
const WOLK_HOOG = 'M6.5 14.5h11a3.75 3.75 0 0 0 .4-7.48A5.5 5.5 0 0 0 7.3 6a4.25 4.25 0 0 0-.8 8.5z'
const HALF_WOLK = 'M9 19.5h9a3.25 3.25 0 0 0 .35-6.48A4.75 4.75 0 0 0 9.6 12.2a3.75 3.75 0 0 0-.6 7.3z'

const vlokje = (x: number, y: number, r = 1.6) =>
  `M${x} ${y - r}v${2 * r}M${x - r * 0.87} ${y - r / 2}l${r * 1.73} ${r}M${x - r * 0.87} ${y + r / 2}l${r * 1.73} ${-r}`

function stralen(cx: number, cy: number, r1: number, r2: number, n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return `M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}`
  }).join('')
}

const MAAN = 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'

const VORMEN: Record<IcoonNaam, string[]> = {
  zon: ['M16.25 12a4.25 4.25 0 1 1-8.5 0 4.25 4.25 0 0 1 8.5 0z', stralen(12, 12, 7, 9.5)],
  maan: [MAAN],
  halfzon: ['M11.5 8.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', stralen(8.5, 8.5, 4.9, 6.6, 6), HALF_WOLK],
  halfmaan: ['M12.5 9.5A5 5 0 0 1 6 3a5 5 0 1 0 6.5 6.5z', HALF_WOLK],
  wolk: [WOLK],
  mist: [WOLK_HOOG, 'M4 17.5h11M7 20.5h13'],
  motregen: [WOLK_HOOG, 'M9 18v1M13 19v1M17 18v1'],
  regen: [WOLK_HOOG, 'M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3'],
  ijzel: [WOLK_HOOG, 'M8.5 17l-1 3M16.5 17l-1 3', vlokje(12, 19)],
  sneeuw: [WOLK_HOOG, vlokje(9, 19), vlokje(15, 19.5)],
  zwaresneeuw: [WOLK_HOOG, vlokje(7.5, 18.5), vlokje(12, 20.5), vlokje(16.5, 18.5)],
  onweer: [WOLK_HOOG, 'M12.5 15l-2 3.5h3l-2 3.5'],
  wind: ['M3 9h10.5a2.75 2.75 0 1 0-2.6-3.6M3 13h15a3 3 0 1 1-2.8 4M3 17h7'],
  vlok: [vlokje(12, 12, 8.5), 'M12 6.5l-1.8-1.8M12 6.5l1.8-1.8M12 17.5l-1.8 1.8M12 17.5l1.8 1.8'],
  nulgraden: ['M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z', 'M12 9v6.5'],
  zicht: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  zonop: ['M7.5 15a4.5 4.5 0 0 1 9 0', 'M3 18.5h18M12 4.5v3M5.5 8l1.8 1.8M18.5 8l-1.8 1.8'],
  klok: ['M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z', 'M12 7.5V12l3 2'],
  offline: ['M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4M19 13a10 10 0 0 0-2.3-1.6M2 9.5A15 15 0 0 1 7 6.6M22 9.5a15 15 0 0 0-9.6-3.9', 'M12 20h.01'],
  link: ['M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
}

export function WeerIcoon({ naam, label, grootte = 24, className }: { naam: IcoonNaam; label?: string; grootte?: number; className?: string }) {
  return (
    <svg
      className={`weericoon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={grootte}
      height={grootte}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {VORMEN[naam].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
