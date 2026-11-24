import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialoogFocus } from '../lib/dialoogFocus'
import { useFotoWachtrij } from '../lib/fotowachtrij'
import { ICOON, ICOON_GENEGEERD, ICOON_SLEUTEL } from '../lib/icoonversie'
import { useInstallatie } from '../lib/installatie'
import { useOpgeslagen } from '../lib/opslag'
import { voortgangNogNietVerstuurd } from '../lib/persoonsdata'
import { useStukjesWachtrij } from '../lib/stukjes'
import { useTerugSluit } from '../lib/terugknop'
import { useToonNaam } from '../lib/bijnamen'
import { Icoon } from './Icoon'

const BASIS = import.meta.env.BASE_URL

/**
 * Alleen op een iPhone/iPad, in de app op het beginscherm die er al stond vóór het nieuwe icoon:
 * iOS werkt het icoon nooit zelf bij. Eén keer uitleggen hoe je het nieuwe krijgt (Wispo eraf
 * halen en opnieuw toevoegen). Wegklikken = nooit meer.
 */
export function IcoonMelding() {
  const { platform, geinstalleerd } = useInstallatie()
  const [versie, setVersie] = useOpgeslagen<string>(ICOON_SLEUTEL, ICOON)
  const [open, setOpen] = useState(false)

  if (platform !== 'ios' || !geinstalleerd || versie !== 'oud') return null

  return (
    <section className="kaartje installatie icoonmelding" aria-labelledby="icoonmelding-titel">
      <button
        type="button"
        className="installatie__sluit"
        aria-label="Melding verbergen"
        onClick={() => setVersie(ICOON_GENEGEERD)}
      >
        <Icoon naam="kruis" />
      </button>
      <h2 id="icoonmelding-titel">Wispo heeft een nieuw icoon</h2>
      <div className="icoonmelding__wissel" aria-hidden="true">
        <img className="icoonmelding__oud" src={`${BASIS}img/icoon-oud.svg`} alt="" width={52} height={52} />
        <Icoon naam="pijl" grootte={20} />
        <img src={`${BASIS}logo.svg`} alt="" width={52} height={52} />
        <span>2slag in een sterrennacht</span>
      </div>
      <p>
        Je iPhone houdt het oude vast. Wil je het nieuwe? Zet Wispo dan opnieuw op je beginscherm. Dat kost een
        minuut en je raakt niets kwijt.
      </p>
      <button type="button" className="knop knop--primair knop--breed" onClick={() => setOpen(true)}>
        Zo doe je dat
      </button>
      <button type="button" className="knop knop--tekst knop--breed" onClick={() => setVersie(ICOON_GENEGEERD)}>
        Laat maar
      </button>
      {open && <IcoonBlad onSluit={() => setOpen(false)} />}
    </section>
  )
}

function IcoonBlad({ onSluit }: { onSluit: () => void }) {
  const venster = useDialoogFocus<HTMLDivElement>(true)
  useTerugSluit(true, onSluit)
  const [naam] = useOpgeslagen<string | null>('naam', null)
  const toon = useToonNaam()
  const fotos = useFotoWachtrij()
  const stukjes = useStukjesWachtrij().length
  const [voortgangWacht, setVoortgangWacht] = useState(voortgangNogNietVerstuurd)
  const [gekopieerd, setGekopieerd] = useState(false)

  useEffect(() => {
    const opToets = (e: KeyboardEvent) => e.key === 'Escape' && onSluit()
    window.addEventListener('keydown', opToets)
    // De pagina eronder ligt stil zolang het blad open is
    document.documentElement.classList.add('venster-open')
    // Voortgang kan intussen verstuurd worden: af en toe opnieuw kijken
    const t = window.setInterval(() => setVoortgangWacht(voortgangNogNietVerstuurd()), 2000)
    return () => {
      window.removeEventListener('keydown', opToets)
      document.documentElement.classList.remove('venster-open')
      window.clearInterval(t)
    }
  }, [onSluit])

  const wachtrij = [fotos > 0 && (fotos === 1 ? '1 foto' : `${fotos} foto’s`), stukjes > 0 && (stukjes === 1 ? '1 stukje' : `${stukjes} stukjes`)]
    .filter(Boolean)
    .join(' en ')
  const link = `${window.location.origin}${BASIS}`

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(link)
      setGekopieerd(true)
      window.setTimeout(() => setGekopieerd(false), 2500)
    } catch {
      window.prompt('Kopieer de link', link)
    }
  }

  // Naar body, zodat het vegen tussen tabs (transform op de inhoud) het blad niet meeneemt
  return createPortal(
    <div className="dialoog-achtergrond" onClick={onSluit}>
      <div
        ref={venster}
        className="dialoog dialoog--hoog icoonblad"
        role="dialog"
        aria-modal="true"
        aria-labelledby="icoonblad-titel"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="icoonblad__sluit" onClick={onSluit} aria-label="Sluiten">
          <Icoon naam="kruis" />
        </button>
        <h2 id="icoonblad-titel">Nieuw icoon in 4 stappen</h2>

        <div className="icoonblad__check">
          {naam ? (
            voortgangWacht ? (
              <p className="is-let">
                <Icoon naam="info" grootte={18} />
                <span>
                  Je laatste voortgang staat nog niet op de server. Wacht even tot je bereik hebt (open dit blad dan
                  opnieuw).
                </span>
              </p>
            ) : (
              <p className="is-goed">
                <Icoon naam="vink" grootte={18} />
                <span>
                  Je paklijst, badges en het spel staan bij <b>{toon(naam)}</b> op de server en komen terug.
                </span>
              </p>
            )
          ) : (
            <p className="is-goed">
              <Icoon naam="vink" grootte={18} />
              <span>Je hebt nog geen naam gekozen, dus er is niets om kwijt te raken.</span>
            </p>
          )}
          {wachtrij ? (
            <p className="is-let">
              <Icoon naam="info" grootte={18} />
              <span>
                <b>Nog {wachtrij}</b> {fotos + stukjes === 1 ? 'wacht' : 'wachten'} op verzenden. Wacht tot je bereik
                hebt en ze weg zijn, anders raak je ze kwijt.
              </span>
            </p>
          ) : (
            naam && (
              <p className="is-goed">
                <Icoon naam="vink" grootte={18} />
                <span>Alle foto’s en stukjes zijn verstuurd.</span>
              </p>
            )
          )}
          <p className="is-let">
            <Icoon naam="bel" grootte={18} />
            <span>Meldingen zet je daarna opnieuw aan.</span>
          </p>
        </div>

        <ol className="icoonblad__stappen">
          <li>
            <span>
              Druk op je beginscherm lang op het Wispo-icoon en kies <b>Verwijder app</b> → <b>Verwijder van
              beginscherm</b>.
            </span>
          </li>
          <li>
            <span>
              Open de link in <b>Safari</b>.
            </span>
            <button type="button" className="knop knop--secundair knop--klein icoonblad__kopieer" onClick={kopieer}>
              <Icoon naam={gekopieerd ? 'vink' : 'deel'} grootte={18} />
              {gekopieerd ? 'Gekopieerd' : 'Kopieer de link'}
            </button>
          </li>
          <li>
            <span>
              Tik op Deel{' '}
              <span className="stappen__icoon">
                <Icoon naam="deel" grootte={18} />
              </span>
              , kies <b>Zet op beginscherm</b> en dan <b>Voeg toe</b>.
            </span>
          </li>
          <li>
            <span>Open Wispo en kies weer {naam ? <b>{toon(naam)}</b> : 'je naam'}.</span>
          </li>
        </ol>
      </div>
    </div>,
    document.body,
  )
}
