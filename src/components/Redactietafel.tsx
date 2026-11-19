import { useEffect, useMemo, useState } from 'react'
import { useToonNaam } from '../lib/bijnamen'
import { beoordeel, useRedactietafel, type Inzending } from '../lib/bewijs'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { grooteLink, zetJury } from '../lib/fotos'
import { klank, minderBeweging, trilSpel } from '../lib/spelgeluid'
import { useTerugSluit } from '../lib/terugknop'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { Kiekje, RedactieStempel } from './Bewijs'
import { Icoon } from './Icoon'

/*
 * De redactietafel: hier beoordeelt de redactie (beheerders) de kiekjes. Rooster met alles wat ter
 * perse ligt, dan per kiekje "Plaatsen" (punten, op de muur) of "Briefje terug" (met een reden).
 * Toetsen: G = plaatsen, N = briefje, pijltjes = bladeren.
 */

const REDENEN = [
  'De foto is te donker of onscherp: we zien niet wat er gebeurt.',
  'We zien de opdracht er net niet op. Bijna!',
  'Niet iedereen die erop moet, staat erop.',
  'Deze hoort volgens ons bij een andere challenge.',
  'Liever niet op de piste: probeer het naast de piste, stilstaand.',
]

type Filter = 'alles' | 'redactie' | 'oud'

export function Redactietafel({
  openVan,
  omschrijving,
  geluid,
  onSluit,
}: {
  /** Wanneer de dagkaart van deze challenge openging (voor "oud kiekje") */
  openVan: (challengeId: string) => Date | null
  omschrijving: (challengeId: string) => string | undefined
  geluid: boolean
  onSluit: () => void
}) {
  const { lijst, fout } = useRedactietafel(true)
  const toon = useToonNaam()
  const [filter, setFilter] = useState<Filter>('alles')
  const [open, setOpen] = useState<string | null>(null)
  const [klaar, setKlaar] = useState<Set<string>>(new Set())
  const dialoog = useDialoogFocus<HTMLDivElement>()
  useTerugSluit(true, onSluit)

  const isOud = (f: Inzending) => {
    const o = openVan(f.challenge_id)
    return !!o && new Date(f.genomen ?? f.gemaakt) < o
  }
  const zichtbaar = useMemo(
    () =>
      (lijst ?? [])
        .filter((f) => !klaar.has(f.id))
        .filter((f) => (filter === 'redactie' ? f.zichtbaar === 'redactie' : filter === 'oud' ? isOud(f) : true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lijst, klaar, filter],
  )
  const idx = open ? zichtbaar.findIndex((f) => f.id === open) : -1

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && open === null && onSluit()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [onSluit, open])

  return (
    <div className="bewijs-achtergrond">
      <div ref={dialoog} className="bewijs redactie" role="dialog" aria-modal="true" aria-labelledby="redactie-titel">
        <div className="bewijs__balk">
          <button type="button" className="bewijs__rond" onClick={onSluit} aria-label="Sluiten">
            <Icoon naam="kruis" grootte={24} />
          </button>
          <span className="spel__caps">Redactietafel</span>
        </div>
        <h2 id="redactie-titel" className="redactie__kop" aria-live="polite">
          {lijst === null ? 'Even kijken…' : `${zichtbaar.length} op tafel`}
        </h2>
        <p className="redactie__uitleg">Plaatsen geeft meteen punten en zet het kiekje in het clubblad. Een briefje terug is geen straf.</p>
        {fout && (
          <p className="bewijs__fout" role="alert">
            {fout}
          </p>
        )}
        <div className="redactie__filters" role="group" aria-label="Filter">
          {(
            [
              ['alles', 'Alles'],
              ['redactie', 'Alleen voor de redactie'],
              ['oud', 'Oud kiekje'],
            ] as const
          ).map(([f, t]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {t}
            </button>
          ))}
        </div>
        {lijst !== null && zichtbaar.length === 0 ? (
          <div className="redactie__leeg">
            <b>Tafel leeg</b>
            <span>Alles is bekeken. Koffie?</span>
          </div>
        ) : (
          <ul className="redactie__rooster">
            {zichtbaar.map((f, i) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="redactie__tegel"
                  onClick={() => setOpen(f.id)}
                  aria-label={`${toon(f.naam)}, ${f.challenge_titel}${isOud(f) ? ', oud kiekje' : ''}${f.zichtbaar === 'redactie' ? ', alleen voor de redactie' : ''}`}
                  style={{ '--scheef': `${i % 2 ? 1.2 : -1}deg` } as React.CSSProperties}
                >
                  <span className="redactie__foto">{f.klein && <img src={f.klein} alt="" loading="lazy" />}</span>
                  <b>{toon(f.naam)}</b>
                  <span>{f.challenge_titel}</span>
                  <span className="redactie__vlaggen">
                    {isOud(f) && <i className="vlag vlag--rood">Oud kiekje</i>}
                    {f.zichtbaar === 'redactie' && <i className="vlag">Alleen redactie</i>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && idx >= 0 && (
        <Beoordelen
          key={open}
          foto={zichtbaar[idx]}
          nr={idx + 1}
          van={zichtbaar.length}
          oud={isOud(zichtbaar[idx])}
          omschrijving={omschrijving(zichtbaar[idx].challenge_id)}
          geluid={geluid}
          onVorige={idx > 0 ? () => setOpen(zichtbaar[idx - 1].id) : undefined}
          onVolgende={idx < zichtbaar.length - 1 ? () => setOpen(zichtbaar[idx + 1].id) : undefined}
          onBeslist={() => {
            const volgende = zichtbaar[idx + 1] ?? zichtbaar[idx - 1]
            setKlaar((k) => new Set(k).add(zichtbaar[idx].id))
            setOpen(volgende?.id ?? null)
          }}
          onSluit={() => setOpen(null)}
        />
      )}
    </div>
  )
}

function Beoordelen({
  foto,
  nr,
  van,
  oud,
  omschrijving,
  geluid,
  onVorige,
  onVolgende,
  onBeslist,
  onSluit,
}: {
  foto: Inzending
  nr: number
  van: number
  oud: boolean
  omschrijving?: string
  geluid: boolean
  onVorige?: () => void
  onVolgende?: () => void
  onBeslist: () => void
  onSluit: () => void
}) {
  const toon = useToonNaam()
  const [groot, setGroot] = useState<string | null>(null)
  const [reden, setReden] = useState(false)
  const [eigen, setEigen] = useState('')
  const [jury, setJury] = useState(!!foto.jury)
  const [bezig, setBezig] = useState<null | 'goed' | 'af'>(null)
  const [fout, setFout] = useState<string | null>(null)
  const dialoog = useDialoogFocus<HTMLDivElement>()
  useTerugSluit(true, onSluit)
  const moment = new Date(foto.genomen ?? foto.gemaakt)
  const punten = foto.punten ?? 0

  useEffect(() => {
    let weg = false
    void grooteLink(foto).then((u) => !weg && setGroot(u))
    return () => void (weg = true)
  }, [foto])

  const beslis = async (status: 'goed' | 'af', tekst?: string) => {
    if (bezig) return
    setFout(null)
    setBezig(status)
    const f = await beoordeel(foto.id, status, tekst)
    if (f) {
      setBezig(null)
      setFout(f)
      return
    }
    klank(status === 'goed' ? 'stempel' : 'papier', geluid)
    if (status === 'goed') trilSpel('stempel', geluid)
    await new Promise((r) => window.setTimeout(r, minderBeweging() ? 0 : 650))
    onBeslist()
  }

  const wisselJury = async () => {
    const f = await zetJury(foto, !jury)
    if (f) setFout(f)
    else setJury(!jury)
  }

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches?.('textarea, input')) return
      if (e.key === 'Escape') {
        if (reden) setReden(false)
        else onSluit()
      }
      if (reden || bezig) return
      if (e.key === 'g') void beslis('goed')
      if (e.key === 'n') setReden(true)
      if (e.key === 'ArrowRight') onVolgende?.()
      if (e.key === 'ArrowLeft') onVorige?.()
    }
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  })

  return (
    <div className="bewijs-achtergrond">
      <div ref={dialoog} className="bewijs redactie" role="dialog" aria-modal="true" aria-labelledby="beoordeel-titel">
        <div className="bewijs__balk">
          <button type="button" className="bewijs__rond" onClick={onSluit} aria-label="Terug naar de tafel">
            <Icoon naam="kruis" grootte={24} />
          </button>
          <span className="spel__caps">
            {nr} van {van}
          </span>
          <span className="redactie__nav">
            <button type="button" className="bewijs__rond" onClick={onVorige} disabled={!onVorige} aria-label="Vorige">
              <Icoon naam="links" grootte={24} />
            </button>
            <button type="button" className="bewijs__rond" onClick={onVolgende} disabled={!onVolgende} aria-label="Volgende">
              <Icoon naam="rechts" grootte={24} />
            </button>
          </span>
        </div>
        <div className={`redactie__groot${bezig === 'goed' ? ' gaat-goed' : bezig === 'af' ? ' gaat-af' : ''}`}>
          <Kiekje src={groot ?? foto.klein} titel={foto.challenge_titel} onder={`${datumLabel(datumISO(moment), 'kort')} · ${tijdUUMM(moment)}`} oud={oud}>
            {bezig === 'goed' && <RedactieStempel soort="geplaatst" punten={punten} nieuw />}
          </Kiekje>
        </div>
        <p className="spel__caps">{toon(foto.naam)}{foto.kamer ? ` · kamer ${foto.kamer}` : ''}</p>
        <h2 id="beoordeel-titel" className="bewijs__titel">
          {foto.challenge_titel} <span className="redactie__punten">+{punten}</span>
        </h2>
        {omschrijving && <p className="bewijs__uitleg">{omschrijving}</p>}
        <ul className="redactie__meta">
          <li>
            <Icoon naam={foto.bron === 'galerij' ? 'download' : 'camera'} grootte={20} />
            {foto.bron === 'galerij' ? 'Uit de foto’s gekozen' : 'Met de camera gemaakt'}, {tijdUUMM(moment)}
          </li>
          {oud && (
            <li className="is-rood">
              <Icoon naam="slot" grootte={20} /> Gemaakt op {datumLabel(datumISO(moment), 'kort')}: vóór deze dagkaart openging
            </li>
          )}
          {foto.zichtbaar === 'redactie' && (
            <li>
              <Icoon naam="slot" grootte={20} /> Met anderen erop, alleen voor de redactie: komt niet op de muur
            </li>
          )}
        </ul>
        {fout && (
          <p className="bewijs__fout" role="alert">
            {fout}
          </p>
        )}
        <div className="bewijs__knoppen bewijs__knoppen--twee">
          <button type="button" className="spelknop spelknop--licht" onClick={() => setReden(true)} disabled={!!bezig} aria-keyshortcuts="n">
            Briefje terug
          </button>
          <button type="button" className="spelknop spelknop--rood" onClick={() => void beslis('goed')} disabled={!!bezig} aria-keyshortcuts="g" data-autofocus>
            <Icoon naam="stempel" grootte={22} /> Plaatsen +{punten}
          </button>
        </div>
        <button type="button" className="bewijs__tekstknop" onClick={() => void wisselJury()} aria-pressed={jury}>
          <Icoon naam={jury ? 'vink' : 'plus'} grootte={20} /> Jurykeuze (+10)
        </button>
      </div>
      {reden && (
        <div className="bewijs-achtergrond" onClick={() => setReden(false)}>
          <div className="redenblad" role="dialog" aria-modal="true" aria-labelledby="reden-titel" onClick={(e) => e.stopPropagation()}>
            <h3 id="reden-titel">Wat schrijf je {toon(foto.naam)} terug?</h3>
            <div className="redenblad__lijst">
              {REDENEN.map((r) => (
                <button key={r} type="button" onClick={() => void beslis('af', r)} disabled={!!bezig}>
                  {r}
                </button>
              ))}
            </div>
            <label className="redenblad__eigen">
              <span>Of in eigen woorden</span>
              <textarea rows={2} maxLength={200} value={eigen} onChange={(e) => setEigen(e.target.value)} placeholder="Kort en vriendelijk" />
            </label>
            <div className="bewijs__knoppen bewijs__knoppen--twee">
              <button type="button" className="spelknop spelknop--licht" onClick={() => setReden(false)}>
                Terug
              </button>
              <button type="button" className="spelknop" onClick={() => void beslis('af', eigen.trim())} disabled={!eigen.trim() || !!bezig}>
                Versturen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
