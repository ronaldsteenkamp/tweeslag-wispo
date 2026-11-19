import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBackend } from '../lib/backend'
import { zetZichtbaar, type Inzending } from '../lib/bewijs'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { uploadFoto, verklein, verwijderFoto, type Verkleind } from '../lib/fotos'
import { bewaarVoorLater, gooiWeg, lijktBereik, probeerOpnieuw, type WachtendeFoto } from '../lib/fotowachtrij'
import { klank, minderBeweging, trilSpel } from '../lib/spelgeluid'
import { useTerugSluit } from '../lib/terugknop'
import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { BevestigDialoog } from './BevestigDialoog'
import { Icoon } from './Icoon'

/*
 * Bewijs insturen in de stijl "redactietafel" (gekozen uit mockups/challenge-c.html): je kiekje gaat
 * met een paperclip naar de redactie van het clubblad. Ter perse → geplaatst (rode stempel, punten)
 * of een geel briefje terug. Opmaak in styles/bewijs.css; geluid en trillen via lib/spelgeluid.
 */

export interface ChallengeInfo {
  id: string
  titel: string
  omschrijving?: string
  punten: number
  /** Wanneer de dagkaart openging: een foto van daarvoor krijgt het labeltje "oud kiekje" */
  open: Date
}

const kort = (d: Date) => `${datumLabel(datumISO(d), 'kort')} · ${tijdUUMM(d)}`

/** De paperclip van de redactie */
export function Paperclip({ className = 'paperclip' }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 44" className={className} aria-hidden="true" focusable="false">
      <path d="M5 30V8a4 4 0 0 1 8 0v26a6 6 0 0 1-12 0V12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** Een kiekje met witte rand, onderschrift en paperclip; `children` = stempel erop */
export function Kiekje({
  src,
  titel,
  onder,
  oud,
  scheef = -1,
  children,
}: {
  src?: string | null
  titel: string
  onder?: string
  oud?: boolean
  scheef?: number
  children?: ReactNode
}) {
  return (
    <figure className={`kiekje${oud ? ' is-oud' : ''}`} style={{ '--scheef': `${scheef}deg` } as React.CSSProperties}>
      <Paperclip />
      <div className="kiekje__foto">{src ? <img src={src} alt="" /> : <span className="kiekje__leeg"><Icoon naam="camera" grootte={40} /></span>}</div>
      <figcaption>
        <span>{titel}</span>
        {onder && <time>{onder}</time>}
      </figcaption>
      {children}
    </figure>
  )
}

export type StempelSoort = 'geplaatst' | 'ter-perse' | 'ligt-klaar'

/** De grote stempel van de redactie */
export function RedactieStempel({ soort, punten, nieuw }: { soort: StempelSoort; punten?: number; nieuw?: boolean }) {
  return (
    <span className={`redactiestempel redactiestempel--${soort}${nieuw ? ' is-nieuw' : ''}`} aria-hidden="true">
      {soort === 'geplaatst' ? (
        <>
          Geplaatst<b>+{punten}</b>de redactie
        </>
      ) : soort === 'ter-perse' ? (
        <>
          Ter<b>perse</b>
        </>
      ) : (
        <>
          Ligt<b>klaar</b>voor de post
        </>
      )}
    </span>
  )
}

type Wie = 'niemand' | 'ok' | 'redactie'

/**
 * Bewijs insturen: plakbriefje met de opdracht → camera van de telefoon (of je foto's) → je kiekje
 * met de vraag wie erop staat → naar de redactie. Zonder bereik ligt hij klaar voor de post en gaat
 * hij vanzelf zodra het kan.
 */
export function BewijsInsturen({
  challenge,
  geluid,
  onSluit,
  onKlaar,
}: {
  challenge: ChallengeInfo
  geluid: boolean
  onSluit: () => void
  /** `later`: zonder bereik bewaard */
  onKlaar: (later: boolean) => void
}) {
  const backend = useBackend()
  const camera = useRef<HTMLInputElement>(null)
  const galerij = useRef<HTMLInputElement>(null)
  const [foto, setFoto] = useState<Verkleind | null>(null)
  const [bron, setBron] = useState<'camera' | 'galerij'>('camera')
  // Vast id per gekozen foto: opnieuw proberen of later versturen zet hem er nooit dubbel op
  const [fotoId, setFotoId] = useState(() => crypto.randomUUID())
  const [voorbeeld, setVoorbeeld] = useState<string | null>(null)
  const [stap, setStap] = useState<'briefje' | 'ontwikkelen' | 'kiekje' | 'versturen' | 'fout'>('briefje')
  const [later, setLater] = useState(false)
  const [wie, setWie] = useState<Wie>('niemand')
  const [fout, setFout] = useState<string | null>(null)
  const [melding, setMelding] = useState('')
  const dialoog = useDialoogFocus<HTMLDivElement>()
  useTerugSluit(true, onSluit)

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && stap !== 'versturen' && onSluit()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [onSluit, stap])
  useEffect(() => () => void (voorbeeld && URL.revokeObjectURL(voorbeeld)), [voorbeeld])

  const genomen = foto?.genomen ? new Date(foto.genomen) : null
  const oud = !!genomen && genomen < challenge.open

  const gekozen = async (bestand: File | undefined, via: 'camera' | 'galerij') => {
    if (!bestand) return
    setFout(null)
    setBron(via)
    setStap('ontwikkelen')
    setMelding('Je kiekje wordt ontwikkeld')
    try {
      const v = await verklein(bestand)
      setFoto(v)
      setFotoId(crypto.randomUUID())
      setVoorbeeld(URL.createObjectURL(v.groot))
      setStap('kiekje')
      setMelding('Je kiekje is klaar. Kijk of hij goed is en stuur hem naar de redactie.')
      klank('papier', geluid)
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e))
      setStap('fout')
    }
  }

  const geenVerbinding = backend.status !== 'verbonden' || !backend.gekoppeld

  const naarRedactie = async () => {
    if (!foto) return
    const info = { id: challenge.id, titel: challenge.titel, punten: challenge.punten, zichtbaar: wie === 'redactie' ? 'redactie' : 'iedereen', bron } as const
    const nuLater = geenVerbinding
    setLater(nuLater)
    setStap('versturen')
    setMelding(nuLater ? 'Geen bereik. Je kiekje ligt klaar voor de post.' : 'Naar de redactie')
    klank('stempel', geluid)
    trilSpel('stempel', geluid)
    const minstens = new Promise((r) => window.setTimeout(r, minderBeweging() ? 300 : 1400))
    let f = nuLater ? await bewaarVoorLater(foto, info, fotoId) : await uploadFoto(foto, info, fotoId)
    let uiteindelijkLater = nuLater
    // Bereik weggevallen tijdens het versturen: dan ligt hij klaar voor de post
    if (f && !nuLater && lijktBereik(f)) {
      uiteindelijkLater = true
      setLater(true)
      f = await bewaarVoorLater(foto, info, fotoId)
    }
    await minstens
    if (f) {
      setFout(f)
      setStap('fout')
      klank('fout', geluid)
      return
    }
    onKlaar(uiteindelijkLater)
  }

  const opnieuw = () => (bron === 'galerij' ? galerij : camera).current?.click()

  return (
    <div className="bewijs-achtergrond">
      <div ref={dialoog} className="bewijs" role="dialog" aria-modal="true" aria-labelledby="bewijs-titel">
        <p className="verborgen" aria-live="polite">
          {melding}
        </p>
        <div className="bewijs__balk">
          <button type="button" className="bewijs__rond" onClick={onSluit} aria-label="Sluiten" disabled={stap === 'versturen'}>
            <Icoon naam="kruis" grootte={24} />
          </button>
          <span className="spel__caps">{stap === 'kiekje' ? 'Je kiekje' : 'Bewijs voor de redactie'}</span>
        </div>

        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void gekozen(e.target.files?.[0], 'camera')} />
        <input ref={galerij} type="file" accept="image/*" hidden onChange={(e) => void gekozen(e.target.files?.[0], 'galerij')} />

        <div className="plakbriefje">
          <span className="spel__caps">Kiekje voor</span>
          <h2 id="bewijs-titel">{challenge.titel}</h2>
          {challenge.omschrijving && stap !== 'kiekje' && <p>{challenge.omschrijving}</p>}
          <b className="plakbriefje__punten">+{challenge.punten}</b>
        </div>

        {(stap === 'briefje' || stap === 'ontwikkelen') && (
          <>
            <Kiekje titel={stap === 'ontwikkelen' ? 'Wordt ontwikkeld…' : 'Nog geen kiekje'} scheef={1.5} />
            <div className="bewijs__knoppen">
              <button type="button" className="spelknop" onClick={() => camera.current?.click()} disabled={stap === 'ontwikkelen'} data-autofocus>
                <Icoon naam="camera" grootte={22} /> Foto maken
              </button>
              <button type="button" className="bewijs__tekstknop" onClick={() => galerij.current?.click()} disabled={stap === 'ontwikkelen'}>
                Uit je foto&apos;s
              </button>
            </div>
          </>
        )}

        {(stap === 'kiekje' || stap === 'versturen') && foto && (
          <>
            <Kiekje src={voorbeeld} titel={challenge.titel} onder={genomen ? kort(genomen) : undefined} oud={oud}>
              {stap === 'versturen' && <RedactieStempel soort={later ? 'ligt-klaar' : 'ter-perse'} nieuw />}
            </Kiekje>
            {oud && genomen && (
              <p className="bewijs__oud" role="note">
                <Icoon naam="slot" grootte={20} />
                <span>
                  Deze foto is van {datumLabel(datumISO(genomen), 'kort')}, van voor deze dagkaart openging. Insturen mag, maar de redactie
                  ziet het.
                </span>
              </p>
            )}
            {stap === 'kiekje' ? (
              <>
                <fieldset className="bewijs__wie">
                  <legend>Staan er anderen op?</legend>
                  {(
                    [
                      ['niemand', 'Nee, alleen ik (of niemand)'],
                      ['ok', 'Ja, en ze vinden het goed dat hij in het clubblad komt'],
                      ['redactie', 'Ja, maar alleen de redactie mag hem zien'],
                    ] as const
                  ).map(([w, tekst]) => (
                    <label key={w} className="bewijs__keuze">
                      <input type="radio" name="wie" value={w} checked={wie === w} onChange={() => setWie(w)} />
                      <span>{tekst}</span>
                    </label>
                  ))}
                </fieldset>
                <div className="bewijs__knoppen bewijs__knoppen--twee">
                  <button type="button" className="spelknop spelknop--licht" onClick={opnieuw}>
                    <Icoon naam="herstel" grootte={20} /> Opnieuw
                  </button>
                  <button type="button" className="spelknop" onClick={() => void naarRedactie()}>
                    {geenVerbinding ? 'Klaarleggen' : 'Naar de redactie'}
                  </button>
                </div>
                <p className="bewijs__klein">
                  {geenVerbinding
                    ? 'Geen bereik: je kiekje blijft op je telefoon en gaat vanzelf zodra het kan, ook als je de app sluit. '
                    : ''}
                  Locatie en cameragegevens gaan eraf; de foto wordt kleiner gemaakt ({Math.round(foto.groot.size / 1024)} kB).
                </p>
              </>
            ) : (
              <p className="bewijs__onderweg">
                <b>{later ? 'Ligt klaar voor de post' : 'Naar de redactie'}</b>
                <span>{later ? 'Gaat vanzelf zodra er bereik is. Je plekje op de dagkaart is alvast bewaard.' : 'Even geduld…'}</span>
              </p>
            )}
          </>
        )}

        {stap === 'fout' && (
          <>
            <div className="briefje" role="alert">
              <span className="spel__caps">Dat lukte niet</span>
              <p>{fout && /verbinding|bereik/i.test(fout) ? 'Geen verbinding met de redactie.' : fout}</p>
            </div>
            <div className="bewijs__knoppen bewijs__knoppen--twee">
              {foto ? (
                <>
                  <button type="button" className="spelknop spelknop--licht" onClick={() => setStap('kiekje')}>
                    Terug
                  </button>
                  <button type="button" className="spelknop" onClick={() => void naarRedactie()}>
                    Nog eens proberen
                  </button>
                </>
              ) : (
                <button type="button" className="spelknop" onClick={() => setStap('briefje')}>
                  Andere foto kiezen
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Je eigen kiekje bij een challenge: status, briefje van de redactie, wie hem mag zien, weghalen */
export function InzendingBlad({
  challenge,
  inzending,
  wachtend,
  onNogEens,
  onSluit,
}: {
  challenge: ChallengeInfo
  inzending?: Inzending
  wachtend?: WachtendeFoto
  onNogEens: () => void
  onSluit: () => void
}) {
  const [bevestig, setBevestig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const dialoog = useDialoogFocus<HTMLDivElement>()
  useTerugSluit(true, onSluit)
  useEffect(() => {
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && !bevestig && onSluit()
    window.addEventListener('keydown', opToets)
    return () => window.removeEventListener('keydown', opToets)
  }, [onSluit, bevestig])

  const status = wachtend ? 'wacht' : inzending!.status
  const moment = inzending ? new Date(inzending.genomen ?? inzending.gemaakt) : null
  const uitleg =
    status === 'wacht'
      ? wachtend?.vast
        ? `Dit kiekje komt niet aan bij de redactie${wachtend.fout ? ` (${wachtend.fout})` : ''}. Probeer het nog een keer.`
        : wachtend?.bezig
          ? 'Gaat nu naar de redactie.'
          : 'Ligt klaar voor de post: staat veilig op je telefoon en gaat vanzelf zodra er bereik is. Je hoeft niets te doen.'
      : status === 'ingestuurd'
        ? 'Ter perse. De redactie kijkt er rond het avondeten naar; je krijgt een seintje.'
        : status === 'goed'
          ? `Geplaatst in het clubblad: ${inzending!.punten ?? challenge.punten} punten voor jou${inzending!.jury ? ', plus 10 als jurykeuze' : ''}.`
          : 'Geen punten eraf, geen straf: stuur gewoon een nieuw kiekje in.'

  const wissel = async () => {
    if (!inzending) return
    setBezig(true)
    const f = await zetZichtbaar(inzending.id, inzending.zichtbaar === 'redactie' ? 'iedereen' : 'redactie')
    setBezig(false)
    setFout(f)
  }

  const weghalen = async () => {
    setBevestig(false)
    setBezig(true)
    const f = wachtend ? (await gooiWeg(wachtend.id), null) : await verwijderFoto(inzending!)
    setBezig(false)
    if (f) setFout(f)
    else onSluit()
  }

  return (
    <div className="bewijs-achtergrond">
      <div ref={dialoog} className="bewijs" role="dialog" aria-modal="true" aria-labelledby="inzending-titel">
        <div className="bewijs__balk">
          <button type="button" className="bewijs__rond" onClick={onSluit} aria-label="Sluiten">
            <Icoon naam="kruis" grootte={24} />
          </button>
          <span className="spel__caps">Jouw kiekje</span>
        </div>
        <h2 id="inzending-titel" className="bewijs__titel">
          {challenge.titel}
        </h2>
        <Kiekje src={wachtend ? wachtend.klein : inzending?.klein} titel={challenge.titel} onder={moment ? kort(moment) : undefined}>
          {status === 'goed' && <RedactieStempel soort="geplaatst" punten={inzending!.punten || challenge.punten} />}
          {status === 'ingestuurd' && <RedactieStempel soort="ter-perse" />}
          {status === 'wacht' && <RedactieStempel soort="ligt-klaar" />}
        </Kiekje>
        {status === 'af' && (
          <div className="briefje">
            <span className="spel__caps">Van de redactie:</span>
            <p>{inzending!.reden || 'Probeer het nog een keer.'}</p>
            <small>Nog een keer insturen mag altijd.</small>
          </div>
        )}
        <p className="bewijs__uitleg" role="status">
          {uitleg}
        </p>
        {fout && (
          <p className="bewijs__fout" role="alert">
            {fout}
          </p>
        )}
        <div className="bewijs__acties">
          {status === 'af' && (
            <button type="button" className="spelknop" onClick={onNogEens} data-autofocus>
              <Icoon naam="camera" grootte={22} /> Nog een keer
            </button>
          )}
          {wachtend?.vast && (
            <button type="button" className="spelknop" onClick={() => void probeerOpnieuw(wachtend.id)}>
              Nog eens proberen
            </button>
          )}
          {inzending && status !== 'af' && (
            <button type="button" className="spelknop spelknop--licht" onClick={() => void wissel()} disabled={bezig} aria-pressed={inzending.zichtbaar === 'redactie'}>
              <Icoon naam={inzending.zichtbaar === 'redactie' ? 'slot' : 'groep'} grootte={20} />
              {inzending.zichtbaar === 'redactie' ? 'Alleen de redactie ziet hem' : 'Mag in het clubblad'}
            </button>
          )}
          <button type="button" className="bewijs__tekstknop bewijs__tekstknop--rood" onClick={() => setBevestig(true)} disabled={bezig}>
            <Icoon naam="prullenbak" grootte={20} /> {wachtend ? 'Niet versturen' : 'Haal mijn foto weg'}
          </button>
        </div>
      </div>
      <BevestigDialoog
        open={bevestig}
        titel={wachtend ? 'Dit kiekje niet versturen?' : 'Je kiekje weghalen?'}
        tekst={
          wachtend
            ? 'Hij staat alleen op deze telefoon. Weg is weg.'
            : status === 'goed'
              ? 'Hij verdwijnt uit het clubblad en de punten voor deze challenge vervallen.'
              : 'Hij verdwijnt bij de redactie.'
        }
        bevestigLabel="Weghalen"
        gevaarlijk
        onBevestig={() => void weghalen()}
        onAnnuleer={() => setBevestig(false)}
      />
    </div>
  )
}

/** De beloning: de redactie zet er een stempel op. Eén keer per geplaatst kiekje. */
export function Geplaatst({
  challenge,
  inzending,
  totaal,
  geluid,
  onSluit,
}: {
  challenge: ChallengeInfo
  inzending: Inzending
  totaal: number
  geluid: boolean
  onSluit: () => void
}) {
  const dialoog = useDialoogFocus<HTMLDivElement>()
  const [bonk, setBonk] = useState(false)
  useTerugSluit(true, onSluit)
  useEffect(() => {
    const id = window.setTimeout(
      () => {
        setBonk(true)
        klank('stempel', geluid)
        trilSpel('stempel', geluid)
      },
      minderBeweging() ? 0 : 350,
    )
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && onSluit()
    window.addEventListener('keydown', opToets)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', opToets)
    }
  }, [geluid, onSluit])
  const punten = inzending.punten || challenge.punten
  return (
    <div className="bewijs-achtergrond bewijs-achtergrond--feest">
      <div ref={dialoog} className="geplaatst" role="dialog" aria-modal="true" aria-labelledby="geplaatst-titel">
        <Kiekje src={inzending.klein} titel={challenge.titel} scheef={2}>
          {bonk && <RedactieStempel soort="geplaatst" punten={punten} nieuw />}
        </Kiekje>
        <h2 id="geplaatst-titel">Geplaatst!</h2>
        <p>
          De redactie zette er een stempel op: <b>{challenge.titel}</b> staat in het clubblad{inzending.jury ? ', als jurykeuze' : ''}.
        </p>
        <p className="geplaatst__stand">
          <span>
            Erbij<b>+{punten}</b>
          </span>
          <span>
            Jouw score<b>{totaal}</b>
          </span>
        </p>
        <button type="button" className="spelknop" onClick={onSluit} data-autofocus>
          Mooi zo
        </button>
      </div>
    </div>
  )
}
