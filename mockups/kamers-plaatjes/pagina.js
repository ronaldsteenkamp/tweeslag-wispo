// Bouwt een mockuppagina: een knoppenbalk en telefoons naast elkaar ("Nu" en een richting).
import { DUOTOON, NAMEN, detail, formulier, kamersPagina, plaatjeVenster } from './kp.js'

const KNOPPEN = {
  thema: ['Thema', [['licht', 'Licht (sneeuw)'], ['creme', 'Licht (crème)'], ['donker', 'Donker']]],
  breed: ['Breedte', [['390', '390 px'], ['360', '360 px']]],
  naam: ['Naam van jouw appartement', [['lang', 'Lang'], ['kort', 'Heel kort'], ['cijfer', 'Met cijfer'], ['heellang', 'Eén lang woord'], ['geen', 'Geen naam']]],
  scherm: ['Scherm', [['jouw', 'Jouw appartement'], ['andere', 'De andere'], ['detail', 'Detail']]],
  wie: ['Plaatje', [['eigen-foto', 'Eigen, met foto'], ['eigen-leeg', 'Eigen, zonder foto'], ['ander-foto', 'Iemand anders, met foto'], ['ander-leeg', 'Iemand anders, zonder foto']]],
  kant: ['Kant', [['voor', 'Voorkant'], ['achter', 'Achterkant'], ['formulier', 'Formulier "Plaatje maken"']]],
}

const WIE = {
  'eigen-foto': { naam: 'Noor', jij: 'Noor', eigen: true },
  'eigen-leeg': { naam: 'Bo', jij: 'Bo', eigen: true, profiel: { geenFoto: true } },
  'ander-foto': { naam: 'Fenna', jij: 'Noor' },
  'ander-leeg': { naam: 'Lotte', jij: 'Noor', profiel: { ski: 'ski', niveau: 1, feitje: "Nog nooit op ski's gestaan", geenFoto: true } },
}

/**
 * soort: 'kopje' | 'plaatjes' | 'overzicht'
 * tels: [{ titel, a, b }]
 */
export function bouw({ soort, tels, knoppen, start = {} }) {
  document.body.insertAdjacentHTML('afterbegin', DUOTOON)
  const balk = document.querySelector('.mock__knoppen')
  balk.innerHTML = knoppen
    .map((k) => {
      const [titel, opties] = KNOPPEN[k]
      const gekozen = start[k] ?? opties[0][0]
      return `<fieldset><legend>${titel}</legend>${opties.map(([w, t]) => `<label><input type="radio" name="${k}" value="${w}"${w === gekozen ? ' checked' : ''}><span>${t}</span></label>`).join('')}</fieldset>`
    })
    .join('')
  const rij = document.querySelector('.mock__rij')
  rij.innerHTML = tels.map((t, i) => `<div class="mock__kolom"><h2>${t.titel}</h2><div class="tel" data-i="${i}"></div></div>`).join('')
  const staat = tels.map(() => ({ overlay: null }))

  const keuze = () => Object.fromEntries(new FormData(balk).entries())

  function teken(i, { scroll = true } = {}) {
    const k = keuze()
    const t = tels[i]
    const el = rij.querySelector(`.tel[data-i="${i}"]`)
    el.dataset.thema = k.thema ?? 'licht'
    el.style.setProperty('--breed', `${k.breed ?? 390}px`)
    const wie = WIE[k.wie ?? 'ander-leeg']
    const o = { a: t.a, b: t.b, jij: soort === 'plaatjes' ? wie.jij : 'Noor', naamJouw: NAMEN[k.naam ?? 'lang'] }
    const s = staat[i]
    let overlay = ''
    if (s.overlay?.soort === 'detail') overlay = detail(s.overlay.nummer, o)
    if (s.overlay?.soort === 'plaatje') overlay = plaatjeVenster(s.overlay.naam, o, s.overlay)
    if (s.overlay?.soort === 'formulier') overlay = formulier(s.overlay.naam, o)
    const oud = el.scrollTop
    el.innerHTML = kamersPagina(o) + overlay
    el.classList.toggle('is-dialoog', !!overlay)
    if (!scroll) el.scrollTop = oud
    else if (k.scherm === 'andere') el.scrollTop = el.querySelector('.ks-laag').offsetTop - 20
    else el.scrollTop = 0
    // Het venster ligt over het zichtbare deel van de telefoon, waar je ook gescrold bent
    const ov = el.querySelector('.dialoog-achtergrond')
    if (ov) Object.assign(ov.style, { top: `${el.scrollTop}px`, bottom: 'auto', height: `${el.clientHeight}px` })
  }

  function vanKnoppen() {
    const k = keuze()
    tels.forEach((t, i) => {
      if (soort === 'kopje') staat[i].overlay = k.scherm === 'detail' ? { soort: 'detail', nummer: '101' } : null
      if (soort === 'overzicht') staat[i].overlay = t.overlay ?? (k.scherm === 'detail' ? { soort: 'detail', nummer: '101' } : null)
      if (soort === 'plaatjes') {
        const wie = WIE[k.wie]
        staat[i].overlay =
          k.kant === 'formulier'
            ? { soort: 'formulier', naam: 'Bo' }
            : { soort: 'plaatje', naam: wie.naam, eigen: wie.eigen, profiel: wie.profiel, achter: k.kant === 'achter' }
      }
      teken(i)
    })
  }

  balk.addEventListener('change', vanKnoppen)
  // In de telefoons: tikken werkt zoals in de app
  rij.addEventListener('click', (e) => {
    const tel = e.target.closest('.tel')
    if (!tel) return
    const i = Number(tel.dataset.i)
    const s = staat[i]
    const plaatjeKnop = e.target.closest('[data-plaatje]')
    const kop = e.target.closest('.ks-kop, .kop:not(.kop--detail)')
    if (e.target.closest('.draaiknop') && s.overlay) s.overlay = { ...s.overlay, achter: !s.overlay.achter }
    else if (e.target.closest('.plaatje__draaier') && s.overlay?.soort === 'plaatje') s.overlay = { ...s.overlay, achter: !s.overlay.achter }
    else if (plaatjeKnop) {
      const naam = plaatjeKnop.dataset.plaatje
      s.overlay = { soort: 'plaatje', naam, eigen: naam === 'Noor' }
    } else if (kop) s.overlay = { soort: 'detail', nummer: kop.closest('[data-detail]').dataset.detail }
    else if (e.target.classList.contains('dialoog-achtergrond') || e.target.closest('.ks-blad__sluit, .plaatjeknop--neven')) s.overlay = null
    else if (e.target.closest('.ks-register button')) return
    else return
    teken(i, { scroll: false })
  })
  vanKnoppen()
}
