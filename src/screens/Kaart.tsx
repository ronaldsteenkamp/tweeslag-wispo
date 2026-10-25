import { useCallback, useMemo, useState } from 'react'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { Icoon } from '../components/Icoon'
import { ZoomKaart, type KaartMarker } from '../components/ZoomKaart'
import { useBackend } from '../lib/backend'
import { KAART_PX, maakOmzetter } from '../lib/georef'
import { startDelen, stopDelen, useDelen, useLocaties, type GedeeldeLocatie } from '../lib/locatie'
import { useNu } from '../lib/nu'
import { lees, schrijf, useOpgeslagen } from '../lib/opslag'

const KAART = `${import.meta.env.BASE_URL}img/pistekaart.webp`
const omzetter = maakOmzetter()
/** Verder dan dit van het dichtstbijzijnde liftstation: niet op de kaart */
const MAX_AFSTAND_M = 2500

const KLEUREN = ['#8e24aa', '#d62839', '#1b8a5a', '#0277bd', '#c2185b', '#5d4037', '#00838f', '#6a1b9a', '#2e7d32', '#ad1457']
const kleurVoor = (naam: string) => KLEUREN[[...naam].reduce((s, c) => s + c.charCodeAt(0), 0) % KLEUREN.length]

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

export default function Kaart() {
  const backend = useBackend()
  const delen = useDelen()
  const nu = useNu(15_000).getTime()
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const metBackend = backend.status !== 'uit'
  const { locaties } = useLocaties(metBackend)
  const [gekozen, setGekozen] = useState<string | null>(null)
  const [vragen, setVragen] = useState(false)
  // "Waar ben ik?": je eigen plek, alleen op deze telefoon (wordt niet gedeeld)
  const [eigenPlek, setEigenPlek] = useState<{ lat: number; lon: number; tijd: number } | null>(null)
  const [zoekPlek, setZoekPlek] = useState<'bezig' | 'buiten' | 'fout' | null>(null)

  const deelAan = delen.status === 'aan' || delen.status === 'zoeken'

  const waarBenIk = () => {
    setZoekPlek('bezig')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, tijd: pos.timestamp }
        setEigenPlek(p)
        setZoekPlek(opKaart(p) ? null : 'buiten')
      },
      () => setZoekPlek('fout'),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
  }
  const eigenStip = !deelAan && eigenPlek ? opKaart(eigenPlek) : null

  // Iedereen die deelt; de eigen positie direct van de telefoon (sneller dan via de server)
  const personen = useMemo(() => {
    const lijst = locaties.filter((l) => l.user_id !== backend.userId)
    if (deelAan && delen.positie && naam) {
      lijst.push({
        user_id: backend.userId ?? 'ik',
        naam,
        kamer: null,
        lat: delen.positie.lat,
        lon: delen.positie.lon,
        nauwkeurigheid: Math.round(delen.positie.nauwkeurigheid),
        bijgewerkt: new Date(delen.positie.tijd).toISOString(),
      })
    }
    return lijst.map((l) => ({ ...l, plek: opKaart(l), eigen: l.user_id === (backend.userId ?? 'ik') }))
  }, [locaties, backend.userId, deelAan, delen.positie, naam])

  const markers: KaartMarker[] = personen
    .filter((p) => p.plek)
    .map((p) => ({
      id: p.user_id,
      x: p.plek!.x,
      y: p.plek!.y,
      label: p.eigen ? 'Jij' : p.naam,
      kort: p.naam.slice(0, 2),
      kleur: kleurVoor(p.naam),
      eigen: p.eigen,
      oud: nu - Date.parse(p.bijgewerkt) > 5 * 60_000,
      beschrijving: `${p.eigen ? 'Jij' : p.naam}, ${geleden(p.bijgewerkt, nu)}`,
    }))
  if (eigenStip && eigenPlek) {
    markers.push({
      id: 'ik-hier',
      x: eigenStip.x,
      y: eigenStip.y,
      label: 'Jij',
      kort: (naam ?? 'Ik').slice(0, 2),
      kleur: '#0d0058',
      eigen: true,
      oud: nu - eigenPlek.tijd > 5 * 60_000,
      beschrijving: `Jij (alleen op deze telefoon), ${geleden(new Date(eigenPlek.tijd).toISOString(), nu)}`,
    })
  }
  const buiten = personen.filter((p) => !p.plek)
  const persoon = personen.find((p) => p.user_id === gekozen) ?? null
  const sluit = useCallback(() => setGekozen(null), [])

  const aanzetten = () => {
    // De eerste keer uitleggen wat delen betekent
    if (lees('locatie.uitgelegd', false)) startDelen()
    else setVragen(true)
  }

  return (
    <div className="kaartscherm">
      <h1 className="verborgen">Pistekaart</h1>
      <ZoomKaart
        src={KAART}
        alt="Pistekaart van Les Deux Alpes"
        bron="Pistekaart © Les 2 Alpes"
        ontbreekt="De pistekaart is nog niet bewaard. Open dit scherm één keer met internet."
        markers={markers}
        gekozen={gekozen}
        onMarker={setGekozen}
        onLeegTik={sluit}
        hint="Knijp of dubbeltik om te zoomen"
      />

      <div className="locatiebalk">
        <div className="locatiebalk__knoppen">
          {!deelAan && 'geolocation' in navigator && (
            <button type="button" className="locatieknop" onClick={waarBenIk} disabled={zoekPlek === 'bezig'}>
              {zoekPlek === 'bezig' ? 'Zoeken…' : '🧭 Waar ben ik?'}
            </button>
          )}
          {!metBackend || delen.status === 'niet-ondersteund' ? null : deelAan ? (
            <button type="button" className="locatieknop is-aan" onClick={() => void stopDelen()}>
              <span className="locatieknop__stip" aria-hidden="true" />
              {delen.status === 'zoeken' ? 'Locatie zoeken…' : 'Je deelt je locatie'} · <strong>Stop</strong>
            </button>
          ) : (
            <button type="button" className="locatieknop" onClick={aanzetten} disabled={!naam}>
              📍 Deel mijn locatie
            </button>
          )}
        </div>
        {zoekPlek === 'buiten' && <p className="locatiebalk__tekst">Je bent buiten het gebied van de pistekaart.</p>}
        {zoekPlek === 'fout' && (
          <p className="locatiebalk__tekst">Je plek is niet te bepalen. Staat locatie aan voor deze app?</p>
        )}
        {metBackend && (
          <>
            {!naam && <p className="locatiebalk__tekst">Kies eerst je naam op Home om je locatie te delen.</p>}
            {delen.status === 'geweigerd' && (
              <p className="locatiebalk__tekst">Je hebt locatie geblokkeerd voor deze app. Zet het aan in de instellingen van je telefoon.</p>
            )}
            {delen.fout && deelAan && <p className="locatiebalk__tekst">{delen.fout}</p>}
            {buiten.length > 0 && (
              <div className="locatiebalk__buiten">
                {buiten.map((p) => (
                  <button key={p.user_id} type="button" className="buitenchip" onClick={() => setGekozen(p.user_id)}>
                    {p.eigen ? 'Jij' : p.naam} · buiten de kaart
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {persoon && <PersoonBlad p={persoon} nu={nu} onSluit={sluit} />}

      <BevestigDialoog
        open={vragen}
        titel="Je locatie delen?"
        tekst="Iedereen in de app ziet dan een stip met jouw naam op de pistekaart, zolang dit aan staat en de app open is. Een locatie die een uur niet is bijgewerkt verdwijnt vanzelf. Je kunt altijd op Stop tikken."
        bevestigLabel="Delen"
        onAnnuleer={() => setVragen(false)}
        onBevestig={() => {
          setVragen(false)
          schrijf('locatie.uitgelegd', true)
          startDelen()
        }}
      />
    </div>
  )
}

function PersoonBlad({ p, nu, onSluit }: { p: GedeeldeLocatie & { plek: { x: number; y: number } | null; eigen: boolean }; nu: number; onSluit: () => void }) {
  return (
    <section className="onderblad" aria-labelledby="onderblad-titel" style={{ ['--kleur' as string]: kleurVoor(p.naam) }}>
      <div className="onderblad__kop">
        <h2 id="onderblad-titel">{p.eigen ? `Jij (${p.naam})` : p.naam}</h2>
        <button type="button" className="icoonknop" aria-label="Sluiten" onClick={onSluit}>
          <Icoon naam="kruis" />
        </button>
      </div>
      <p>
        {p.kamer ? `Kamer ${p.kamer} · ` : ''}
        {geleden(p.bijgewerkt, nu)}
        {p.nauwkeurigheid ? ` · ± ${p.nauwkeurigheid} m` : ''}
      </p>
      {!p.plek && <p>Buiten het gebied van de pistekaart.</p>}
      <p className="klein">De stip op de getekende pistekaart is bij benadering. De precieze plek zie je in Google Maps.</p>
      <div className="onderblad__knoppen">
        <a
          className="knop knop--primair"
          href={`https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(5)},${p.lon.toFixed(5)}`}
          target="_blank"
          rel="noopener"
        >
          <Icoon naam="pin" grootte={20} /> Precies op Google Maps
        </a>
        {p.eigen && (
          <button type="button" className="knop knop--secundair" onClick={() => void stopDelen().then(onSluit)}>
            Stop met delen
          </button>
        )}
      </div>
    </section>
  )
}
