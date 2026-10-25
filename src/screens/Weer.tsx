import { bijgewerkt } from '../components/WeerKaart'
import { config } from '../config'
import { useData } from '../lib/data'
import { useNu } from '../lib/nu'
import { useOpgeslagen } from '../lib/opslag'
import { tabToetsen } from '../lib/tabbladen'
import { datumISO, datumLabel, lokaalNaarDate } from '../lib/tijd'
import { cm, dagdelen, graden, meters, useWeer, verversWeer, weerIcoon, weerTekst } from '../lib/weer'

const vertrek = lokaalNaarDate(config.vertrek)

/** Detailscherm: vandaag per dagdeel en de komende dagen, voor dorp of gletsjer */
export default function Weer({ terug }: { terug: () => void }) {
  const nu = useNu(60_000)
  const { weer, laden, mislukt } = useWeer()
  const { data: planning } = useData('planning')
  const [plekId, setPlekId] = useOpgeslagen<string>('weer.plek', config.weer.locaties[0].id)
  const vandaag = datumISO(nu)
  const reisdagen = new Set((planning?.dagen ?? []).map((d) => d.datum))
  const voorVertrek = nu < vertrek

  const plek = weer?.locaties.find((l) => l.id === plekId) ?? weer?.locaties[0]
  const dagVandaag = plek?.dagen.find((d) => d.datum === vandaag)
  const delen = plek && dagVandaag ? dagdelen(plek, vandaag) : []
  const komend = plek?.dagen.filter((d) => d.datum > vandaag) ?? []
  const reisInBeeld = komend.some((d) => reisdagen.has(d.datum))

  return (
    <div className="scherm weer">
      <button type="button" className="tekstknop" onClick={terug}>
        ← Terug
      </button>
      <h1>Weer en sneeuw</h1>

      {!weer || !plek ? (
        <p className="laadtekst">
          {laden ? 'Weerbericht laden…' : 'Nog geen weerbericht bewaard. Open de app een keer met internet.'}
        </p>
      ) : (
        <>
          {voorVertrek && (
            <section className="kaartje weer__nu">
              <h2>Zo is het nu in Les Deux Alpes</h2>
              <div className="weerkaart__plekken">
                {weer.locaties.map((l) => (
                  <div key={l.id} className="weerkaart__plek">
                    <p className="weerkaart__naam">
                      {l.naam} <span>{l.hoogte} m</span>
                    </p>
                    <div className="weerkaart__hoofd">
                      <span className="weerkaart__icoon" aria-hidden="true">
                        {weerIcoon(l.nu.code, l.nu.isDag)}
                      </span>
                      <span className="weerkaart__temp">{graden(l.nu.temp)}</span>
                    </div>
                    <p className="weerkaart__tekst">{weerTekst(l.nu.code)}</p>
                    <p className="weerkaart__regel">💨 {Math.round(l.nu.wind)} km/u</p>
                  </div>
                ))}
              </div>
              <p className="klein">
                {reisInBeeld
                  ? 'De eerste reisdagen staan al in de verwachting hieronder.'
                  : 'Een verwachting gaat ongeveer 16 dagen vooruit. Vanaf eind februari zie je hier het weer voor de reis.'}
              </p>
            </section>
          )}

          <div
            className="segment"
            role="tablist"
            aria-label="Plek"
            onKeyDown={tabToetsen(
              weer.locaties.map((l) => l.id),
              plek.id,
              setPlekId,
            )}
          >
            {weer.locaties.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={plek.id === l.id}
                tabIndex={plek.id === l.id ? 0 : -1}
                className={`segment__knop${plek.id === l.id ? ' is-actief' : ''}`}
                onClick={() => setPlekId(l.id)}
              >
                {l.naam} · {l.hoogte} m
              </button>
            ))}
          </div>

          {dagVandaag && (
            <section className="kaartje weer__vandaag">
              <p className="dag__nummer">Vandaag · {datumLabel(vandaag)}</p>
              <div className="weer__groot">
                <span className="weer__icoon" aria-hidden="true">
                  {weerIcoon(dagVandaag.code)}
                </span>
                <div>
                  <p className="weer__temp">
                    {graden(dagVandaag.tMax)} <small>/ {graden(dagVandaag.tMin)}</small>
                  </p>
                  <p>{weerTekst(dagVandaag.code)}</p>
                </div>
              </div>
              <dl className="weer__feiten">
                <div>
                  <dt>Verse sneeuw</dt>
                  <dd>{cm(dagVandaag.sneeuw)}</dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>
                    {Math.round(dagVandaag.wind)} km/u <small>(stoten {Math.round(dagVandaag.windstoten)})</small>
                  </dd>
                </div>
                <div>
                  <dt>Zon</dt>
                  <dd>{Math.round(dagVandaag.zonUren)} uur</dd>
                </div>
                {dagVandaag.nulgraden != null && (
                  <div>
                    <dt>Nulgradengrens</dt>
                    <dd>{meters(dagVandaag.nulgraden)}</dd>
                  </div>
                )}
              </dl>
              {delen.length > 0 && (
                <div className="weer__delen">
                  {delen.map((d) => (
                    <div key={d.naam} className="weer__deel">
                      <p className="weer__deelnaam">{d.naam}</p>
                      <span className="weer__deelicoon" aria-label={weerTekst(d.code)}>
                        {weerIcoon(d.code)}
                      </span>
                      <p>
                        <strong>{graden(d.tMax)}</strong> / {graden(d.tMin)}
                      </p>
                      <p className="klein">❄️ {cm(d.sneeuw)}</p>
                      <p className="klein">💨 {Math.round(d.wind)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <h2 className="tussenkop">Komende dagen</h2>
          {komend.map((d) => {
            const reis = reisdagen.has(d.datum)
            return (
              <article key={d.datum} className={`kaartje weer__dag${reis ? ' is-reisdag' : ''}`}>
                <div className="weer__dagkop">
                  <p className="weer__datum">
                    {datumLabel(d.datum, 'kort')}
                    {reis && <span className="label label--accent">reis</span>}
                  </p>
                  <span className="weer__dagicoon" aria-label={weerTekst(d.code)}>
                    {weerIcoon(d.code)}
                  </span>
                  <p className="weer__dagtemp">
                    <strong>{graden(d.tMax)}</strong> / {graden(d.tMin)}
                  </p>
                </div>
                <p className="weer__dagregel">
                  <span>❄️ {cm(d.sneeuw)}</span>
                  <span>💨 {Math.round(d.wind)} km/u</span>
                  {d.nulgraden != null && <span>0° op {meters(d.nulgraden)}</span>}
                </p>
              </article>
            )
          })}

          <p className="klein weer__bron">
            {bijgewerkt(weer, nu)}
            {mislukt && ' · geen verbinding, dit is het laatst bewaarde bericht'}
            <br />
            Bron: Open-Meteo.com
          </p>
          <button
            type="button"
            className="knop knop--secundair knop--breed"
            onClick={() => verversWeer(true)}
            disabled={laden || !navigator.onLine}
          >
            {laden ? 'Bezig…' : 'Nu vernieuwen'}
          </button>
        </>
      )}
    </div>
  )
}
