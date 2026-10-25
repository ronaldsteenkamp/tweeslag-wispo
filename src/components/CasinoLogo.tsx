/*
 * Logo van Jacco's Casino: een fiche met een J, en de naam in goud met lampjes eromheen
 * zoals bij een casino in Las Vegas.
 */

const LAMPJES = Array.from({ length: 13 }, (_, i) => 62 + i * 11)

export function CasinoLogo() {
  return (
    <svg className="casino-logo" viewBox="0 0 210 60" role="img" aria-label="Jacco's Casino">
      <defs>
        <linearGradient id="cl-goud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6c8" />
          <stop offset="45%" stopColor="#f5cd4f" />
          <stop offset="55%" stopColor="#d9a52e" />
          <stop offset="100%" stopColor="#fbe58f" />
        </linearGradient>
        <radialGradient id="cl-fiche" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#e2343c" />
          <stop offset="100%" stopColor="#8e0f16" />
        </radialGradient>
        <radialGradient id="cl-lampje" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#ffe07a" />
          <stop offset="100%" stopColor="#d79a1e" />
        </radialGradient>
      </defs>

      {/* De fiche */}
      <g transform="translate(29 30)">
        <circle r="26" fill="#3a0508" opacity="0.45" cy="2" />
        <circle r="26" fill="url(#cl-fiche)" stroke="#5c070c" strokeWidth="1" />
        <circle r="22.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeDasharray="8.83 8.83" />
        <circle r="17" fill="#a3141c" stroke="url(#cl-goud)" strokeWidth="2" />
        <circle r="13.5" fill="none" stroke="#f5cd4f" strokeWidth="0.6" strokeDasharray="1.5 2" />
        <text
          y="1"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="22"
          fontWeight="800"
          fontStyle="italic"
          fill="url(#cl-goud)"
          stroke="#5c070c"
          strokeWidth="0.8"
          className="casino-logo__letter"
        >
          J
        </text>
      </g>

      {/* Lampjes boven en onder de naam */}
      {LAMPJES.map((x, i) => (
        <g key={x} className={`casino-logo__lampje${i % 2 ? ' is-om' : ''}`}>
          <circle cx={x} cy="4" r="2.1" fill="url(#cl-lampje)" />
          <circle cx={x + 5.5} cy="56" r="2.1" fill="url(#cl-lampje)" />
        </g>
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
      {/* Sterretjes */}
      <path d="M190 14 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="#fff6c8" className="casino-logo__ster" />
      <path d="M200 32 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1z" fill="#fff6c8" className="casino-logo__ster is-om" />
    </svg>
  )
}
