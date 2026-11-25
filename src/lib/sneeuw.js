/*
 * sneeuw.js — vallende sneeuw als achtergrond van de app (prototype, geen dependencies).
 *
 * Gebruik:
 *   import { startSneeuw } from './sneeuw.js'
 *   const sneeuw = startSneeuw({ ...eigen instellingen })   // canvas komt achter de inhoud
 *   sneeuw.storm('links')  sneeuw.zetAan(false)  sneeuw.vernietig()
 *
 * Hoe het werkt, kort:
 *  - VORM: bij de start tekent de module 10–12 sneeuwkristallen op losse (offscreen) canvassen,
 *    elk met een eigen seed: stervormige dendrieten, varens, sterplaatjes, gesectoreerde plaatjes,
 *    eenvoudige sterren. Van elke vorm bestaan ook vooraf vervaagde versies. Per frame is een vlok
 *    dus één drawImage met een eigen draaimatrix (draaien + kantelen = in één as indrukken).
 *  - DIEPTE: vier lagen (ver, midden, dichtbij, voorgrond). Verder weg = kleiner, trager, minder
 *    dekkend en een vervaagde sprite. De voorgrondlaag zijn een paar heel grote, zachte vlokken.
 *  - TELKENS ANDERS: alles komt uit één seed per sessie (crypto.getRandomValues). Vlokken starten
 *    verspreid over de hele hoogte, ieder met eigen snelheid en fase, dus geen golven.
 *  - INTENSITEIT: gladde ruis (1D-gradiëntruis) over tientallen seconden bepaalt welk deel van de
 *    vlokken meedoet. Een vlok wisselt alleen van 'aan' naar 'uit' als hij boven opnieuw begint,
 *    zodat er nooit vlokken midden in beeld verschijnen of verdwijnen.
 *  - STORM: af en toe (willekeurig, gemiddeld eens per paar minuten) een omhullende opbouw → piek →
 *    afzwakken, met wind van één kant, vlagen uit ruis, turbulentie per vlok en een witte waas.
 *    De wind reageert trager dan de storm, dus hij waait na.
 *  - VERVAGING ACHTER BLOKKEN: modus 'css' = de blokken krijgen backdrop-filter (zie CSS);
 *    modus 'canvas' = de module tekent vlokken die achter een blok met [data-ijs] vallen zelf
 *    vervaagd en zwakker. Dat ziet er hetzelfde uit (de achtergrond is verder egaal) en is veel
 *    lichter voor iOS Safari. 'auto' kiest canvas op iOS/iPadOS, anders css.
 */

/* =====================================================================================
 * INSTELLINGEN — alles op één plek. Elke waarde is te overschrijven via startSneeuw({...}).
 * ===================================================================================== */
export const STANDAARD = {
  /** Waar het canvas komt. Het krijgt position: fixed, z-index -1 en pointer-events: none. */
  doel: null, // null = document.body
  /**
   * true = één laag over het hele scherm, achter alle inhoud. false = de laag vult alleen het
   * doel (bijv. een donkerblauwe kop) en stopt vanzelf als dat blok uit beeld is gescrold.
   */
  vast: true,

  /** Vlokken per 100.000 css-px² scherm bij volle intensiteit (390×844 ≈ 3,3 × dit getal). */
  dichtheid: 62,
  /** Nooit meer dan dit aantal vlokken in totaal (ook niet op een groot scherm). */
  maxVlokken: 420,
  /** Nooit minder dan dit aantal in de pool (anders oogt een klein scherm leeg). */
  minVlokken: 90,

  /** Begrenzing van de devicePixelRatio: scherper dan 2 zie je niet aan sneeuw, het kost wel. */
  maxDpr: 2,
  /** Hoogstens zoveel frames per seconde (ook op 120 Hz-schermen): spaart de batterij. */
  maxFps: 60,

  /** Automatisch minder vlokken als de fps zakt. */
  autoKwaliteit: true,
  /** Onder dit deel van maxFps (gemiddeld over ~2 s) gaat de kwaliteit omlaag. */
  kwaliteitOndergrens: 0.86,
  /** Laagste kwaliteit: dit deel van de vlokken blijft altijd over. */
  minKwaliteit: 0.35,

  /** Sneeuwkristallen: hoeveel verschillende vormen er bij de start getekend worden (min. 8). */
  aantalVormen: 12,
  /** Resolutie van een sprite (css-px, maal dpr). Grote vlokken worden niet groter getekend. */
  spriteGrootte: 128,

  /**
   * De dieptelagen. aandeel = deel van de vlokken; grootte in css-px (doorsnede);
   * val = valsnelheid in px/s; zwaai = amplitude van het heen-en-weer (px);
   * dekking = maximale alpha; vaag = vervaging in px (op het scherm, ongeveer);
   * wind = hoeveel de wind deze laag meeneemt (parallax: dichtbij beweegt meer).
   */
  lagen: {
    ver:       { aan: true, aandeel: 0.46, grootte: [5, 9],   val: [16, 30],  zwaai: [4, 10],  dekking: 0.6,  vaag: 0.7, wind: 0.45 },
    midden:    { aan: true, aandeel: 0.34, grootte: [9, 17],  val: [30, 52],  zwaai: [8, 18],  dekking: 0.85, vaag: 0.2, wind: 0.75 },
    dichtbij:  { aan: true, aandeel: 0.19, grootte: [17, 30], val: [55, 90],  zwaai: [12, 28], dekking: 1,    vaag: 0,   wind: 1 },
    // Heel af en toe één grote, onscherpe vlok vlak voor de 'camera'
    voorgrond: { aan: true, aandeel: 0.006, grootte: [70, 130], val: [95, 150], zwaai: [20, 45], dekking: 0.42, vaag: 9, wind: 1.35, min: 1 },
  },

  /** Draaien (graden/s) en kantelen (hoe ver een vlok in één as ingedrukt raakt, 0–1). */
  draaiSnelheid: [6, 38],
  kanteling: [0.15, 0.6],
  /** Hoe snel het kantelen heen en weer gaat (Hz). */
  kantelTempo: [0.05, 0.22],

  /** Kleur van de vlok en een zachte rand, zodat een witte vlok ook op licht papier te zien is. */
  // Wit met een ijsblauwe rand: op crème papier lees je het als een ijskristal, op donkerblauw als
  // een witte vlok met een koele gloed. Puur wit op papier is vrijwel onzichtbaar.
  kleur: '#ffffff',
  rand: 'rgba(96, 160, 200, 0.95)', // op een donkere achtergrond mag dit zachter, bijv. rgba(150,200,230,.5)
  randBreedte: 3.4, // in sprite-px (bij spriteGrootte 128)

  /** Intensiteit: van 'paar losse vlokken' tot 'dicht', vloeiend via ruis. */
  intensiteit: {
    min: 0.07, // laagste deel van de pool dat meedoet (een paar losse vlokken)
    max: 0.72, // hoogste deel buiten een storm; de rest is voor de storm
    periode: 38, // seconden: tijdschaal van de grote golf in de ruis
    detail: 11, // seconden: kleinere schommelingen erbovenop
  },

  /** Wind buiten een storm: een zacht briesje dat langzaam van richting wisselt (px/s). */
  bries: 14,

  storm: {
    aan: true,
    /** Gemiddelde tijd tussen twee stormen (s); werkelijke wachttijd is willekeurig (exponentieel). */
    gemiddeldeWacht: 200,
    /** De eerste storm nooit eerder dan dit (s) na het openen. */
    eersteNa: 50,
    opbouw: [6, 10], // s: opbouwen
    duur: [10, 30], // s: volle storm
    afzwakken: [9, 15], // s: geleidelijk minder
    wind: 260, // px/s bij volle storm (dichtbij-laag)
    vlagen: 0.45, // 0–1: hoe sterk de wind in vlagen op en neer gaat
    turbulentie: 0.35, // 0–1: eigen afwijking per vlok (geen strakke lijnen)
    valFactor: 0.9, // vlokken vallen tot (1 + dit) keer zo snel
    waas: 0.16, // maximale witte waas (alpha) aan de windkant
    nawaaien: 9, // s: tijdconstante waarmee de wind na de storm uitdooft
    bewegingsonscherpte: true, // snelle vlokken krijgen een zachte 'veeg'
  },

  vervaging: {
    /** 'auto' | 'css' | 'canvas' (zie bovenaan). */
    modus: 'auto',
    /** Welke blokken als ijs gelden (alleen nodig voor modus 'canvas'). */
    selector: '[data-ijs]',
    /** Donkere blokken die een onderlaag krijgen (zie 'onderlaag'). */
    donker: '[data-ijs="donker"]',
    /**
     * Tekst die direct op het papier staat (zonder eigen blok): vlokken erachter worden in beide
     * modi vaag en zwak getekend, zodat ze nooit scherp door de letters lopen. Er verandert niets
     * aan de opmaak van de tekst zelf.
     */
    tekst: '[data-ijs="tekst"]',
    tekstDoorzicht: 0.4,
    /** Vervaging in px achter een blok (modus canvas; voor css staat hij in --ijs-vaag). */
    vaag: 7,
    /**
     * …maar nooit meer dan dit deel van de vlokgrootte: dan blijft een vage vlok een zesarmige vlok
     * (zacht) en wordt hij geen vlek. 0,12 = een vlok van 20 px vervaagt hooguit 2,4 px.
     */
    vaagMaxDeel: 0.12,
    /** Extra dimmen van vlokken achter een blok (modus canvas, 1 = alleen vervagen, net als css). */
    doorzicht: 1,
    /**
     * Onderlaag voor donkere blokken ([data-ijs="donker"]): een halfdoorzichtig navy blok over
     * crème papier wordt paarsgrijs. Daarom tekent het canvas precies onder zo'n blok eerst een vlak
     * in de kleur uit de CSS-variabele --ijs-onder, dán de vlokken. Het blok zelf kan dan ~70%
     * dekkend zijn en heeft toch exact de huisstijlkleur, met de sneeuw zichtbaar erdoorheen.
     */
    onderlaag: true,
  },

  /** prefers-reduced-motion: 'rustig' = trage, dunne sneeuw zonder storm; 'stil' = stilstaand beeld. */
  minderBeweging: 'rustig',

  /** Begint de sneeuw aan? null = uit de opslag (opslagSleutel), anders true/false. */
  aan: null,

  /** localStorage-sleutel waarin aan/uit wordt onthouden (null = niet onthouden). */
  opslagSleutel: 'tweeslag-wispo.sneeuw.aan',

  /** Seed: null = elke sessie een nieuwe uit crypto.getRandomValues. */
  seed: null,
}

/* ===================================================================================== */

/** Kleine snelle PRNG (mulberry32) zodat alles uit één seed komt. */
function maakToeval(seed) {
  let a = seed >>> 0
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  r.tussen = (a2, b) => a2 + (b - a2) * r()
  r.uit = (lijst) => lijst[Math.floor(r() * lijst.length)]
  return r
}

function nieuweSeed() {
  const buf = new Uint32Array(1)
  try {
    crypto.getRandomValues(buf)
  } catch {
    buf[0] = (Date.now() * 2654435761) >>> 0
  }
  return buf[0]
}

/** 1D-gradiëntruis (Perlin): glad, waarden ongeveer tussen -1 en 1. */
function maakRuis(toeval) {
  const g = new Float32Array(256)
  for (let i = 0; i < 256; i++) g[i] = toeval() * 2 - 1
  return (x) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * f * (f * (f * 6 - 15) + 10)
    const a = g[i & 255] * f
    const b = g[(i + 1) & 255] * (f - 1)
    return (a + u * (b - a)) * 2
  }
}

const klem = (x, a, b) => (x < a ? a : x > b ? b : x)
const glad = (a, b, x) => {
  const t = klem((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/* ------------------------------ Sneeuwkristallen tekenen ------------------------------ */

/*
 * Vormen naar de indeling van Kenneth Libbrecht (snowcrystals.com): stervormige dendriet,
 * varenachtige dendriet, sterplaatje, gesectoreerd plaatje, eenvoudige ster, hexagonaal plaatje,
 * dendriet met plaatjes op de punten, brede-armenster. Alles zesvoudig symmetrisch; binnen een arm
 * spiegelsymmetrisch, met kleine willekeurige variatie per sessie.
 */
const VORMEN = ['dendriet', 'varen', 'sterplaat', 'sector', 'ster', 'plaat', 'puntplaat', 'breed']

/** Tekent één arm (naar boven, y negatief) op ctx; R = armlengte. Wordt 6× gedraaid aangeroepen. */
function tekenArm(ctx, soort, R, p) {
  const lijn = (x1, y1, x2, y2) => {
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
  }
  const tak = (y, len, hoek = Math.PI / 3) => {
    // twee zijtakjes op hoogte y, gespiegeld, onder 60° (zoals bij echte kristallen)
    const dx = Math.sin(hoek) * len
    const dy = Math.cos(hoek) * len
    lijn(0, y, -dx, y - dy)
    lijn(0, y, dx, y - dy)
  }
  const zeshoekPad = (cx, cy, r) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.closePath()
  }

  switch (soort) {
    case 'dendriet': {
      ctx.beginPath()
      lijn(0, 0, 0, -R)
      for (const t of p.takken) {
        tak(-R * t.y, R * t.l)
        // subtakjes op de grootste takken
        if (t.l > 0.24) {
          const len = R * t.l
          const s = Math.sin(Math.PI / 3)
          const c = Math.cos(Math.PI / 3)
          for (const side of [-1, 1]) {
            const mx = side * s * len * 0.55
            const my = -R * t.y - c * len * 0.55
            lijn(mx, my, mx + side * len * 0.18, my - len * 0.18 * 0.2)
            lijn(mx, my, mx, my - len * 0.2)
          }
        }
      }
      ctx.stroke()
      break
    }
    case 'varen': {
      ctx.beginPath()
      lijn(0, 0, 0, -R)
      const n = p.dicht
      for (let i = 0; i < n; i++) {
        const y = 0.22 + (i / n) * 0.74
        // takken worden naar de punt toe korter, met wat ruis
        const l = (0.3 - y * 0.24) * p.ruis[i]
        tak(-R * y, R * Math.max(0.04, l), Math.PI / 3)
      }
      ctx.stroke()
      break
    }
    case 'sterplaat': {
      // brede arm die uitloopt in een plaatje
      ctx.beginPath()
      lijn(0, 0, 0, -R * 0.62)
      ctx.stroke()
      ctx.beginPath()
      zeshoekPad(0, -R * 0.78, R * 0.2)
      ctx.globalAlpha = 0.45
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      ctx.beginPath()
      tak(-R * 0.4, R * 0.16)
      lijn(0, -R * 0.66, 0, -R * 0.94)
      ctx.stroke()
      break
    }
    case 'sector': {
      // een sector van een zeshoekig plaatje met ribbels naar de punt
      const w = R * 0.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-w * 0.58, -R * 0.86)
      ctx.lineTo(0, -R)
      ctx.lineTo(w * 0.58, -R * 0.86)
      ctx.closePath()
      ctx.globalAlpha = 0.3
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      ctx.beginPath()
      lijn(0, 0, 0, -R)
      for (const y of p.ribbels) {
        tak(-R * y, R * (1 - y) * 0.45)
      }
      ctx.stroke()
      break
    }
    case 'ster': {
      ctx.beginPath()
      lijn(0, 0, 0, -R)
      tak(-R * p.y1, R * p.l1)
      if (p.twee) tak(-R * p.y2, R * p.l2)
      ctx.stroke()
      break
    }
    case 'plaat': {
      // wordt in tekenKristal als geheel getekend; hier alleen de ribbel + een stip
      ctx.beginPath()
      lijn(0, -R * 0.2, 0, -R * 0.62)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, -R * 0.75, R * 0.05, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'puntplaat': {
      ctx.beginPath()
      lijn(0, 0, 0, -R * 0.82)
      tak(-R * 0.3, R * 0.2)
      tak(-R * 0.55, R * 0.16)
      ctx.stroke()
      ctx.beginPath()
      zeshoekPad(0, -R * 0.88, R * 0.12)
      ctx.globalAlpha = 0.5
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      break
    }
    case 'breed': {
      // brede, platte arm met een inkeping: lijkt op een geplette sterplaat
      const w = R * 0.11
      ctx.beginPath()
      ctx.moveTo(-w, 0)
      ctx.lineTo(-w, -R * 0.7)
      ctx.lineTo(-w * 1.9, -R * 0.82)
      ctx.lineTo(0, -R)
      ctx.lineTo(w * 1.9, -R * 0.82)
      ctx.lineTo(w, -R * 0.7)
      ctx.lineTo(w, 0)
      ctx.globalAlpha = 0.4
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.stroke()
      ctx.beginPath()
      lijn(0, -R * 0.15, 0, -R * 0.85)
      tak(-R * 0.45, R * 0.2)
      ctx.stroke()
      break
    }
  }
}

function tekenKristal(ctx, soort, R, p, kleur, rand, randBreedte, lijnDikte) {
  const zeshoek = (r, rot = Math.PI / 6) => {
    ctx.beginPath()
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rot
      k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
  }
  const alles = (stroke, fill, dikte) => {
    ctx.strokeStyle = stroke
    ctx.fillStyle = fill
    ctx.lineWidth = dikte
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // kern: een klein zeshoekje in het midden, zoals bij echte kristallen
    const kern = soort === 'plaat' ? R * 0.92 : soort === 'sector' ? R * 0.2 : R * p.kern
    zeshoek(kern, 0)
    ctx.globalAlpha = soort === 'plaat' ? 0.38 : 0.55
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.stroke()
    if (soort === 'plaat') {
      zeshoek(R * 0.5, 0)
      ctx.stroke()
    }
    for (let k = 0; k < 6; k++) {
      ctx.save()
      ctx.rotate((k / 6) * Math.PI * 2)
      tekenArm(ctx, soort, R, p)
      ctx.restore()
    }
  }
  // eerst de rand (iets dikker, gekleurd), dan de vlok zelf eroverheen
  if (rand && rand !== 'transparent') alles(rand, rand, lijnDikte + randBreedte)
  alles(kleur, kleur, lijnDikte)
}

/** Willekeurige maar plausibele parameters per vorm (zodat elke sessie andere kristallen heeft). */
function vormParameters(soort, r) {
  const p = { kern: r.tussen(0.07, 0.14) }
  if (soort === 'dendriet') {
    const n = 3 + Math.floor(r() * 3)
    p.takken = Array.from({ length: n }, (_, i) => ({
      y: 0.25 + (i / n) * 0.62 + r.tussen(-0.04, 0.04),
      l: r.tussen(0.12, 0.34) * (1 - i / (n + 2)),
    }))
  } else if (soort === 'varen') {
    p.dicht = 9 + Math.floor(r() * 6)
    p.ruis = Array.from({ length: p.dicht }, () => r.tussen(0.75, 1.25))
  } else if (soort === 'sector') {
    p.ribbels = [r.tussen(0.3, 0.42), r.tussen(0.55, 0.7)]
  } else if (soort === 'ster') {
    p.y1 = r.tussen(0.45, 0.65)
    p.l1 = r.tussen(0.16, 0.28)
    p.twee = r() < 0.6
    p.y2 = r.tussen(0.72, 0.84)
    p.l2 = r.tussen(0.08, 0.15)
  }
  return p
}

function maakCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(w, h)
    } catch {}
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

let filterSteun = null
function kanFilter() {
  if (filterSteun !== null) return filterSteun
  try {
    const c = document.createElement('canvas').getContext('2d')
    c.filter = 'blur(2px)'
    filterSteun = c.filter === 'blur(2px)'
  } catch {
    filterSteun = false
  }
  return filterSteun
}

/**
 * Een vervaagde kopie van een sprite, met een eigen vervaging op de pixels (drie keer een box-blur,
 * dat benadert een gaussische vervaging). Op elk toestel hetzelfde: Safari kent ctx.filter niet, en de
 * oude terugval (klein tekenen en weer vergroten) maakte van kleine vlokken vierkante blokjes.
 */
function vervaag(bron, px, uitGrootte) {
  const doel = maakCanvas(uitGrootte, uitGrootte)
  const ctx = doel.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bron, 0, 0, uitGrootte, uitGrootte)
  const straal = Math.round((px * uitGrootte) / bron.width * 0.75)
  if (straal < 1) return doel
  const beeld = ctx.getImageData(0, 0, uitGrootte, uitGrootte)
  boxVervaging(beeld.data, uitGrootte, uitGrootte, straal)
  ctx.putImageData(beeld, 0, 0)
  return doel
}

/**
 * Drie keer horizontaal + verticaal een glijdend gemiddelde, op 'voorvermenigvuldigde' kleuren (anders
 * krijgen de witte armen een donkere rand van de doorzichtige pixels eromheen).
 */
function boxVervaging(d, w, h, r) {
  const n = w * h
  const kan = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)]
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255
    kan[0][i] = d[i * 4] * a
    kan[1][i] = d[i * 4 + 1] * a
    kan[2][i] = d[i * 4 + 2] * a
    kan[3][i] = d[i * 4 + 3]
  }
  const tmp = new Float32Array(n)
  const breed = 2 * r + 1
  const lijn = (bron, uit, start, stap, lengte) => {
    // glijdend gemiddelde langs één rij of kolom; buiten de rand telt als doorzichtig
    let som = 0
    for (let k = 0; k <= r && k < lengte; k++) som += bron[start + k * stap]
    for (let k = 0; k < lengte; k++) {
      uit[start + k * stap] = som / breed
      const erbij = k + r + 1
      const eraf = k - r
      if (erbij < lengte) som += bron[start + erbij * stap]
      if (eraf >= 0) som -= bron[start + eraf * stap]
    }
  }
  for (const c of kan) {
    for (let keer = 0; keer < 3; keer++) {
      for (let y = 0; y < h; y++) lijn(c, tmp, y * w, 1, w)
      for (let x = 0; x < w; x++) lijn(tmp, c, x, w, h)
    }
  }
  for (let i = 0; i < n; i++) {
    const a = kan[3][i]
    d[i * 4 + 3] = a
    const f = a > 0.5 ? 255 / a : 0
    d[i * 4] = Math.min(255, kan[0][i] * f)
    d[i * 4 + 1] = Math.min(255, kan[1][i] * f)
    d[i * 4 + 2] = Math.min(255, kan[2][i] * f)
  }
}

/*
 * Vaagniveaus in sprite-px (bij een vlokstraal van 0.31 × spriteGrootte). Op het scherm kiest de
 * module per vlok het niveau dat het dichtst bij de gewenste vervaging in schermpixels komt.
 */
const VAAG_NIVEAUS = [0, 2.5, 5, 9, 15, 24]

function maakSprites(cfg, r, dpr) {
  const S = Math.round(cfg.spriteGrootte * Math.min(dpr, 1.5))
  const R = S * 0.31 // straal van de vlok; de rest is ruimte voor de vervaging
  const lijnDikte = Math.max(1.4, S / 52)
  const randBreedte = (cfg.randBreedte * S) / 128
  const n = Math.max(8, cfg.aantalVormen)
  // elke vorm minstens één keer, daarna willekeurig aanvullen
  const soorten = [...VORMEN]
  while (soorten.length < n) soorten.push(r.uit(['dendriet', 'dendriet', 'varen', 'ster', 'sterplaat', 'sector', 'puntplaat']))
  return soorten.map((soort) => {
    const p = vormParameters(soort, r)
    const scherp = maakCanvas(S, S)
    const ctx = scherp.getContext('2d')
    ctx.translate(S / 2, S / 2)
    ctx.rotate(r() * Math.PI) // ieder kristal begint in een andere stand
    tekenKristal(ctx, soort, R, p, cfg.kleur, cfg.rand, randBreedte, lijnDikte)
    // Vervaagde versies pas maken als een vlok ze voor het eerst nodig heeft (spreidt het rekenwerk;
    // veel niveaus worden nooit gebruikt), en op een kleiner canvas: na het vervagen is er toch geen
    // fijn detail meer, en vergroten van iets vaags valt niet op.
    const niveaus = [scherp]
    const niveau = (i) => {
      if (!niveaus[i]) {
        const px = (VAAG_NIVEAUS[i] * S) / 128
        const kleiner = Math.min(2, Math.max(1, px / 8)) // hooguit de helft: anders verdwijnen de armen
        niveaus[i] = vervaag(scherp, px, Math.max(24, Math.round(S / kleiner)))
      }
      return niveaus[i]
    }
    return { soort, niveaus, niveau, straalDeel: 0.31 }
  })
}

/* ------------------------------------- Het weer --------------------------------------- */

/*
 * Intensiteit en storm zijn gedeeld door alle sneeuwlagen op de pagina. Elke donkere kop heeft
 * een eigen canvas, maar het sneeuwt overal even hard en een storm loopt gewoon door als je van
 * tab wisselt. De tijd komt van de klok, zodat het weer ook doorgaat als er niets getekend wordt.
 */
let WEER = null
function maakWeer(seed) {
  const r = maakToeval(seed)
  return {
    seed,
    r,
    ruisI: maakRuis(r),
    ruisD: maakRuis(r),
    ruisW: maakRuis(r),
    ruisV: maakRuis(r),
    ruisT: maakRuis(r),
    // begin op een willekeurige plek in de ruis
    t0: performance.now() / 1000 - r() * 1000,
    storm: { fase: 'rust', tot: -1, kracht: 0, richting: 1, opbouw: 8, duur: 20, afzwakken: 12, start: 0 },
  }
}
const klok = () => performance.now() / 1000 - WEER.t0
let aantalLagen = 0

/** Sprites zijn per sessie hetzelfde: niet voor elke kop opnieuw tekenen */
const SPRITES = new Map()

/* ------------------------------------- De motor -------------------------------------- */

export function startSneeuw(eigen = {}) {
  const cfg = samenvoegen(JSON.parse(JSON.stringify(STANDAARD)), eigen)
  const doel = cfg.doel || document.body

  const canvas = document.createElement('canvas')
  canvas.className = 'sneeuwlaag'
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    // vast: over het hele scherm, achter alle inhoud; anders: vult het eigen blok (bijv. een kop)
    position: cfg.vast ? 'fixed' : 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: cfg.vast ? '-1' : '',
    pointerEvents: 'none',
    display: 'block',
    contain: 'strict',
  })
  doel.prepend(canvas)
  const ctx = canvas.getContext('2d', { alpha: true })

  const ios =
    /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const bepaalModus = () => (cfg.vervaging.modus === 'auto' ? (ios ? 'canvas' : 'css') : cfg.vervaging.modus)
  const zetModusKlasse = () => {
    if (!cfg.vast) return
    const m = bepaalModus()
    document.documentElement.classList.toggle('ijs-canvas', m === 'canvas')
    document.documentElement.classList.toggle('ijs-css', m === 'css')
  }

  const rm = window.matchMedia('(prefers-reduced-motion: reduce)')
  let minderBeweging = rm.matches
  let forceerMinder = null // debug: null = volg systeem

  let seed, r, ruisI, ruisD, ruisW, ruisV, ruisT, sprites
  let breedte = 0
  let hoogte = 0
  let dpr = 1
  let vlokken = []
  let t = 0 // simulatietijd in s
  let kwaliteit = 1
  let geforceerdeIntensiteit = null
  let aan = leesAan()
  let raf = 0
  let vorige = 0
  let laatsteTeken = 0
  const meting = { fps: 0, jsMs: 0, frames: 0, sinds: 0, jsSom: 0, laag: 0, hoog: 0 }
  // storm (gedeeld, zie WEER): fase 'rust' | 'opbouw' | 'vol' | 'af'. De wind is per laag, die
  // volgt de storm met wat vertraging (nawaaien).
  let storm
  let wind = 0
  let ijsVlakken = []
  let meetTeller = 0
  let meetVuil = true

  function leesAan() {
    if (cfg.aan !== null && cfg.aan !== undefined) return !!cfg.aan
    if (!cfg.opslagSleutel) return true
    try {
      return localStorage.getItem(cfg.opslagSleutel) !== 'uit'
    } catch {
      return true
    }
  }

  function initSeed(s) {
    const nieuw = s !== undefined || !WEER || (cfg.seed !== null && cfg.seed !== undefined && WEER.seed !== cfg.seed)
    if (nieuw) WEER = maakWeer(s ?? cfg.seed ?? nieuweSeed())
    ;({ seed, ruisI, ruisD, ruisW, ruisV, ruisT, storm } = WEER)
    t = klok()
    if (storm.tot < 0) plan(Math.max(cfg.storm.eersteNa, wachtTijd()))
    // eigen vlokken per laag, het weer is gedeeld
    r = maakToeval(seed ^ Math.imul(++aantalLagen, 0x9e3779b1))
    wind = storm.kracht * storm.richting
  }

  function wachtTijd() {
    return -Math.log(1 - WEER.r()) * cfg.storm.gemiddeldeWacht
  }
  function plan(over) {
    storm.fase = 'rust'
    storm.tot = t + over
  }

  function meetScherm() {
    dpr = Math.min(window.devicePixelRatio || 1, cfg.maxDpr)
    // de werkelijke maat van het canvas (zonder scrollbalk; volgt ook de iOS-adresbalk)
    breedte = canvas.clientWidth || window.innerWidth
    hoogte = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(breedte * dpr)
    canvas.height = Math.round(hoogte * dpr)
  }

  function maakVlok(laagNaam, overalInBeeld) {
    const L = cfg.lagen[laagNaam]
    const grootte = r.tussen(L.grootte[0], L.grootte[1])
    const sprite = Math.floor(r() * sprites.length)
    const v = {
      laag: laagNaam,
      L,
      sprite,
      grootte,
      x: r() * breedte,
      y: overalInBeeld ? r() * (hoogte + 2 * grootte) - grootte : -grootte - r() * hoogte * 0.2,
      vx: 0,
      val: r.tussen(L.val[0], L.val[1]),
      zwaai: r.tussen(L.zwaai[0], L.zwaai[1]),
      zwaaiTempo: r.tussen(0.12, 0.45) * (laagNaam === 'ver' ? 0.7 : 1),
      fase: r() * Math.PI * 2,
      hoek: r() * Math.PI * 2,
      draai: (r() < 0.5 ? -1 : 1) * r.tussen(cfg.draaiSnelheid[0], cfg.draaiSnelheid[1]) * (Math.PI / 180),
      kantel: r.tussen(cfg.kanteling[0], cfg.kanteling[1]),
      kantelTempo: r.tussen(cfg.kantelTempo[0], cfg.kantelTempo[1]) * Math.PI * 2,
      kantelFase: r() * Math.PI * 2,
      drempel: r(), // doet mee als drempel < intensiteit
      ruis: r() * 200,
      dekking: L.dekking * r.tussen(0.75, 1),
      actief: false,
    }
    // vaagniveau uit de gewenste vervaging op het scherm
    v.niveau = kiesNiveau(L.vaag, grootte)
    v.ijsNiveau = kiesNiveau(Math.hypot(L.vaag, ijsVaag(grootte)), grootte)
    return v
  }

  /** Vervaging achter een blok: nooit meer dan een deel van de vlok zelf, zodat de vorm herkenbaar blijft */
  function ijsVaag(grootte) {
    return Math.min(cfg.vervaging.vaag, grootte * cfg.vervaging.vaagMaxDeel)
  }

  function kiesNiveau(schermPx, grootte) {
    if (schermPx <= 0.05) return 0
    // schermpx → sprite-px: de vlok (straal 0.31 S) wordt getekend op grootte/2
    const spritePx = (schermPx * 0.31 * 128) / (grootte / 2)
    let beste = 0
    let afstand = Infinity
    VAAG_NIVEAUS.forEach((n, i) => {
      const d = Math.abs(Math.log((n + 0.5) / (spritePx + 0.5)))
      if (d < afstand) {
        afstand = d
        beste = i
      }
    })
    return beste
  }

  function vulPool() {
    const oppervlak = (breedte * hoogte) / 100000
    const n = klem(Math.round(cfg.dichtheid * oppervlak), cfg.minVlokken, cfg.maxVlokken)
    vlokken = []
    for (const naam of Object.keys(cfg.lagen)) {
      const L = cfg.lagen[naam]
      const aantal = Math.max(L.min || 0, Math.round(n * L.aandeel))
      for (let i = 0; i < aantal; i++) vlokken.push(maakVlok(naam, true))
    }
    // door elkaar, zodat 'minder kwaliteit' (de staart afknippen) alle lagen evenredig raakt
    for (let i = vlokken.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[vlokken[i], vlokken[j]] = [vlokken[j], vlokken[i]]
    }
    // ver weg eerst tekenen, voorgrond als laatste
    const volgorde = { ver: 0, midden: 1, dichtbij: 2, voorgrond: 3 }
    vlokken.forEach((v, i) => (v.index = i))
    vlokken.sort((a, b) => volgorde[a.laag] - volgorde[b.laag])
    const I = intensiteit()
    for (const v of vlokken) v.actief = v.drempel < I
  }

  /** Huidige intensiteit: deel van de pool dat meedoet (0–1). */
  function intensiteit() {
    if (geforceerdeIntensiteit !== null) return geforceerdeIntensiteit
    const c = cfg.intensiteit
    const n = 0.68 * ruisI(t / c.periode) + 0.32 * ruisD(t / c.detail)
    let basis = c.min + (c.max - c.min) * glad(-0.55, 0.6, n)
    if (isMinder()) basis = Math.min(basis, 0.3)
    // in een storm komt de rest van de pool erbij
    return basis + (1 - basis) * storm.kracht
  }

  function isMinder() {
    return forceerMinder ?? minderBeweging
  }

  function startStorm(richting) {
    if (isMinder()) return
    const s = cfg.storm
    const wr = WEER.r
    storm.richting = richting === 'links' ? 1 : richting === 'rechts' ? -1 : wr() < 0.5 ? 1 : -1 // links = wind van links → naar rechts
    storm.opbouw = wr.tussen(s.opbouw[0], s.opbouw[1])
    storm.duur = wr.tussen(s.duur[0], s.duur[1])
    storm.afzwakken = wr.tussen(s.afzwakken[0], s.afzwakken[1])
    storm.fase = 'opbouw'
    // als er al wat storm is, vloeiend verder vanaf de huidige kracht
    storm.start = t - storm.kracht * storm.opbouw
  }

  function stopStorm() {
    if (storm.fase === 'rust') return
    storm.fase = 'af'
    storm.start = t - (1 - storm.kracht) * storm.afzwakken
  }

  function werkStormBij(dt) {
    const s = cfg.storm
    if (storm.fase === 'rust') {
      storm.kracht = 0
      if (s.aan && !isMinder() && t >= storm.tot) startStorm()
    } else if (storm.fase === 'opbouw') {
      const f = (t - storm.start) / storm.opbouw
      storm.kracht = glad(0, 1, f)
      if (f >= 1) {
        storm.fase = 'vol'
        storm.start = t
      }
    } else if (storm.fase === 'vol') {
      // in de volle storm zelf schommelt de kracht ook een beetje
      storm.kracht = 0.86 + 0.14 * (0.5 + 0.5 * ruisV(t / 4))
      if (t - storm.start >= storm.duur) stopStorm()
    } else if (storm.fase === 'af') {
      const f = (t - storm.start) / storm.afzwakken
      storm.kracht = Math.min(storm.kracht, 1 - glad(0, 1, f))
      if (f >= 1) {
        storm.kracht = 0
        plan(Math.max(40, wachtTijd()))
      }
    }
    // De wind volgt de storm traag (opbouwen ~2,5 s, uitdoven = nawaaien)
    const doelWind = storm.kracht * storm.richting
    const tau = Math.abs(doelWind) > Math.abs(wind) ? 2.5 : s.nawaaien
    wind += (doelWind - wind) * (1 - Math.exp(-dt / tau))
  }

  function stap(dt) {
    t = klok()
    werkStormBij(dt)
    const sc = cfg.storm
    const traag = isMinder() ? 0.35 : 1
    const I = intensiteit()
    // wind: bries + storm met vlagen (twee ruislagen, een snelle en een langzame)
    const vlaag = 1 - sc.vlagen + sc.vlagen * (0.5 + 0.5 * ruisW(t * 0.33)) * (1.2 + 0.5 * ruisV(t * 0.11))
    const bries = cfg.bries * ruisW(t / 23 + 50) * traag
    const stormWind = wind * sc.wind * vlaag
    const valFactor = 1 + sc.valFactor * Math.abs(wind)
    const limiet = Math.ceil(vlokken.length * kwaliteit)

    for (const v of vlokken) {
      const L = v.L
      // turbulentie per vlok: eigen ruis, sterker als het stormt
      const turb = ruisT(v.ruis + t * 0.5) * (8 + sc.turbulentie * Math.abs(stormWind))
      const doelVx = (bries + stormWind) * L.wind + turb * L.wind
      // kleine vlokken volgen de wind sneller dan grote
      const volg = 1 - Math.exp(-dt * (3.2 - Math.min(2.4, v.grootte / 30)))
      v.vx += (doelVx - v.vx) * volg
      v.x += v.vx * dt
      v.y += v.val * valFactor * traag * dt * (L === cfg.lagen.voorgrond ? 1 : 1 - 0.08 * Math.sin(t * v.zwaaiTempo * 2 + v.fase))
      v.hoek += v.draai * dt * traag * (1 + Math.abs(wind) * 1.5)

      const marge = v.grootte
      if (v.y > hoogte + marge) {
        // boven opnieuw beginnen; nu pas beslissen of hij meedoet (geen plotselinge sprongen)
        v.y = -marge - r() * 40
        v.x = r() * (breedte + 2 * marge) - marge
        v.vx = (bries + stormWind) * L.wind
        v.actief = v.drempel < I && v.index < limiet
        if (v.laag === 'voorgrond') v.actief = v.actief && r() < 0.35 // echt af en toe
      }
      // zijwaarts uit beeld (storm) → aan de andere kant terug
      const span = breedte + 2 * marge + 2 * v.zwaai
      if (v.x > breedte + marge + v.zwaai) v.x -= span
      else if (v.x < -marge - v.zwaai) v.x += span
    }
  }

  // stijlgegevens per blok (radius, onderlaagkleur) niet elk frame opnieuw uitrekenen
  let stijlCache = new WeakMap()
  let stijlFrame = 0
  let onderlagen = []
  function meetIjs() {
    ijsVlakken = []
    onderlagen = []
    const vv = cfg.vervaging
    const canvasModus = bepaalModus() === 'canvas'
    const zoek = []
    if (canvasModus) zoek.push(vv.selector)
    else if (vv.onderlaag) zoek.push(vv.donker)
    if (vv.tekst) zoek.push(vv.tekst)
    if (!zoek.length) return
    if (++stijlFrame > 90) {
      stijlFrame = 0
      stijlCache = new WeakMap()
    }
    // Vaste laag: blokken overal op de pagina, in schermcoördinaten. Laag in een blok (vast:
    // false): alleen blokken binnen dat blok (bijv. de knoppen in een kop), ten opzichte van het canvas.
    const bereik = cfg.vast ? document : doel.parentElement || doel
    const c = cfg.vast ? null : canvas.getBoundingClientRect()
    const dx = c ? c.left : 0
    const dy = c ? c.top : 0
    for (const el of bereik.querySelectorAll(zoek.join(', '))) {
      const rb = el.getBoundingClientRect()
      const b = { left: rb.left - dx, top: rb.top - dy, bottom: rb.bottom - dy, width: rb.width, height: rb.height }
      if (b.bottom < 0 || b.top > hoogte || b.width === 0) continue
      let st = stijlCache.get(el)
      if (!st) {
        const cs = getComputedStyle(el)
        st = {
          r: parseFloat(cs.borderTopLeftRadius) || 0,
          onder: cs.getPropertyValue('--ijs-onder').trim(),
          donker: el.matches(vv.donker),
          tekst: !!vv.tekst && el.matches(vv.tekst),
        }
        stijlCache.set(el, st)
      }
      const vlak = { x: b.left, y: b.top, w: b.width, h: b.height, r: st.r, doorzicht: st.tekst ? vv.tekstDoorzicht : vv.doorzicht }
      if (canvasModus || st.tekst) ijsVlakken.push(vlak)
      if (st.donker && vv.onderlaag && st.onder) onderlagen.push({ ...vlak, kleur: st.onder })
    }
  }

  function vlakkenPad(c) {
    for (const v of ijsVlakken) {
      if (c.roundRect) c.roundRect(v.x, v.y, v.w, v.h, v.r)
      else c.rect(v.x, v.y, v.w, v.h)
    }
  }

  function overlaptIjs(x, y, h) {
    for (const v of ijsVlakken) {
      if (x + h > v.x && x - h < v.x + v.w && y + h > v.y && y - h < v.y + v.h) return v
    }
    return null
  }
  function geheelInIjs(x, y, h) {
    for (const v of ijsVlakken) {
      if (x - h > v.x + v.r * 0.3 && x + h < v.x + v.w - v.r * 0.3 && y - h > v.y + v.r * 0.3 && y + h < v.y + v.h - v.r * 0.3) return v
    }
    return null
  }

  /** Waar de vlok nu echt staat (met het heen-en-weer zwaaien erbij) */
  const zwaaiX = (v) => v.x + Math.sin(t * v.zwaaiTempo * Math.PI * 2 * 0.5 + v.fase) * v.zwaai

  function tekenVlok(v, niveau, alpha) {
    const spr = sprites[v.sprite]
    // Nog niet klaar? Dan heel even de scherpe versie; de vage wordt in een rustig moment gemaakt
    let img = spr.niveaus[niveau]
    if (!img) {
      vraagAan(v.sprite, niveau)
      img = spr.niveaus[0]
    }
    const k = 1 - v.kantel * (0.5 + 0.5 * Math.sin(t * v.kantelTempo + v.kantelFase))
    const cos = Math.cos(v.hoek)
    const sin = Math.sin(v.hoek)
    const x = zwaaiX(v)
    // de sprite is S breed en de vlok heeft straal 0.31 S → schaal zo dat de vlok 'grootte' breed is
    const s = v.grootte / (2 * 0.31 * img.width) * dpr
    ctx.globalAlpha = alpha
    // draaien én in één as indrukken (= kantelen in 3D, goedkoop)
    ctx.setTransform(cos * s, sin * s, -sin * s * k, cos * s * k, x * dpr, v.y * dpr)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    // bewegingsonscherpte: een zwakke kopie een stukje terug langs de baan
    if (cfg.storm.bewegingsonscherpte && niveau < 4) {
      const snel = Math.abs(v.vx)
      if (snel > 120 && v.laag !== 'ver') {
        const terug = (v.vx / 60) * 1.6
        ctx.globalAlpha = alpha * 0.35
        ctx.setTransform(cos * s, sin * s, -sin * s * k, cos * s * k, (x - terug) * dpr, (v.y - (v.val / 60) * 1.6) * dpr)
        ctx.drawImage(img, -img.width / 2, -img.height / 2)
      }
    }
  }

  let lagenAan = null
  function teken() {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (onderlagen.length) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalAlpha = 1
      for (const o of onderlagen) {
        ctx.fillStyle = o.kleur
        ctx.beginPath()
        // 0,5 px naar binnen: bij snel scrollen kan het canvas een frame achterlopen
        if (ctx.roundRect) ctx.roundRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1, Math.max(0, o.r - 0.5))
        else ctx.rect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1)
        ctx.fill()
      }
    }
    const canvasIjs = ijsVlakken.length > 0
    let n = 0
    for (const v of vlokken) {
      if (!v.actief || !v.L.aan) continue
      n++
      // Test op de plek waar de vlok echt getekend wordt, met zijn echte straal. Alleen een vlok die
      // er met marge helemaal achter zit (ook de vage rand) wordt in z'n geheel vaag; steekt hij er
      // ook maar een beetje uit, dan is alleen het deel achter het blok vaag en de rest scherp.
      // (Eerder werd hier met grootte − zwaai gerekend; dat is vaak negatief, waardoor een vlok die
      // nog half buiten het blok zat al in één keer vaag werd.)
      const xm = zwaaiX(v)
      const straal = v.grootte * 0.5 + 2
      const raak = canvasIjs ? overlaptIjs(xm, v.y, straal) : null
      if (raak) {
        const binnen = geheelInIjs(xm, v.y, straal + cfg.vervaging.vaag)
        if (binnen) {
          tekenVlok(v, v.ijsNiveau, v.dekking * binnen.doorzicht)
        } else {
          const doorzicht = raak.doorzicht
          // half achter een blok: buiten het blok scherp, erin vaag (twee keer geclipt)
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.beginPath()
          ctx.rect(0, 0, canvas.width, canvas.height)
          ctx.scale(dpr, dpr)
          vlakkenPad(ctx)
          ctx.clip('evenodd')
          tekenVlok(v, v.niveau, v.dekking)
          ctx.restore()
          ctx.save()
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.beginPath()
          vlakkenPad(ctx)
          ctx.clip()
          tekenVlok(v, v.ijsNiveau, v.dekking * doorzicht)
          ctx.restore()
        }
      } else {
        tekenVlok(v, v.niveau, v.dekking)
      }
    }
    // witte waas aan de windkant tijdens een storm
    const w = Math.abs(wind) * cfg.storm.waas
    if (w > 0.004) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      const links = wind > 0
      const g = ctx.createLinearGradient(links ? 0 : canvas.width, 0, links ? canvas.width : 0, 0)
      g.addColorStop(0, `rgba(255,255,255,${w.toFixed(3)})`)
      g.addColorStop(0.55, `rgba(255,255,255,${(w * 0.45).toFixed(3)})`)
      g.addColorStop(1, `rgba(255,255,255,${(w * 0.15).toFixed(3)})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.globalAlpha = 1
    return n
  }

  let zichtbaar = 0
  function frame(nu) {
    raf = requestAnimationFrame(frame)
    if (!vorige) vorige = nu
    // fps-begrenzing (bijv. 60 op een 120 Hz-scherm)
    const minAfstand = 1000 / cfg.maxFps - 1.5
    if (nu - laatsteTeken < minAfstand) return
    const dt = Math.min(0.05, (nu - vorige) / 1000) // na een hapering niet ineens ver springen
    vorige = nu
    laatsteTeken = nu
    const begin = performance.now()
    stap(dt)
    // De glazen blokken opmeten dwingt de browser de pagina op te maken. In een kop scrollen ze met
    // de sneeuw mee, dus elke 8e frame is genoeg (en meteen als de kop van maat verandert); als vaste
    // achtergrond over de pagina schuiven ze bij het scrollen, dan elk frame.
    if (cfg.vast || meetVuil || ++meetTeller >= 8) {
      meetTeller = 0
      meetVuil = false
      meetIjs()
    }
    zichtbaar = teken()
    const js = performance.now() - begin
    meetFps(nu, js)
  }

  function meetFps(nu, js) {
    meting.frames++
    meting.jsSom += js
    if (!meting.sinds) meting.sinds = nu
    const duur = nu - meting.sinds
    if (duur < 1000) return
    meting.fps = (meting.frames * 1000) / duur
    meting.jsMs = meting.jsSom / meting.frames
    meting.frames = 0
    meting.jsSom = 0
    meting.sinds = nu
    if (!cfg.autoKwaliteit || document.hidden) return
    const doel = cfg.maxFps
    if (meting.fps < doel * cfg.kwaliteitOndergrens) {
      meting.laag++
      meting.hoog = 0
      if (meting.laag >= 2 && kwaliteit > cfg.minKwaliteit) {
        kwaliteit = Math.max(cfg.minKwaliteit, kwaliteit * 0.82)
        meting.laag = 0
      }
    } else if (meting.fps > doel * 0.96) {
      meting.hoog++
      meting.laag = 0
      if (meting.hoog >= 8 && kwaliteit < 1) {
        kwaliteit = Math.min(1, kwaliteit * 1.08)
        meting.hoog = 0
      }
    }
  }

  // html.sneeuw-aan: de CSS gebruikt dit om blokken zonder sneeuw (en dus zonder onderlaag) dicht te maken
  let verborgen = false // zetZichtbaar(false): bijv. op een scherm met een kaart over de hele breedte
  let stilGezet = !!cfg.stil // zetStil(true): wel getekend, maar (nog) niet bewegen
  const zetAanKlasse = () => cfg.vast && document.documentElement.classList.toggle('sneeuw-aan', aan && !verborgen)

  function isStil() {
    return isMinder() && cfg.minderBeweging === 'stil'
  }
  function draai() {
    zetAanKlasse()
    if (raf || !aan || verborgen || document.hidden) return
    if (stilGezet) {
      // klaargezet (bijv. in het buurscherm bij vegen): één beeld, ook als het nog buiten beeld ligt
      canvas.style.display = 'block'
      meetIjs()
      teken()
      return
    }
    if (!inBeeld) return
    if (isStil()) {
      canvas.style.display = 'block'
      meetIjs()
      teken() // één stilstaand beeld (bij scrollen opnieuw, voor de onderlagen)
      return
    }
    canvas.style.display = 'block'
    vorige = 0
    laatsteTeken = 0
    meting.sinds = 0
    meting.frames = 0
    raf = requestAnimationFrame(frame)
  }
  function pauzeer() {
    cancelAnimationFrame(raf)
    raf = 0
  }

  // --- gebeurtenissen ---
  const opZichtbaarheid = () => (document.hidden ? pauzeer() : draai())
  let resizeWacht = 0
  const opResize = () => {
    cancelAnimationFrame(resizeWacht)
    resizeWacht = requestAnimationFrame(() => {
      const oudB = breedte
      const oudH = hoogte
      const oudDpr = dpr
      if ((canvas.clientWidth || innerWidth) === oudB && (canvas.clientHeight || innerHeight) === oudH && Math.min(devicePixelRatio || 1, cfg.maxDpr) === oudDpr) return
      meetScherm()
      if (!oudB) return
      // vlokken meeschalen in plaats van opnieuw beginnen (draaien van de telefoon). Een kleine
      // hoogteverandering (adresbalk in/uit) laat de vlokken gewoon staan: geen sprongetje.
      const hoogteAnders = Math.abs(hoogte - oudH) / oudH > 0.2
      for (const v of vlokken) {
        v.x = (v.x / oudB) * breedte
        if (hoogteAnders) v.y = (v.y / oudH) * hoogte
      }
      if (!raf && aan) teken() // het canvas is na het vergroten leeg
      const nodig = klem(Math.round(cfg.dichtheid * ((breedte * hoogte) / 100000)), cfg.minVlokken, cfg.maxVlokken)
      if (Math.abs(nodig - vlokken.length) / vlokken.length > 0.25) vulPool()
      if (!raf) draai()
    })
  }
  const opRm = () => {
    minderBeweging = rm.matches
    if (isMinder()) stopStorm()
    pauzeer()
    draai()
  }
  const opScroll = () => {
    if (!raf && aan && isStil()) {
      meetIjs()
      teken()
    }
  }
  window.addEventListener('scroll', opScroll, { passive: true })
  document.addEventListener('visibilitychange', opZichtbaarheid)
  window.addEventListener('pagehide', pauzeer)
  window.addEventListener('pageshow', draai)
  window.addEventListener('resize', opResize)
  window.addEventListener('orientationchange', opResize)
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(opResize)
  ro?.observe(canvas)
  // Verandert de kop (of wat erin zit) van maat, dan de glazen blokken meteen opnieuw opmeten
  const roIjs = typeof ResizeObserver === 'undefined' || cfg.vast ? null : new ResizeObserver(() => (meetVuil = true))
  const ijsOuder = doel.parentElement
  if (roIjs && ijsOuder) {
    roIjs.observe(ijsOuder)
    for (const el of ijsOuder.querySelectorAll(cfg.vervaging?.selector || ':not(*)')) roIjs.observe(el)
  }
  rm.addEventListener?.('change', opRm)
  // In een blok: stilzetten zodra het blok uit beeld is (weggescrold), weer verder als het terugkomt
  let inBeeld = true
  const io =
    cfg.vast || typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((items) => {
          inBeeld = items[items.length - 1].isIntersecting
          if (inBeeld) draai()
          else pauzeer()
        })
  io?.observe(canvas)

  // --- start ---
  function opbouw(s) {
    initSeed(s)
    meetScherm()
    const sleutel = [seed, dpr, cfg.kleur, cfg.rand, cfg.randBreedte, cfg.aantalVormen, cfg.spriteGrootte].join('|')
    sprites = SPRITES.get(sleutel)
    if (!sprites) {
      sprites = maakSprites(cfg, maakToeval(seed ^ 0x51ed), dpr)
      if (SPRITES.size > 6) SPRITES.clear()
      SPRITES.set(sleutel, sprites)
    }
    vulPool()
    voorverwarm()
  }

  // De vervaagde versies die de vlokken nodig hebben alvast maken in rustige momenten, één per keer,
  // zodat er tijdens het vallen geen hapering is als een vlok ze voor het eerst gebruikt. Pas een
  // paar seconden na het openen van de app: het is veel rekenwerk (pixel voor pixel) en anders
  // concurreert het met het opstarten. Tot dan tekent een vlok gewoon de scherpe versie.
  let warmId = 0
  const taken = new Map()
  const NA_OPENEN = 3000 // ms na het laden van de pagina
  const rust = (f) => {
    const stil = () => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 40))
    const wacht = NA_OPENEN - performance.now()
    return wacht > 0 ? setTimeout(stil, wacht) : stil()
  }
  function werk() {
    warmId = 0
    const [sleutel, t] = taken.entries().next().value ?? []
    if (!sleutel) return
    taken.delete(sleutel)
    sprites[t[0]]?.niveau(t[1])
    if (taken.size) warmId = rust(werk)
  }
  function vraagAan(sprite, niveau) {
    const sleutel = `${sprite}:${niveau}`
    if (taken.has(sleutel) || sprites[sprite]?.niveaus[niveau]) return
    taken.set(sleutel, [sprite, niveau])
    if (!warmId) warmId = rust(werk)
  }
  function voorverwarm() {
    for (const v of vlokken) {
      if (v.niveau) vraagAan(v.sprite, v.niveau)
      if (v.ijsNiveau) vraagAan(v.sprite, v.ijsNiveau)
    }
  }
  opbouw()
  zetModusKlasse()
  if (!aan) canvas.style.display = 'none'
  zetAanKlasse()
  draai()

  return {
    /** Sneeuw aan of uit (wordt onthouden). */
    zetAan(waarde) {
      aan = !!waarde
      try {
        if (cfg.opslagSleutel) localStorage.setItem(cfg.opslagSleutel, aan ? 'aan' : 'uit')
      } catch {}
      if (aan) draai()
      else {
        pauzeer()
        canvas.style.display = 'none'
        zetAanKlasse()
      }
    },
    isAan: () => aan,
    /** Tijdelijk verbergen en stilzetten (los van aan/uit), bijv. op de kaart. */
    zetZichtbaar(waarde) {
      verborgen = !waarde
      if (verborgen) {
        pauzeer()
        canvas.style.display = 'none'
        zetAanKlasse()
      } else {
        canvas.style.display = aan ? 'block' : 'none'
        draai()
      }
    },
    /** Stilstaand beeld (true) of weer laten vallen (false); het weer loopt gewoon door. */
    zetStil(waarde) {
      if (stilGezet === !!waarde) return
      stilGezet = !!waarde
      pauzeer()
      draai()
    },
    pauzeer,
    hervat: draai,
    /** Storm nu starten: 'links' = wind van links, 'rechts' = wind van rechts, leeg = willekeurig. */
    storm: startStorm,
    stopStorm,
    /** Intensiteit vastzetten (0–1) of null = weer automatisch. */
    zetIntensiteit(waarde) {
      geforceerdeIntensiteit = waarde === null ? null : klem(waarde, 0, 1)
      const I = intensiteit()
      // direct zichtbaar maken bij forceren (anders duurt het tot de vlokken boven opnieuw beginnen)
      for (const v of vlokken) v.actief = v.drempel < I && v.index < Math.ceil(vlokken.length * kwaliteit) && (v.laag !== 'voorgrond' || v.actief)
    },
    zetLaag(naam, waarde) {
      cfg.lagen[naam].aan = !!waarde
    },
    zetDichtheid(waarde) {
      cfg.dichtheid = waarde
      vulPool()
    },
    zetVervaging({ modus, vaag, doorzicht } = {}) {
      if (modus) cfg.vervaging.modus = modus
      if (doorzicht !== undefined) cfg.vervaging.doorzicht = doorzicht
      if (vaag !== undefined) {
        cfg.vervaging.vaag = vaag
        for (const v of vlokken) v.ijsNiveau = kiesNiveau(Math.hypot(v.L.vaag, ijsVaag(v.grootte)), v.grootte)
      }
      zetModusKlasse()
    },
    zetKleur({ kleur, rand }) {
      if (kleur) cfg.kleur = kleur
      if (rand) cfg.rand = rand
      sprites = maakSprites(cfg, maakToeval(seed ^ 0x9e37), dpr)
      for (const v of vlokken) v.sprite %= sprites.length
    },
    zetMinderBeweging(waarde) {
      forceerMinder = waarde
      opRm()
    },
    zetAutoKwaliteit(waarde) {
      cfg.autoKwaliteit = waarde
      if (!waarde) kwaliteit = 1
    },
    nieuweSeed() {
      opbouw(nieuweSeed())
    },
    status() {
      return {
        seed,
        fps: meting.fps,
        jsMs: meting.jsMs,
        vlokken: vlokken.length,
        zichtbaar,
        kwaliteit,
        intensiteit: intensiteit(),
        storm: storm.fase,
        stormKracht: storm.kracht,
        wind: wind,
        volgendeStorm: storm.fase === 'rust' ? Math.max(0, storm.tot - t) : 0,
        modus: bepaalModus(),
        dpr,
        minderBeweging: isMinder(),
        canvasFilter: kanFilter(),
        vormen: sprites.map((s) => s.soort),
      }
    },
    /** Voor de debug-weergave: de sprites zelf. */
    sprites: () => sprites,
    config: cfg,
    vernietig() {
      pauzeer()
      document.removeEventListener('visibilitychange', opZichtbaarheid)
      window.removeEventListener('pagehide', pauzeer)
      window.removeEventListener('pageshow', draai)
      window.removeEventListener('resize', opResize)
      window.removeEventListener('orientationchange', opResize)
      window.removeEventListener('scroll', opScroll)
      ro?.disconnect()
      roIjs?.disconnect()
      io?.disconnect()
      rm.removeEventListener?.('change', opRm)
      if (cfg.vast) document.documentElement.classList.remove('ijs-canvas', 'ijs-css', 'sneeuw-aan')
      canvas.remove()
    },
  }
}

function samenvoegen(basis, extra) {
  for (const k of Object.keys(extra || {})) {
    const w = extra[k]
    if (w && typeof w === 'object' && !Array.isArray(w) && !(w instanceof Node) && basis[k] && typeof basis[k] === 'object') {
      samenvoegen(basis[k], w)
    } else basis[k] = w
  }
  return basis
}
