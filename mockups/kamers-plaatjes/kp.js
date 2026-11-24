/*
 * Gedeelde motor voor de mockups Kamers + plaatjes. Zelfde testdata als de screenshots van de app
 * (verzonnen voornamen), dezelfde opbouw als Kamers.tsx en Profiel.tsx, met per onderdeel een richting:
 *   kopje (A): 'nu' | 'a' (Deurbordje) | 'b' (Sleutelhanger) | 'c' (Wegwijzer)
 *   plaatje (B): 'nu' | 'a' (Gewoon weg) | 'b' (Bergen + stempel) | 'c' (Bordje in de hoek)
 */

// ---------- Testdata ----------
export const KAMERS = [
  { nummer: '101', naam: 'Gletsjer', bedden: 4, bewoners: ['Fenna', 'Daan', 'Lotte', 'Mats'] },
  { nummer: '102', naam: 'Poedersneeuw op de Pistekant', bedden: 4, bewoners: ['Noor', 'Sem', 'Iris', 'Bo'] },
  { nummer: '104', bedden: 3, bewoners: ['Jesse', 'Lieke', 'Wout'] },
  { nummer: '201', naam: 'Lawine', bedden: 4, bewoners: [] },
  { nummer: '202', naam: 'Zon', bedden: 4, bewoners: ['Pim', 'Sara'] },
  { nummer: '203', naam: 'Après', bedden: 4, bewoners: ['Thijs', 'Eva', 'Ruben', 'Maud'] },
]
const BIJNAMEN = { Fenna: 'Fen', Mats: 'De Mol', Sem: 'Semmie', Thijs: 'Thijs de Turbo' }
const PROFIELEN = {
  Fenna: { ski: 'board', niveau: 3, karaoke: 'Dancing Queen', artiest: 'ABBA', feitje: 'Kan jongleren met drie sneeuwballen' },
  Daan: { ski: 'ski', niveau: 4, angst: 'Stoeltjeslift zonder beugel' },
  Lotte: { ski: 'ski', niveau: 1, feitje: "Nog nooit op ski's gestaan" },
  Mats: { ski: 'nooit' },
  Noor: { ski: 'allebei', niveau: 2, karaoke: 'Mooi man', artiest: 'Bløf' },
  Sem: { ski: 'board', niveau: 5 },
  Iris: { niveau: 3 },
  Jesse: { ski: 'ski', niveau: 2 },
  Lieke: { ski: 'ski' },
  Pim: { ski: 'board', niveau: 1 },
  Sara: { ski: 'ski', niveau: 3 },
  Thijs: { ski: 'ski', niveau: 4 },
  Maud: { ski: 'allebei', niveau: 2 },
}
const MET_FOTO = ['Fenna', 'Daan', 'Noor', 'Sem', 'Jesse', 'Sara', 'Maud', 'Thijs']
const ALLE_NAMEN = KAMERS.flatMap((k) => k.bewoners).sort((a, b) => a.localeCompare(b, 'nl'))

export const toon = (n) => BIJNAMEN[n] ?? n

// ---------- Getekende portretten (zelfde tekening als in de app-screenshots) ----------
const fotoCache = new Map()
export function foto(naam) {
  const i = MET_FOTO.indexOf(naam)
  if (i < 0) return null
  if (fotoCache.has(naam)) return fotoCache.get(naam)
  const c = document.createElement('canvas')
  c.width = 480
  c.height = 600
  const g = c.getContext('2d')
  const h = [205, 25, 340, 160, 50, 280, 10, 120][i % 8]
  const lucht = g.createLinearGradient(0, 0, 0, 600)
  lucht.addColorStop(0, `hsl(${h} 45% 72%)`)
  lucht.addColorStop(1, `hsl(${h} 35% 45%)`)
  g.fillStyle = lucht
  g.fillRect(0, 0, 480, 600)
  g.fillStyle = 'hsl(210 30% 92%)'
  g.beginPath(); g.moveTo(0, 420); g.lineTo(120, 330); g.lineTo(220, 400); g.lineTo(340, 300); g.lineTo(480, 390); g.lineTo(480, 600); g.lineTo(0, 600); g.fill()
  g.fillStyle = `hsl(${(h + 180) % 360} 40% 35%)`
  g.beginPath(); g.ellipse(240, 610, 190, 170, 0, Math.PI, 0); g.fill()
  g.fillStyle = `hsl(28 ${30 + (i * 7) % 30}% ${55 + (i * 5) % 20}%)`
  g.beginPath(); g.ellipse(240, 300, 92, 112, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = `hsl(${20 + i * 9} 40% ${18 + (i * 9) % 40}%)`
  g.beginPath(); g.ellipse(240, 225, 100, 62, 0, Math.PI, 0); g.fill()
  g.fillStyle = 'rgba(20,20,40,.75)'
  g.beginPath(); g.arc(205, 300, 8, 0, 7); g.arc(275, 300, 8, 0, 7); g.fill()
  const url = c.toDataURL('image/jpeg', 0.85)
  fotoCache.set(naam, url)
  return url
}

// ---------- Iconen (paden uit src/components/Icoon.tsx) ----------
const PADEN = {
  rechts: 'M9 5.5l6.5 6.5L9 18.5',
  kamers: 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 12.5a1.8 1.8 0 1 0 0-.01',
  kruis: 'M6 6l12 12M18 6 6 18',
  draai: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  ski: 'M15 5.5a1.5 1.5 0 1 0 0-.01M8 9l5 1.5-2 4 4 3M3.5 15.5 20 21M17 10.5l-3-1',
  board: 'M2.5 12.5c0 2.2 1.3 3.5 3.5 3.5h12c2.2 0 3.5-1.3 3.5-3.5M7.5 16v-4.5H11M14 16v-4.5h3.5',
  allebei: 'M4 8h13l-3-3M20 16H7l3 3',
  bier: 'M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 11h2.2a1.8 1.8 0 0 1 1.8 1.8v2.4a1.8 1.8 0 0 1-1.8 1.8H15M6 8a2.5 2.5 0 0 1 2.4-3 3 3 0 0 1 5.2 0A2.5 2.5 0 0 1 15 8M9 12v5M12 12v5',
  microfoon: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6',
  fluister: 'M4 5h16v11h-9l-4.5 4v-4H4zM8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01',
  bliksem: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  potlood: 'M4 20l1.2-4.8L15.6 4.8a2 2 0 0 1 2.9 0l.7.7a2 2 0 0 1 0 2.9L8.8 18.8zM13.6 6.8l3.6 3.6',
  camera: 'M4 8h3.5l2-2.5h5L16.5 8H20v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  lift: 'M2.5 4.5l19 3.5M12 6.3V10M9 10h6a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 15 19H9a2.5 2.5 0 0 1-2.5-2.5v-4A2.5 2.5 0 0 1 9 10zM6.5 14h11',
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5',
  planning: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5M8 14h3M8 17h6',
  paklijst: 'M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M4 7h16v13H4zM4 12h16M10 12v2h4v-2',
  spel: 'M7 4h10v4.5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13.5V17M8.5 20h7M10 17h4v3h-4z',
  groep: 'M9 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19.5a5.5 5.5 0 0 1 11 0M17 11.9a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM15.5 14.4a4.5 4.5 0 0 1 5 5.1',
}
export const icoon = (n, g = 24) =>
  `<svg class="icoon" width="${g}" height="${g}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${PADEN[n]}"/></svg>`

// ---------- Kamers ----------
const verdieping = (nr) => Math.floor(Number(nr) / 100)
const verdiepingNaam = (v) => (v === 0 ? 'begane grond' : `${v}e verdieping`)
const opsomming = (n) => (n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} en ${n[n.length - 1]}`)

/** Kamers met de (eventueel overschreven) naam van jouw appartement */
export function kamers(o) {
  return KAMERS.map((k) => {
    const bedden = Math.max(k.bedden ?? 0, k.bewoners.length)
    const naam = k.bewoners.includes(o.jij) && o.naamJouw !== undefined ? o.naamJouw || undefined : k.naam
    return { ...k, naam, verdieping: verdieping(k.nummer), vrij: bedden - k.bewoners.length }
  })
}
const titelVan = (k) => k.naam ?? `Appartement ${k.nummer}`
const isJouw = (k, o) => k.bewoners.includes(o.jij)

function omschrijving(k, o) {
  const wie = k.bewoners.map((b) => (b === o.jij ? `${toon(b)} (jij)` : toon(b)))
  return `${k.naam ? `${k.naam}, appartement ${k.nummer}` : `Appartement ${k.nummer}`}${isJouw(k, o) ? ', jouw appartement' : ''}, ${verdiepingNaam(k.verdieping)}. ${wie.length ? opsomming(wie) : 'Nog leeg'}${k.vrij ? `, ${k.vrij} ${k.vrij === 1 ? 'bed' : 'bedden'} vrij` : ''}. Bekijk het appartement.`
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

// ---------- A: het kopje, per richting ----------

/** Het bordje met het nummer (Deurbordje); ook gebruikt in het register, het detailscherm en richting B-c */
export const bordje = (nr, { jouw = false, maat = '' } = {}) =>
  `<span class="bordje${jouw ? ' bordje--jouw' : ''}${maat ? ` bordje--${maat}` : ''}" aria-hidden="true"><b>${nr}</b></span>`

/** De sleutelhanger (eigen SVG, lijn 2 zoals de iconen) */
export const fob = (nr, { jouw = false, maat = '' } = {}) =>
  `<span class="fob${jouw ? ' fob--jouw' : ''}${maat ? ` fob--${maat}` : ''}" aria-hidden="true"><svg viewBox="0 0 124 56" focusable="false"><circle class="fob__ring" cx="11" cy="28" r="8.5"/><path class="fob__lijf" d="M20 28c0-9.5 6.6-16 17-16l66 4.5c8.4.6 14 5.3 14 11.5s-5.6 10.9-14 11.5L37 44c-10.4 0-17-6.5-17-16z"/><circle class="fob__gat" cx="30" cy="28" r="4"/></svg><b>${nr}</b></span>`

/** Regel boven de naam: jouw appartement en (voor jou) de verdieping */
function bovenregel(k, o, { detail, meerLagen = true }) {
  const jouw = isJouw(k, o)
  const delen = []
  if (jouw) delen.push('Jouw appartement')
  if (detail || jouw || !meerLagen) delen.push(verdiepingNaam(k.verdieping))
  return delen.join(' · ')
}

/** Kopje boven een bladzijde (knop) of in het detailscherm (kop, geen knop) */
export function kopje(k, o, { detail = false } = {}) {
  const v = o.a
  const jouw = isJouw(k, o) && !detail
  const jouwKleur = isJouw(k, o)
  const pijl = detail ? '' : icoon('rechts', 20)
  const label = detail ? '' : ` aria-label="${esc(omschrijving(k, o))}"`
  const tag = detail ? 'h2' : 'button'
  const extra = detail ? ' id="ks-blad-titel"' : ' type="button"'

  if (v === 'nu') {
    const boven = detail ? `<b>${k.nummer}</b> · ${verdiepingNaam(k.verdieping)}` : `${jouw ? 'Jouw appartement · ' : ''}<b>${k.nummer}</b>${jouw ? ` · ${verdiepingNaam(k.verdieping)}` : ''}`
    const inhoud = `<span><span class="ks-nr">${boven}</span><span class="ks-naam">${esc(titelVan(k))}</span></span>${pijl}`
    return `<${tag} class="${detail ? 'ks-blad__kop' : 'ks-kop'}"${extra}${label}>${inhoud}</${tag}>`
  }

  // Zonder eigen naam staat het nummer al op het bordje: dan alleen "Appartement" (voorleestekst: "Appartement 104")
  const naam = k.naam ? esc(k.naam) : 'Appartement'
  const geenNaam = k.naam ? '' : ' is-zonder-naam'
  const boven = bovenregel(k, o, { detail })
  // Bij jouw appartement over de hele breedte boven bordje en naam, anders loopt hij naast het grote bordje te krap
  const bovenVol = jouw && v !== 'c' ? `<span class="kop__boven kop__boven--vol">${boven}</span>` : ''
  const bovenHtml = boven && !bovenVol ? `<span class="kop__boven">${boven}</span>` : ''
  const leeg = !k.bewoners.length ? `<span class="kop__onder">Nog leeg · ${k.vrij} bedden vrij</span>` : ''

  if (v === 'a') {
    const maat = detail ? 'groot' : jouw ? 'groot' : ''
    return `<${tag} class="kop kop--bord${jouw ? ' kop--jouw' : ''}${detail ? ' kop--detail' : ''}"${extra}${label}>${bovenVol}${bordje(k.nummer, { jouw: jouwKleur, maat })}<span class="kop__tekst">${bovenHtml}<span class="kop__naam${geenNaam}">${naam}</span>${leeg}</span>${pijl}</${tag}>`
  }
  if (v === 'b') {
    const maat = detail || jouw ? 'groot' : ''
    return `<${tag} class="kop kop--fob${jouw ? ' kop--jouw' : ''}${detail ? ' kop--detail' : ''}"${extra}${label}>${bovenVol}${fob(k.nummer, { jouw: jouwKleur, maat })}<span class="kop__tekst">${bovenHtml}<span class="kop__naam${geenNaam}">${naam}</span>${leeg}</span>${pijl}</${tag}>`
  }
  // c: wegwijzer. De punt naar rechts is de "ga erheen"; in het detailscherm een recht bord (niets meer om op te tikken).
  const hoogte = detail || jouw ? `<span class="kop__boven"><svg class="hoogte" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 10.5 6 2l5 8.5z"/></svg>${verdiepingNaam(k.verdieping)}</span>` : ''
  const los = jouw ? '<span class="kop__boven kop__boven--los">Jouw appartement</span>' : ''
  return `<${tag} class="kop kop--wijzer${jouw ? ' kop--jouw' : ''}${detail ? ' kop--detail' : ''}${jouwKleur ? ' is-jouw' : ''}"${extra}${label}>${los}<span class="wijzer"><span class="wijzer__binnen"><span class="wijzer__nr" aria-hidden="true">${k.nummer}</span><span class="kop__tekst">${hoogte}<span class="kop__naam${geenNaam}">${naam}</span>${leeg}</span></span></span></${tag}>`
}

function register(ks, o) {
  const knoppen = ks
    .map((k) => {
      const jouw = isJouw(k, o)
      const label = `Naar ${esc(titelVan(k))}${k.naam ? `, appartement ${k.nummer}` : ''}`
      if (o.a === 'a') return `<button type="button" class="reg-bord" aria-label="${label}">${bordje(k.nummer, { jouw, maat: 'klein' })}</button>`
      if (o.a === 'b') return `<button type="button" class="reg-fob" aria-label="${label}">${fob(k.nummer, { jouw, maat: 'klein' })}</button>`
      if (o.a === 'c') return `<button type="button" class="reg-wijzer${jouw ? ' is-jouw' : ''}" aria-label="${label}"><span class="wijzer__nr" aria-hidden="true">${k.nummer}</span></button>`
      return `<button type="button" class="${jouw ? 'is-jouw' : ''}" aria-label="${label}">${k.nummer}</button>`
    })
    .join('')
  return `<nav class="ks-register register--${o.a}" aria-label="Naar appartement">${knoppen}</nav>`
}

// ---------- Portretten in Kamers (ongewijzigd) ----------
function smoel(n, o) {
  const url = foto(n)
  const jij = n === o.jij
  const beeld = url
    ? `<img src="${url}" alt="">`
    : `<b>${toon(n).charAt(0).toUpperCase()}</b><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 22L22 8 36 18 58 2 76 16 100 8V40H0Z" fill="#087f9e"/><path d="M0 32C30 26 60 32 100 28V40H0Z" fill="#dff1f8"/></svg>`
  return `<li class="ks-smoel${jij ? ' is-jij' : ''}"><button type="button" data-plaatje="${n}" aria-label="${n}${toon(n) !== n ? `, ${toon(n)}` : ''}${jij ? ', jij' : ''}. Bekijk het plaatje."><span class="ks-beeld">${beeld}</span><span class="ks-smoel__naam">${esc(toon(n))}</span>${jij ? '<span class="ks-smoel__jij">jij</span>' : ''}</button></li>`
}
function smoelen(k, o) {
  const vrij = Array.from({ length: k.vrij }, () => `<li class="ks-smoel is-vrij"><span class="ks-beeld">${icoon('kamers', 26)}</span><span class="ks-smoel__naam">bed vrij</span></li>`).join('')
  return `<ul class="ks-smoelen">${k.bewoners.map((n) => smoel(n, o)).join('')}${vrij}</ul>`
}

function bladzijde(k, o) {
  const jouw = isJouw(k, o)
  const knop = jouw ? `<button type="button" class="tekstknop kamernaam__knop">${icoon('potlood', 20)} Naam van het appartement aanpassen</button>` : ''
  return `<section class="ks-blz${jouw ? ' ks-blz--jouw' : ''} blz--${o.a}" id="ks-${k.nummer}" aria-label="${esc(titelVan(k))}" data-detail="${k.nummer}">${kopje(k, o)}${smoelen(k, o)}${knop}</section>`
}

export const DUOTOON = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="ks-duo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncR type="gamma" exponent="2.6"/><feFuncG type="gamma" exponent="2.6"/><feFuncB type="gamma" exponent="2.6"/></feComponentTransfer><feComponentTransfer><feFuncR type="table" tableValues="0.05 0.87"/><feFuncG type="table" tableValues="0 0.945"/><feFuncB type="table" tableValues="0.345 0.97"/></feComponentTransfer></filter></svg>`

const TABBALK = `<div class="tabbalk" aria-hidden="true">${[['home', 'Home'], ['planning', 'Planning'], ['paklijst', 'Paklijst'], ['spel', 'Spel'], ['groep', 'Groep']]
  .map(([i, t]) => `<span class="${i === 'groep' ? 'is-actief' : ''}">${icoon(i, 26)}${t}</span>`)
  .join('')}</div>`

/** De hele Kamers-pagina */
export function kamersPagina(o) {
  const ks = kamers(o)
  const mijn = ks.find((k) => isJouw(k, o))
  const andere = ks.filter((k) => k !== mijn)
  const genoten = mijn.bewoners.filter((b) => b !== o.jij).map(toon)
  const lagen = [...new Set(andere.map((k) => k.verdieping))].sort((a, b) => b - a)
  const mensen = ks.reduce((s, k) => s + k.bewoners.length, 0)
  const vrij = ks.reduce((s, k) => s + k.vrij, 0)
  return `<div class="scherm ks inhoud--kamers">
    <header class="schermkop"><p class="schermkop__boven">Les Deux Alpes</p><h1 class="schermkop__titel">Appartementen</h1><p class="schermkop__onder">Je slaapt in ${esc(titelVan(mijn))}, met ${opsomming(genoten)}.</p></header>
    ${bladzijde(mijn, o)}
    <p class="ks-lead">${mensen} mensen in ${ks.length} appartementen, ${vrij} bedden nog vrij.</p>
    ${register(ks, o)}
    ${lagen
      .map((v) => `<div class="ks-laag"><h2 class="ks-verdieping">${verdiepingNaam(v)}</h2>${andere.filter((k) => k.verdieping === v).map((k) => bladzijde(k, o)).join('')}</div>`)
      .join('')}
    <p class="ks-voet">Staat ook zonder wifi op je telefoon.</p>
  </div>${TABBALK}`
}

/** Detailscherm (onderblad) van één appartement */
export function detail(nummer, o) {
  const k = kamers(o).find((x) => x.nummer === nummer)
  return `<div class="dialoog-achtergrond"><div class="dialoog dialoog--hoog ks-blad blz--${o.a}" role="dialog" aria-modal="true" aria-labelledby="ks-blad-titel"><button type="button" class="ks-blad__sluit" aria-label="Sluiten">${icoon('kruis')}</button>${kopje(k, o, { detail: true })}${smoelen(k, o)}${k.vrij > 0 && !isJouw(k, o) ? '<p class="ks-stil">Er is nog plek. Wil je verhuizen? Vraag het de reisleiding: dat blijft tussen jullie.</p>' : ''}</div></div>`
}

// ---------- B: het plaatje ----------
const SKI = { ski: ['ski', 'Ski'], board: ['board', 'Board'], allebei: ['allebei', 'Allebei'], nooit: ['bier', 'Hier voor bier'] }
const PISTES = [['groen', 'Groen'], ['blauw', 'Blauw'], ['rood', 'Rood'], ['zwart', 'Zwart'], ['dubbelzwart', 'Dubbelzwart']]
const NIVEAUS = ['Waar zit de rem?', 'Blauw met beleid', 'Rood is prima', 'Zwart als het moet', 'Zwarte piste voor ontbijt']
const pistebord = (n, cls = '') => {
  const [kleur, naam] = PISTES[n - 1]
  return `<span class="pistebord pistebord--${kleur} ${cls}" role="img" aria-label="${naam}e piste: ${NIVEAUS[n - 1]}"><span aria-hidden="true">${kleur === 'dubbelzwart' ? '◆◆' : n}</span></span>`
}
const nr = (n) => String(n).padStart(2, '0')
const kamerVan = (naam) => KAMERS.find((k) => k.bewoners.includes(naam))

/** Bergen met de initiaal, zoals het portret in Kamers, en een stempel "Nog niet geplakt" (richting B-b) */
const gatBergen = (naam) =>
  `<div class="gat-bergen" aria-hidden="true"><span class="gat-bergen__lucht"><b>${toon(naam).charAt(0).toUpperCase()}</b><svg viewBox="0 0 100 40" preserveAspectRatio="none"><path class="gat-bergen__berg" d="M0 22L22 8 36 18 58 2 76 16 100 8V40H0Z"/><path class="gat-bergen__sneeuw" d="M0 32C30 26 60 32 100 28V40H0Z"/></svg></span><span class="gat-stempel">Nog niet<br>geplakt</span></div>`

export function plaatje(naam, o, { achter = false, profiel } = {}) {
  const p = profiel ?? PROFIELEN[naam] ?? {}
  const v = o.b
  const url = p.geenFoto ? null : foto(naam)
  const bijnaam = BIJNAMEN[naam]
  const getoond = bijnaam ?? naam
  const ski = p.ski ? SKI[p.ski] : null
  const kamer = kamerVan(naam)?.nummer ?? null
  const nummer = ALLE_NAMEN.indexOf(naam) + 1
  const hoek = v === 'c' && kamer ? `<span class="plaatje__hoek">${bordje(kamer, { maat: 'klein' })}<span class="verborgen">Appartement ${kamer}</span></span>` : ''

  let voor
  if (url) voor = `<img src="${url}" alt="Foto van ${naam}">${v === 'nu' ? `<span class="plaatje__nr">№ ${nr(nummer)}</span>` : hoek}`
  else if (v === 'nu') voor = `<div class="plaatje__gat" aria-hidden="true"><b>${nr(nummer)}</b><span>Nog niet geplakt</span></div>`
  else if (v === 'a') voor = `<div class="plaatje__gat gat--leeg" aria-hidden="true"><span>Nog niet geplakt</span></div>`
  else if (v === 'b') voor = gatBergen(naam)
  else voor = `<div class="plaatje__gat gat--initiaal" aria-hidden="true"><b>${toon(naam).charAt(0).toUpperCase()}</b><span>Nog niet geplakt</span></div>${hoek}`

  const verhaal = []
  if (p.karaoke) verhaal.push(['microfoon', 'Bus-karaoke', `${p.karaoke}${p.artiest ? `<small> – ${p.artiest}</small>` : ''}`])
  if (p.feitje) verhaal.push(['fluister', 'Wat niemand weet', p.feitje])
  if (p.angst) verhaal.push(['bliksem', 'Bang voor', p.angst])
  const kamerInBand = kamer && v !== 'c'
  const voet = v === 'nu' ? `<b>№ ${nr(nummer)}</b>` : v === 'c' && kamer ? bordje(kamer, { maat: 'klein' }) : ''

  return `<div class="plaatje plaatje--${v}${achter ? ' is-omgedraaid' : ''}"><div class="plaatje__draaier">
    <div class="plaatje__kant plaatje__voor" aria-hidden="${achter}">${voor}
      ${p.niveau ? pistebord(p.niveau, 'plaatje__piste') : ''}
      <div class="plaatje__band"><p class="plaatje__naam">${esc(getoond)}${bijnaam ? `<small>${naam}</small>` : ''}</p>
      <p class="plaatje__positie"><span>${ski ? `${icoon(ski[0], 18)}${ski[1]}` : 'Tweeslag'}</span>${kamerInBand ? `<span>${icoon('kamers', 18)}<span class="verborgen">Kamer </span>${kamer}</span>` : ''}</p></div>
    </div>
    <div class="plaatje__kant plaatje__achter" aria-hidden="${!achter}">
      <p class="achter__kop"><span>Seizoen 2027 · Les 2 Alpes</span><img src="kamers-plaatjes/2slag-wit.svg" alt=""></p>
      <p class="achter__naam">${esc(getoond)}</p>
      <dl class="achter__feiten">
        <div><dt>Speelt als</dt><dd class="${ski ? '' : 'is-leeg'}">${ski ? `${icoon(ski[0], 17)}${ski[1]}` : '–'}</dd></div>
        <div><dt>Piste</dt><dd class="${p.niveau ? '' : 'is-leeg'}">${p.niveau ? `${pistebord(p.niveau)}${PISTES[p.niveau - 1][1]}` : '–'}</dd></div>
        <div><dt>Kamer</dt><dd class="${kamer ? '' : 'is-leeg'}">${kamer ?? '–'}</dd></div>
      </dl>
      ${p.niveau ? `<p class="achter__niveau">${NIVEAUS[p.niveau - 1]}</p>` : ''}
      ${verhaal.length ? `<dl class="achter__verhaal">${verhaal.map(([i, l, t]) => `<div>${icoon(i, 19)}<div><dt>${l}</dt><dd>${t}</dd></div></div>`).join('')}</dl>` : '<div class="achter__blanco"><p>De rest van de achterkant is nog blanco.</p><i></i><i></i><i></i></div>'}
      <p class="achter__voet"><span>Tweeslag Groningen<br>Wispo 05.03–14.03.2027</span>${voet}</p>
    </div>
  </div></div>`
}

/** Het venster met een plaatje (bekijken), zoals Bekijk in Profiel.tsx */
export function plaatjeVenster(naam, o, { achter = false, eigen = false, profiel } = {}) {
  const k = kamerVan(naam)
  const kamerTekst = k ? `Kamer ${k.nummer}${k.naam ? ` · ${k.naam}` : ''}` : 'Tweeslag-album 2027'
  const nummer = ALLE_NAMEN.indexOf(naam) + 1
  const bijnaam = BIJNAMEN[naam]
  let titel
  if (eigen) titel = 'Jouw plaatje'
  else if (o.b === 'nu') titel = `Plaatje ${nr(nummer)}<span class="verborgen">: ${toon(naam)}</span>`
  else titel = `${esc(toon(naam))}${bijnaam ? `<span class="plaatjekop__echt"> ${naam}</span>` : ''}`
  const leeg = profiel && !Object.keys(profiel).some((x) => x !== 'geenFoto') && profiel.geenFoto
  return `<div class="dialoog-achtergrond"><div class="dialoog dialoog--hoog dialoog--plaatje" role="dialog" aria-modal="true" aria-labelledby="venster-titel">
    <header class="plaatjekop"><p class="plaatjekop__boven">${eigen ? 'Tweeslag-album 2027' : kamerTekst}</p><h2 id="venster-titel" class="plaatjekop__titel">${titel}</h2></header>
    ${eigen && leeg ? '<p class="plaatje__rustig">Je plaatje is nog niet geplakt. Geen haast: het album hoeft pas in maart vol.</p>' : ''}
    ${plaatje(naam, o, { achter, profiel })}
    <button type="button" class="draaiknop" aria-pressed="${achter}">${icoon('draai', 20)}${achter ? 'Voorkant' : 'Draai om'}</button>
    ${eigen ? `<button type="button" class="plaatjeknop plaatjeknop--hoofd">${icoon('potlood', 20)}${leeg ? 'Plaatje maken' : 'Plaatje aanpassen'}</button>` : ''}
    <button type="button" class="plaatjeknop plaatjeknop--neven">Sluiten</button>
  </div></div>`
}

/** Het formulier "Plaatje maken" (begin), zoals MijnProfiel + ProfielFormulier */
export function formulier(naam, o) {
  return `<div class="dialoog-achtergrond"><div class="dialoog dialoog--hoog dialoog--plaatje" role="dialog" aria-modal="true" aria-labelledby="venster-titel">
    <header class="plaatjekop"><p class="plaatjekop__boven">Jouw plaatje</p><h2 id="venster-titel" class="plaatjekop__titel">Plaatje maken</h2></header>
    <p class="plaatje__wie">Je bent <strong>${naam}</strong> <button type="button" class="plaatjeknop--tekst">Andere naam kiezen</button></p>
    <form class="plaatjeform" onsubmit="return false">
      <div class="plaatjeform__voorbeeld" aria-hidden="true">${plaatje(naam, o, { profiel: { geenFoto: true } })}</div>
      <section class="plaatjeform__blok"><h3 class="plaatjeform__label">Foto voor je plaatje</h3><div class="plaatjeform__fotorij"><button type="button" class="plaatjeknop plaatjeknop--neven">${icoon('camera', 20)}Foto kiezen</button></div><p class="plaatjeform__uitleg">Mag, hoeft niet. Wordt op je telefoon verkleind; de locatie uit de foto gaat eraf.</p></section>
    </form>
  </div></div>`
}

// ---------- Knoppenbalk + telefoons ----------

/** Leest de keuzes uit de knoppenbalk (radio's met name=...) */
export function keuzes(form) {
  const f = new FormData(form)
  return Object.fromEntries(f.entries())
}

/** Zet thema en breedte op een telefoon */
export function zetTel(el, k) {
  el.dataset.thema = k.thema ?? 'licht'
  el.style.setProperty('--breed', `${k.breed ?? 390}px`)
}

/** Naam van jouw appartement uit de knop "naam" */
export const NAMEN = {
  lang: 'Poedersneeuw op de Pistekant',
  kort: 'Ski',
  cijfer: 'De 7 Dwergen',
  heellang: 'Gletsjerspletenparadijsappartement',
  geen: '',
}
