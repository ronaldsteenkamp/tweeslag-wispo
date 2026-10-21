import { useEffect, useRef, useState } from 'react'
import { useBackend } from '../lib/backend'
import { uploadFoto, verklein, type Verkleind } from '../lib/fotos'
import { Icoon } from './Icoon'

/** Dialoog om een foto als bewijs bij een challenge te uploaden */
export function FotoUpload({
  challenge,
  onSluit,
  onGelukt,
}: {
  challenge: { id: string; titel: string }
  onSluit: () => void
  onGelukt: () => void
}) {
  const backend = useBackend()
  const camera = useRef<HTMLInputElement>(null)
  const galerij = useRef<HTMLInputElement>(null)
  const [foto, setFoto] = useState<Verkleind | null>(null)
  const [voorbeeld, setVoorbeeld] = useState<string | null>(null)
  const [stap, setStap] = useState<'kiezen' | 'verkleinen' | 'klaar' | 'uploaden'>('kiezen')
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && onSluit()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [onSluit])

  useEffect(() => () => void (voorbeeld && URL.revokeObjectURL(voorbeeld)), [voorbeeld])

  const gekozen = async (bestand: File | undefined) => {
    if (!bestand) return
    setFout(null)
    setStap('verkleinen')
    try {
      const v = await verklein(bestand)
      setFoto(v)
      setVoorbeeld(URL.createObjectURL(v.groot))
      setStap('klaar')
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e))
      setStap('kiezen')
    }
  }

  const upload = async () => {
    if (!foto) return
    setStap('uploaden')
    setFout(null)
    const f = await uploadFoto(foto, challenge)
    if (f) {
      setFout(f)
      setStap('klaar')
    } else onGelukt()
  }

  const geenVerbinding = backend.status !== 'verbonden'

  return (
    <div className="dialoog-achtergrond" onClick={onSluit}>
      <div
        className="dialoog dialoog--hoog foto-upload"
        role="dialog"
        aria-modal="true"
        aria-labelledby="foto-upload-titel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="foto-upload-titel">📸 Bewijs: {challenge.titel}</h2>

        {voorbeeld && <img className="foto-upload__voorbeeld" src={voorbeeld} alt="Voorbeeld van je foto" />}
        {foto && (
          <p className="klein">
            Verkleind tot {foto.breedte}×{foto.hoogte} px, {Math.round(foto.groot.size / 1024)} kB. Locatie- en
            cameragegevens zijn eruit gehaald.
          </p>
        )}
        {stap === 'verkleinen' && <p className="laadtekst">Foto verkleinen…</p>}
        {geenVerbinding && <p className="melding">Geen verbinding. Uploaden kan alleen met internet.</p>}
        {fout && (
          <p className="melding melding--fout" role="alert">
            {fout}
          </p>
        )}

        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void gekozen(e.target.files?.[0])}
        />
        <input ref={galerij} type="file" accept="image/*" hidden onChange={(e) => void gekozen(e.target.files?.[0])} />

        {stap === 'klaar' || stap === 'uploaden' ? (
          <div className="dialoog__knoppen">
            <button type="button" className="knop knop--secundair" onClick={() => galerij.current?.click()} disabled={stap === 'uploaden'}>
              Andere foto
            </button>
            <button type="button" className="knop knop--primair" onClick={() => void upload()} disabled={stap === 'uploaden' || geenVerbinding}>
              {stap === 'uploaden' ? 'Uploaden…' : 'Uploaden'}
            </button>
          </div>
        ) : (
          <div className="dialoog__knoppen">
            <button type="button" className="knop knop--primair" onClick={() => camera.current?.click()} disabled={stap === 'verkleinen'}>
              <Icoon naam="camera" grootte={20} /> Foto maken
            </button>
            <button type="button" className="knop knop--secundair" onClick={() => galerij.current?.click()} disabled={stap === 'verkleinen'}>
              Uit je foto&apos;s
            </button>
          </div>
        )}
        <button type="button" className="tekstknop" onClick={onSluit}>
          Annuleren
        </button>
      </div>
    </div>
  )
}
