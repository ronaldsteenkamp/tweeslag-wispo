import { Bergen, MEIJE, rondTop } from '../components/Bergen'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { kijkNaarPlek } from '../lib/badgesTelefoon'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { Icoon } from '../components/Icoon'
import { ZoomKaart, type KaartFocus, type KaartMarker } from '../components/ZoomKaart'
import { useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { IJKPUNTEN, KAART_PX, maakOmzetter } from '../lib/georef'
import { startDelen, stopDelen, useDelen, useLocaties, type GedeeldeLocatie } from '../lib/locatie'
import { useNu } from '../lib/nu'
import { lees, schrijf, useOpgeslagen } from '../lib/opslag'

const KAART = `${import.meta.env.BASE_URL}img/pistekaart.webp`
const omzetter = maakOmzetter()
/** Verder dan dit van het dichtstbijzijnde liftstation: niet op de kaart */
const MAX_AFSTAND_M = 2500
/** Ouder dan dit (ms): grijs */
const OUD_MS = 5 * 60_000
/** Zoom bij "Waar ben ik?" en bij iemand uit de lijst */
const DICHTBIJ = 2.4

function geleden(iso: string, nu: number) {
  const min = Math.max(0, Math.round((nu - Date.parse(iso)) / 60_000))
  return min < 1 ? 'zojuist' : min === 1 ? '1 minuut geleden' : `${min} minuten geleden`
}

/** Waar op de pistekaart (in procenten), of null als het buiten het skigebied is */
function opKaart(l: { lat: number; lon: number }) {
  if (omzetter.afstandTotGebied(l.lat, l.lon) > MAX_AFSTAND_M) return null
  const { x, y } = omzetter.naarKaart(l.lat, l.lon)
  const px = (x / KAART_PX.b) * 100, py = (y / KAART_PX.h) * 100
  return px < 0 || px > 100 || py < 0 || py > 100 ? null : { x: px, y: py }
}

/** "bij Jandri 2600", "in het dorp" of "buiten de kaart" */
function bijWelkePlek(l: { lat: number; lon: number }) {
  if (!opKaart(l)) return 'buiten de kaart'
  let beste = '', d = Infinity
  for (const [naam, lat, lon] of IJKPUNTEN) {
    const a = Math.hypot((lat - l.lat) * 111_320, (lon - l.lon) * 78_700)
    if (a < d) (d = a), (beste = naam)
  }
  if (beste.includes('(dorp)')) return 'in het dorp'
  return `bij ${beste.replace(/ \((dal|noord|zuid)\)/, '')}`
}

const googleMaps = (l: { lat: number; lon: number }) => `https://www.google.com/maps/search/?api=1&query=${l.lat.toFixed(5)},${l.lon.toFixed(5)}`

type Open = { soort: 'jij' } | { soort: 'persoon'; id: string } | { soort: 'lijst' } | null

export default function Kaart({ terug }: { terug?: () => void } = {}) {
  const backend = useBackend()
  const delen = useDelen()
  const nu = useNu(15_000).getTime()
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const toon = useToonNaam()
  const metBackend = backend.status !== 'uit'
  const kanDelen = metBackend && delen.status !== 'niet-ondersteund' && delen.status !== 'geen-backend'
  const { locaties } = useLocaties(metBackend)
  const [open, setOpen] = useState<Open>(null)
  const [vragen, setVragen] = useState(false)
  const [melding, setMelding] = useState<string | null>(null)
  // "Waar ben ik?": je eigen plek, alleen op deze telefoon (wordt niet gedeeld)
  const [eigenPlek, setEigenPlek] = useState<{ lat: number; lon: number; tijd: number; nauwkeurigheid: number } | null>(null)
  const [zoeken, setZoeken] = useState(false)
  const [volgen, setVolgen] = useState(false)
  const [focus, setFocus] = useState<KaartFocus | null>(null)
  const kijker = useRef<number | null>(null)
  const [hint] = useState(() => !lees('kaart.hintGezien', false))
  const blad = useRef<HTMLElement>(null)
  const [bladHoogte, setBladHoogte] = useState(0)

  const deelAan = delen.status === 'aan' || delen.status === 'zoeken'
  const mijnPlek = deelAan && delen.positie ? delen.positie : eigenPlek
  const mijnStip = mijnPlek ? opKaart(mijnPlek) : null

  useEffect(() => {
    schrijf('kaart.hintGezien', true)
    return () => {
      if (kijker.current !== null) navigator.geolocation.clearWatch(kijker.current)
    }
  }, [])

  const gaNaar = useCallback((p: { x: number; y: number }, zoom = DICHTBIJ) => setFocus((f) => ({ ...p, zoom, sleutel: (f?.sleutel ?? 0) + 1 })), [])

  /** Je plek blijven meten zolang de kaart open is (alleen op deze telefoon) */
  const startKijken = () => {
    if (kijker.current !== null || !('geolocation' in navigator)) return
    setZoeken(true)
    kijker.current = navigator.geolocation.watchPosition(
      (pos) => {
        setZoeken(false)
        setEigenPlek({ lat: pos.coords.latitude, lon: pos.coords.longitude, tijd: pos.timestamp, nauwkeurigheid: pos.coords.accuracy })
      },
      (e) => {
        setZoeken(false)
        setVolgen(false)
        if (kijker.current !== null) navigator.geolocation.clearWatch(kijker.current)
        kijker.current = null
        setMelding(
          e.code === e.PERMISSION_DENIED
            ? 'Locatie staat uit voor deze app. Zet het aan in de instellingen van je telefoon.'
            : 'Je plek is niet te vinden. Staat locatie aan? Buiten, bij een lift, lukt het meestal beter.',
        )
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
  }

  const waarBenIk = () => {
    setMelding(null)
    setVolgen(true)
    if (mijnStip) gaNaar(mijnStip)
    else if (mijnPlek) setMelding('Je bent buiten het gebied van de pistekaart.')
    else startKijken()
  }

  // Volgen: bij elke nieuwe positie de kaart meenemen
  useEffect(() => {
    if (!volgen || !mijnPlek) return
    const p = opKaart(mijnPlek)
    if (p) gaNaar(p)
    else {
      setVolgen(false)
      setMelding('Je bent buiten het gebied van de pistekaart.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volgen, mijnPlek?.lat, mijnPlek?.lon])

  // ⛰️ Bergbeklimmer: alleen met de plek die je hier zelf hebt opgevraagd of deelt
  useEffect(() => {
    if (eigenPlek) kijkNaarPlek(eigenPlek)
  }, [eigenPlek])
  useEffect(() => {
    if (delen.positie) kijkNaarPlek(delen.positie)
  }, [delen.positie])

  // Anderen die delen (jouw eigen stip komt direct van de telefoon)
  const anderen = useMemo(
    () =>
      locaties
        .filter((l) => l.user_id !== backend.userId)
        .map((l) => ({ ...l, plek: opKaart(l), oud: nu - Date.parse(l.bijgewerkt) > OUD_MS }))
        .sort((a, b) => Date.parse(b.bijgewerkt) - Date.parse(a.bijgewerkt)),
    [locaties, backend.userId, nu],
  )

  const markers: KaartMarker[] = []
  if (mijnStip && mijnPlek)
    markers.push({
      id: 'jij',
      x: mijnStip.x,
      y: mijnStip.y,
      label: 'Jij',
      kort: '',
      eigen: true,
      oud: nu - mijnPlek.tijd > OUD_MS,
      beschrijving: `Jij, ${bijWelkePlek(mijnPlek)}, ${deelAan ? 'gedeeld met de groep' : 'alleen op deze telefoon'}`,
    })
  for (const p of anderen) {
    if (!p.plek) continue
    markers.push({
      id: p.user_id,
      x: p.plek.x,
      y: p.plek.y,
      label: toon(p.naam),
      kort: toon(p.naam).slice(0, 2),
      oud: p.oud,
      beschrijving: `${toon(p.naam)}, ${bijWelkePlek(p)}, ${geleden(p.bijgewerkt, nu)}`,
    })
  }

  const persoon = open?.soort === 'persoon' ? anderen.find((p) => p.user_id === open.id) ?? null : null
  const sluit = useCallback(() => setOpen(null), [])

  // Hoogte van het onderblad: de kaart centreert daarboven
  useEffect(() => {
    const el = blad.current
    if (!open || !el) return setBladHoogte(0)
    const ro = new ResizeObserver(() => setBladHoogte(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && sluit()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [sluit])

  // Bij het openen van een blad: de stip boven het blad zetten (zodra we weten hoe hoog het is)
  const doelBijOpenen = useRef<{ x: number; y: number; zoom: number } | null>(null)
  useEffect(() => {
    const d = doelBijOpenen.current
    if (!bladHoogte || !d) return
    doelBijOpenen.current = null
    gaNaar(d, d.zoom)
  }, [bladHoogte, gaNaar])

  const kiesMarker = (id: string) => {
    const m = markers.find((x) => x.id === id)
    if (m) doelBijOpenen.current = { x: m.x, y: m.y, zoom: 1 }
    // Naar iemand anders kijken: niet meer met jezelf meeschuiven
    if (id !== 'jij') setVolgen(false)
    setBladHoogte(0)
    if (id === 'jij') setOpen({ soort: 'jij' })
    else setOpen({ soort: 'persoon', id })
  }

  const zetDelen = (aan: boolean) => {
    setMelding(null)
    if (!aan) return void stopDelen()
    if (!naam) return setMelding('Kies eerst je naam op Home om je plek te delen.')
    // De eerste keer uitleggen wat delen betekent
    if (lees('locatie.uitgelegd', false)) startDelen()
    else setVragen(true)
  }

  const ikTekst = zoeken || delen.status === 'zoeken' ? 'Zoeken…' : !mijnStip ? 'Waar ben ik?' : volgen ? 'Volgt jou' : 'Naar mij'
  const deelFout = delen.status === 'geweigerd' ? 'Je hebt locatie geblokkeerd voor deze app. Zet het aan in de instellingen van je telefoon.' : deelAan ? delen.fout : undefined
  const tekstMelding = melding ?? deelFout ?? null

  return (
    <div className="kaartscherm">
      <h1 className="verborgen">Pistekaart</h1>
      {terug && (
        <button type="button" className="kaartscherm__terug" onClick={terug} aria-label="Terug naar Home">
          <Icoon naam="links" grootte={26} />
        </button>
      )}
      <div className="kaartscherm__kaart">
        <ZoomKaart
          src={KAART}
          alt="Pistekaart van Les Deux Alpes"
          ontbreekt="De pistekaart is nog niet bewaard. Open dit scherm één keer met internet."
          markers={markers}
          gekozen={open?.soort === 'jij' ? 'jij' : open?.soort === 'persoon' ? open.id : null}
          onMarker={kiesMarker}
          onLeegTik={sluit}
          hint={hint ? 'Knijp of dubbeltik om te zoomen' : null}
          focus={focus}
          onderMarge={open ? bladHoogte : 0}
          onHandmatig={() => setVolgen(false)}
        />

        {tekstMelding && (
          <p className="kaartmelding" role="status">
            <span>{tekstMelding}</span>
            <button type="button" className="kaartmelding__sluit" aria-label="Melding sluiten" onClick={() => setMelding(null)}>
              <Icoon naam="kruis" grootte={20} />
            </button>
          </p>
        )}

        {open && (
          <section ref={blad} className={`kaartblad kaartblad--${open.soort}`} aria-labelledby="kaartblad-titel">
            {open.soort === 'lijst' ? (
              <WieIsWaar
                mijnPlek={mijnPlek}
                deelAan={deelAan}
                anderen={anderen}
                nu={nu}
                onKies={(id) => {
                  const plek = id === 'jij' ? mijnStip : anderen.find((a) => a.user_id === id)?.plek
                  if (plek) doelBijOpenen.current = { ...plek, zoom: DICHTBIJ }
                  if (id !== 'jij') setVolgen(false)
                  // Het blad wisselt van inhoud (en hoogte): opnieuw meten
                  setBladHoogte(0)
                  setOpen(id === 'jij' ? { soort: 'jij' } : { soort: 'persoon', id })
                }}
                onSluit={sluit}
                schakelaar={kanDelen ? <DeelSchakelaar aan={deelAan} naam={naam} onZet={zetDelen} /> : null}
              />
            ) : open.soort === 'jij' ? (
              mijnPlek && (
                <>
                  <BladKop titel="Jij" ondertitel={`${bijWelkePlek(mijnPlek)} · ${geleden(new Date(mijnPlek.tijd).toISOString(), nu)}`} rond="jij" onSluit={sluit} />
                  <p>De stip staat er ongeveer: de pistekaart is een tekening, geen kaart op schaal. Reken op zo’n 50 meter speling.</p>
                  {kanDelen && <DeelSchakelaar aan={deelAan} naam={naam} onZet={zetDelen} />}
                  <GoogleMapsKnop plek={mijnPlek} />
                </>
              )
            ) : (
              persoon && (
                <>
                  <BladKop
                    titel={toon(persoon.naam)}
                    ondertitel={`${persoon.kamer ? `Kamer ${persoon.kamer} · ` : ''}${bijWelkePlek(persoon)} · ${geleden(persoon.bijgewerkt, nu)}`}
                    rond={toon(persoon.naam).slice(0, 2)}
                    oud={persoon.oud}
                    onSluit={sluit}
                  />
                  <p>
                    {!persoon.plek
                      ? 'Buiten het gebied van de pistekaart.'
                      : persoon.oud
                        ? `Deze plek is ${geleden(persoon.bijgewerkt, nu).replace(' geleden', '')} oud. ${toon(persoon.naam)} heeft de app misschien dicht.`
                        : "Bij benadering, zo’n 50 meter speling."}
                  </p>
                  <GoogleMapsKnop plek={persoon} />
                </>
              )
            )}
          </section>
        )}
      </div>

      <div className={`kaartbalk${kanDelen ? '' : ' kaartbalk--alleen'}`} role="group" aria-label="Kaart">
        {'geolocation' in navigator && (
          <button type="button" className={`kaartbalk__knop${volgen && mijnStip ? ' is-aan' : ''}`} onClick={waarBenIk} disabled={zoeken}>
            <Icoon naam={volgen && mijnStip ? 'volgen' : 'mikpunt'} grootte={22} />
            <span>{ikTekst}</span>
          </button>
        )}
        {kanDelen && (
          <>
            <button type="button" className={`kaartbalk__knop${deelAan ? ' is-aan' : ''}`} aria-pressed={deelAan} onClick={() => zetDelen(!deelAan)}>
              <Icoon naam="uitzenden" grootte={22} />
              <span>{deelAan ? 'Stop delen' : 'Delen'}</span>
            </button>
            <button
              type="button"
              className="kaartbalk__knop"
              aria-expanded={open?.soort === 'lijst'}
              onClick={() => setOpen(open?.soort === 'lijst' ? null : { soort: 'lijst' })}
            >
              <Icoon naam="groep" grootte={22} />
              <span>Wie is waar</span>
              <b className="kaartbalk__aantal" aria-label={`${anderen.length} anderen`}>
                {anderen.length}
              </b>
            </button>
          </>
        )}
      </div>

      <BevestigDialoog
        open={vragen}
        titel="Je plek delen?"
        tekst="Iedereen in de app ziet dan een stip met jouw naam op de pistekaart, zolang dit aan staat en de app open is. Een plek die een uur niet is bijgewerkt verdwijnt vanzelf. Je kunt altijd weer stoppen."
        bevestigLabel="Delen"
        onAnnuleer={() => setVragen(false)}
        onBevestig={() => {
          setVragen(false)
          schrijf('locatie.uitgelegd', true)
          startDelen()
          setVolgen(true)
        }}
      />
    </div>
  )
}

function BladKop({ titel, ondertitel, rond, oud, onSluit }: { titel: string; ondertitel?: string; rond?: string; oud?: boolean; onSluit: () => void }) {
  return (
    <div className="kaartblad__kop">
      {rond && <span className={`kaartblad__rond${rond === 'jij' ? ' kaartblad__rond--jij' : ''}${oud ? ' is-oud' : ''}`}>{rond === 'jij' ? '' : rond}</span>}
      <div>
        <h2 id="kaartblad-titel">{titel}</h2>
        {ondertitel && <p>{ondertitel}</p>}
      </div>
      <button type="button" className="kaartblad__sluit" aria-label="Sluiten" onClick={onSluit}>
        <Icoon naam="kruis" />
      </button>
    </div>
  )
}

function DeelSchakelaar({ aan, naam, onZet }: { aan: boolean; naam: string | null; onZet: (aan: boolean) => void }) {
  return (
    <label className="deelschakelaar">
      <span>
        <strong>Deel mijn plek met de groep</strong>
        <small>{!naam ? 'Kies eerst je naam op Home.' : aan ? 'Iedereen ziet je stip zolang de app open is.' : 'Nu ziet alleen jij je stip.'}</small>
      </span>
      <input type="checkbox" role="switch" checked={aan} disabled={!naam && !aan} onChange={(e) => onZet(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  )
}

function GoogleMapsKnop({ plek }: { plek: { lat: number; lon: number } }) {
  return (
    <a className="kaartblad__extern" href={googleMaps(plek)} target="_blank" rel="noopener">
      <Icoon naam="extern" grootte={20} />
      <span>
        Precies op Google Maps
        <small>alleen met bereik</small>
      </span>
    </a>
  )
}

type Ander = GedeeldeLocatie & { plek: { x: number; y: number } | null; oud: boolean }

function WieIsWaar({
  mijnPlek,
  deelAan,
  anderen,
  nu,
  onKies,
  onSluit,
  schakelaar,
}: {
  mijnPlek: { lat: number; lon: number } | null
  deelAan: boolean
  anderen: Ander[]
  nu: number
  onKies: (id: string) => void
  onSluit: () => void
  schakelaar: ReactNode
}) {
  const toon = useToonNaam()
  return (
    <>
      <BladKop titel="Wie is waar" onSluit={onSluit} />
      {anderen.length === 0 && !mijnPlek ? (
        <div className="kaartblad__leeg">
          {/* Lege staat: de kleine bergvariant (La Meije), zelfde vorm als overal in de app */}
          <Bergen className="kaartblad__bergen" venster={rondTop(MEIJE, 220)} lagen={[1, 3]} lucht={12} diepte={30} dalHoogte={10} parallax={false} />
          <p>Er deelt nu niemand een plek.</p>
        </div>
      ) : (
        <ul className="wieiswaar">
          {mijnPlek && (
            <li>
              <button type="button" className="wieiswaar__rij" onClick={() => onKies('jij')}>
                <span className="kaartblad__rond kaartblad__rond--jij" aria-hidden="true" />
                <span>
                  <strong>Jij</strong>
                  <small>
                    {bijWelkePlek(mijnPlek)} · {deelAan ? 'gedeeld met de groep' : 'alleen op deze telefoon'}
                  </small>
                </span>
                <Icoon naam="kaart" grootte={20} />
              </button>
            </li>
          )}
          {anderen.map((p) => (
            <li key={p.user_id}>
              <button type="button" className={`wieiswaar__rij${p.oud ? ' is-oud' : ''}`} onClick={() => onKies(p.user_id)}>
                <span className={`kaartblad__rond${p.oud ? ' is-oud' : ''}`} aria-hidden="true">
                  {toon(p.naam).slice(0, 2)}
                </span>
                <span>
                  <strong>{toon(p.naam)}</strong>
                  <small>
                    {bijWelkePlek(p)} · {geleden(p.bijgewerkt, nu)}
                  </small>
                </span>
                <Icoon naam={p.plek ? 'kaart' : 'extern'} grootte={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {schakelaar}
      <p className="klein">Een plek die langer dan 5 minuten niet is bijgewerkt is grijs; na een uur verdwijnt hij.</p>
    </>
  )
}
