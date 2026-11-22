/*
 * Gedeelde onderdelen voor de mockups: iconen, bergen (het echte panorama uit de app) en sneeuw.
 * Vereist panorama-data.js (window.PANORAMA).
 */
(function () {
  // ---------------------------------------------------------------- ICONEN
  // Eén set: 24×24, lijn 2 px, ronde uiteinden. De meeste paden komen uit src/components/Icoon.tsx;
  // nieuw zijn: clubblad, mensen, meer, persoon, berg, weer, delen-ios, plus-vierkant, update, info, let-op.
  const I = {
    home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5',
    planning: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5M8 14h3M8 17h6',
    paklijst: 'M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M4 7h16v13H4zM4 12h16M10 12v2h4v-2',
    kamers: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 12.5a1.8 1.8 0 1 0 0-.01',
    kaart: 'M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20',
    rad: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 10.5V3.5M13.3 12.75l6.06 3.5M10.7 12.75l-6.06 3.5M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    spel: 'M7 4h10v4.5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13.5V17M8.5 20h7M10 17h4v3h-4z',
    groep: 'M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19.5a5.5 5.5 0 0 1 11 0M17 11.9a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM15.5 14.4a4.5 4.5 0 0 1 5 5.1',
    clubblad: 'M5 4.5h11v15H6.5A1.5 1.5 0 0 1 5 18zM16 8.5h3V18a1.5 1.5 0 0 1-3 0M8 8h5M8 11.5h5M8 15h3',
    meer: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
    persoon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
    berg: 'M2.5 19.5 9 8.5l3.2 5.3L15 9.5l6.5 10zM6.8 12.3 9 14l2-1.6',
    weer: 'M8 9.5a4 4 0 1 1 7.6 1.8M6.5 19.5a3.5 3.5 0 0 1 0-7 5 5 0 0 1 9.6-1 3.75 3.75 0 0 1 1.4 7.2zM12 2.5v1.5M4.2 5.2l1 1M19.8 5.2l-1 1',
    vink: 'M5 12.5 10 17.5 19.5 7',
    plus: 'M12 5v14M5 12h14',
    min: 'M5 12h14',
    kruis: 'M6 6l12 12M18 6 6 18',
    zoek: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
    deel: 'M12 3.5v11M8 7.5l4-4 4 4M6.5 11H5v9.5h14V11h-1.5',
    pin: 'M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    pijl: 'M5 12h14M13 6l6 6-6 6',
    links: 'M15 5.5 8.5 12l6.5 6.5',
    rechts: 'M9 5.5l6.5 6.5L9 18.5',
    camera: 'M4 8h3.5l2-2.5h5L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    eten: 'M7 3v6.5a2 2 0 0 0 4 0V3M9 3v18M16.5 21V3c-2 1.2-3 3.8-3 7v4h3',
    ski: 'M15 5.5a1.5 1.5 0 1 0 0-.01M8 9l5 1.5-2 4 4 3M3.5 15.5 20 21M17 10.5l-3-1',
    bus: 'M5.5 4h13v13h-13zM5.5 11.5h13M8 20v-3M16 20v-3M8.5 14.25h.01M15.5 14.25h.01M5.5 7.5h13',
    muziek: 'M9 17.5V5.5l10.5-2v12M9 17.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0zM19.5 15.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0z',
    sneeuwvlok: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5',
    bal: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 3.5c2 3 2 8-1 11.5M20.2 10c-3.5-.6-7.5 1.2-9.2 5M5 17c2.5-2.5 6.8-2.8 10.2-1M3.8 10.3c3 1.2 5.6 1.2 8.2-.3',
    vlag: 'M5.5 21V3.5M5.5 4.5h12l-2.5 4 2.5 4h-12',
    glas: 'M7 3.5h10l-1 7a4 4 0 0 1-8 0zM12 14.5v6M8.5 20.5h7M7.6 7.5h8.8',
    lift: 'M2.5 4.5l19 3.5M12 6.3V10M9 10h6a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 15 19H9a2.5 2.5 0 0 1-2.5-2.5v-4A2.5 2.5 0 0 1 9 10zM6.5 14h11',
    mikpunt: 'M12 18.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    bel: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0M12 3v2',
    offline: 'M12 18.5h.01M8.8 15.2a4.5 4.5 0 0 1 6.4 0M5.6 12a9 9 0 0 1 12.8 0M2.5 8.8a13.5 13.5 0 0 1 19 0M3 3l18 18',
    update: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
    stempel: 'M9.5 4h5l-1 6h-3zM7 10h10l1 4H6zM5 14h14v3H5zM7 20h10',
    deelIos: 'M12 3.5v11M8.5 7 12 3.5 15.5 7M7 10.5H5.5v10h13v-10H17',
    plusVierkant: 'M4.5 4.5h15v15h-15zM12 8.5v7M8.5 12h7',
    info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.5M12 7.5h.01',
    letop: 'M12 4 21 19.5H3zM12 10v4.5M12 17h.01',
    instellingen: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
    zon: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    maan: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
    oog: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    slot: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 14.5v2.5',
  }
  function icoon(naam, grootte = 24, extra = '') {
    return `<svg width="${grootte}" height="${grootte}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${I[naam] || ''}"/></svg>`
  }

  // ---------------------------------------------------------------- BERGEN
  // Zoals Bergen.tsx 'doorlopend': vaste schaal (700 panorama-px per telefoonbreedte), het midden van
  // het beeld schuift per tab 100 px naar rechts, de hoogste top staat overal even hoog.
  const P = window.PANORAMA
  const BREED = 700
  function hoogsteIn(a, b, lagen) {
    let top = P.hoogte
    for (const i of lagen) for (const [x, y] of P.lagen[i].kam) if (x >= a && x <= b) top = Math.min(top, y)
    return top
  }
  /**
   * SVG met het panorama. opties: camera (midden in panorama-px), breed (px over de breedte),
   * verhouding (breedte/hoogte van het vlak), lagen, dal (golvende sneeuwrand), vlag, marge.
   */
  function bergen({ camera = 445, breed, verhouding = 4, lagen = [0, 1, 2, 3], dal = true, vlag = false, marge = 0.06, klasse = '' } = {}) {
    // Zo breed dat er ±260 panorama-px hoogte in past (telefoonkop ≈ 700, zoals in de app)
    if (!breed) breed = Math.max(520, Math.min(1400, 260 * verhouding))
    camera = Math.max(breed / 2, Math.min(1400 - breed / 2, camera))
    const x0 = camera - breed / 2
    const h = breed / verhouding
    const top = hoogsteIn(x0, x0 + breed, lagen)
    const y0 = top - h * marge - (vlag ? 18 : 0)
    let s = `<svg class="${klasse}" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${breed} ${h.toFixed(1)}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">`
    for (const i of lagen) {
      const l = P.lagen[i]
      s += `<path d="${l.d}" fill="var(--berg-${i})"/><path d="${l.schaduw}" fill="var(--berg-${i}-schaduw)"/>`
    }
    if (vlag) {
      const meije = P.toppen.find((t) => t.naam === 'Grand Pic de la Meije')
      let tp = null
      for (const i of lagen) for (const [x, y] of P.lagen[i].kam) if (Math.abs(x - meije.x) <= 12 && (!tp || y < tp[1])) tp = [x, y]
      if (tp && tp[0] > x0 && tp[0] < x0 + breed) s += `<path d="M${tp[0]} ${tp[1]}v-16" stroke="var(--berg-0)" stroke-width="1.4"/><path d="M${tp[0]} ${tp[1] - 16}h9l-2.5 3 2.5 3h-9z" fill="var(--rood)"/>`
    }
    if (dal) {
      const yb = y0 + h
      const d = h * 0.11
      s += `<path d="M${x0} ${yb - d * 0.5} C${x0 + breed * 0.2} ${yb - d * 1.2} ${x0 + breed * 0.35} ${yb - d * 0.2} ${x0 + breed * 0.55} ${yb - d * 0.7} S${x0 + breed * 0.85} ${yb - d * 1.1} ${x0 + breed} ${yb - d * 0.6} V${yb + 2} H${x0} Z" fill="var(--berg-dal)"/>`
    }
    return s + '</svg>'
  }
  /**
   * Alleen de bovenrand van een laag, platgedrukt tot een strook (voor de bergkam-tabbalk en
   * scheidingen). Vult onder de kam met currentColor-achtige fill (via CSS var --kam).
   */
  function kamrand({ camera = 445, breed = 900, laag = 3, achter = 2 } = {}) {
    const x0 = Math.max(0, camera - breed / 2), x1 = Math.min(P.breedte, x0 + breed)
    const pad = (i, schaal, basis) => {
      const pts = P.lagen[i].kam.filter(([x]) => x >= x0 - 20 && x <= x1 + 20)
      const ys = pts.map((p) => p[1]); const lo = Math.min(...ys), hi = Math.max(...ys)
      return 'M' + pts.map(([x, y]) => `${(((x - x0) / (x1 - x0)) * 100).toFixed(2)} ${(basis + ((y - lo) / (hi - lo || 1)) * schaal).toFixed(2)}`).join('L') + 'L100 100L0 100Z'
    }
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${pad(achter, 70, 0)}" fill="var(--kam-achter, var(--berg-2))"/><path d="${pad(laag, 60, 30)}" fill="var(--kam, var(--berg-3))"/></svg>`
  }
  /** Camera per tab, zoals cameraVoor() in Bergen.tsx: 445 + 100 per stap */
  const camera = (index) => 445 + 100 * index

  // ---------------------------------------------------------------- SNEEUW
  // Canvas met zeskantige kristallen in drie dieptes; af en toe een windvlaag. Stopt bij minder
  // beweging, bij data-sneeuw="uit" en als het canvas niet in beeld is.
  function sneeuw(canvas, { aantal = 26 } = {}) {
    const ctx = canvas.getContext('2d')
    let w = 0, h = 0, dpr = 1, vlokken = [], wind = 0, windDoel = 0, t0 = performance.now(), loopt = false
    const minder = matchMedia('(prefers-reduced-motion: reduce)')
    function maat() {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(2, devicePixelRatio || 1)
      w = r.width; h = r.height
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    function nieuw(boven) {
      const diepte = Math.random()
      return { x: Math.random() * w, y: boven ? -10 : Math.random() * h, r: 1.6 + diepte * 4.2, v: 10 + diepte * 26, z: diepte, hoek: Math.random() * 6, draai: (Math.random() - 0.5) * 0.6, golf: Math.random() * 6 }
    }
    function kristal(f) {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.hoek)
      ctx.globalAlpha = 0.35 + f.z * 0.55
      ctx.strokeStyle = getComputedStyle(canvas).color || '#fff'; ctx.lineWidth = f.r > 3.5 ? 1.3 : 1; ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a)
        ctx.moveTo(0, 0); ctx.lineTo(c * f.r, s * f.r)
        if (f.r > 3) { const m = f.r * 0.55, k = f.r * 0.3; ctx.moveTo(c * m, s * m); ctx.lineTo(c * m + Math.cos(a + 0.8) * k, s * m + Math.sin(a + 0.8) * k); ctx.moveTo(c * m, s * m); ctx.lineTo(c * m + Math.cos(a - 0.8) * k, s * m + Math.sin(a - 0.8) * k) }
      }
      ctx.stroke(); ctx.restore()
    }
    function stap(nu) {
      if (!loopt) return
      const dt = Math.min(0.05, (nu - t0) / 1000); t0 = nu
      if (Math.random() < 0.002) windDoel = (Math.random() - 0.3) * 60
      windDoel *= 0.995; wind += (windDoel - wind) * 0.02
      ctx.clearRect(0, 0, w, h)
      for (const f of vlokken) {
        f.golf += dt; f.y += f.v * dt; f.x += (Math.sin(f.golf) * 8 + wind * (0.4 + f.z)) * dt; f.hoek += f.draai * dt
        if (f.y > h + 10 || f.x < -20 || f.x > w + 20) Object.assign(f, nieuw(true))
        kristal(f)
      }
      requestAnimationFrame(stap)
    }
    function start() {
      const uit = minder.matches || document.documentElement.dataset.sneeuw === 'uit'
      if (uit) { loopt = false; ctx.clearRect(0, 0, w, h); return }
      if (loopt) return
      maat(); if (!vlokken.length) vlokken = Array.from({ length: aantal }, () => nieuw(false))
      loopt = true; t0 = performance.now(); requestAnimationFrame(stap)
    }
    new ResizeObserver(() => { maat() }).observe(canvas)
    new IntersectionObserver(([e]) => { if (e.isIntersecting) start(); else loopt = false }).observe(canvas)
    new MutationObserver(start).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sneeuw'] })
    minder.addEventListener?.('change', start)
  }
  function sneeuwOveral(root = document) {
    root.querySelectorAll('canvas.sneeuwveld:not([data-aan])').forEach((c) => { c.dataset.aan = '1'; sneeuw(c, { aantal: Number(c.dataset.aantal || 24) }) })
  }

  window.Wispo = { icoon, iconen: I, bergen, kamrand, camera, sneeuw, sneeuwOveral }
})()
