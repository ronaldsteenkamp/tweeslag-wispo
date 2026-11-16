import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { badgeDef, TE_HALEN, useBadges, type Badge } from '../lib/badges'
import { telefoonUitFeiten } from '../lib/badgeregels'
import { lees, schrijf, schrijfEnMeld } from '../lib/opslag'
import { Feestregen } from './Feestregen'
import { toonProfiel } from './Profiel'

const label = (b: Badge) => {
  const d = badgeDef(b.id)
  return b.aantal && b.aantal > 1 ? `${d.naam} ×${b.aantal}` : d.naam
}

/**
 * Rij badges onder de naam in het profielvenster. Tik op een badge voor de uitleg: die komt als
 * tekstballon over de inhoud heen, zodat de foto en de naam niet verschuiven. Sluiten: dezelfde
 * badge nog eens, ergens anders tikken of Escape. Met leegTekst staat er een regel als er nog geen
 * badges zijn (Jouw profiel); zonder leegTekst blijft de rij dan weg (profiel van een ander).
 */
export function BadgeRij({ naam, leegTekst }: { naam: string; leegTekst?: string }) {
  const { van } = useBadges(true)
  const badges = van(naam)
  const [gekozen, setGekozen] = useState<Badge['id'] | null>(null)
  // Plek van het pijltje (midden van de gekozen badge) en of de ballon boven de rij moet
  const [pijlX, setPijlX] = useState(0)
  const [boven, setBoven] = useState(false)
  const rij = useRef<HTMLDivElement>(null)
  const ballon = useRef<HTMLDivElement>(null)
  const knoppen = useRef(new Map<Badge['id'], HTMLButtonElement>())
  const ballonId = useId()
  const uitleg = badges.find((b) => b.id === gekozen)

  // Sluiten door ernaast te tikken of met Escape (alleen de ballon, niet het hele venster)
  useEffect(() => {
    if (!gekozen) return
    const buiten = (e: PointerEvent) => {
      if (!rij.current?.contains(e.target as Node)) setGekozen(null)
    }
    const opToets = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Vangfase op window: zo komt de Escape niet meer bij het profielvenster
      e.stopImmediatePropagation()
      setGekozen(null)
    }
    document.addEventListener('pointerdown', buiten)
    window.addEventListener('keydown', opToets, true)
    return () => {
      document.removeEventListener('pointerdown', buiten)
      window.removeEventListener('keydown', opToets, true)
    }
  }, [gekozen])

  // Voor het tekenen meten: pijltje onder de badge, en boven de rij als er onder te weinig plek is
  useLayoutEffect(() => {
    const knop = gekozen ? knoppen.current.get(gekozen) : null
    if (!knop || !rij.current || !ballon.current) return
    setPijlX(knop.offsetLeft + knop.offsetWidth / 2)
    const r = rij.current.getBoundingClientRect()
    const scroller = rij.current.closest('.dialoog--hoog')
    const vak = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
    const nodig = ballon.current.offsetHeight + 12
    const erboven = vak.bottom - r.bottom < nodig && r.top - vak.top >= nodig
    setBoven(erboven)
    // Past hij nergens helemaal, dan het venster een stukje meeschuiven
    if (!erboven && vak.bottom - r.bottom < nodig) ballon.current.scrollIntoView({ block: 'nearest' })
  }, [gekozen])

  if (!badges.length) return leegTekst ? <p className="badgerij__leeg">{leegTekst}</p> : null
  const d = uitleg ? badgeDef(uitleg.id) : null
  return (
    <div className="badgerij" ref={rij}>
      <ul className="badgerij__lijst" aria-label="Badges">
        {badges.map((b) => {
          const def = badgeDef(b.id)
          return (
            <li key={b.id}>
              <button
                ref={(el) => {
                  if (el) knoppen.current.set(b.id, el)
                  else knoppen.current.delete(b.id)
                }}
                type="button"
                className={`badge${gekozen === b.id ? ' is-gekozen' : ''}`}
                aria-label={`${label(b)}: ${def.uitleg}`}
                aria-expanded={gekozen === b.id}
                aria-controls={ballonId}
                onClick={() => setGekozen(gekozen === b.id ? null : b.id)}
              >
                <span aria-hidden="true">{def.emoji}</span>
                {b.aantal && b.aantal > 1 && <span className="badge__aantal">×{b.aantal}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {uitleg && d && (
        <div
          ref={ballon}
          id={ballonId}
          className={`badgeballon${boven ? ' badgeballon--boven' : ''}`}
          role="status"
          style={{ '--pijl-x': `${pijlX}px` } as CSSProperties}
        >
          <strong>
            {d.emoji} {label(uitleg)}
          </strong>
          <span>
            {d.uitleg}
            {d.wisselt && ' (gaat naar wie voorop staat)'}
          </span>
        </div>
      )}
    </div>
  )
}

/** Kaart in Spel met al jouw badges, ook die je nog kunt halen */
export function JouwBadges() {
  const { van, feitenVan, mijnNaam } = useBadges(true)
  if (!mijnNaam) return null
  const mijn = van(mijnNaam)
  const feiten = feitenVan(mijnNaam)
  const heb = new Map(mijn.map((b) => [b.id, b]))
  return (
    <section className="kaartje badgekaart" aria-labelledby="badgekaart-titel">
      <h2 id="badgekaart-titel" className="badgekaart__titel">
        Jouw badges <span>{mijn.length} van {TE_HALEN.length}</span>
      </h2>
      <ul className="badgekaart__lijst">
        {TE_HALEN.map((d) => {
          const b = heb.get(d.id)
          return (
            <li key={d.id} className={`badgekaart__item${b ? ' is-verdiend' : ''}`}>
              <span className="badge badge--groot" aria-hidden="true">
                {d.emoji}
              </span>
              <span className="badgekaart__tekst">
                <strong>
                  {b ? label(b) : d.naam}
                  {d.wisselt && <span className="badgekaart__wisselt"> · wisselt</span>}
                </strong>
                <span>{b ? d.uitleg : `Nog te verdienen: ${d.nogTeDoen(feiten)}`}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const GEZIEN = 'badges.gezien'

/**
 * Eén keer in App: haal je een nieuwe badge, dan even een melding met wat confetti. Tik erop
 * om je profiel te openen. De eerste keer (na het bijwerken van de app) worden de badges die je
 * al had stil onthouden, zodat er niet ineens een rij meldingen komt.
 */
export function BadgeMelding() {
  const { van, feitenVan, mijnNaam, serverBekend, spelGeladen } = useBadges(false)
  const mijn = mijnNaam ? van(mijnNaam) : null

  // De badges die alleen deze telefoon kent klaarzetten voor de server (scorebord.ts stuurt ze mee)
  const telefoon = mijnNaam ? JSON.stringify(telefoonUitFeiten(feitenVan(mijnNaam))) : null
  useEffect(() => {
    if (telefoon !== null && JSON.stringify(lees('badges.telefoon', {})) !== telefoon) schrijfEnMeld('badges.telefoon', JSON.parse(telefoon))
  }, [telefoon])
  const ids = mijn ? mijn.map((b) => b.id).join(',') : null
  const [melding, setMelding] = useState<Badge | null>(null)
  const [feest, setFeest] = useState(0)
  const wachtrij = useRef<Badge[]>([])

  useEffect(() => {
    // Pas kijken als spel.json er is: anders lijken de spelbadges even weg
    if (!mijn || !mijnNaam || !spelGeladen) return
    const gezien = lees<{ naam: string; ids: string[] } | null>(GEZIEN, null)
    if (!gezien || gezien.naam !== mijnNaam) {
      schrijf(GEZIEN, { naam: mijnNaam, ids: mijn.map((b) => b.id) })
      return
    }
    const nieuw = mijn.filter((b) => !gezien.ids.includes(b.id))
    // Kwijt (een badge die wisselt, of na het wissen van de testperiode): vergeten, zodat je
    // hem opnieuw gemeld krijgt. Zonder stand van de server de serverbadges niet vergeten.
    const behouden = gezien.ids.filter(
      (id) => mijn.some((b) => b.id === id) || (!serverBekend && badgeDef(id as Badge['id'])?.server),
    )
    schrijf(GEZIEN, { naam: mijnNaam, ids: [...behouden, ...nieuw.map((b) => b.id)] })
    if (nieuw.length) {
      wachtrij.current.push(...nieuw)
      setMelding((m) => m ?? wachtrij.current.shift() ?? null)
    }
    // ids: alleen opnieuw kijken als de set badges verandert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, mijnNaam, serverBekend, spelGeladen])

  useEffect(() => {
    if (!melding) return
    setFeest((n) => n + 1)
    const id = window.setTimeout(() => setMelding(wachtrij.current.shift() ?? null), 4200)
    return () => window.clearTimeout(id)
  }, [melding])

  const tekst = useMemo(() => (melding ? `${badgeDef(melding.id).emoji} Nieuwe badge: ${label(melding)}` : null), [melding])

  return (
    <>
      {feest > 0 && <Feestregen key={feest} klein onKlaar={() => setFeest(0)} />}
      {melding && mijnNaam && (
        <button
          type="button"
          className="feest feest--klein badgemelding"
          role="status"
          onClick={() => {
            setMelding(wachtrij.current.shift() ?? null)
            toonProfiel(mijnNaam)
          }}
        >
          {tekst}
          <small>{badgeDef(melding.id).uitleg} · tik voor je profiel</small>
        </button>
      )}
    </>
  )
}
