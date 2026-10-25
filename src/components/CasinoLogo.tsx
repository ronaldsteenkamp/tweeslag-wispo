import { punt, taartpunt } from './Wiel'

/*
 * Logo van Jacco's Casino: een echte casinofiche met JA, en de naam in goud met
 * knipperende lampjes erboven zoals bij een casino in Las Vegas. Alleen bovenaan
 * lampjes: onder het logo begint het wiel.
 */

const LAMPJES = Array.from({ length: 9 }, (_, i) => 64 + i * 11)
/** De witte blokjes op de rand van de fiche (graden) */
const RANDBLOKJES = [0, 60, 120, 180, 240, 300]

export function CasinoLogo() {
  return (
    <svg className="casino-logo" viewBox="0 0 210 54" role="img" aria-label="Jacco's Casino">
      <defs>
        <linearGradient id="cl-goud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6c8" />
          <stop offset="45%" stopColor="#f5cd4f" />
          <stop offset="55%" stopColor="#d9a52e" />
          <stop offset="100%" stopColor="#fbe58f" />
        </linearGradient>
        <radialGradient id="cl-fiche" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#c8141e" />
          <stop offset="100%" stopColor="#8a0b12" />
        </radialGradient>
        <radialGradient id="cl-inleg" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="100%" stopColor="#e8dcc0" />
        </radialGradient>
        <radialGradient id="cl-glans" cx="32%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </radialGradient>
        <radialGradient id="cl-lampje" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#ffe07a" />
          <stop offset="100%" stopColor="#d79a1e" />
        </radialGradient>
      </defs>

      {/* De fiche, een beetje schuin zoals hij op tafel ligt */}
      <g transform="translate(28 26.5) rotate(-12)">
        <ellipse cx="1.5" cy="3" rx="25.5" ry="25" fill="#000" opacity="0.35" />
        {/* Zijkant: een dun randje dikte onder de bovenkant */}
        <circle cy="1.6" r="25" fill="#6a070c" />
        <circle r="25" fill="url(#cl-fiche)" />
        {RANDBLOKJES.map((a) => (
          <g key={a}>
            <path d={taartpunt(25, a - 10, a + 10, 18.5)} fill="#f7f3ea" />
            {/* Twee rode streepjes in elk blokje, zoals op echte fiches */}
            {[-4, 4].map((d) => {
              const [x1, y1] = punt(24.4, a + d)
              const [x2, y2] = punt(19.1, a + d)
              return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8141e" strokeWidth="1.1" />
            })}
          </g>
        ))}
        <circle r="18.5" fill="none" stroke="#6a070c" strokeWidth="0.8" />
        <circle r="16.6" fill="none" stroke="#f7f3ea" strokeWidth="0.7" strokeDasharray="2.2 1.9" />
        {/* Ingelegd plaatje in het midden */}
        <circle r="14.4" fill="url(#cl-inleg)" stroke="url(#cl-goud)" strokeWidth="1.4" />
        <circle r="11.8" fill="none" stroke="#c8141e" strokeWidth="0.5" />
        {/* Monogram JA: een grote rode J met een kleinere gouden A er schuin tegenaan */}
        <text
          x="-2.6"
          y="-0.4"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="17"
          fontWeight="800"
          fontStyle="italic"
          fill="#b3121b"
          className="casino-logo__letter"
        >
          J
        </text>
        <text
          x="4.6"
          y="3.6"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="11"
          fontWeight="800"
          fontStyle="italic"
          fill="url(#cl-goud)"
          stroke="#7a0a10"
          strokeWidth="0.9"
          paintOrder="stroke"
          transform="rotate(14 4.6 3.6)"
          className="casino-logo__letter"
        >
          A
        </text>
        {[45, 225].map((a) => {
          const [x, y] = punt(9.8, a)
          return <circle key={a} cx={x} cy={y} r="0.8" fill="#d9a52e" />
        })}
        <circle r="25" fill="url(#cl-glans)" />
      </g>

      {/* Lampjes boven de naam */}
      {LAMPJES.map((x, i) => (
        <circle key={x} cx={x} cy="4" r="2.1" fill="url(#cl-lampje)" className={`casino-logo__lampje${i % 2 ? ' is-om' : ''}`} />
      ))}

      <text
        x="60"
        y="29"
        fontSize="25"
        fontWeight="800"
        fontStyle="italic"
        fill="url(#cl-goud)"
        stroke="#3d2405"
        strokeWidth="1.4"
        paintOrder="stroke"
        className="casino-logo__naam"
      >
        Jacco’s
      </text>
      <text
        x="62"
        y="49"
        fontSize="15.5"
        fontWeight="800"
        letterSpacing="6.2"
        fill="url(#cl-goud)"
        stroke="#3d2405"
        strokeWidth="1.2"
        paintOrder="stroke"
        className="casino-logo__naam"
      >
        CASINO
      </text>
      {/* Sterretje */}
      <path d="M190 14 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="#fff6c8" className="casino-logo__ster" />
    </svg>
  )
}
