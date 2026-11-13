import { useMemo, useState } from 'react'
import { useBackend } from '../lib/backend'
import { useToonNaam } from '../lib/bijnamen'
import { useFotos, type Foto } from '../lib/fotos'
import { useOpgeslagen } from '../lib/opslag'
import { FotoGroot, GEZIEN, useKamerLabel } from '../screens/Fotomuur'
import { Icoon } from './Icoon'

/** Op Home: de nieuwste foto's van de fotomuur (alleen als er foto's zijn) */
export function FotoStrip({ naarFotomuur }: { naarFotomuur: () => void }) {
  const backend = useBackend()
  const { fotos } = useFotos(4, backend.status !== 'uit')
  const kamerLabel = useKamerLabel()
  const toon = useToonNaam()
  const [open, setOpen] = useState<number | null>(null)
  // Nieuw = nog niet groot geopend op deze telefoon (en niet van jezelf)
  const [gezien] = useOpgeslagen<string[]>(GEZIEN, [])
  const gezienSet = useMemo(() => new Set(gezien), [gezien])
  if (!fotos?.length) return null
  const isNieuw = (f: Foto) => f.user_id !== backend.userId && !gezienSet.has(f.id)

  return (
    <section className="kaartje">
      <div className="kaartje__kop">
        <h2>📸 Nieuwste foto&apos;s</h2>
        <button type="button" className="tekstknop" onClick={naarFotomuur}>
          Fotomuur <Icoon naam="pijl" grootte={18} />
        </button>
      </div>
      <div className="fotostrip">
        {fotos.map((f, i) => {
          const nieuw = isNieuw(f)
          return (
            <button
              key={f.id}
              type="button"
              className={`fotomuur__foto${nieuw ? ' is-nieuw' : ''}`}
              onClick={() => setOpen(i)}
            >
              {f.klein ? (
                <img src={f.klein} alt={`${f.challenge_titel} door ${toon(f.naam)}${nieuw ? ' (nieuw)' : ''}`} loading="lazy" />
              ) : (
                <span>📷</span>
              )}
              {nieuw && (
                <span className="fotomuur__nieuw" aria-hidden="true">
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
