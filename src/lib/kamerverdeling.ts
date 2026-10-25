import type { RealtimeChannel } from '@supabase/supabase-js'
import { abonneerBackend, backendIngesteld, backendStand, stuurProfiel, supabase } from './backend'
import { normaliseerKamers, zetServerKamers } from './data'
import { lees, schrijfEnMeld } from './opslag'

/*
 * Kamerverdeling op de server (tabel kamerverdeling, migratie 0008). De reisleiding slaat de
 * verdeling op vanuit "Kamerverdeling maken"; elke telefoon haalt hem op (en ververst live) en
 * bewaart hem voor gebruik zonder internet. Zolang er geen verdeling op de server staat, of de
 * tabel nog niet bestaat, blijft kamers.json gelden.
 */

/** Wie de verdeling op de server het laatst opsloeg en wanneer (zodat twee reisleiders elkaar niet overschrijven) */
export interface ServerVersie {
  door: string | null
  bijgewerkt: string
}

/** Bewaard als 'kamers.server.versie'; te volgen met useOpgeslagen */
export const SERVER_VERSIE = 'kamers.server.versie'

const zetVersie = (v: ServerVersie | null) => {
  if (JSON.stringify(v) !== JSON.stringify(lees(SERVER_VERSIE, null))) schrijfEnMeld(SERVER_VERSIE, v)
}

let bezig = false

async function haalOp() {
  const cb = supabase()
  if (!cb || bezig || backendStand().status !== 'verbonden') return
  bezig = true
  try {
    const c = await cb
    const { data, error } = await c.from('kamerverdeling').select('data, door, bijgewerkt').eq('id', 1).maybeSingle()
    if (error) return // bijv. migratie 0008 nog niet gedraaid: dan blijft kamers.json gelden
    zetServerKamers(data ? normaliseerKamers(data.data) : null)
    zetVersie(data ? { door: data.door, bijgewerkt: data.bijgewerkt } : null)
    // De kamer van deze deelnemer kan veranderd zijn: opnieuw doorgeven (voor het klassement per kamer)
    void stuurProfiel()
  } finally {
    bezig = false
  }
}

const tabelOntbreekt = (e: { code?: string; message?: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|does not exist/i.test(e.message ?? '')

export type OpslaanResultaat =
  | { fout: string }
  /** Op de server staat een nieuwere verdeling dan die waar dit concept op voortbouwt */
  | { nieuwer: ServerVersie }
  | { versie: string | null }

/**
 * Slaat de verdeling op. Alleen voor ingelogde beheerders. `basis` is de serverversie waar het
 * concept op voortbouwt; heeft iemand anders intussen opgeslagen, dan wordt er niets overschreven
 * (behalve met `toch`).
 */
export async function slaKamerverdelingOp(kamers: unknown, basis: string | null, toch = false): Promise<OpslaanResultaat> {
  const cb = supabase()
  const b = backendStand()
  if (!cb || b.status !== 'verbonden') return { fout: 'Geen verbinding. Opslaan kan alleen met internet.' }
  if (!b.beheerder) return { fout: 'Alleen een ingelogde beheerder kan de kamerverdeling opslaan.' }
  const c = await cb
  if (!toch) {
    const { data: nu, error } = await c.from('kamerverdeling').select('door, bijgewerkt').eq('id', 1).maybeSingle()
    if (error && tabelOntbreekt(error)) return { fout: 'De tabel voor de kamerverdeling bestaat nog niet. Draai eerst migratie 0008 in Supabase.' }
    if (nu && nu.bijgewerkt !== basis) {
      // Eerst de nieuwe versie ophalen, zodat "overnemen" meteen de goede indeling geeft
      await haalOp()
      return { nieuwer: { door: nu.door, bijgewerkt: nu.bijgewerkt } }
    }
  }
  const { data, error } = await c
    .from('kamerverdeling')
    .upsert({ id: 1, data: kamers, door: lees<string | null>('naam', null) }, { onConflict: 'id' })
    .select('door, bijgewerkt')
    .maybeSingle()
  if (error) {
    // Tabel onbekend: migratie 0008 is nog niet gedraaid
    if (tabelOntbreekt(error)) return { fout: 'De tabel voor de kamerverdeling bestaat nog niet. Draai eerst migratie 0008 in Supabase.' }
    return { fout: `Opslaan lukte niet: ${error.message}` }
  }
  zetServerKamers(normaliseerKamers(kamers))
  zetVersie(data ? { door: data.door, bijgewerkt: data.bijgewerkt } : null)
  void stuurProfiel()
  return { versie: data?.bijgewerkt ?? null }
}

let gestart = false

/** Eén keer bij het starten van de app */
export function startKamerverdeling() {
  if (gestart || !backendIngesteld) return
  gestart = true
  let kanaal: RealtimeChannel | null = null
  let vorige = ''
  abonneerBackend(() => {
    const status = backendStand().status
    if (status === vorige) return
    vorige = status
    if (status !== 'verbonden') return
    void haalOp()
    if (!kanaal) {
      void supabase()?.then((c) => {
        if (kanaal) return
        kanaal = c
          .channel('kamerverdeling')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kamerverdeling' }, () => void haalOp())
          .subscribe()
      })
    }
  })
}
