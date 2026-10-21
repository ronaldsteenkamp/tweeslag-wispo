import { useEffect, useMemo, useRef, useState } from 'react'
import { BevestigDialoog } from '../components/BevestigDialoog'
import { Icoon } from '../components/Icoon'
import { Verbinding } from '../components/Verbinding'
import { useBackend } from '../lib/backend'
import { useData } from '../lib/data'
import { grooteLink, useFotos, verwijderFoto, type Foto } from '../lib/fotos'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'

export function wanneerGemaakt(iso: string) {
  const d = new Date(iso)
  return datumISO(d) === datumISO(new Date()) ? `vandaag ${tijdUUMM(d)}` : `${datumLabel(datumISO(d), 'kort')} ${tijdUUMM(d)}`
}

/** Kamerlabel zoals elders in de app: '101 · Gletsjer' */
export function useKamerLabel() {
  const { data } = useData('kamers')
  return useMemo(() => {
    const m = new Map((data?.kamers ?? []).map((k) => [k.nummer, k.naam]))
    return (nr: string | null) => (nr ? `${nr}${m.get(nr) ? ` · ${m.get(nr)}` : ''}` : '')
  }, [data])
}

export default function Fotomuur({ terug }: { terug: () => void }) {
  const backend = useBackend()
  const { fotos, mislukt, meer, laadMeer } = useFotos(30, backend.status !== 'uit')
  const kamerLabel = useKamerLabel()
  const [open, setOpen] = useState<Foto | null>(null)

  return (
    <div className="scherm fotomuur">
      <button type="button" className="tekstknop" onClick={terug}>
        ← Terug naar Spel
      </button>
      <h1>Fotomuur</h1>

      {backend.status === 'uit' ? (
        <p>Er is geen backend ingesteld, dus er is geen fotomuur.</p>
      ) : (
        <>
          <div className="kaartje klassement__status">
            <Verbinding />
            <p className="klein">Upload een foto als bewijs via het 📷-knopje bij een challenge.</p>
          </div>

          {!fotos ? (
            <p className="laadtekst">
              {mislukt || backend.status !== 'verbonden'
                ? 'Geen verbinding. De fotomuur laadt zodra er internet is.'
                : "Foto's laden…"}
            </p>
          ) : fotos.length === 0 ? (
            <p className="laadtekst">Nog geen foto&apos;s. Wie is de eerste?</p>
          ) : (
            <>
              {mislukt && <p className="melding">Geen verbinding. Nieuwe foto&apos;s verschijnen zodra er internet is.</p>}
              <ul className="fotomuur__raster">
                {fotos.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="fotomuur__foto" onClick={() => setOpen(f)}>
                      {f.klein ? <img src={f.klein} alt={`${f.challenge_titel} door ${f.naam}`} loading="lazy" /> : <span>📷</span>}
                    </button>
                    <p className="fotomuur__onderschrift">
                      <strong>{f.naam}</strong>
                      {f.kamer && <span> · kamer {kamerLabel(f.kamer)}</span>}
                      <br />
                      {f.challenge_titel}
                      <small>{wanneerGemaakt(f.gemaakt)}</small>
                    </p>
                  </li>
                ))}
              </ul>
              {meer && (
                <button type="button" className="knop knop--secundair knop--breed" onClick={laadMeer}>
                  Meer foto&apos;s
                </button>
              )}
            </>
          )}
        </>
      )}

      {open && <FotoGroot foto={open} kamerLabel={kamerLabel} onSluit={() => setOpen(null)} />}
    </div>
  )
}

/** Eén foto op groot formaat, met verwijderen voor de eigenaar en beheerders */
export function FotoGroot({
  foto,
  kamerLabel,
  onSluit,
}: {
  foto: Foto
  kamerLabel: (nr: string | null) => string
  onSluit: () => void
}) {
  const backend = useBackend()
  const [url, setUrl] = useState<string | null>(null)
  const [vragen, setVragen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const magVerwijderen = foto.user_id === backend.userId || backend.beheerder
  const sluit = useRef(onSluit)
  sluit.current = onSluit

  useEffect(() => {
    let actief = true
    void grooteLink(foto).then((u) => actief && setUrl(u))
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && sluit.current()
    window.addEventListener('keydown', opToets)
    return () => {
      actief = false
      window.removeEventListener('keydown', opToets)
    }
  }, [foto])

  const verwijder = async () => {
    setVragen(false)
    const f = await verwijderFoto(foto)
    if (f) setFout(f)
    else onSluit()
  }

  return (
    <div className="foto-groot" role="dialog" aria-modal="true" aria-label={foto.challenge_titel} onClick={onSluit}>
      <button type="button" className="foto-groot__sluit" aria-label="Sluiten" onClick={onSluit}>
        <Icoon naam="kruis" />
      </button>
      <img
        src={url ?? foto.klein}
        alt={`${foto.challenge_titel} door ${foto.naam}`}
        style={foto.breedte && foto.hoogte ? { aspectRatio: `${foto.breedte} / ${foto.hoogte}` } : undefined}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="foto-groot__onder" onClick={(e) => e.stopPropagation()}>
        <p>
          <strong>{foto.naam}</strong>
          {foto.kamer && ` · kamer ${kamerLabel(foto.kamer)}`}
          <br />
          {foto.challenge_titel} · {wanneerGemaakt(foto.gemaakt)}
        </p>
        {magVerwijderen && (
          <button type="button" className="knop knop--gevaar knop--klein" onClick={() => setVragen(true)}>
            <Icoon naam="prullenbak" grootte={18} /> Verwijderen
          </button>
        )}
        {fout && <p className="melding melding--fout">{fout}</p>}
      </div>
      <BevestigDialoog
        open={vragen}
        titel="Foto verwijderen?"
        tekst={`De foto van ${foto.naam} bij "${foto.challenge_titel}" verdwijnt voor iedereen.`}
        bevestigLabel="Verwijderen"
        gevaarlijk
        onAnnuleer={() => setVragen(false)}
        onBevestig={() => void verwijder()}
      />
    </div>
  )
}
