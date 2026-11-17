import { useMemo, useState } from 'react'
import { useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { useFotos, type Foto } from '../lib/fotos'
import { useOpgeslagen } from '../lib/opslag'
import { FotoGroot, GEZIEN, useKamerLabel } from '../screens/Fotomuur'
import { Icoon } from './Icoon'

/**
 * Op Home: de nieuwste foto's van de fotomuur als ansichtkaartjes (alleen als er foto's zijn).
 * Opmaak in styles/home.css (.ansicht), dezelfde kaartjes als in de terugblik ná de reis.
 */
export function FotoStrip({ naarFotomuur }: { naarFotomuur: () => void }) {
  const backend = useBackend()
  const { fotos } = useFotos(6, backend.status !== 'uit')
  const kamerLabel = useKamerLabel()
  const toon = useToonNaam()
  const [open, setOpen] = useState<number | null>(null)
  // Nieuw = nog niet groot geopend op deze telefoon (en niet van jezelf)
  const [gezien] = useOpgeslagen<string[]>(GEZIEN, [])
  const gezienSet = useMemo(() => new Set(gezien), [gezien])
  if (!fotos?.length) return null
  const isNieuw = (f: Foto) => f.user_id !== backend.userId && !gezienSet.has(f.id)

  return (
    <section>
      <div className="home__kopje">
        <h2>Nieuwste foto&apos;s</h2>
        <button type="button" onClick={naarFotomuur}>
          Fotomuur <Icoon naam="pijl" grootte={16} />
        </button>
      </div>
      <div className="ansichten">
        {fotos.map((f, i) => {
          const nieuw = isNieuw(f)
          const onderschrift = `${f.challenge_titel} · ${toon(f.naam)}`
          return (
            <button key={f.id} type="button" className="ansicht ansicht--klein" onClick={() => setOpen(i)}>
              {f.klein ? <img src={f.klein} alt="" loading="lazy" /> : <span className="ansicht__leeg" />}
              <span className="ansicht__tekst">{onderschrift}</span>
              <span className="verborgen">{nieuw ? ', nieuw' : ''}</span>
              {nieuw && (
                <span className="ansicht__nieuw" aria-hidden="true">
                  Nieuw
                </span>
              )}
            </button>
          )
        })}
      </div>
      {open !== null && <FotoGroot fotos={fotos} start={open} kamerLabel={kamerLabel} onSluit={() => setOpen(null)} />}
    </section>
  )
}
