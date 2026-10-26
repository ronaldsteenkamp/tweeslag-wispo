import { useEffect, useMemo, useRef, useState } from 'react'
import type { Kamers } from '../lib/data'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { lees, schrijfEnMeld, useOpgeslagen } from '../lib/opslag'
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

const BUITEN_LABEL: Record<Buiten, string> = { rood: 'Rood', zwart: 'Zwart', laag: 'Laag', hoog: 'Hoog' }
/** Welke getallen Laag en Hoog zijn, klein onder de knop */
const bereik = (b: Buiten, n: number) =>
  b === 'laag' ? `1–${helft(n)}` : b === 'hoog' ? `${helft(n) + 1}–${2 * helft(n)}` : null

const fiches = (n: number) => n.toLocaleString('nl-NL')
const som = (inzet: Record<string, number>) => Object.values(inzet).reduce((s, x) => s + x, 0)

/** Een bedrag als stapeltje fiches (grootste eerst), voor op het speelveld */
function stapel(bedrag: number): number[] {
  const uit: number[] = []
  for (const f of [...FICHES].reverse()) while (bedrag >= f && uit.length < 6) (uit.push(f), (bedrag -= f))
  return uit
}

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
  const [geluidAan, setGeluidAan] = useOpgeslagen('rad.geluid', true)
  const wiel = useRef<SVGGElement>(null)
  const bal = useRef<SVGCircleElement>(null)
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
    const [bx, by] = punt(st.straal, st.bal)
    bal.current?.setAttribute('cx', String(bx))
    bal.current?.setAttribute('cy', String(by))
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
    const getal = willekeurig(vakken) // vak i = getal i (0, 1, 2, …, N)
    const worp = planWorp({
      wiel: hoek.current,
      wielSnelheid: wielSnelheid.current,
      bal: balHoek.current ?? hoek.current + 180 / vakken,
      balStraal: balStraal.current,
      getal,
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
    setUitslag({ getal, naam: getal === 0 ? null : volgorde[getal - 1] ?? null, ingezet: totaal, uitbetaald })
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

  return (
    <div className="casino">
      {n < 2 ? (
        <p className="melding">Kies minstens twee spelers (tik hieronder op Spelers).</p>
      ) : (
        <section className="casino__tafel" aria-label="Jaccasino">
          <div className="casino__kopregel">
            <h2 className="casino__titel">
              <CasinoLogo />
            </h2>
            <div className="casino__rechts">
              <button
                type="button"
                className="casino__geluid"
                onClick={() => setGeluidAan(!geluidAan)}
                aria-pressed={geluidAan}
                aria-label={geluidAan ? 'Geluid en trillen uitzetten' : 'Geluid en trillen aanzetten'}
                title={geluidAan ? 'Geluid en trillen aan' : 'Geluid en trillen uit'}
              >
                {geluidAan ? '🔊' : '🔇'}
              </button>
              <p className="casino__saldo" aria-label={`${fiches(saldo)} fiches`}>
                <span aria-hidden="true">🪙</span> {fiches(saldo)}
              </p>
            </div>
          </div>

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
          {uitslag && uitslag.uitbetaald > uitslag.ingezet && <Confetti key={ronde} />}

          <div className="casino__veld">
            <Vak sleutel="0" label="0, iedereen drinkt" klasse="casino__vak casino__vak--nul" inzet={inzet} winnend={winnend('0')} onZet={zet} uit={!!uitslag || bezig}>
              <strong>0</strong>
              <span>Iedereen drinkt</span>
            </Vak>
            <div className="casino__raster">
              {volgorde.map((speler, i) => {
                const g = i + 1
                return (
                  <Vak
                    key={g}
                    sleutel={String(g)}
                    label={`${g}, ${speler}`}
                    klasse={`casino__vak casino__vak--${kleurVan(g, n)}`}
                    inzet={inzet}
                    winnend={winnend(String(g))}
                    onZet={zet}
                    uit={!!uitslag || bezig}
                  >
                    <strong>{g}</strong>
                    <span>{speler}</span>
                  </Vak>
                )
              })}
            </div>
            <div className="casino__buiten">
              {buitenInzetten(n).map((b) => (
                <Vak
                  key={b}
                  sleutel={b}
                  label={bereik(b, n) ? `${BUITEN_LABEL[b]}, ${bereik(b, n)}` : BUITEN_LABEL[b]}
                  klasse={`casino__vak casino__vak--buiten casino__vak--${b}`}
                  inzet={inzet}
                  winnend={winnend(b)}
                  onZet={zet}
                  uit={!!uitslag || bezig}
                >
                  <strong>{BUITEN_LABEL[b]}</strong>
                  {bereik(b, n) && <span>{bereik(b, n)}</span>}
                </Vak>
              ))}
            </div>
          </div>

          {saldo === 0 && totaal === 0 && !bezig && !uitslag ? (
            <div className="casino__bank">
              <button
                type="button"
                className="knop knop--breed casino__knop"
                onClick={() => {
                  setSaldo(LENING)
                  setGeleend(geleend + 1)
                }}
              >
                🍺 Trek een bak voor {fiches(LENING)} nieuwe fiches
              </button>
            </div>
          ) : (
            <>
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
                  {bezig ? 'Rolt…' : totaal === 0 ? 'Zet in' : 'Rien ne va plus!'}
                </button>
              </div>
              <p className="casino__inzetregel">
                Inzet <strong>{fiches(totaal)}</strong>
                {totaal > 0 && !bezig && (
                  <button type="button" className="tekstknop casino__terug" onClick={inzetTerug}>
                    terugnemen
                  </button>
                )}
              </p>
            </>
          )}
          <p className="verborgen" aria-live="polite">
            {uitslag ? uitslagTekst(uitslag) : ''}
          </p>
        </section>
      )}

      <details className="kaartje casino__spelers">
        <summary>Spelers ({spelers.length})</summary>
        {/* Niets aan te passen zolang het balletje rolt */}
        <fieldset className="radinstellingen" disabled={bezig}>
          <DeelnemersKiezer kamers={kamers} naam={naam} />
        </fieldset>
      </details>
      <p className="klein casino__bakken">
        🍺 {geleend} {geleend === 1 ? 'bak' : 'bakken'} getrokken
      </p>

      {uitslag && toonPopup && (
        // Onderin en licht, zodat wiel en winnend vak zichtbaar blijven
        <div className="dialoog-achtergrond dialoog-achtergrond--licht" onClick={volgendeRonde}>
          <div
            ref={popup}
            className="dialoog casino__popup"
            role="dialog"
            aria-modal="true"
            aria-label="Uitslag"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="casino__getal">
              <span className={`casino__bol casino__bol--${kleurVan(uitslag.getal, n)}`}>{uitslag.getal}</span>
              {kleurVan(uitslag.getal, n)}
            </p>
            <p className="casino__klos">{uitslag.naam ? `${uitslag.naam} neemt een slok!` : '🍻 Iedereen drinkt!'}</p>
            <p>
              {uitslag.uitbetaald > uitslag.ingezet
                ? `Je wint ${fiches(uitslag.uitbetaald - uitslag.ingezet)} fiches 🎉`
                : uitslag.uitbetaald === uitslag.ingezet
                  ? 'Quitte: je krijgt je inzet terug.'
                  : `Je verliest ${fiches(uitslag.ingezet - uitslag.uitbetaald)} fiches.`}
            </p>
            <button type="button" className="knop knop--breed casino__knop" onClick={volgendeRonde}>
              Volgende ronde
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
  label,
  klasse,
  inzet,
  winnend,
  uit,
  onZet,
  children,
}: {
  sleutel: string
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
      className={`${klasse}${winnend ? ' is-winnend' : ''}`}
      onClick={() => onZet(sleutel)}
      aria-disabled={uit}
      aria-label={`${label}${bedrag ? `, ingezet ${bedrag}` : ''}`}
    >
      {children}
      {bedrag > 0 && (
        <span className="stapel" aria-hidden="true">
          {stapel(bedrag).map((f, i) => (
            <span key={i} className={`fiche fiche--mini fiche--${f}`} style={{ bottom: i * 3 }} />
          ))}
          <span className="stapel__bedrag">{bedrag}</span>
        </span>
      )}
    </button>
  )
}


const WIELKLEUR: Record<Kleur, string> = { groen: '#1d8a4a', rood: '#b8141d', zwart: '#181818', blauw: '#2563b0' }

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
  bal: React.RefObject<SVGCircleElement>
  staart: React.RefObject<SVGPathElement>
  hoek: number
  balHoek: number
  balStraal: number
  /** Na de worp: dit getal groot in het midden (ook leesbaar als het wiel klein is) */
  uitslag: number | null
}) {
  const vakken = n + 1
  const vak = 360 / vakken
  const letter = vakken <= 13 ? 8.5 : vakken <= 25 ? 7.5 : 6.5
  const kleur = (g: number) => WIELKLEUR[kleurVan(g, n)]
  const [bx, by] = punt(balStraal, balHoek)
  return (
    <svg className="casino__wiel" viewBox="-118 -118 236 236" role="img" aria-label={`Roulettewiel met 0 tot en met ${n}`}>
      <defs>
        <radialGradient id="rw-rand" cx="0" cy="0" r="117" gradientUnits="userSpaceOnUse">
          <stop offset="92%" stopColor="#6e3f1b" />
          <stop offset="96%" stopColor="#8a5428" />
          <stop offset="100%" stopColor="#3d210c" />
        </radialGradient>
        {/* Vaste deel: de baan langs de rand en de schuine helling naar het wiel */}
        <radialGradient id="rw-kom" cx="0" cy="0" r="108" gradientUnits="userSpaceOnUse">
          <stop offset="81%" stopColor="#1c120a" />
          <stop offset="89%" stopColor="#4a3020" />
          <stop offset="90.5%" stopColor="#2b1a0d" />
          <stop offset="96%" stopColor="#5c3b20" />
          <stop offset="100%" stopColor="#24150a" />
        </radialGradient>
        <radialGradient id="rw-kegel" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#a8703a" />
          <stop offset="55%" stopColor="#6e4220" />
          <stop offset="100%" stopColor="#3a210e" />
        </radialGradient>
        <radialGradient id="rw-goud" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff4c4" />
          <stop offset="50%" stopColor="#e2b752" />
          <stop offset="100%" stopColor="#8a6420" />
        </radialGradient>
        <linearGradient id="rw-chroom" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#b9bec4" />
          <stop offset="100%" stopColor="#6d737a" />
        </linearGradient>
        {/* Diepte in de vakjes: donkerder aan de randen */}
        <radialGradient id="rw-diepte" cx="0" cy="0" r="88" gradientUnits="userSpaceOnUse">
          <stop offset="71.5%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="78%" stopColor="#000" stopOpacity="0" />
          <stop offset="84%" stopColor="#000" stopOpacity="0.05" />
          <stop offset="87.5%" stopColor="#000" stopOpacity="0.5" />
          <stop offset="88%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rw-licht" cx="35%" cy="22%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rw-bal" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#ecebe6" />
          <stop offset="100%" stopColor="#a9a8a2" />
        </radialGradient>
      </defs>
      <circle r="117" fill="url(#rw-rand)" />
      <circle r="108.5" fill="url(#rw-kom)" stroke="#e8c463" strokeWidth="1" />
      <circle r={R_BAAN - 5.2} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="0.8" />
      {DIAMANTEN.map((d, i) => (
        <polygon
          key={d}
          points={i % 2 ? '-4.5,0 0,-1.8 4.5,0 0,1.8' : '0,-4.5 1.8,0 0,4.5 -1.8,0'}
          fill="url(#rw-chroom)"
          stroke="#4b4f55"
          strokeWidth="0.4"
          transform={`rotate(${d}) translate(0 ${-R_DIAMANT})`}
        />
      ))}
      <g ref={wiel} transform={`rotate(${hoek})`}>
        <circle r="89" fill="url(#rw-chroom)" />
        {Array.from({ length: vakken }, (_, g) => (
          <g key={g}>
            {/* Getallenring buiten, vakjes binnen (zoals bij een echt wiel) */}
            <path d={taartpunt(88, g * vak, (g + 1) * vak, 77)} fill={kleur(g)} />
            <path d={taartpunt(77, g * vak, (g + 1) * vak, 63)} fill={kleur(g)} />
            <text
              transform={`rotate(${(g + 0.5) * vak})`}
              y={-82.5}
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
          const [x3, y3] = punt(63, g * vak)
          return (
            <g key={g}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8c463" strokeWidth="0.5" />
              {/* Schotje tussen twee vakjes */}
              <line x1={x2} y1={y2} x2={x3} y2={y3} stroke="#d4d8dc" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          )
        })}
        <circle r="77" fill="none" stroke="#e8c463" strokeWidth="1.2" />
        <circle r="63.5" fill="url(#rw-kegel)" stroke="#c9ced3" strokeWidth="2" />
        <circle r="50" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />
        <circle r="30" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />
        {/* Het kruis in het midden waaraan de croupier het wiel draait */}
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect x="-2.2" y="-38" width="4.4" height="30" rx="2.2" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.4" />
            <circle cy="-40" r="4.6" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.4" />
          </g>
        ))}
        <circle r="11" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.6" />
        <circle r="5" fill="url(#rw-goud)" stroke="#7a561a" strokeWidth="0.4" />
      </g>
      {/* Licht van boven: draait niet mee, zoals een echte weerspiegeling */}
      <circle r="108" fill="url(#rw-licht)" pointerEvents="none" />
      <path ref={staart} d="" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" />
      <circle ref={bal} cx={bx} cy={by} r="4.2" fill="url(#rw-bal)" className="casino__bal" />
      {uitslag !== null && (
        <g className="casino__wieluitslag" aria-hidden="true">
          <circle r="27" fill={WIELKLEUR[kleurVan(uitslag, n)]} stroke="#e8c463" strokeWidth="3" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="30" fill="#ffffff" className="casino__wielgetal">
            {uitslag}
          </text>
        </g>
      )}
    </svg>
  )
}
