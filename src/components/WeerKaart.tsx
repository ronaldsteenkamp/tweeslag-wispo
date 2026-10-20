import { datumISO, datumLabel, tijdUUMM } from '../lib/tijd'
import { cm, graden, meters, useWeer, weerIcoon, weerTekst, type Weer } from '../lib/weer'
import { Icoon } from './Icoon'

/** 'Bijgewerkt om 14:05', of met datum als het bericht van een andere dag is */
export function bijgewerkt(weer: Weer, nu: Date): string {
  const op = new Date(weer.opgehaald)
  const dag = datumISO(op)
  return dag === datumISO(nu)
    ? `Bijgewerkt om ${tijdUUMM(op)}`
    : `Bijgewerkt op ${datumLabel(dag, 'kort')} om ${tijdUUMM(op)}`
}

/**
 * Compacte weerkaart op Home: dorp en gletsjer naast elkaar.
 * Voor vertrek: de actuele situatie. Tijdens de reis: de verwachting voor vandaag.
 */
export function WeerKaart({ nu, voorVertrek, onOpen }: { nu: Date; voorVertrek: boolean; onOpen: () => void }) {
  const { weer, laden, mislukt } = useWeer()
  const vandaag = datumISO(nu)

  return (
    <button type="button" className="kaartje weerkaart" onClick={onOpen} aria-label="Weer en sneeuw, tik voor details">
      <div className="kaartje__kop">
        <h2>{voorVertrek ? 'Zo is het nu in Les Deux Alpes' : 'Weer en sneeuw vandaag'}</h2>
        <span className="tekstknop" aria-hidden="true">
          Meer <Icoon naam="pijl" grootte={18} />
        </span>
      </div>

      {!weer ? (
        <p className="laadtekst">{laden ? 'Weerbericht laden…' : mislukt ? 'Nog geen weerbericht bewaard. Open de app een keer met internet.' : '…'}</p>
      ) : (
        <>
          <div className="weerkaart__plekken">
            {weer.locaties.map((l) => {
              const dag = l.dagen.find((d) => d.datum === vandaag) ?? l.dagen[0]
              return (
                <div key={l.id} className="weerkaart__plek">
                  <p className="weerkaart__naam">
                    {l.naam} <span>{l.hoogte} m</span>
                  </p>
                  <div className="weerkaart__hoofd">
                    <span className="weerkaart__icoon" aria-hidden="true">
                      {voorVertrek ? weerIcoon(l.nu.code, l.nu.isDag) : weerIcoon(dag.code)}
                    </span>
                    <span className="weerkaart__temp">{graden(voorVertrek ? l.nu.temp : dag.tMax)}</span>
                  </div>
                  <p className="weerkaart__tekst">{weerTekst(voorVertrek ? l.nu.code : dag.code)}</p>
                  {!voorVertrek && <p className="weerkaart__regel">🌡️ min {graden(dag.tMin)}</p>}
                  <p className="weerkaart__regel">❄️ {cm(dag.sneeuw)} vers</p>
                  <p className="weerkaart__regel">💨 {Math.round(voorVertrek ? l.nu.wind : dag.wind)} km/u</p>
                </div>
              )
            })}
          </div>
          <p className="weerkaart__voet">
            {weer.locaties[0]?.dagen.find((d) => d.datum === vandaag)?.nulgraden != null && (
              <>Nulgradengrens ca. {meters(weer.locaties[0].dagen.find((d) => d.datum === vandaag)!.nulgraden!)} · </>
            )}
            {bijgewerkt(weer, nu)}
            {mislukt && ' · offline'}
          </p>
        </>
      )}
    </button>
  )
}
