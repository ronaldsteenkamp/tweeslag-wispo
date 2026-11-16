import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback } from 'react'
import { abonneerBackend, backendIngesteld, backendStand, supabase } from './backend'
import { kamerNaamVan, MAX_KAMERNAAM, type KamernaamRij } from './kamernaamregels'
import { lees, schrijfEnMeld, useOpgeslagen } from './opslag'

/*
 * Eigen namen van kamers (tabel kamernamen, migratie 0013). De bewoners van een kamer kunnen de
 * naam aanpassen; die staat dan overal in de app in plaats van de naam uit de kamerverdeling.
 * Net als bij bijnamen: alle namen worden lokaal bewaard ('kamernamen.cache'), zodat ze ook
 * zonder bereik kloppen. Aanpassen kan alleen met internet (de server controleert wie het mag).
 */

const CACHE = 'kamernamen.cache'

const cacheRijen = () => lees<KamernaamRij[]>(CACHE, [])

/** De eigen namen zoals nu bekend (voor de controle bij het aanpassen) */
export function useEigenKamernamen(): KamernaamRij[] {
  const [rijen] = useOpgeslagen<KamernaamRij[]>(CACHE, [])
  return rijen
}

/** Naam van een kamer zoals hij in beeld komt; het scherm ververst als er een naam verandert */
export function useKamerNaam(): (k: { nummer: string; naam?: string }) => string | undefined {
  const rijen = useEigenKamernamen()
  return useCallback((k) => kamerNaamVan(k, rijen), [rijen])
}

const tabelOntbreekt = (e: { code?: string; message?: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|does not exist/i.test(e.message ?? '')

// ---------- Ophalen ----------

let ophalen: Promise<void> | null = null

export function haalKamernamen(): Promise<void> {
  ophalen ??= haalNu().finally(() => {
    ophalen = null
  })
  return ophalen
}

async function haalNu() {
  const cb = supabase()
  if (!cb || backendStand().status !== 'verbonden') return
  try {
    const c = await cb
    const { data, error } = await c.from('kamernamen').select('nummer, naam')
    if (error) throw error
    const rijen = ((data ?? []) as KamernaamRij[]).sort((a, b) => a.nummer.localeCompare(b.nummer))
    if (JSON.stringify(rijen) !== JSON.stringify(cacheRijen())) schrijfEnMeld(CACHE, rijen)
  } catch {
    // Dan blijven de bewaarde namen staan (bijv. als migratie 0013 nog niet gedraaid is)
  }
}

// ---------- Aanpassen ----------

/**
 * De naam van je eigen kamer aanpassen (leeg = terug naar de naam van de reisleiding).
 * Geeft een foutmelding, of null als het gelukt is.
 */
export async function slaKamernaamOp(nummer: string, naam: string): Promise<string | null> {
  if (!backendIngesteld) return 'Aanpassen kan alleen met de server, en die is in deze versie niet ingesteld.'
  const cb = supabase()
  const b = backendStand()
  if (!cb || b.status !== 'verbonden') return 'Geen verbinding. Aanpassen kan alleen met internet.'
  if (!b.gekoppeld) return 'Je naam is nog niet doorgegeven aan de server. Probeer het zo opnieuw.'
  if (b.gekoppeld.kamer !== nummer) return 'Alleen de bewoners van deze kamer kunnen de naam aanpassen.'
  const n = naam.trim().slice(0, MAX_KAMERNAAM)
  const c = await cb
  // Delete geeft geen fout als de regels het tegenhouden: dan teruglezen wat er nu staat
  const { error } = n
    ? await c.from('kamernamen').upsert({ nummer, naam: n }, { onConflict: 'nummer' })
    : await c.from('kamernamen').delete().eq('nummer', nummer)
  if (error) {
    if (error.code === '23505') return 'Een andere kamer heet al zo. Kies een andere naam.'
    if (tabelOntbreekt(error)) return 'Kamernamen aanpassen kan nog niet: migratie 0013 is nog niet gedraaid.'
    if (error.code === '42501') return 'Alleen de bewoners van deze kamer kunnen de naam aanpassen.'
    return `Opslaan lukte niet: ${error.message}`
  }
  // Meteen zichtbaar, ook voordat de server het live doorgeeft
  const zonder = cacheRijen().filter((r) => r.nummer !== nummer)
  schrijfEnMeld<KamernaamRij[]>(CACHE, n ? [...zonder, { nummer, naam: n }].sort((a, b) => a.nummer.localeCompare(b.nummer)) : zonder)
  void haalKamernamen()
  return null
}

// ---------- Starten ----------

let gestart = false

/** Eén keer bij het starten van de app */
export function startKamernamen() {
  if (gestart || !backendIngesteld) return
  gestart = true
  let kanaal: RealtimeChannel | null = null
  let vorige = ''
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void haalKamernamen()
  })
  abonneerBackend(() => {
    const status = backendStand().status
    if (status === vorige) return
    vorige = status
    if (status !== 'verbonden') return
    void haalKamernamen()
    // Live: een nieuwe naam staat meteen bij iedereen
    if (!kanaal) {
      void supabase()?.then((c) => {
        if (kanaal) return
        kanaal = c
          .channel('kamernamen')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kamernamen' }, () => void haalKamernamen())
          .subscribe()
      })
    }
  })
}
