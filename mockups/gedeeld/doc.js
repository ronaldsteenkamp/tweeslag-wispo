// Gemeenschappelijk voor de documentatiepagina's: bergen in de kop, sneeuw, themaknop en lichtbak.
(function () {
  const W = window.Wispo
  document.querySelectorAll('[data-bergen]').forEach((el) => {
    const teken = () => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      el.innerHTML = W.bergen({ camera: Number(el.dataset.bergen || 445), verhouding: r.width / r.height, vlag: el.hasAttribute('data-vlag') })
    }
    teken()
    new ResizeObserver(teken).observe(el)
  })
  W.sneeuwOveral()

  // Thema: auto (telefoon) / licht / donker
  const knop = document.createElement('div')
  knop.className = 'themaknop'
  knop.setAttribute('role', 'group')
  knop.setAttribute('aria-label', 'Thema van deze pagina')
  const keuzes = [['auto', 'Auto'], ['licht', W.icoon('zon', 20)], ['donker', W.icoon('maan', 20)]]
  const zet = (t) => {
    if (t === 'auto') delete document.documentElement.dataset.thema
    else document.documentElement.dataset.thema = t
    knop.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === t)))
  }
  for (const [t, inhoud] of keuzes) {
    const b = document.createElement('button')
    b.type = 'button'; b.dataset.t = t; b.innerHTML = inhoud
    b.setAttribute('aria-label', t === 'auto' ? 'Volg de telefoon' : t === 'licht' ? 'Licht' : 'Donker')
    b.onclick = () => zet(t)
    knop.append(b)
  }
  if (!document.body.hasAttribute('data-geen-thema')) document.body.append(knop)
  zet(document.documentElement.dataset.thema || 'auto')

  // Lichtbak voor screenshots
  const bak = document.createElement('div')
  bak.className = 'lichtbak'
  bak.innerHTML = '<img alt="">'
  bak.onclick = () => bak.classList.remove('open')
  document.body.append(bak)
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-groot]')
    if (!img) return
    bak.querySelector('img').src = img.src
    bak.querySelector('img').alt = img.alt
    bak.classList.add('open')
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') bak.classList.remove('open') })

  // Iconen invullen: <i data-icoon="naam" data-grootte="20"></i>
  document.querySelectorAll('[data-icoon]').forEach((el) => { el.outerHTML = W.icoon(el.dataset.icoon, Number(el.dataset.grootte || 24)) })
})()
