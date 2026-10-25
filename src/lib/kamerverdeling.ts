import type { RealtimeChannel } from '@supabase/supabase-js'
import { abonneerBackend, backendIngesteld, backendStand, stuurProfiel, supabase } from './backend'
import { normaliseerKamers, zetServerKamers } from './data'
import { lees } from './opslag'

/*
 * Kamerverdeling op de server (tabel kamerverdeling, migratie 0008). De reisleiding slaat de
 * verdeling op vanuit "Kamerverdeling maken"; elke telefoon haalt hem op (en ververst live) en
 * bewaart hem voor gebruik zonder internet. Zolang er geen verdeling op de server staat, of de
 * tabel nog niet bestaat, blijft kamers.json gelden.
 */

let bezig = false

async function haalOp() {
  const cb = supabase()
  if (!cb || bezig || backendStand().status !== 'verbonden') return
  bezig = true
  try {
    const c = await cb
    const { data, error } = await c.from('kamerverdeling').select('data').eq('id', 1).maybeSingle()
    if (error) return // bijv. migratie 0008 nog niet gedraaid: dan blijft kamers.json gelden
    zetServerKamers(data ? normaliseerKamers(data.data) : null)
    // De kamer van deze deelnemer kan veranderd zijn: opnieuw doorgeven (voor het klassement per kamer)
    void stuurProfiel()
  } finally {
    bezig = false
  }
}

/** Slaat de verdeling op. Alleen voor ingelogde beheerders; geeft een foutmelding of null. */
export async function slaKamerverdelingOp(kamers: unknown): Promise<string | null> {
  const cb = supabase()
  const b = backendStand()
  if (!cb || b.status !== 'verbonden') return 'Geen verbinding. Opslaan kan alleen met internet.'
  if (!b.beheerder) return 'Alleen een ingelogde beheerder kan de kamerverdeling opslaan.'
  const c = await cb
  const { error } = await c
    .from('kamerverdeling')
    .upsert({ id: 1, data: kamers, door: lees<string | null>('naam', null) }, { onConflict: 'id' })
  if (error) {
    // Tabel onbekend: migratie 0008 is nog niet gedraaid
    if (error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message ?? ''))
      return 'De tabel voor de kamerverdeling bestaat nog niet. Draai eerst migratie 0008 in Supabase.'
    return `Opslaan lukte niet: ${error.message}`
  }
  zetServerKamers(normaliseerKamers(kamers))
  void stuurProfiel()
  return null
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
