import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { backendIngesteld } from '../lib/backend'
import { badgeDef, TE_HALEN, useActueleStand, useBadges, type Badge, type BadgeDef } from '../lib/badges'
import { telefoonUitFeiten } from '../lib/badgeregels'
import { voorVertrek } from '../lib/badgesTelefoon'
import { useToonNaam } from '../lib/bijnamen'
import { lees, schrijf, schrijfEnMeld } from '../lib/opslag'
import { sleutel } from '../lib/profiel'
import { Feestregen } from './Feestregen'
import { toonProfiel } from './Profiel'

const label = (b: Badge) => {
  const d = badgeDef(b.id)
  return b.aantal && b.aantal > 1 ? `${d.naam} ×${b.aantal}` : d.naam
}

/** Zoveel rondjes passen op één regel (ook op een smalle telefoon) */
const IN_RIJ = 6

/** Badges die wisselen eerst (je laat zien dat je nu voorop staat), verder in de volgorde van BADGES */
const opVolgorde = (badges: Badge[]) =>
  [...badges].sort((a, b) => Number(!!badgeDef(b.id).wisselt) - Number(!!badgeDef(a.id).wisselt))

/**
 * Het profielvenster geeft hiermee door hoe het badge-overzicht open gaat (in hetzelfde venster).
 * Buiten het venster is er geen overzicht.
 */
export const OpenBadgeOverzicht = createContext<((naam: string) => void) | null>(null)

/**
 * Rij badges onder de naam in het profielvenster. Altijd één regel: passen ze er niet op, dan
 * staan er vijf en een rondje +N dat het overzicht met alle badges opent. Tik op een badge voor
 * de uitleg: die komt als tekstballon over de inhoud heen, zodat de foto en de naam niet
 * verschuiven. Sluiten: dezelfde badge nog eens, ergens anders tikken of Escape.
 * Bij je eigen profiel staat er altijd een weg naar het overzicht (ook zonder badges), want
 * daar staat wat je nog kunt halen. Bij een ander zonder badges blijft de rij weg.
 * alles: alle badges tonen, zonder +N (in het overzicht zelf).
 */
export function BadgeRij({ naam, alles = false }: { naam: string; alles?: boolean }) {
  const { van, mijnNaam } = useBadges(true)
  const openOverzicht = useContext(OpenBadgeOverzicht)
  const alle = opVolgorde(van(naam))
  const eigen = !!mijnNaam && sleutel(mijnNaam) === sleutel(naam)
  const kanOpenen = !alles && !!openOverzicht
  const teVeel = kanOpenen && alle.length > IN_RIJ
  const badges = teVeel ? alle.slice(0, IN_RIJ - 1) : alle
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

  const naarOverzicht = (tekst: string) => (
    <button type="button" className="tekstknop badgerij__alles" onClick={() => openOverzicht?.(naam)}>
      {tekst}
    </button>
  )

  if (!alle.length) {
    return eigen && kanOpenen ? (
      <p className="badgerij__leeg">Nog geen badges. {naarOverzicht('Bekijk hoe je ze haalt')}</p>
    ) : null
  }
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
        {teVeel && (
          <li>
            <button
              type="button"
              className="badge badge--meer badgerij__meer"
              aria-label={`Alle ${alle.length} badges bekijken`}
              onClick={() => openOverzicht?.(naam)}
            >
              +{alle.length - badges.length}
            </button>
          </li>
        )}
      </ul>
      {/* Je eigen badges passen op één regel: dan een tekstknop naar wat je nog kunt halen */}
      {eigen && kanOpenen && !teVeel && naarOverzicht('Alle badges en wat je nog kunt halen')}
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

/**
 * Alle badges van iemand, in het profielvenster (na een tik op +N). Bij een ander: wat die heeft,
 * met de uitleg. Bij jezelf: je badges als rondjes (tik voor de uitleg) en daaronder wat je nog
 * kunt halen, met je voortgang.
 */
export function BadgeOverzicht({ naam, onTerug }: { naam: string; onTerug: () => void }) {
  const { van, feitenVan, mijnNaam } = useBadges(true)
  const toon = useToonNaam()
  const terug = useRef<HTMLButtonElement>(null)
  const eigen = !!mijnNaam && sleutel(mijnNaam) === sleutel(naam)
  const badges = opVolgorde(van(naam))
  const feiten = feitenVan(naam)
  const heb = new Set(badges.map((b) => b.id))
  const nogTeHalen = TE_HALEN.filter((d) => !heb.has(d.id))
  const vooraf = voorVertrek()

  // Bovenaan beginnen, met de focus op Terug
  useEffect(() => {
    terug.current?.closest('.dialoog--hoog')?.scrollTo({ top: 0 })
    terug.current?.focus()
  }, [])

  const regel = (d: BadgeDef, b?: Badge) => (
    <li key={d.id} className={`badgekaart__item${b ? ' is-verdiend' : ''}`}>
      <span className="badge badge--groot" aria-hidden="true">
        {d.emoji}
      </span>
      <span className="badgekaart__tekst">
        <strong>
          {b ? label(b) : d.naam}
          {d.wisselt && <span className="badgekaart__wisselt"> · wisselt</span>}
        </strong>
        <span>{b ? d.uitleg : d.reis && vooraf ? 'Te halen tijdens de reis' : d.nogTeDoen(feiten)}</span>
      </span>
    </li>
  )
  return (
    <section className="badgeoverzicht" aria-labelledby="badgeoverzicht-titel">
      <button ref={terug} type="button" className="tekstknop badgeoverzicht__terug" onClick={onTerug}>
        ← Terug
      </button>
      <h2 id="badgeoverzicht-titel" className="badgekaart__titel">
        {eigen ? 'Jouw badges' : `Badges van ${toon(naam)}`}
        <span>
          {badges.length} van {TE_HALEN.length}
        </span>
      </h2>
      {eigen ? (
        <>
          {badges.length ? (
            <BadgeRij naam={naam} alles />
          ) : (
            <p className="badgekaart__leeg">Nog geen badges. Hieronder zie je hoe je ze haalt.</p>
          )}
          {nogTeHalen.length > 0 && (
            <details className="badgekaart__nog" open>
              <summary>Nog te halen ({nogTeHalen.length})</summary>
              <ul className="badgekaart__lijst">{nogTeHalen.map((d) => regel(d))}</ul>
            </details>
          )}
        </>
      ) : badges.length ? (
        <ul className="badgekaart__lijst">{badges.map((b) => regel(badgeDef(b.id), b))}</ul>
      ) : (
        <p className="badgekaart__leeg">{toon(naam)} heeft nog geen badges.</p>
      )}
      <button type="button" className="knop knop--secundair knop--breed" onClick={onTerug}>
        Terug naar het profiel
      </button>
    </section>
  )
}

const GEZIEN = 'badges.gezien'
/**
 * Ophogen als er nieuwe soorten badges bijkomen. Na het bijwerken van de app worden de nieuwe
 * badges die je al zou hebben dan één keer stil onthouden, zodat er geen stapel meldingen komt.
 * 1: de eerste acht badges; 2: de badges van badgeregels.ts erbij.
 */
const GEZIEN_VERSIE = 2

interface Gezien {
  naam: string
  ids: string[]
  versie?: number
}

/**
 * Eén keer in App: haal je een nieuwe badge, dan even een melding met wat confetti. Tik erop
 * om je profiel te openen. De eerste keer (en na een update met nieuwe soorten badges) worden
 * de badges die je al had stil onthouden, zodat er niet ineens een rij meldingen komt.
 */
export function BadgeMelding() {
  const { van, feitenVan, mijnNaam, serverBekend, serverActueel, geladen } = useBadges(false)
  // Eén keer de stand van de server ophalen als die nog van een oudere versie is
  useActueleStand()
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
    // Pas kijken als spel.json en de kamers er zijn: anders lijken de spelbadges en Kamerkampioen
    // even weg, worden ze vergeten en komen ze bij elke start opnieuw als melding
    if (!mijn || !mijnNaam || !geladen) return
    const gezien = lees<Gezien | null>(GEZIEN, null)
    if (!gezien || gezien.naam !== mijnNaam) {
      schrijf<Gezien>(GEZIEN, { naam: mijnNaam, ids: mijn.map((b) => b.id), versie: GEZIEN_VERSIE })
      return
    }
    if ((gezien.versie ?? 1) < GEZIEN_VERSIE) {
      // Net bijgewerkt: wat je van de nieuwe badges al hebt stil onthouden. Met een server eerst
      // wachten op een stand van deze versie, anders komen die badges er straks alsnog als melding bij.
      if (backendIngesteld && !serverActueel) return
      schrijf<Gezien>(GEZIEN, { naam: mijnNaam, ids: [...new Set([...gezien.ids, ...mijn.map((b) => b.id)])], versie: GEZIEN_VERSIE })
      return
    }
    const nieuw = mijn.filter((b) => !gezien.ids.includes(b.id))
    // Kwijt (een badge die wisselt, of na het wissen van de testperiode): vergeten, zodat je
    // hem opnieuw gemeld krijgt. Zonder stand van de server de serverbadges niet vergeten.
    const behouden = gezien.ids.filter(
      (id) => mijn.some((b) => b.id === id) || (!serverBekend && badgeDef(id as Badge['id'])?.server),
    )
    schrijf<Gezien>(GEZIEN, { naam: mijnNaam, ids: [...behouden, ...nieuw.map((b) => b.id)], versie: GEZIEN_VERSIE })
    if (nieuw.length) {
      wachtrij.current.push(...nieuw)
      setMelding((m) => m ?? wachtrij.current.shift() ?? null)
    }
    // ids: alleen opnieuw kijken als de set badges verandert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, mijnNaam, serverBekend, serverActueel, geladen])

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
