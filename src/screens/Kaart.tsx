import { useCallback, useMemo, useRef, useState } from 'react'
import { Icoon } from '../components/Icoon'
import { SOORTEN, ZoomKaart } from '../components/ZoomKaart'
import { useData, type KaartNaam } from '../lib/data'
import { useOpgeslagen } from '../lib/opslag'

const KAARTEN: Record<KaartNaam, { label: string; src: string; alt: string; bron: string; ontbreekt: string }> = {
  piste: {
    label: 'Piste',
    src: `${import.meta.env.BASE_URL}img/pistekaart.jpg`,
    alt: 'Pistekaart van Les Deux Alpes',
    bron: 'Pistekaart © Les 2 Alpes',
    ontbreekt: 'De pistekaart is nog niet bewaard. Open dit scherm één keer met internet.',
  },
  dorp: {
    label: 'Dorp',
    src: `${import.meta.env.BASE_URL}img/dorpskaart.jpg`,
    alt: 'Plattegrond van het dorp Les Deux Alpes',
    // Verplicht bij OpenStreetMap-gegevens (ODbL)
    bron: '© OpenStreetMap-bijdragers',
    ontbreekt: 'De dorpskaart is nog niet bewaard. Open dit scherm één keer met internet.',
  },
}

// ?plaats=1: tik op de kaart om de positie (in procenten) voor plekken.json te krijgen
const plaatsModus = new URLSearchParams(window.location.search).get('plaats') === '1'

export default function Kaart() {
  const [keuze, setKeuze] = useOpgeslagen<KaartNaam>('kaart.keuze', 'piste')
  const kaart = KAARTEN[keuze] ? keuze : 'piste'
  const { data } = useData('plekken')
  const [gekozen, setGekozen] = useState<string | null>(null)
  const [plaats, setPlaats] = useState<{ x: number; y: number } | null>(null)

  // Alleen de bierplekken (soort 'apres')
  const zichtbaar = useMemo(() => (data?.plekken ?? []).filter((p) => p.kaart === kaart && p.soort === 'apres'), [data, kaart])
  const plek = zichtbaar.find((p) => p.id === gekozen) ?? null

  const kies = (k: KaartNaam) => {
    setKeuze(k)
    setGekozen(null)
    setPlaats(null)
  }
  const sluit = useCallback(() => setGekozen(null), [])

  return (
    <div className="kaartscherm">
      <h1 className="verborgen">Kaart</h1>
      <ZoomKaart
        key={kaart}
        {...KAARTEN[kaart]}
        plekken={zichtbaar}
        gekozen={gekozen}
        onPlek={setGekozen}
        onLeegTik={sluit}
        onPlaats={plaatsModus ? (x, y) => setPlaats({ x, y }) : undefined}
        markering={plaats}
        hint={plaatsModus ? 'Plaatsmodus: tik op een plek op de kaart' : 'Knijp of dubbeltik om te zoomen'}
      />

      <div className="segment kaartkeuze" role="tablist" aria-label="Kaart">
        {(Object.keys(KAARTEN) as KaartNaam[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kaart === k}
            className={`segment__knop${kaart === k ? ' is-actief' : ''}`}
            onClick={() => kies(k)}
          >
            {KAARTEN[k].label}
          </button>
        ))}
      </div>

      {plaatsModus && plaats && <PlaatsPaneel x={plaats.x} y={plaats.y} kaart={kaart} onSluit={() => setPlaats(null)} />}

      {plek && (
        <section className="onderblad" aria-labelledby="onderblad-titel" style={{ ['--kleur' as string]: SOORTEN[plek.soort].kleur }}>
          <div className="onderblad__kop">
            <span className="onderblad__soort">
              <span aria-hidden="true">{SOORTEN[plek.soort].icoon}</span> {SOORTEN[plek.soort].label}
            </span>
            <button type="button" className="icoonknop" aria-label="Sluiten" onClick={sluit}>
              <Icoon naam="kruis" />
            </button>
          </div>
          <h2 id="onderblad-titel">{plek.naam}</h2>
          {plek.omschrijving && <p>{plek.omschrijving}</p>}
          {plek.tijden && <p className="onderblad__tijden">🕒 {plek.tijden}</p>}
          <div className="onderblad__knoppen">
            <a
              className="knop knop--primair"
              // Google Maps toont bij de plek foto's en reviews
              href={plek.fotos ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${plek.naam} Les Deux Alpes`)}`}
              target="_blank"
              rel="noopener"
            >
              📷 Foto&apos;s en reviews
            </a>
            {plek.route && (
              <a className="knop knop--secundair" href={plek.route} target="_blank" rel="noopener">
                <Icoon naam="pin" grootte={20} /> Route
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

/** Plaatsmodus: positie en een kant-en-klaar fragment voor plekken.json */
function PlaatsPaneel({ x, y, kaart, onSluit }: { x: number; y: number; kaart: KaartNaam; onSluit: () => void }) {
  const veld = useRef<HTMLTextAreaElement>(null)
  const [gekopieerd, setGekopieerd] = useState(false)
  const getal = (n: number) => n.toFixed(1)
  const fragment = `{ "id": "nieuwe-plek", "naam": "Nieuwe plek", "soort": "apres", "kaart": "${kaart}", "x": ${getal(x)}, "y": ${getal(y)}, "omschrijving": "", "tijden": "", "route": "" }`

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(fragment)
    } catch {
      // Oudere browsers of geen https: selecteren en via de oude manier kopiëren
      veld.current?.select()
      document.execCommand('copy')
    }
    setGekopieerd(true)
    window.setTimeout(() => setGekopieerd(false), 2000)
  }

  return (
    <section className="plaatspaneel" aria-live="polite">
      <div className="onderblad__kop">
        <strong>
          x: {getal(x)} · y: {getal(y)}
        </strong>
        <button type="button" className="icoonknop" aria-label="Sluiten" onClick={onSluit}>
          <Icoon naam="kruis" />
        </button>
      </div>
      <textarea ref={veld} className="plaatspaneel__json" readOnly value={fragment} rows={3} onFocus={(e) => e.target.select()} />
      <button type="button" className="knop knop--primair knop--breed" onClick={() => void kopieer()}>
        {gekopieerd ? 'Gekopieerd ✓' : 'Kopieer JSON'}
      </button>
      <p className="klein">Plak dit in de lijst "plekken" in plekken.json (met een komma tussen de plekken) en vul naam, soort en de rest in.</p>
    </section>
  )
}
