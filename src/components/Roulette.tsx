import { useEffect, useMemo, useRef, useState } from 'react'
import { Icoon } from './Icoon'
import { useToonNaam } from '../lib/bijnamen'
import type { Kamers } from '../lib/data'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { lees, schrijf, schrijfEnMeld, useOpgeslagen } from '../lib/opslag'
import { deelnemers, fractie, schud, useDeelnemersKeuze, willekeurig } from '../lib/rad'
import { tabToetsen } from '../lib/tabbladen'
import { CasinoLogo } from './CasinoLogo'
import { Confetti } from './Confetti'
import { DeelnemersKiezer } from './DeelnemersKiezer'
import {
  buitenInzetten,
  DIAMANTEN,
  helft,
  kleurVan,
  planWorp,
  R_BAAN,
  R_DIAMANT,
  R_VAKJE,
  uitbetaling,
  wielVolgorde,
  type Buiten,
  type Kleur,
  type Stand,
  type Worp,
} from '../lib/roulette'
import { minderBeweging, punt, rolgeluid, taartpunt, tik, tril } from './Wiel'

/*
 * Het Jaccasino: een roulettetafel met de deelnemers als getallen. Fiches zijn nep en staan
 * alleen op deze telefoon; ze tellen nergens mee.
 */

const FICHES = [10, 25, 100] as const
const START = 1000
/** Fiches op, dan: een bak (bier in één keer leeg) voor zoveel nieuwe fiches */
const LENING = 500

/**
 * Grapje: op hun eigen telefoon zit het geluk een beetje mee of tegen. Positief: een verloren
 * worp wordt met deze kans nog één keer overgegooid. Negatief: een gewonnen worp net zo.
 * Op rood/zwart (10 spelers) wordt dat ongeveer +26% i.p.v. −9% per worp, resp. −24%.
 */
const GELUK: Record<string, number> = { jacco: 0.7, josje: -0.3 }
const sleutelNaam = (s: string) => s.trim().toLocaleLowerCase('nl')

const BUITEN_LABEL: Record<Buiten, string> = { rood: 'Rood', zwart: 'Zwart', laag: 'Laag', hoog: 'Hoog' }
/**
 * Welke getallen bij een buiteninzet horen, klein onder de knop. Zo is ook te zien dat het blauwe
 * getal (bij een oneven aantal spelers) bij geen van de vier hoort.
 */
function bereik(b: Buiten, n: number): string {
  const h = helft(n)
  if (b === 'laag') return h === 1 ? '1' : `1–${h}`
  if (b === 'hoog') return h === 1 ? '2' : `${h + 1}–${2 * h}`
  const eerste = b === 'rood' ? 1 : 2
  const laatste = 2 * h - (b === 'rood' ? 1 : 0)
  if (laatste === eerste) return String(eerste)
  if (laatste === eerste + 2) return `${eerste}, ${laatste}`
  return `${eerste}, ${eerste + 2} … ${laatste}`
}

/**
 * Iedereen opnieuw laten beginnen (fiches terug naar START, bakken op 0): verander deze
 * waarde. Elke telefoon reset dan één keer, bij de eerste keer openen na de update.
 */
const CASINO_RESET = '2026-11-12'

/** Eén keer bij het starten van de app, vóór het tekenen */
export function resetCasinoAlsNodig() {
  if (lees<string | null>('casino.reset', null) === CASINO_RESET) return
  schrijf('casino.fiches', START)
  schrijf('casino.geleend', 0)
  schrijf('casino.inzet', {})
  schrijf('casino.reset', CASINO_RESET)
}

const fiches = (n: number) => n.toLocaleString('nl-NL')
const hoofdletter = (s: string) => s.charAt(0).toLocaleUpperCase('nl') + s.slice(1)
const som = (inzet: Record<string, number>) => Object.values(inzet).reduce((s, x) => s + x, 0)

/** Een bedrag als stapeltje fiches (grootste boven), voor op het speelveld; hoogstens drie */
function stapel(bedrag: number): number[] {
  const uit: number[] = []
  for (const f of [...FICHES].reverse()) while (bedrag >= f && uit.length < 3) (uit.push(f), (bedrag -= f))
  return uit.reverse()
}

/** Een stapel verspringt een beetje, zoals echte fiches (px opzij per fiche) */
const VERSPRING = [0, 1.5, -1]

/** Lange namen kleiner, over twee regels; het nummer blijft altijd even groot */
const LANG = 9

interface Uitslag {
  getal: number
  naam: string | null
  ingezet: number
  uitbetaald: number
}

export function Roulette({
  naam,
  kamers,
  onBezig,
}: {
  naam: string | null
  kamers?: Kamers
  /** Draait het wiel? (dan kan er niet van rad gewisseld worden) */
  onBezig?: (bezig: boolean) => void
}) {
  const [keuze] = useDeelnemersKeuze()
  const [saldo, setSaldo] = useOpgeslagen('casino.fiches', START)
  const [geleend, setGeleend] = useOpgeslagen('casino.geleend', 0)
  const [fiche, setFiche] = useState<number>(25)
  // Ook bewaard, zodat een inzet niet verdwijnt als de app tussendoor wordt gesloten
  const [inzet, setInzet] = useOpgeslagen<Record<string, number>>('casino.inzet', {})
  const [bezig, setBezig] = useState(false)
  useEffect(() => onBezig?.(bezig), [bezig, onBezig])
  const [uitslag, setUitslag] = useState<Uitslag | null>(null)
  // Eerst even het winnende vak (en confetti) laten zien, dan pas de popup
  const [toonPopup, setToonPopup] = useState(false)
  const popupTimer = useRef<number>()
  const [ronde, setRonde] = useState(0)
  const [melding, setMelding] = useState<string | null>(null)
  const popup = useDialoogFocus<HTMLDivElement>(uitslag !== null && toonPopup)
  // Wie er meedoen: een blad dat opent vanuit de kopregel van de tafel
  const [spelersOpen, setSpelersOpen] = useState(false)
  const spelersBlad = useDialoogFocus<HTMLDivElement>(spelersOpen)
  const tafel = useRef<HTMLElement>(null)
  const raster = useRef<HTMLDivElement>(null)
  const [geluidAan, setGeluidAan] = useOpgeslagen('rad.geluid', true)
  const wiel = useRef<SVGGElement>(null)
  const bal = useRef<SVGGElement>(null)
  const staart = useRef<SVGPathElement>(null)
  // Waar wiel en balletje nu zijn (graden, 0 = boven); een nieuwe draai begint daar.
  // Het balletje ligt in rust in een vakje (null = nog nooit gedraaid: in het vakje van 0).
  const hoek = useRef(0)
  const wielSnelheid = useRef(0)
  const balHoek = useRef<number | null>(null)
  const balStraal = useRef(R_VAKJE)
  const frame = useRef<number | null>(null)
  const rol = useRef<ReturnType<typeof rolgeluid>>(null)
  // De worp die nu rolt (de uitslag ligt al vast) en de inzet van dit moment, voor als je weggaat
  const lopend = useRef<{ getal: number; inzet: Record<string, number>; n: number } | null>(null)
  const inzetNu = useRef(inzet)
  inzetNu.current = inzet

  useEffect(() => {
    // Inzet van een vorige keer (app tussendoor gesloten): terug naar het saldo
    const oud = som(lees<Record<string, number>>('casino.inzet', {}))
    if (oud) {
      inzetNu.current = {}
      schrijfEnMeld('casino.inzet', {})
      schrijfEnMeld('casino.fiches', lees('casino.fiches', START) + oud)
      setMelding(`Je inzet van ${fiches(oud)} fiches staat weer bij je saldo.`)
    }
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      rol.current?.stop()
      window.clearTimeout(popupTimer.current)
      // Weg van het casino: een lopende worp meteen afrekenen, anders de inzet terug
      const l = lopend.current
      const terug = l
        ? Object.entries(l.inzet).reduce((t, [k, x]) => t + uitbetaling(k, x, l.getal, l.n), 0)
        : som(inzetNu.current)
      if (terug) schrijfEnMeld('casino.fiches', lees('casino.fiches', START) + terug)
      if (l || terug) schrijfEnMeld('casino.inzet', {})
      lopend.current = null
      inzetNu.current = {}
    }
  }, [])

  const spelers = useMemo(() => deelnemers(keuze, kamers, naam), [keuze, kamers, naam])
  const toonNaam = useToonNaam()
  // Elk getal 1..N hoort bij één naam, per ronde opnieuw geschud. Tafel en wiel volgen deze
  // volgorde (niet de spelerslijst zelf), zodat ze niet veranderen terwijl het balletje rolt.
  const [volgorde, setVolgorde] = useState<string[]>(() => schud(spelers))
  const n = volgorde.length
  const totaal = som(inzet)
  const totaalNu = useRef(totaal)
  totaalNu.current = totaal

  // Andere spelers: inzet terug en opnieuw schudden. Niet tijdens een worp of met de uitslag
  // in beeld; dan pas daarna.
  const spelersSleutel = spelers.join('|')
  const tafelVoor = useRef(spelersSleutel)
  useEffect(() => {
    if (bezig || uitslag || spelersSleutel === tafelVoor.current) return
    tafelVoor.current = spelersSleutel
    setVolgorde(schud(spelersSleutel ? spelersSleutel.split('|') : []))
    const terug = totaalNu.current
    if (terug) setSaldo((s) => s + terug)
    totaalNu.current = 0
    setInzet({})
  }, [spelersSleutel, bezig, uitslag, setSaldo])

  useEffect(() => {
    if (!uitslag || !toonPopup) return
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && volgendeRonde()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  })

  useEffect(() => {
    if (!melding) return
    const id = window.setTimeout(() => setMelding(null), 2500)
    return () => window.clearTimeout(id)
  }, [melding])

  // Spelersblad: Escape sluit, en de pagina eronder ligt stil
  useEffect(() => {
    if (!spelersOpen) return
    const html = document.documentElement
    html.classList.add('venster-open')
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && setSpelersOpen(false)
    window.addEventListener('keydown', opToets)
    return () => {
      html.classList.remove('venster-open')
      window.removeEventListener('keydown', opToets)
    }
  }, [spelersOpen])

  // De tafel is zo hoog als het scherm tussen de kopbalk en de tabbalk. Bij het openen van het
  // casino schuift hij daar in beeld (alleen als hij nog niet helemaal te zien is).
  const heeftTafel = n >= 2
  useEffect(() => {
    // Even wachten: de Spel-kop wordt bij het casino eerst compacter, daarna ligt de tafel pas vast
    const id = window.setTimeout(() => {
      const t = tafel.current
      // Niet in een buurscherm (het Spel-scherm naast Groep of Kaart, klaar om naartoe te vegen):
      // dat zou de pagina van de tab die je nu ziet laten scrollen
      if (!t || t.closest('.buurpaneel')) return
      const r = t.getBoundingClientRect()
      const tabbalk = document.querySelector('.tabbalk')?.getBoundingClientRect().top ?? window.innerHeight
      if (r.top >= 40 && r.bottom <= tabbalk + 1) return
      // Zelf uitrekenen: scroll-margin-top (de kopbalk) wordt niet overal meegenomen
      const marge = parseFloat(getComputedStyle(t).scrollMarginTop) || 0
      window.scrollTo({ top: window.scrollY + r.top - marge, behavior: minderBeweging() ? 'auto' : 'smooth' })
    }, 150)
    return () => window.clearTimeout(id)
  }, [heeftTafel])

  // Na de worp: het winnende getal in het raster in beeld schuiven (bij veel spelers scrolt het)
  useEffect(() => {
    const r = raster.current
    if (!uitslag || !r || uitslag.getal === 0) return
    const vak = r.querySelector<HTMLElement>(`[data-getal="${uitslag.getal}"]`)
    if (!vak) return
    const boven = vak.offsetTop // het raster is position: relative
    if (boven >= r.scrollTop && boven + vak.offsetHeight <= r.scrollTop + r.clientHeight) return
    r.scrollTo({ top: boven - (r.clientHeight - vak.offsetHeight) / 2, behavior: minderBeweging() ? 'auto' : 'smooth' })
  }, [uitslag])

  const zet = (sleutel: string) => {
    if (bezig || uitslag) return
    if (saldo < fiche) {
      setMelding(saldo === 0 ? 'Je fiches zijn op.' : `Je hebt nog maar ${fiches(saldo)} fiches. Kies een kleinere fiche.`)
      return
    }
    setSaldo(saldo - fiche)
    setInzet({ ...inzet, [sleutel]: (inzet[sleutel] ?? 0) + fiche })
  }

  const inzetTerug = () => {
    setSaldo(saldo + totaal)
    setInzet({})
  }

  const volgendeRonde = () => {
    window.clearTimeout(popupTimer.current)
    setToonPopup(false)
    setUitslag(null)
    tafelVoor.current = spelersSleutel
    setVolgorde(schud(spelers))
  }

  const toon = (st: Stand) => {
    hoek.current = st.wiel
    wielSnelheid.current = st.wielSnelheid
    balHoek.current = st.bal
    balStraal.current = st.straal
    wiel.current?.setAttribute('transform', `rotate(${st.wiel})`)
    // Het balletje beweegt met een transform (geen cx/cy), met zijn glans en schaduw erin
    const [bx, by] = punt(st.straal, st.bal)
    bal.current?.setAttribute('transform', `translate(${bx} ${by})`)
    // Bewegingsstaart: zo ziet een snel balletje er ook op 60 beelden per seconde vloeiend uit
    const lengte = Math.min(30, Math.abs(st.balSnelheid) * 0.03)
    if (lengte < 2) staart.current?.setAttribute('d', '')
    else {
      const van = st.bal - Math.sign(st.balSnelheid) * lengte
      const [x1, y1] = punt(st.straal, van)
      const [x2, y2] = punt(st.straal, st.bal)
      const omloop = st.balSnelheid > 0 ? 1 : 0
      staart.current?.setAttribute('d', `M${x1} ${y1} A${st.straal} ${st.straal} 0 0 ${omloop} ${x2} ${y2}`)
    }
  }

  /** Speelt een worp af; klaar zodra het balletje stil ligt (het wiel draait daarna nog even uit) */
  const speel = (worp: Worp) =>
    new Promise<void>((klaar) => {
      if (frame.current) cancelAnimationFrame(frame.current)
      if (minderBeweging()) {
        toon(worp.stand(worp.einde))
        klaar()
        return
      }
      rol.current = geluidAan ? rolgeluid() : null
      const begin = performance.now()
      let volgendTikje = 0
      let geland = false
      const stap = (nu: number) => {
        const t = (nu - begin) / 1000
        const st = worp.stand(t)
        toon(st)
        if (geluidAan) {
          while (volgendTikje < worp.tikjes.length && worp.tikjes[volgendTikje].t <= t) {
            const tj = worp.tikjes[volgendTikje++]
            tik(tj.volume, tj.toon)
            tril(4)
          }
          const v = Math.abs(st.balSnelheid)
          rol.current?.zet(st.rolt ? Math.min(0.05, v / 12000) : 0, 300 + v * 0.8)
        }
        if (!geland && t >= worp.landing) {
          geland = true
          rol.current?.stop()
          rol.current = null
          window.setTimeout(klaar, 500)
        }
        if (t < worp.einde) frame.current = requestAnimationFrame(stap)
        else frame.current = null
      }
      frame.current = requestAnimationFrame(stap)
    })

  const draaiWiel = async () => {
    if (bezig || totaal === 0 || n < 2) return
    const vakken = n + 1
    let getal = willekeurig(vakken) // 0, 1, 2, …, N
    const geluk = naam ? GELUK[sleutelNaam(naam)] ?? 0 : 0
    const netto = (g: number) => Object.entries(inzet).reduce((s, [k, x]) => s + uitbetaling(k, x, g, n), 0) - totaal
    if ((geluk > 0 ? netto(getal) < 0 : netto(getal) > 0) && fractie() < Math.abs(geluk)) getal = willekeurig(vakken)
    const worp = planWorp({
      wiel: hoek.current,
      wielSnelheid: wielSnelheid.current,
      bal: balHoek.current ?? hoek.current + 180 / vakken,
      balStraal: balStraal.current,
      vakje: wielVolgorde(n).indexOf(getal),
      vakken,
      toeval: fractie,
    })
    lopend.current = { getal, inzet, n }
    setBezig(true)
    setUitslag(null)
    await speel(worp)
    if (!lopend.current) return // intussen weggegaan: al afgerekend
    lopend.current = null
    const uitbetaald = Object.entries(inzet).reduce((s, [k, x]) => s + uitbetaling(k, x, getal, n), 0)
    setSaldo((s) => s + uitbetaald)
    const winnaar = getal === 0 ? null : (volgorde[getal - 1] ?? null)
    setUitslag({ getal, naam: winnaar && toonNaam(winnaar), ingezet: totaal, uitbetaald })
    setRonde((r) => r + 1)
    setInzet({})
    setBezig(false)
    if (geluidAan) tril(uitbetaald > totaal ? [80, 60, 80, 60, 200] : 120)
    popupTimer.current = window.setTimeout(() => setToonPopup(true), minderBeweging() ? 0 : 900)
  }

  /** De uitslag als zin, voor schermlezers */
  const uitslagTekst = (u: Uitslag) =>
    `${u.getal}, ${kleurVan(u.getal, n)}. ${u.naam ? `${u.naam} neemt een slok!` : 'Iedereen drinkt!'} ${
      u.uitbetaald > u.ingezet
        ? `Je wint ${fiches(u.uitbetaald - u.ingezet)} fiches.`
        : u.uitbetaald === u.ingezet
          ? 'Quitte.'
          : `Je verliest ${fiches(u.ingezet - u.uitbetaald)} fiches.`
    }`

  const winnend = (sleutel: string) => {
    if (!uitslag) return false
    return /^\d+$/.test(sleutel) ? Number(sleutel) === uitslag.getal : uitbetaling(sleutel, 1, uitslag.getal, n) > 0
  }

  const uit = !!uitslag || bezig
  const fichesOp = saldo === 0 && totaal === 0 && !bezig && !uitslag

  return (
    <div className="casino">
      {n < 2 ? (
        <div className="melding casino__tekort">
          <p>Kies minstens twee spelers om aan tafel te gaan.</p>
          <button type="button" className="knop knop--secundair knop--klein" onClick={() => setSpelersOpen(true)}>
            <Icoon naam="groep" grootte={20} /> Spelers kiezen
          </button>
        </div>
      ) : (
        <section className="casino__tafel" aria-label="Jaccasino" ref={tafel}>
          {/* Kopregel: logo, saldo (met de getrokken bakken) en de twee knoppen van de tafel */}
          <div className="casino__kopregel">
            <h2 className="casino__titel">
              <CasinoLogo />
            </h2>
            <p className="casino__saldo">
              <span className="casino__bedrag">
                <span className="casino__fiche" aria-hidden="true" /> {fiches(saldo)}
                <span className="verborgen"> fiches</span>
              </span>
              <span className="casino__bakken">
                <Icoon naam="bier" grootte={13} /> {geleend} {geleend === 1 ? 'bak' : 'bakken'}
              </span>
            </p>
            <button
              type="button"
              className="casino__rond"
              onClick={() => setGeluidAan(!geluidAan)}
              aria-pressed={geluidAan}
              aria-label={geluidAan ? 'Geluid en trillen uitzetten' : 'Geluid en trillen aanzetten'}
              title={geluidAan ? 'Geluid en trillen aan' : 'Geluid en trillen uit'}
            >
              <Icoon naam={geluidAan ? 'geluid' : 'stil'} grootte={20} />
            </button>
            <button
              type="button"
              className="casino__rond casino__spelersknop"
              onClick={() => setSpelersOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Spelers kiezen, nu ${spelers.length}`}
              title="Spelers"
              // Niets aan te passen zolang het balletje rolt
              disabled={bezig}
            >
              <Icoon naam="groep" grootte={20} />
              <span className="casino__aantal" aria-hidden="true">
                {spelers.length}
              </span>
            </button>
          </div>

          {/* Het wiel vult de ruimte die de tafel over heeft */}
          <div className="casino__wielplek">
            <RouletteWiel
              n={n}
              wiel={wiel}
              bal={bal}
              staart={staart}
              hoek={hoek.current}
              balHoek={balHoek.current ?? hoek.current + 180 / (n + 1)}
              balStraal={balStraal.current}
              uitslag={uitslag?.getal ?? null}
            />
          </div>
          {/* Confetti alleen bij een flinke winst: minstens drie keer de inzet terug (een getal raak) */}
          {uitslag && uitslag.uitbetaald >= 3 * uitslag.ingezet && !minderBeweging() && <Confetti key={ronde} />}

          <div className={`casino__veld${uitslag ? ' is-uitslag' : ''}`}>
            <Vak sleutel="0" label="0, iedereen drinkt" klasse="casino__vak casino__vak--nul" inzet={inzet} winnend={winnend('0')} onZet={zet} uit={uit}>
              <strong>0</strong>
              <span>Iedereen drinkt</span>
            </Vak>
            <div className="casino__raster" ref={raster}>
              {volgorde.map((speler, i) => {
                const g = i + 1
                const kleur = kleurVan(g, n)
                const tekst = toonNaam(speler)
                return (
                  <Vak
                    key={g}
                    getal={g}
                    sleutel={String(g)}
                    label={`${g}, ${tekst}${kleur === 'blauw' ? ', blauw: telt niet voor rood, zwart, laag of hoog' : ''}`}
                    klasse={`casino__vak casino__vak--${kleur}${tekst.length > LANG ? ' is-lang' : ''}`}
                    inzet={inzet}
                    winnend={winnend(String(g))}
                    onZet={zet}
                    uit={uit}
                  >
                    <strong>{g}</strong>
                    <span>{tekst}</span>
                  </Vak>
                )
              })}
            </div>
            <div className="casino__buiten">
              {buitenInzetten(n).map((b) => (
                <Vak
                  key={b}
                  sleutel={b}
                  label={`${BUITEN_LABEL[b]}, ${bereik(b, n)}`}
                  klasse={`casino__vak casino__vak--buiten casino__vak--${b}`}
                  inzet={inzet}
                  winnend={winnend(b)}
                  onZet={zet}
                  uit={uit}
                >
                  <strong>{BUITEN_LABEL[b]}</strong>
                  <span>{bereik(b, n)}</span>
                </Vak>
              ))}
            </div>
          </div>

          {/* De bediening ligt vast onderaan de tafel, net boven de tabbalk */}
          <div className="casino__rail">
            {fichesOp ? (
              <div className="casino__bank">
                <p className="casino__railregel">Je fiches zijn op.</p>
                <button
                  type="button"
                  className="knop casino__knop casino__draai"
                  onClick={() => {
                    setSaldo(LENING)
                    setGeleend(geleend + 1)
                  }}
                >
                  <Icoon naam="bier" grootte={20} /> Trek een bak voor {fiches(LENING)} fiches
                </button>
              </div>
            ) : (
              <>
                <div className="casino__railregel">
                  <span>
                    Inzet <strong className="casino__inzet">{fiches(totaal)}</strong>
                  </span>
                  {totaal > 0 && !bezig ? (
                    <button type="button" className="tekstknop casino__terug" onClick={inzetTerug}>
                      <Icoon naam="herstel" grootte={16} /> Terugnemen
                    </button>
                  ) : (
                    <span className="casino__hint">{bezig ? 'Rien ne va plus' : uitslag ? '' : 'Kies een fiche en tik op een vak'}</span>
                  )}
                </div>
                <div className="casino__bediening">
                  <div
                    className="casino__fiches"
                    role="radiogroup"
                    aria-label="Fiche"
                    onKeyDown={tabToetsen<number>(FICHES, fiche, setFiche)}
                  >
                    {FICHES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={fiche === f}
                        tabIndex={fiche === f ? 0 : -1}
                        className={`fiche fiche--${f}${fiche === f ? ' is-gekozen' : ''}`}
                        onClick={() => setFiche(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="knop casino__knop casino__draai"
                    onClick={() => void draaiWiel()}
                    disabled={bezig || totaal === 0 || !!uitslag}
                  >
                    {bezig
                      ? 'Rolt…'
                      : uitslag
                        ? `${uitslag.getal} · ${hoofdletter(kleurVan(uitslag.getal, n))}`
                        : totaal === 0
                          ? 'Eerst inzetten'
                          : 'Rien ne va plus!'}
                  </button>
                </div>
              </>
            )}

            {uitslag && toonPopup && (
              // Op de plek van de bediening: wiel en winnend vak blijven zichtbaar
              <div
                ref={popup}
                className="casino__popup"
                role="dialog"
                aria-modal="false"
                aria-label="Uitslag"
              >
                <div className="casino__uitslagrij">
                  <span className={`casino__bol casino__bol--${kleurVan(uitslag.getal, n)}`} aria-hidden="true">
                    {uitslag.getal}
                  </span>
                  <div className="casino__uitslagtekst">
                    <p className={`casino__klos${(uitslag.naam?.length ?? 0) > 14 ? ' is-lang' : ''}`}>{uitslag.naam ? `${uitslag.naam} neemt een slok!` : 'Iedereen drinkt!'}</p>
                    <p className="casino__winst">
                      {uitslag.uitbetaald > uitslag.ingezet
                        ? `Je wint ${fiches(uitslag.uitbetaald - uitslag.ingezet)} fiches!`
                        : uitslag.uitbetaald === uitslag.ingezet
                          ? 'Quitte: je krijgt je inzet terug.'
                          : `Je verliest ${fiches(uitslag.ingezet - uitslag.uitbetaald)} fiches.`}
                    </p>
                  </div>
                </div>
                <button type="button" className="knop casino__knop casino__draai casino__volgende" onClick={volgendeRonde}>
                  Volgende ronde
                </button>
              </div>
            )}
          </div>
          <p className="verborgen" aria-live="polite">
            {uitslag ? uitslagTekst(uitslag) : ''}
          </p>
        </section>
      )}

      {spelersOpen && (
        <div className="dialoog-achtergrond" onClick={() => setSpelersOpen(false)}>
          <div
            ref={spelersBlad}
            className="dialoog dialoog--hoog casino__spelersblad"
            role="dialog"
            aria-modal="true"
            aria-labelledby="casino-spelers-titel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="casino__bladkop">
              <h2 id="casino-spelers-titel">Spelers ({spelers.length})</h2>
              <button type="button" className="icoonknop" aria-label="Sluiten" onClick={() => setSpelersOpen(false)}>
                <Icoon naam="kruis" grootte={20} />
              </button>
            </div>
            <p className="klein">
              Elke speler is een getal op het wiel, per ronde opnieuw verdeeld. Bij een oneven aantal is het hoogste getal
              blauw: dat telt niet mee voor Rood, Zwart, Laag of Hoog.
            </p>
            {/* Niets aan te passen zolang het balletje rolt */}
            <fieldset className="radinstellingen" disabled={bezig}>
              <DeelnemersKiezer kamers={kamers} naam={naam} />
            </fieldset>
            <button type="button" className="knop knop--primair knop--breed" onClick={() => setSpelersOpen(false)}>
              Klaar
            </button>
          </div>
        </div>
      )}

      {melding && (
        <div className="toast" role="status">
          <span>{melding}</span>
        </div>
      )}
    </div>
  )
}

function Vak({
  sleutel,
  getal,
  label,
  klasse,
  inzet,
  winnend,
  uit,
  onZet,
  children,
}: {
  sleutel: string
  getal?: number
  label: string
  klasse: string
  inzet: Record<string, number>
  winnend: boolean
  uit: boolean
  onZet: (s: string) => void
  children: React.ReactNode
}) {
  const bedrag = inzet[sleutel] ?? 0
  return (
    <button
      type="button"
      className={`${klasse}${winnend ? ' is-winnend' : ''}${bedrag > 0 ? ' heeft-inzet' : ''}`}
      onClick={() => onZet(sleutel)}
      aria-disabled={uit}
      aria-label={`${label}${bedrag ? `, ingezet ${bedrag}` : ''}`}
      data-getal={getal}
    >
      {children}
      {/* Het stapeltje ligt binnen het vak, rechtsboven, met het bedrag erop */}
      {bedrag > 0 && (
        <span className="stapel" aria-hidden="true">
          {stapel(bedrag).map((f, i) => (
            <span key={i} className={`fiche fiche--mini fiche--${f}`} style={{ top: 8 - i * 3, left: 3 + VERSPRING[i] }} />
          ))}
          <span className="stapel__bedrag">{bedrag}</span>
        </span>
      )}
    </button>
  )
}


const WIELKLEUR: Record<Kleur, string> = { groen: '#17804a', rood: '#b3121b', zwart: '#151515', blauw: '#2360ad' }

/** Boogje op een cirkel van `van` tot `tot` graden (voor lichtstrepen) */
const boog = (r: number, van: number, tot: number) => {
  const [x1, y1] = punt(r, van)
  const [x2, y2] = punt(r, tot)
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`
}

/*
 * Het wiel: een vaste laag (rand, kom, ruiten, licht) en het draaiende deel. Alles is verloop en
 * vorm, geen filters: tijdens het draaien wordt het wiel elk beeld opnieuw getekend.
 */
function RouletteWiel({
  n,
  wiel,
  bal,
  staart,
  hoek,
  balHoek,
  balStraal,
  uitslag,
}: {
  n: number
  wiel: React.RefObject<SVGGElement>
  bal: React.RefObject<SVGGElement>
  staart: React.RefObject<SVGPathElement>
  hoek: number
  balHoek: number
  balStraal: number
  /** Na de worp: dit getal groot in het midden (ook leesbaar als het wiel klein is) */
  uitslag: number | null
}) {
  const vakken = n + 1
  const vak = 360 / vakken
  const letter = vakken <= 13 ? 9 : vakken <= 25 ? 8 : 7
  const kleur = (g: number) => WIELKLEUR[kleurVan(g, n)]
  const ring = useMemo(() => wielVolgorde(n), [n])
  const [bx, by] = punt(balStraal, balHoek)
  const winst = uitslag !== null && ring.includes(uitslag) ? taartpunt(88.3, ring.indexOf(uitslag) * vak, (ring.indexOf(uitslag) + 1) * vak, 63) : null
  return (
    <svg className="casino__wiel" viewBox="-118 -118 236 236" role="img" aria-label={`Roulettewiel met 0 tot en met ${n}${n % 2 ? `; ${n} is blauw` : ''}`}>
      <defs>
        <radialGradient id="rw-schaduw" cx="0" cy="0" r="118" gradientUnits="userSpaceOnUse">
          <stop offset="88%" stopColor="#000" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {/* Hout van de rand: banen nerf, zoals gedraaid hout */}
        <radialGradient id="rw-hout" cx="0" cy="0" r="116" gradientUnits="userSpaceOnUse">
          <stop offset="93.3%" stopColor="#2e1808" />
          <stop offset="94.2%" stopColor="#5e3616" />
          <stop offset="95.1%" stopColor="#83501f" />
          <stop offset="95.7%" stopColor="#6f411b" />
          <stop offset="96.6%" stopColor="#9a6331" />
          <stop offset="97.2%" stopColor="#8a5629" />
          <stop offset="98%" stopColor="#a56d38" />
          <stop offset="98.8%" stopColor="#7a4720" />
          <stop offset="99.5%" stopColor="#55300f" />
          <stop offset="100%" stopColor="#2a1505" />
        </radialGradient>
        {/* Lak: licht van boven, de onderkant in de schaduw */}
        <linearGradient id="rw-lak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="30%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="62%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        {/* Kom: schaduw onder de rand, gepolijste baan, lip, helling en de spleet naar de rotor */}
        <radialGradient id="rw-kom" cx="0" cy="0" r="108.5" gradientUnits="userSpaceOnUse">
          <stop offset="82.2%" stopColor="#0e0803" />
          <stop offset="83.2%" stopColor="#2a1a0c" />
          <stop offset="88%" stopColor="#4c321b" />
          <stop offset="90.4%" stopColor="#2b1a0c" />
          <stop offset="91%" stopColor="#7a5430" />
          <stop offset="91.6%" stopColor="#3a2411" />
          <stop offset="93.5%" stopColor="#5b3c1f" />
          <stop offset="96%" stopColor="#4a2f18" />
          <stop offset="98.4%" stopColor="#1e1208" />
          <stop offset="100%" stopColor="#080402" />
        </radialGradient>
        <linearGradient id="rw-chroom" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#c3c8ce" />
          <stop offset="55%" stopColor="#8d949b" />
          <stop offset="100%" stopColor="#e6e9ec" />
        </linearGradient>
        <linearGradient id="rw-ruit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="48%" stopColor="#cfd4d9" />
          <stop offset="52%" stopColor="#7d848b" />
          <stop offset="100%" stopColor="#b9bfc5" />
        </linearGradient>
        {/* Diepte in de vakjes: donkerder aan de randen */}
        <radialGradient id="rw-diepte" cx="0" cy="0" r="88" gradientUnits="userSpaceOnUse">
          <stop offset="71.5%" stopColor="#000" stopOpacity="0.6" />
          <stop offset="77%" stopColor="#000" stopOpacity="0" />
          <stop offset="83%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="87.4%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="87.6%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {/* Kegel in het midden: gedraaid hout */}
        <radialGradient id="rw-kegel" cx="0" cy="0" r="63.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b98048" />
          <stop offset="30%" stopColor="#a06a37" />
          <stop offset="31%" stopColor="#8c5a2c" />
          <stop offset="55%" stopColor="#7a4b24" />
          <stop offset="56%" stopColor="#6a3f1d" />
          <stop offset="80%" stopColor="#5a3317" />
          <stop offset="81%" stopColor="#4a2a12" />
          <stop offset="94%" stopColor="#3a200d" />
          <stop offset="100%" stopColor="#1e1006" />
        </radialGradient>
        {/* Gepolijst messing */}
        <linearGradient id="rw-arm" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6e4c15" />
          <stop offset="30%" stopColor="#e9c868" />
          <stop offset="42%" stopColor="#fff6d2" />
          <stop offset="58%" stopColor="#d4a640" />
          <stop offset="100%" stopColor="#5e3f10" />
        </linearGradient>
        <radialGradient id="rw-messing" cx="36%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="22%" stopColor="#f6dc8a" />
          <stop offset="55%" stopColor="#c99a33" />
          <stop offset="100%" stopColor="#6e4c15" />
        </radialGradient>
        <radialGradient id="rw-licht" cx="35%" cy="22%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Ivoor */}
        <radialGradient id="rw-bal" cx="36%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fffef9" />
          <stop offset="45%" stopColor="#f4eedd" />
          <stop offset="100%" stopColor="#b9ae92" />
        </radialGradient>
        <radialGradient id="rw-balschaduw" cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rw-glans" cx="34%" cy="28%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Schaduw van het wiel op het vilt (een verloop, geen filter) */}
      <circle cy="3" r="118" fill="url(#rw-schaduw)" />

      {/* Houten rand: nerf, lak en een lichtstreep */}
      <circle r="116" fill="url(#rw-hout)" />
      <g fill="none" stroke="#2a1405" strokeWidth="0.35" strokeOpacity="0.35">
        <circle r="110.6" strokeDasharray="38 5 14 3 60 7 22 4" />
        <circle r="112.3" strokeDasharray="25 6 48 3 18 9 40 5" />
        <circle r="114.4" strokeDasharray="52 4 20 6 33 3" />
      </g>
      <path
        d="M0 -116 A116 116 0 1 1 0 116 A116 116 0 1 1 0 -116 Z M0 -108.5 A108.5 108.5 0 1 0 0 108.5 A108.5 108.5 0 1 0 0 -108.5 Z"
        fill="url(#rw-lak)"
        fillRule="evenodd"
      />
      <path d={boog(113.4, -62, -18)} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.1" strokeLinecap="round" />
      <circle r="116" fill="none" stroke="#1c0e04" strokeWidth="0.8" />

      {/* Kom met de baan van het balletje, lager dan de rand */}
      <circle r="108.5" fill="url(#rw-kom)" />
      <circle r="108.6" fill="none" stroke="#e8c463" strokeWidth="0.6" strokeOpacity="0.9" />
      <path d={boog(R_BAAN, -64, -14)} fill="none" stroke="#fff" strokeOpacity="0.09" strokeWidth="4" strokeLinecap="round" />

      {/* Ruiten van chroom, met een slagschaduw en een lichtrug */}
      {DIAMANTEN.map((d, i) => {
        const [x, y] = punt(R_DIAMANT, d)
        const vorm = i % 2 ? '-4.8,0 0,-1.9 4.8,0 0,1.9' : '0,-4.8 1.9,0 0,4.8 -1.9,0'
        return (
          <g key={d} transform={`translate(${x} ${y}) rotate(${d})`}>
            <polygon points={vorm} fill="#000" fillOpacity="0.45" transform="translate(0.7 0.9)" />
            <polygon points={vorm} fill="url(#rw-ruit)" stroke="#3d4248" strokeWidth="0.35" />
            {i % 2 ? (
              <line x1="-4.2" x2="4.2" y1="0" y2="0" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.35" />
            ) : (
              <line x1="0" x2="0" y1="-4.2" y2="4.2" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.35" />
            )}
          </g>
        )
      })}

      <g ref={wiel} transform={`rotate(${hoek})`}>
        <circle r="89.2" fill="url(#rw-chroom)" />
        {ring.map((g, i) => (
          <g key={g}>
            {/* Getallenring buiten, vakjes binnen (zoals bij een echt wiel) */}
            <path d={taartpunt(88, i * vak, (i + 1) * vak, 77)} fill={kleur(g)} />
            <path d={taartpunt(77, i * vak, (i + 1) * vak, 63)} fill={kleur(g)} />
            <text
              transform={`rotate(${(i + 0.5) * vak})`}
              y={-82.6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={letter}
              fill="#ffffff"
              className="casino__wielgetal"
            >
              {g}
            </text>
          </g>
        ))}
        <circle r="88" fill="url(#rw-diepte)" />
        {Array.from({ length: vakken }, (_, g) => {
          const [x1, y1] = punt(88, g * vak)
          const [x2, y2] = punt(77, g * vak)
          const [x3, y3] = punt(63.5, g * vak)
          return (
            <g key={g}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8c463" strokeWidth="0.45" />
              {/* Metalen wandje tussen twee vakjes: donkere kant met een lichte rug */}
              <line x1={x2} y1={y2} x2={x3} y2={y3} stroke="#2e3238" strokeWidth="1.9" strokeLinecap="round" />
              <line x1={x2} y1={y2} x2={x3} y2={y3} stroke="#eef1f4" strokeWidth="0.9" strokeLinecap="round" />
            </g>
          )
        })}
        <circle r="88" fill="none" stroke="#e8c463" strokeWidth="0.5" />
        <circle r="77" fill="none" stroke="#2e3238" strokeWidth="1.8" />
        <circle r="77" fill="none" stroke="#dfe3e7" strokeWidth="0.9" />
        {/* Na de worp licht het winnende vakje één keer op (het draait mee met het wiel) */}
        {winst && (
          <>
            <path className="casino__wielwinst-gloed" d={winst} fill="none" stroke="#f3d36b" strokeWidth="4.5" strokeOpacity="0.45" strokeLinejoin="round" />
            <path d={winst} fill="#fff" fillOpacity="0.14" stroke="#f8e49a" strokeWidth="1.4" strokeLinejoin="round" />
          </>
        )}
        <circle r="63.5" fill="url(#rw-kegel)" />
        <circle r="63.5" fill="none" stroke="#2e3238" strokeWidth="2.4" />
        <circle r="63.5" fill="none" stroke="url(#rw-chroom)" strokeWidth="1.3" />
        <circle r="40" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="0.6" />
        <circle r="26" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="0.6" />
        {/* Het kruis van messing in het midden waaraan de croupier het wiel draait */}
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect x="-3.2" y="-39" width="6.4" height="31" rx="3.2" fill="#000" fillOpacity="0.28" />
            <rect x="-2.3" y="-38" width="4.6" height="30" rx="2.3" fill="url(#rw-arm)" stroke="#5e3f10" strokeWidth="0.35" />
            <circle cy="-40.5" r="6" fill="#000" fillOpacity="0.25" />
            <circle cy="-40.5" r="4.8" fill="url(#rw-messing)" stroke="#5e3f10" strokeWidth="0.35" />
          </g>
        ))}
        <circle r="13.5" fill="#000" fillOpacity="0.3" />
        <circle r="12" fill="url(#rw-messing)" stroke="#5e3f10" strokeWidth="0.5" />
        <circle r="8.4" fill="none" stroke="#7a561a" strokeWidth="0.5" strokeOpacity="0.7" />
        <circle r="5.6" fill="url(#rw-messing)" stroke="#5e3f10" strokeWidth="0.4" />
      </g>
      {/* Lichtvlek op de messing kop en licht van boven: draaien niet mee, zoals een echte weerspiegeling */}
      <ellipse cx="-3.6" cy="-4.4" rx="3.4" ry="2.2" fill="#fff" fillOpacity="0.55" transform="rotate(-35 -3.6 -4.4)" />
      <circle r="108" fill="url(#rw-licht)" pointerEvents="none" />
      <path ref={staart} d="" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" />
      {/* Ivoren balletje met een schaduwtje en een glansvlek; beweegt met een transform */}
      <g ref={bal} transform={`translate(${bx} ${by})`}>
        <ellipse cx="0.9" cy="1.6" rx="5" ry="4.4" fill="url(#rw-balschaduw)" />
        <circle r="4.2" fill="url(#rw-bal)" />
        <circle cx="-1.4" cy="-1.5" r="1.1" fill="#fff" fillOpacity="0.9" />
      </g>
      {uitslag !== null && (
        <g className="casino__wieluitslag" aria-hidden="true">
          <circle r="29" fill="#000" fillOpacity="0.35" />
          <circle r="27" fill={WIELKLEUR[kleurVan(uitslag, n)]} />
          <circle r="27" fill="url(#rw-glans)" />
          <circle r="27" fill="none" stroke="#f3d36b" strokeWidth="2.2" />
          <circle r="28.6" fill="none" stroke="#5e3f10" strokeWidth="0.8" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="32" fill="#ffffff" className="casino__wielgetal">
            {uitslag}
          </text>
        </g>
      )}
    </svg>
  )
}
