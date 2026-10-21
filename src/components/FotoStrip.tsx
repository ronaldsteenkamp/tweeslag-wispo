import { useState } from 'react'
import { useBackend } from '../lib/backend'
import { useFotos, type Foto } from '../lib/fotos'
import { FotoGroot, useKamerLabel } from '../screens/Fotomuur'
import { Icoon } from './Icoon'

/** Op Home: de nieuwste foto's van de fotomuur (alleen als er foto's zijn) */
export function FotoStrip({ naarFotomuur }: { naarFotomuur: () => void }) {
  const backend = useBackend()
  const { fotos } = useFotos(4, backend.status !== 'uit')
  const kamerLabel = useKamerLabel()
  const [open, setOpen] = useState<Foto | null>(null)
  if (!fotos?.length) return null

  return (
    <section className="kaartje">
      <div className="kaartje__kop">
        <h2>📸 Nieuwste foto&apos;s</h2>
        <button type="button" className="tekstknop" onClick={naarFotomuur}>
          Fotomuur <Icoon naam="pijl" grootte={18} />
        </button>
      </div>
      <div className="fotostrip">
        {fotos.map((f) => (
          <button key={f.id} type="button" className="fotomuur__foto" onClick={() => setOpen(f)}>
            {f.klein ? <img src={f.klein} alt={`${f.challenge_titel} door ${f.naam}`} loading="lazy" /> : <span>📷</span>}
          </button>
        ))}
      </div>
      {open && <FotoGroot foto={open} kamerLabel={kamerLabel} onSluit={() => setOpen(null)} />}
    </section>
  )
}
