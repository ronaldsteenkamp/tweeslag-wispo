// Testdata voor het clubblad bij LOKAAL testen (niet in de echte app): getekende foto's, verzonnen
// namen. Laden vóór de app, bijv. als init-script in een testbrowser (CDP
// Page.addScriptToEvaluateOnNewDocument) bij een build met `--mode zonderbackend`; Fotomuur.tsx leest
// dan window.__demoClubblad (alleen in dev/zonderbackend, de echte build negeert het).
// Klok staat op ma 8 maart 2027 21:30 (jaarboek: 15 maart). Kies met ?demo=… in de url://   standaard  = dag 2: 1 foto, dag 3: 4 foto's, dag 4: 15 foto's + 3 stukjes
//   30         = dag 4 met 30 foto's
//   leeg       = niets
//   stukjes    = alleen stukjes, geen foto's
//   jaarboek   = klok op 15 maart (na de reis)
;(() => {
  const q = new URLSearchParams(location.search)
  const soort = q.get('demo') ?? 'standaard'
  const klok = soort === 'jaarboek' ? '2027-03-15T10:00:00+01:00' : '2027-03-08T21:30:00+01:00'
  if (!window.__echteDate) {
    const _D = Date
    window.__echteDate = _D
    const off = new _D(klok).getTime() - _D.now()
    class D extends _D {
      constructor(...a) {
        if (a.length === 0) super(_D.now() + off)
        else super(...a)
      }
      static now() {
        return _D.now() + off
      }
    }
    window.Date = D
  }

  // Een getekende foto in verhouding b:h (lange zijde 480 px, zoals de kleine versie in de app).
  // Bij staande foto's zitten de hoofden bovenin (dan zie je of bijsnijden de bovenkant houdt).
  const teken = (n, b, h) => {
    const s = 480 / Math.max(b, h)
    const w = Math.round(b * s)
    const hh = Math.round(h * s)
    const c = document.createElement('canvas')
    c.width = w
    c.height = hh
    const g = c.getContext('2d')
    const luchten = [
      ['#5d9fd3', '#dcebf6'],
      ['#2b2550', '#8a6a86'],
      ['#7fcbe2', '#eef8fb'],
      ['#e7a86b', '#f6e2c6'],
      ['#4f7fb8', '#c9dbee'],
    ]
    const l = luchten[n % luchten.length]
    const gr = g.createLinearGradient(0, 0, 0, hh)
    gr.addColorStop(0, l[0])
    gr.addColorStop(1, l[1])
    g.fillStyle = gr
    g.fillRect(0, 0, w, hh)
    // Bergen
    const basis = hh * (h > b ? 0.62 : 0.72)
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.moveTo(0, basis)
    const pieken = 3 + (n % 3)
    for (let i = 0; i <= pieken; i++) {
      const x = (w / pieken) * i
      const top = basis - hh * (0.25 + ((n * 7 + i * 13) % 10) / 40)
      g.lineTo(x - w / pieken / 2, top)
      g.lineTo(x, basis - hh * 0.08)
    }
    g.lineTo(w, basis)
    g.lineTo(w, hh)
    g.lineTo(0, hh)
    g.fill()
    g.fillStyle = 'rgba(13,0,88,0.10)'
    g.fillRect(0, basis, w, hh - basis)
    // Mensen
    const kleuren = ['#0d0058', '#099fc4', '#c4212f', '#2d6a4f', '#5b4b8a', '#d49a1a']
    const aantal = 1 + (n % 5)
    const maat = Math.min(w, hh) / 9
    const y0 = h > b ? hh * 0.2 : hh * 0.62
    for (let i = 0; i < aantal; i++) {
      const x = w / 2 + (i - (aantal - 1) / 2) * maat * 2.1
      g.fillStyle = '#f1d3b5'
      g.beginPath()
      g.arc(x, y0, maat * 0.55, 0, 7)
      g.fill()
      g.fillStyle = kleuren[(i + n) % kleuren.length]
      g.fillRect(x - maat * 0.75, y0 + maat * 0.55, maat * 1.5, maat * 2.4)
      g.fillRect(x - maat * 0.6, y0 - maat * 0.75, maat * 1.2, maat * 0.35)
    }
    // Nummer in de hoek (zo zie je in de schermen welke foto waar staat)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.fillRect(8, hh - 34, 78, 26)
    g.fillStyle = '#0d0058'
    g.font = 'bold 16px sans-serif'
    g.fillText(`#${n} ${b}:${h}`, 13, hh - 15)
    return { url: c.toDataURL('image/jpeg', 0.82), b: w, h: hh }
  }

  const namen = ['Femke', 'Joost', 'Lotte', 'Sem', 'Iris', 'Bram', 'Mila', 'Daan', 'Noor', 'Thijs', 'Eva', 'Ruben']
  const kamers = ['101', '102', '103', '104', '201', '202']
  const challenges = [
    ['top-gletsjer', 'Top van de gletsjer'],
    ['ijsgrot', 'IJskoud'],
    ['apres', 'Après-ski-koning'],
    ['lift', 'Liftpraatje'],
    ['groep', 'Hele kamer op de foto'],
    ['val', 'Mooiste val'],
    ['kaas', 'Kaaskenner'],
  ]
  const onderschriften = [
    'Op 3400 meter en nog steeds geen zuurstofmasker nodig.',
    'Joost beweert dat hij het ijsbeeld heeft gemaakt.',
    'Iedereen kijkt naar de verkeerde camera.',
    'De sneeuw was beter dan de après-ski. Bijna.',
    'Twaalf man in één gondel, één raampje open.',
    'Niemand weet nog wie de muts kwijt is.',
    'Hier ging het nog goed.',
  ]
  // Verhoudingen: liggend, staand, vierkant, panorama
  const VORMEN = {
    L: [4, 3],
    W: [16, 9],
    S: [3, 4],
    T: [9, 16],
    V: [1, 1],
    P: [3, 1],
  }

  let nr = 0
  const foto = (datum, uur, vorm, extra = {}) => {
    const n = ++nr
    const [b, h] = VORMEN[vorm]
    const t = teken(n, b, h)
    const [chId, chTitel] = challenges[n % challenges.length]
    const wanneer = `${datum}T${uur}:00+01:00`
    return {
      id: `demo-${n}`,
      user_id: 'demo',
      naam: namen[n % namen.length],
      kamer: kamers[n % kamers.length],
      challenge_id: chId,
      challenge_titel: chTitel,
      pad: `demo/${n}.jpg`,
      breedte: t.b,
      hoogte: t.h,
      gemaakt: wanneer,
      genomen: wanneer,
      jury: false,
      status: 'goed',
      zichtbaar: 'iedereen',
      onderschrift: n % 2 ? onderschriften[n % onderschriften.length] : null,
      klein: t.url,
      ...extra,
    }
  }
  const uren = (aantal, van = 9) =>
    Array.from({ length: aantal }, (_, i) => {
      const min = van * 60 + Math.round((i * (12 * 60)) / Math.max(1, aantal))
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    })

  const dag = (datum, vormen, juryOp = -1) =>
    uren(vormen.length)
      .map((u, i) => foto(datum, u, vormen[i], i === juryOp ? { jury: true } : {}))
      .reverse() // nieuwste eerst, zoals de server ze geeft

  const stukje = (id, naam, kamer, tekst, wanneer, ch = null) => ({
    id,
    user_id: 'demo',
    naam,
    kamer,
    challenge_id: ch?.[0] ?? null,
    challenge_titel: ch?.[1] ?? null,
    tekst,
    punten: ch ? 5 : 0,
    status: 'goed',
    reden: null,
    gemaakt: wanneer,
    beoordeeld_op: wanneer,
  })
  const STUKJES = [
    stukje('s1', 'Iris', '102', 'Gisteren in de gondel naar boven: acht man, één raampje open, en Bram die zijn boterham met ei openmaakte. De rest van de rit hebben we zwijgend doorgebracht.\nBram, we houden van je, maar niet in een gondel.', '2027-03-08T13:30:00+01:00'),
    stukje('s2', 'Daan', '104', 'Comté, Reblochon en Beaufort. Zonder telefoon.', '2027-03-08T16:45:00+01:00', ['kaas', 'Kaaskenner']),
    stukje('s3', 'Noor', '201', 'Aan de reisleiding: de bus was laat, de sneeuw was nat, maar zonder jullie hadden we niks gehad. Dank!', '2027-03-07T20:10:00+01:00'),
  ]

  let fotos = []
  let stukjes = []
  if (soort === 'standaard' || soort === 'jaarboek') {
    fotos = [
      ...dag('2027-03-08', ['L', 'S', 'P', 'L', 'V', 'S', 'L', 'W', 'S', 'L', 'T', 'L', 'V', 'P', 'L'], 6),
      ...dag('2027-03-07', ['S', 'L', 'V', 'L']),
      ...dag('2027-03-06', ['L']),
    ]
    stukjes = STUKJES
  } else if (soort === '30') {
    const v = ['L', 'S', 'L', 'V', 'P', 'L', 'S', 'S', 'W', 'L', 'T', 'L', 'V', 'L', 'S', 'P', 'L', 'L', 'S', 'V', 'L', 'W', 'S', 'L', 'T', 'L', 'P', 'S', 'L', 'V']
    fotos = dag('2027-03-08', v, 11)
    stukjes = STUKJES.slice(0, 2)
  } else if (soort === '4') {
    fotos = dag('2027-03-08', ['S', 'L', 'V', 'L'], 1)
    stukjes = STUKJES.slice(0, 1)
  } else if (soort === '1') {
    fotos = dag('2027-03-08', ['L'])
  } else if (soort === 'stukjes') {
    stukjes = STUKJES
  }
  // Sorteer zoals de server: nieuwste eerst
  fotos.sort((a, b) => (a.genomen < b.genomen ? 1 : -1))
  stukjes.sort((a, b) => (a.gemaakt < b.gemaakt ? 1 : -1))
  const wachtrij = q.has('wachtrij')
    ? [{ id: 'w1', challengeId: 'val', titel: 'Mooiste val', klein: teken(99, 4, 3).url, bezig: false, vast: false, pogingen: 0, fout: null }]
    : []
  // Stand (nagebootst): 10 per foto, 10 extra voor een jurykeuze
  const punten = new Map()
  for (const f of fotos) punten.set(f.naam, (punten.get(f.naam) ?? 0) + 10 + (f.jury ? 10 : 0))
  const personen = [...punten]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([naam, totaal]) => ({ naam, kamer: null, challenge_punten: totaal, bingo_punten: 0, correcties: 0, totaal }))
  const klassement = personen.length ? { personen, kamers: [], correcties: [], opgehaald: Date.now() } : null
  window.__demoClubblad = { fotos, stukjes, wachtrij, klassement, beheerder: q.has('jury'), soort, teken, VORMEN }
})()
