import type { ReactNode } from 'react'
import { SchermKop } from '../components/SchermKop'
import { WeerIcoon } from '../components/WeerIcoon'
import { config } from '../config'
import { useData } from '../lib/data'
import { useNu } from '../lib/nu'
import { NIVEAU_WOORD, skidag, versSneeuw } from '../lib/skidag'
import { datumISO, datumLabel, lokaalNaarDate, tijdUUMM } from '../lib/tijd'
import {
  bijgewerkt,
  cm,
  geweest,
  graden,
  meters,
  urenVan,
  useWeer,
  verversWeer,
  weerSoort,
  weerTekst,
  windstreek,
  zichtTekst,
  type WeerLocatie,
  type WeerUur,
} from '../lib/weer'
import '../styles/barlow.css'
import '../styles/weer.css'

/*
 * Weer en sneeuw als doorsnede van de berg ("Doorsnede", mockups/weer-b.html). Bovenaan het antwoord
 * op de vraag van de ochtend; daaronder de berg zelf als grafiek met dorp, halverwege en gletsjer op
 * hun echte hoogte, de nulgradengrens en de verse sneeuw. Na 18 uur gaat alles over morgen.
 * Lawinerisico: alleen de officiële bron (Météo-France), nooit een eigen oordeel.
 */

const vertrek = lokaalNaarDate(config.vertrek)
/** Vanaf dit uur toont het scherm morgen */
const AVOND = 18
/** Ouder dan dit (minuten): de leeftijd van het bericht staat bovenaan */
const OUD_NA = 180

function plusDagen(datum: string, n: number) {
  const d = new Date(`${datum}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function leeftijdTekst(minuten: number) {
  if (minuten < 90) return `${Math.round(minuten)} minuten oud`
  if (minuten < 36 * 60) return `${Math.round(minuten / 60)} uur oud`
  return `${Math.round(minuten / 1440)} dagen oud`
}

export default function Weer({ terug }: { terug: () => void }) {
  const nu = useNu(60_000)
  const { weer, laden, mislukt } = useWeer()
  const { data: planning } = useData('planning')
  const vandaag = datumISO(nu)
  const uur = +tijdUUMM(nu).slice(0, 2)
  const avond = uur >= AVOND
  const datum = avond ? plusDagen(vandaag, 1) : vandaag
  const reisdagen = (planning?.dagen ?? []).map((d) => d.datum).sort()

  const loc = (id: string) => weer?.locaties.find((l) => l.id === id)
  const dorp = loc('dorp')
  const midden = loc('midden')
  const gletsjer = loc('gletsjer')
  const metDatum = !!gletsjer?.dagen.some((d) => d.datum === datum)
  const leeftijd = weer ? (nu.getTime() - weer.opgehaald) / 60_000 : 0
  const oud = !!weer && leeftijd > OUD_NA
  // Een bericht van gisteravond zegt nog genoeg over vandaag; ouder dan 18 uur: geen oordeel meer
  const bruikbaar = !!weer && leeftijd < 18 * 60
  const oordeel = weer && bruikbaar && metDatum ? skidag(weer.locaties, datum) : null
  // Ruim voor de reis (de reis zit nog niet in de verwachting): gewoon hoe het er nu is, zonder skidag-label
  const reisInBeeld = reisdagen.some((d) => gletsjer?.dagen.some((x) => x.datum === d))
  const alleenNu = nu < vertrek && !reisInBeeld
  const dagTitel = `${avond ? 'Morgen' : 'Vandaag'} · ${datumLabel(datum)}`

  return (
    <div className="scherm weer" data-niveau={oordeel?.niveau}>
      <SchermKop titel="Weer en sneeuw" boven={dagTitel} terug={{ label: 'Terug', onClick: terug }}>
        <div className="weerkop">
          <Lucht avond={avond} soort={oordeel?.soort} />
          <p className="weerkop__vraag">
            {alleenNu ? (avond ? 'Zo wordt het morgen in Les Deux Alpes' : 'Zo is het nu in Les Deux Alpes') : avond ? 'En morgen?' : 'Wordt het een goede skidag?'}
          </p>
          {oordeel ? (
            <>
              <p className="weerkop__antwoord">{oordeel.kop}</p>
              <p className="weerkop__sub">{oordeel.sub}</p>
              {!alleenNu && (
                <p className="weerkop__oordeel">
                  <i aria-hidden="true" />
                  {NIVEAU_WOORD[oordeel.niveau]}
                  <span className="verborgen"> (inschatting van de app uit sneeuw, wind en zicht)</span>
                </p>
              )}
            </>
          ) : (
            <p className="weerkop__sub">
              {!weer
                ? laden
                  ? 'Weerbericht laden…'
                  : 'Nog geen weerbericht op deze telefoon. Open de app een keer met internet.'
                : 'Dit bericht is te oud om iets over de skidag te zeggen. Zodra je bereik hebt, halen we een nieuw.'}
            </p>
          )}
          {weer && (
            <p className="weerkop__bijgewerkt">
              <WeerIcoon naam="klok" grootte={16} /> {bijgewerkt(weer, nu)} · tijd in Les Deux Alpes
            </p>
          )}
          {weer && (oud || (mislukt && !navigator.onLine)) && (
            <div className="weerkop__stempel" role="status">
              <b>
                <WeerIcoon naam="offline" grootte={16} /> {mislukt ? 'Geen bereik' : 'Oud bericht'} · {leeftijdTekst(leeftijd)}
              </b>
              Dit is het laatste bericht op je telefoon. Zodra je weer bereik hebt, halen we een nieuw.
            </div>
          )}
        </div>
      </SchermKop>

      {weer && gletsjer && dorp && metDatum && (
        <>
          <Doorsnede locaties={[gletsjer, midden, dorp]} datum={datum} nu={avond ? null : nu} />
          <WatTelt gletsjer={gletsjer} midden={midden} dorp={dorp} datum={datum} />
          <PerUur gletsjer={gletsjer} dorp={dorp} datum={datum} avond={avond} />
        </>
      )}

      <Lawine />

      {weer && gletsjer && dorp && <Dagen gletsjer={gletsjer} dorp={dorp} vandaag={vandaag} reisdagen={reisdagen} voorVertrek={nu < vertrek} />}

      <section className="weer__voet" aria-label="Bron">
        <p className="weer__bron">
          Weerbericht:{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Open-Meteo.com
          </a>{' '}
          (
          <a href="https://creativecommons.org/licenses/by/4.0/deed.nl" target="_blank" rel="noopener noreferrer">
            CC BY 4.0
          </a>
          ), een modelverwachting omgerekend naar de hoogte van elke plek. Lawinerisico: Météo-France. Alle tijden in de tijd van Les Deux
          Alpes.
        </p>
        <button type="button" className="weer__vernieuw" onClick={() => verversWeer(true)} disabled={laden || !navigator.onLine}>
          {!navigator.onLine ? (
            <>
              <WeerIcoon naam="offline" grootte={20} /> Geen bereik
            </>
          ) : laden ? (
            'Bezig…'
          ) : (
            'Nu vernieuwen'
          )}
        </button>
      </section>
    </div>
  )
}

/** Lijntekening rechtsboven in de kop, per soort weer (geen kleurverloop) */
function Lucht({ avond, soort }: { avond: boolean; soort?: string }) {
  let inhoud: ReactNode
  if (avond)
    inhoud = (
      <>
        <path d="M128 52a24 24 0 0 1-31-31 24 24 0 1 0 31 31z" />
        <circle cx="40" cy="30" r="1.5" fill="currentColor" />
        <circle cx="70" cy="70" r="1.2" fill="currentColor" />
        <circle cx="150" cy="96" r="1.4" fill="currentColor" />
      </>
    )
  else if (soort === 'poeder' || soort === 'sneeuwdag')
    inhoud = (
      <>
        <path d="M50 70h80a22 22 0 0 0 3-43.8A32 32 0 0 0 72 22a25 25 0 0 0-22 48z" />
        <path d="M70 92v12M65 95l10 6M65 101l10-6M108 100v12M103 103l10 6M103 109l10-6M88 120v10M84 122l8 6M84 128l8-6" />
      </>
    )
  else if (soort === 'storm' || soort === 'wind')
    inhoud = (
      <>
        <path d="M50 62h80a22 22 0 0 0 3-43.8A32 32 0 0 0 72 14a25 25 0 0 0-22 48z" />
        <path d="M40 84h60M60 98h80M30 112h50M96 112h30" />
      </>
    )
  else if (soort === 'wolk' || soort === 'mist')
    inhoud = (
      <>
        <circle cx="120" cy="34" r="14" />
        <path d="M120 10v-6M144 34h6M137 17l4-4M103 17l-4-4M20 70h140M40 84h110M10 98h120M50 112h100" />
      </>
    )
  else if (soort === 'zon')
    inhoud = (
      <>
        <circle cx="110" cy="46" r="20" />
        <path d="M110 12v-8M110 88v-8M76 46h-8M152 46h-8M86 22l-6-6M134 22l6-6M86 70l-6 6M134 70l6 6" />
      </>
    )
  else inhoud = <path d="M50 70h80a22 22 0 0 0 3-43.8A32 32 0 0 0 72 22a25 25 0 0 0-22 48z" />
  return (
    <svg className="weerkop__lucht" viewBox="0 0 170 150" aria-hidden="true">
      {inhoud}
    </svg>
  )
}

// ---------- De berg als grafiek ----------

const Y = (h: number) => 262 - (h - 1500) * (240 / 2200)
const PUNT: Record<string, [number, number]> = { gletsjer: [104, Y(3400)], midden: [160, Y(2600)], dorp: [198, Y(1650)] }

interface Stand {
  loc: WeerLocatie
  uur: WeerUur
}

/** Voor vandaag: het uur van nu. Voor morgen: 12 uur. */
function standVan(loc: WeerLocatie | undefined, datum: string, nu: Date | null): Stand | null {
  if (!loc) return null
  const sleutel = `${datum}T${nu ? tijdUUMM(nu).slice(0, 2) : '12'}:00`
  const uur = loc.uren.find((u) => u.tijd === sleutel)
  return uur ? { loc, uur } : null
}

function Doorsnede({ locaties, datum, nu }: { locaties: (WeerLocatie | undefined)[]; datum: string; nu: Date | null }) {
  const standen = locaties.map((l) => standVan(l, datum, nu)).filter((s): s is Stand => !!s)
  const boven = standen.find((s) => s.loc.id === 'gletsjer')
  const mid = standen.find((s) => s.loc.id === 'midden')
  const dag = boven?.loc.dagen.find((d) => d.datum === datum)
  const nulgraden = boven?.uur.nulgraden ?? dag?.nulgraden ?? null
  const vers = Math.round(versSneeuw(boven?.loc, datum))
  const isDag = nu ? +tijdUUMM(nu).slice(0, 2) >= 7 && +tijdUUMM(nu).slice(0, 2) < 19 : true
  // Wolk: halverwege in de mist terwijl het boven helder is
  const wolk = !!mid && !!boven && (mid.uur.zicht ?? 99_999) < 1000 && (boven.uur.zicht ?? 0) >= 5000
  const sneeuwt = (boven?.uur.sneeuw ?? 0) >= 0.2
  const waait = (boven?.uur.stoten ?? 0) >= 60

  const omtrek = `M0 262 L0 200 L22 160 L40 120 L58 70 L72 ${Y(3600)} L88 46 L104 ${Y(3400)} L124 66 L138 100 L150 128 L160 ${Y(2600)} L172 170 L182 205 L192 236 L198 ${Y(1650)} L212 252 L212 262 Z`
  const schaduw = `M0 262 L0 200 L22 160 L40 120 L58 70 L72 ${Y(3600)} L64 96 L50 150 L34 205 L24 262 Z`
  const dik = Math.min(9, 2 + vers / 4)
  const label = `Doorsnede van de berg, ${nu ? 'nu' : 'morgen om 12 uur'}. ${standen
    .map((s) => `${s.loc.naam} ${s.loc.hoogte} meter: ${graden(s.uur.temp)}, ${weerTekst(s.uur.code, isDag).toLowerCase()}, wind ${Math.round(s.uur.wind)} kilometer per uur`)
    .join('. ')}.${nulgraden ? ` Nulgradengrens ${nulgraden} meter.` : ''}`

  return (
    <section className="weer__blok" aria-labelledby="h-doorsnede">
      <h2 id="h-doorsnede" className="weer__kop">
        Van dorp tot gletsjer <small>{nu ? `nu, ${tijdUUMM(nu)}` : 'morgen, 12:00'}</small>
      </h2>
      <div className="doorsnede">
        <svg className="doorsnede__berg" viewBox="0 0 358 280" role="img" aria-label={label}>
          {!isDag ? (
            <path className="teken" d="M196 30a12 12 0 0 1-15-15 12 12 0 1 0 15 15z" />
          ) : sneeuwt ? (
            <g className="vlokjes">
              {[
                [30, 30],
                [120, 22],
                [170, 60],
                [150, 20],
                [96, 10],
                [186, 30],
                [48, 12],
              ].map(([x, y], i) => (
                <path key={i} style={{ animationDelay: `${-i * 0.8}s` }} d={`M${x} ${y - 4}v8M${x - 3.5} ${y - 2}l7 4M${x - 3.5} ${y + 2}l7-4`} />
              ))}
            </g>
          ) : waait ? (
            <g className="strepen">
              {['M80 18h40', 'M110 34h50', 'M20 28h34', 'M140 70h44', 'M90 6h30'].map((d, i) => (
                <path key={i} d={d} style={{ animationDelay: `${-i * 0.35}s` }} />
              ))}
            </g>
          ) : (boven?.uur.code ?? 3) <= 2 || wolk ? (
            <>
              <circle className="teken" cx="176" cy="34" r="10" />
              <path className="teken" d="M176 16v-5M176 57v-5M158 34h-5M199 34h-5M163 21l-3-3M189 21l3-3M163 47l-3 3M189 47l3 3" />
            </>
          ) : null}
          <path className="lichaam" d={omtrek} />
          <path className="schaduw" d={schaduw} />
          {vers >= 1 && (
            <>
              <path
                className="vers"
                d={`M52 84 L58 ${70 - dik} L72 ${Y(3600) - dik} L88 ${46 - dik} L104 ${Y(3400) - dik} L124 ${66 - dik} L138 ${100 - dik * 0.6} L138 100 L124 66 L104 ${Y(3400)} L88 46 L72 ${Y(3600)} L58 70 Z`}
              />
              <text className="verstekst" x="0" y="22">
                +{vers} cm
              </text>
              <path className="teken" d={`M30 26 L62 ${Y(3600) - dik + 4}`} />
            </>
          )}
          {wolk && (
            <g className="wolk">
              <rect className="wolk__vlak" x="-8" y={Y(2950)} width="228" height={Y(2200) - Y(2950)} rx="18" />
              <path d={`M4 ${Y(2850)}h150M22 ${Y(2700)}h120M4 ${Y(2550)}h150M22 ${Y(2400)}h90`} />
              <text className="wolk__tekst" x="6" y={Y(2200) - 8}>
                Wolk rond 2600 m
              </text>
            </g>
          )}
          {nulgraden != null &&
            (nulgraden >= 1650 && nulgraden <= 3700 ? (
              <>
                <path className="nul" d={`M0 ${Y(nulgraden)} H212`} />
                <text className="nultekst" x="2" y={Y(nulgraden) - 5}>
                  0° · {meters(Math.round(nulgraden / 50) * 50)}
                </text>
              </>
            ) : nulgraden < 1650 ? (
              <>
                <path className="nul" d="M0 258 H212" />
                <text className="nultekst" x="2" y="253">
                  0° lager dan het dorp
                </text>
              </>
            ) : null)}
          {standen.map((s) => {
            const [x, y] = PUNT[s.loc.id] ?? [0, 0]
            return (
              <g key={s.loc.id}>
                <path className="leider" d={`M${x + 5} ${y} H222`} />
                <circle className="punt" cx={x} cy={y} r="4.5" />
              </g>
            )
          })}
        </svg>
        {standen.map((s) => {
          const y = PUNT[s.loc.id]?.[1] ?? 0
          const stoten = Math.round(s.uur.stoten ?? 0)
          return (
            <div key={s.loc.id} className={`hoogte${stoten >= 70 ? ' is-hard' : ''}`} style={{ top: `${(y / 280) * 100}%` }} aria-hidden="true">
              <p className="hoogte__naam">
                {s.loc.naam} · {s.loc.hoogte} m
              </p>
              <WeerIcoon naam={weerSoort(s.uur.code, isDag)} grootte={30} />
              <p className="hoogte__temp">{graden(s.uur.temp)}</p>
              <p className="hoogte__wind">
                <b>{Math.round(s.uur.wind)} km/u</b>
                {stoten >= 50
                  ? ` · stoten ${stoten}`
                  : s.uur.zicht != null && s.uur.zicht < 1000
                    ? ` · zicht ${zichtTekst(s.uur.zicht)}`
                    : s.uur.gevoel != null
                      ? ` · gevoel ${graden(s.uur.gevoel)}`
                      : ''}
              </p>
            </div>
          )
        })}
      </div>
      <p className="doorsnede__legenda">
        {nulgraden == null
          ? ''
          : nulgraden < 1650
            ? `0°-grens op ${meters(Math.round(nulgraden / 50) * 50)}: het vriest overal, ook in het dorp.`
            : nulgraden > 3700
              ? `0°-grens op ${meters(Math.round(nulgraden / 50) * 50)}: het dooit tot boven op de gletsjer.`
              : 'Rode stippellijn: daarboven vriest het.'}
        {wolk && ' Halverwege zit je in de wolk; boven en beneden is het zicht goed.'}
      </p>
    </section>
  )
}

// ---------- Wat telt ----------

function Rij({ icoon, titel, uitleg, waarde, onder, soort }: { icoon: Parameters<typeof WeerIcoon>[0]['naam']; titel: string; uitleg: ReactNode; waarde: ReactNode; onder?: ReactNode; soort?: 'let' | 'goed' }) {
  return (
    <div className={soort ? `is-${soort}` : undefined}>
      <WeerIcoon naam={icoon} grootte={26} />
      <dt>
        {titel}
        <small>{uitleg}</small>
      </dt>
      <dd>
        {waarde}
        {onder && <small>{onder}</small>}
      </dd>
    </div>
  )
}

function WatTelt({ gletsjer, midden, dorp, datum }: { gletsjer: WeerLocatie; midden?: WeerLocatie; dorp: WeerLocatie; datum: string }) {
  const dagUren = urenVan(gletsjer, datum, 9, 17)
  const vers = versSneeuw(gletsjer, datum)
  const versDorp = versSneeuw(dorp, datum)
  const wind = Math.round(Math.max(...dagUren.map((u) => u.wind)))
  const stoten = Math.round(Math.max(...dagUren.map((u) => u.stoten ?? 0)))
  const richting = dagUren.find((u) => u.richting != null)?.richting
  // Zicht: het slechtste stuk van de dag, op de plek waar het het slechtst is
  const zichten = [midden, gletsjer]
    .flatMap((l) => urenVan(l, datum, 9, 17).map((u) => ({ plek: l!.naam.toLowerCase(), z: u.zicht, uur: +u.tijd.slice(11, 13) })))
    .filter((x): x is { plek: string; z: number; uur: number } => typeof x.z === 'number')
  const slechtst = zichten.length ? zichten.reduce((a, b) => (b.z < a.z ? b : a)) : null
  const dag = gletsjer.dagen.find((d) => d.datum === datum)
  const dagDorp = dorp.dagen.find((d) => d.datum === datum)

  return (
    <section className="weer__blok" aria-labelledby="h-telt">
      <h2 id="h-telt" className="weer__kop">
        Wat telt
      </h2>
      <dl className="telt">
        <Rij
          icoon="vlok"
          titel="Verse sneeuw"
          uitleg="sinds gistermiddag, gletsjer"
          waarde={cm(vers)}
          onder={`dorp ${cm(versDorp)}`}
          soort={vers >= 15 ? 'goed' : undefined}
        />
        <Rij
          icoon="wind"
          titel="Wind boven"
          uitleg={`gletsjer${richting != null ? `, uit het ${windstreek(richting)}` : ''}, 9–17 uur`}
          waarde={`${wind} km/u`}
          onder={stoten ? `stoten ${stoten}` : undefined}
          soort={stoten >= 70 ? 'let' : undefined}
        />
        {slechtst && (
          <Rij
            icoon="zicht"
            titel="Zicht"
            uitleg={`slechtst: ${slechtst.plek}, rond ${slechtst.uur} uur`}
            waarde={zichtTekst(slechtst.z)}
            soort={slechtst.z < 1000 ? 'let' : undefined}
          />
        )}
        {dag?.nulgraden != null && (
          <Rij
            icoon="nulgraden"
            titel="Nulgradengrens"
            uitleg={dag.nulgraden < 1650 ? 'lager dan het dorp' : 'daarboven vriest het'}
            waarde={meters(dag.nulgraden)}
          />
        )}
        {dag && (
          <Rij
            icoon="zonop"
            titel="Zon"
            uitleg={dagDorp?.zonOp && dagDorp.zonOnder ? `op ${dagDorp.zonOp.slice(11)} · onder ${dagDorp.zonOnder.slice(11)}` : 'boven op de berg'}
            waarde={`${Math.round(dag.zonUren)} uur`}
          />
        )}
      </dl>
    </section>
  )
}

// ---------- Per uur ----------

function PerUur({ gletsjer, dorp, datum, avond }: { gletsjer: WeerLocatie; dorp: WeerLocatie; datum: string; avond: boolean }) {
  const g = urenVan(gletsjer, datum, 8, 18)
  const d = urenVan(dorp, datum, 8, 18)
  if (g.length < 6 || d.length !== g.length) return null
  const B = 358
  const kol = B / g.length
  const temps = [...g, ...d].map((u) => u.temp)
  const min = Math.min(...temps) - 1
  const max = Math.max(...temps) + 1
  const ty = (t: number) => 46 + (1 - (t - min) / (max - min)) * 64
  const x = (i: number) => kol * i + kol / 2
  const lijn = (uren: WeerUur[]) => uren.map((u, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${ty(u.temp).toFixed(1)}`).join('')
  const sneeuwMax = Math.max(1, ...g.map((u) => u.sneeuw))
  const beschrijving = g
    .map((u, i) => `${+u.tijd.slice(11, 13)} uur: gletsjer ${graden(u.temp)}, ${weerTekst(u.code).toLowerCase()}, wind ${Math.round(u.wind)}; dorp ${graden(d[i].temp)}`)
    .join('. ')
  // Dorp is meestal warmer (hoger in de grafiek): dorpcijfers erboven, gletsjercijfers eronder

  return (
    <section className="weer__blok" aria-labelledby="h-uren">
      <h2 id="h-uren" className="weer__kop">
        {avond ? 'Morgen per uur' : 'Vandaag per uur'}
      </h2>
      <svg className="uren" viewBox={`0 0 ${B} 194`} role="img" aria-label={`${avond ? 'Morgen' : 'Vandaag'} per uur. ${beschrijving}.`}>
        <path className="uren__raster" d={`M0 156H${B}`} />
        {g.map((u, i) => (
          <g key={u.tijd} transform={`translate(${(x(i) - 11).toFixed(1)} 4)`}>
            <WeerIcoon naam={weerSoort(u.code)} grootte={22} />
          </g>
        ))}
        <path className="uren__dorp" d={lijn(d)} />
        <path className="uren__gletsjer" d={lijn(g)} />
        {g.map((u, i) => (
          <text key={`g${i}`} className="uren__tg" x={x(i)} y={ty(u.temp) + 17} textAnchor="middle">
            {graden(u.temp)}
          </text>
        ))}
        {d.map((u, i) =>
          i % 2 ? null : (
            <text key={`d${i}`} className="uren__td" x={x(i)} y={ty(u.temp) - 7} textAnchor="middle">
              {graden(u.temp)}
            </text>
          ),
        )}
        {g.map((u, i) =>
          u.sneeuw >= 0.1 ? (
            <rect key={`s${i}`} className="uren__sneeuw" x={x(i) - 7} y={156 - (u.sneeuw / sneeuwMax) * 30} width="14" height={(u.sneeuw / sneeuwMax) * 30} rx="1" />
          ) : null,
        )}
        {g.map((u, i) => (
          <text key={`w${i}`} className={`uren__wind${(u.stoten ?? 0) >= 60 ? ' is-hard' : ''}`} x={x(i)} y="172" textAnchor="middle">
            {Math.round(u.wind)}
          </text>
        ))}
        {g.map((u, i) => (
          <text key={`u${i}`} className="uren__as" x={x(i)} y="190" textAnchor="middle">
            {+u.tijd.slice(11, 13)}u
          </text>
        ))}
      </svg>
      <p className="uren__legenda">
        <span>
          <i /> gletsjer 3400 m
        </span>
        <span>
          <i className="d" /> dorp 1650 m
        </span>
        <span>balkjes: sneeuw per uur</span>
        <span>onderste rij: wind boven (km/u)</span>
      </p>
    </section>
  )
}

// ---------- Lawinerisico: alleen verwijzen naar de officiële bron ----------

function Lawine() {
  return (
    <section className="weer__blok" aria-labelledby="h-lawine">
      <h2 id="h-lawine" className="weer__kop">
        Lawinerisico <small>buiten de pistes</small>
      </h2>
      <div className="lawine">
        <p>
          Het officiële lawinebulletin (BERA) van Météo-France voor het massief Oisans, waar Les Deux Alpes onder valt, verschijnt elke dag rond 16
          uur voor de volgende dag. Het risico staat op de Europese schaal van 1 (laag) tot 5 (zeer groot).
        </p>
        <p className="lawine__klein">Het bulletin gaat over terrein buiten de pistes. Op de open pistes zorgt het skigebied voor de veiligheid.</p>
        <a href={config.weer.lawineUrl} target="_blank" rel="noopener noreferrer">
          Lees het bulletin <WeerIcoon naam="link" grootte={18} />
          <span className="verborgen"> (Météo-France, opent in een nieuw venster)</span>
        </a>
      </div>
    </section>
  )
}

// ---------- De reis (of de komende dagen) ----------

function Dagen({ gletsjer, dorp, vandaag, reisdagen, voorVertrek }: { gletsjer: WeerLocatie; dorp: WeerLocatie; vandaag: string; reisdagen: string[]; voorVertrek: boolean }) {
  const inVerwachting = new Set(gletsjer.dagen.map((d) => d.datum))
  const reisInBeeld = reisdagen.some((d) => d >= vandaag && inVerwachting.has(d))
  const toonReis = reisdagen.length > 0 && (reisInBeeld || !voorVertrek) && reisdagen[reisdagen.length - 1] >= vandaag
  const data = toonReis ? reisdagen : gletsjer.dagen.map((d) => d.datum).filter((d) => d > vandaag).slice(0, 7)
  const oud = geweest()
  const verste = gletsjer.dagen[gletsjer.dagen.length - 1]?.datum

  return (
    <section className="weer__blok" aria-labelledby="h-dagen">
      <h2 id="h-dagen" className="weer__kop">
        {toonReis ? 'De hele reis' : 'Komende dagen'} <small>gletsjer / dorp</small>
      </h2>
      <ol className="dagen">
        {data.map((datum, i) => {
          const verschil = Math.round((new Date(`${datum}T12:00:00Z`).getTime() - new Date(`${vandaag}T12:00:00Z`).getTime()) / 864e5)
          const g = gletsjer.dagen.find((d) => d.datum === datum)
          const d = dorp.dagen.find((x) => x.datum === datum)
          const voorbij = datum < vandaag
          const was = voorbij ? oud[datum] : undefined
          const waarden = was
            ? { code: was.code, boven: was.boven, dorp: was.dorp, vers: was.vers, wind: was.wind }
            : g && d && !voorbij
              ? { code: g.code, boven: g.tMax, dorp: d.tMax, vers: versSneeuw(gletsjer, datum), wind: g.wind }
              : null
          const status = verschil === 0 ? 'vandaag' : verschil === 1 ? 'morgen' : voorbij ? 'geweest' : toonReis && i === 0 ? 'bus heen' : toonReis && i === data.length - 1 ? 'bus terug' : verschil > 5 ? 'onzeker' : ''
          const klas = verschil === 0 ? 'is-vandaag' : voorbij ? 'is-geweest' : verschil > 5 ? 'is-onzeker' : ''
          return (
            <li key={datum} className={klas}>
              <span className="dagen__dag">
                {datumLabel(datum, 'kort')}
                {status && <small>{status}</small>}
              </span>
              {waarden ? (
                <>
                  <WeerIcoon naam={weerSoort(waarden.code)} label={weerTekst(waarden.code)} grootte={26} />
                  <span className="dagen__temp">
                    {graden(waarden.boven)} <span>/ {graden(waarden.dorp)}</span>
                  </span>
                  <span className={`dagen__vers${waarden.vers >= 0.5 ? '' : ' is-leeg'}`}>
                    <i style={{ width: `${Math.max(2, Math.min(80, waarden.vers * 2.4))}px` }} />
                    {waarden.vers >= 0.5 ? cm(waarden.vers) : '–'}
                    <span className="verborgen"> verse sneeuw</span>
                  </span>
                  <span className="dagen__wind">
                    {Math.round(waarden.wind)}
                    <span className="verborgen"> km/u wind boven</span>
                  </span>
                </>
              ) : (
                <span className="dagen__leeg">{voorbij ? 'niet bewaard' : verste && datum > verste ? 'nog te ver weg' : '–'}</span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="dagen__noot">
        {toonReis
          ? 'Hoe verder weg, hoe onzekerder; die dagen staan lichter. Bij voorbije dagen staat wat de verwachting die dag zelf zei.'
          : 'Een verwachting gaat ongeveer 16 dagen vooruit. Vanaf eind februari staat hier de reis.'}{' '}
        Rechts: wind boven in km/u.
      </p>
    </section>
  )
}
