/*
 * Bouwt de telefoons voor vernieuwen-a/b/c.html.
 * - <template id="t-verschijn|t-herladen|t-later"> per ontwerp: de melding in die toestand
 * - <div class="paar-tel" data-toestand="…"> krijgt een telefoon in licht en in donker
 * - knoppen met data-naar="…" wisselen in die telefoon naar een andere toestand (echt te proberen)
 * - <svg class="pan" data-pan="x0 x1 y0"> krijgt de lagen van het echte panorama (gedeeld/panorama-data.js)
 * - ?los=verschijn-licht toont één telefoon op 390 × 844 (voor de screenshots), &rustig=1 zonder beweging
 */
(function () {
  const P = window.PANORAMA
  const zoek = new URLSearchParams(location.search)

  function panorama(root) {
    for (const svg of root.querySelectorAll('svg.pan[data-pan]')) {
      if (svg.dataset.klaar) continue
      const [x0, x1, y0, y1 = P.hoogte] = svg.dataset.pan.split(' ').map(Number)
      const lagen = (svg.dataset.lagen || '0 1 2 3').split(' ').map(Number)
      svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`)
      svg.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') || 'xMidYMax slice')
      let html = ''
      for (const i of lagen) {
        html += `<path class="l${i}" d="${P.lagen[i].d}"/>`
        if (P.lagen[i].schaduw) html += `<path class="s${i}" d="${P.lagen[i].schaduw}"/>`
      }
      svg.insertAdjacentHTML('afterbegin', html)
      svg.dataset.klaar = '1'
    }
  }

  function vul(tel, toestand) {
    for (const oud of tel.querySelectorAll(':scope > :not(.tel__scherm)')) oud.remove()
    const t = document.getElementById('t-' + toestand)
    tel.appendChild(t.content.cloneNode(true))
    panorama(tel)
    for (const knop of tel.querySelectorAll('[data-naar]'))
      knop.addEventListener('click', () => vul(tel, knop.dataset.naar))
  }

  function telefoon(toestand, thema) {
    const tel = document.createElement('div')
    tel.className = `tel thema-${thema}`
    tel.innerHTML = `<img class="tel__scherm" src="vernieuwen/home-${thema}.jpg" alt="">`
    vul(tel, toestand)
    return tel
  }

  if (zoek.get('los')) {
    const [toestand, thema] = zoek.get('los').split('-')
    document.body.classList.add('los')
    if (zoek.get('rustig')) document.body.classList.add('rustig')
    const tel = telefoon(toestand, thema)
    tel.classList.add('los-tel')
    document.body.appendChild(tel)
    return
  }

  function bouw() {
    for (const plek of document.querySelectorAll('.paar-tel[data-toestand]')) {
      plek.innerHTML = ''
      for (const thema of ['licht', 'donker']) {
        const fig = document.createElement('figure')
        const kader = document.createElement('div')
        kader.className = 'tel-kader'
        kader.appendChild(telefoon(plek.dataset.toestand, thema))
        fig.appendChild(kader)
        fig.insertAdjacentHTML('beforeend', `<figcaption>${thema === 'licht' ? 'Licht' : 'Donker'}</figcaption>`)
        plek.appendChild(fig)
      }
    }
  }
  bouw()
  for (const k of document.querySelectorAll('[data-opnieuw]')) k.addEventListener('click', bouw)
  for (const k of document.querySelectorAll('[data-rustig]'))
    k.addEventListener('change', () => {
      document.body.classList.toggle('rustig', k.checked)
      bouw()
    })
})()
