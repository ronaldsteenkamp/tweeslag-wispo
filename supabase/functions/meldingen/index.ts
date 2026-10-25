// Edge Function `meldingen`: verstuurt Web Push-meldingen.
//
// Aanroepen (POST, JSON):
//   { soort: 'sleutel' }                       → publieke VAPID-sleutel (voor het aanmelden in de app)
//   { soort: 'test' }                          → testmelding naar je eigen apparaten (ingelogd)
//   { soort: 'bericht', titel, tekst, url? }   → bericht aan iedereen (alleen beheerders)
//   { soort: 'gepland' }                       → wat nu aan de beurt is (elke 5 minuten via pg_cron)
//
// Instellingen in Supabase: "Verify JWT" UIT. De functie controleert zelf wie er belt;
// 'gepland' verstuurt alleen wat aan de beurt is en nog niet verstuurd is, dus dat mag iedereen.
// De VAPID-sleutels maakt de functie zelf aan bij de eerste aanroep (tabel push_sleutels).

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import webpush from 'npm:web-push@3.6.7'
import { teVersturen, type GeslotenStemming, type Melding } from './planner.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
/** Waar de app (en de JSON-bestanden) staat */
const SITE = Deno.env.get('SITE_URL') ?? 'https://ronaldsteenkamp.github.io/tweeslag-wispo/'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const antwoord = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- Sleutels ----------

let sleutelCache: { publiek: string; prive: string } | null = null

async function sleutels() {
  if (sleutelCache) return sleutelCache
  let { data } = await db.from('push_sleutels').select('publiek, prive').eq('id', 1).maybeSingle()
  if (!data) {
    const k = webpush.generateVAPIDKeys()
    await db.from('push_sleutels').upsert({ id: 1, publiek: k.publicKey, prive: k.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
    ;({ data } = await db.from('push_sleutels').select('publiek, prive').eq('id', 1).single())
  }
  sleutelCache = data!
  return sleutelCache
}

// ---------- Versturen ----------

interface Abonnement {
  endpoint: string
  p256dh: string
  auth: string
}

async function verstuur(abonnementen: Abonnement[], bericht: { titel: string; tekst: string; url: string; tag?: string }) {
  const k = await sleutels()
  webpush.setVapidDetails(SITE, k.publiek, k.prive)
  const payload = JSON.stringify(bericht)
  let gelukt = 0
  const weg: string[] = []
  const fouten: string[] = []
  await Promise.all(
    abonnementen.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
          TTL: 6 * 3600,
          urgency: 'high',
        })
        gelukt++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        const tekst = String((e as { body?: string }).body ?? (e as Error).message ?? '').slice(0, 120)
        console.warn('push mislukt', code, new URL(a.endpoint).host, tekst)
        // Verlopen of afgemeld: opruimen
        if (code === 404 || code === 410) weg.push(a.endpoint)
        else fouten.push(`${code ?? 'fout'} ${tekst}`.trim().slice(0, 140))
      }
    }),
  )
  if (weg.length) await db.from('push_abonnementen').delete().in('endpoint', weg)
  return { gelukt, mislukt: abonnementen.length - gelukt, opgeruimd: weg.length, fouten: fouten.slice(0, 5) }
}

async function alleAbonnementen(): Promise<Abonnement[]> {
  const { data, error } = await db.from('push_abonnementen').select('endpoint, p256dh, auth')
  if (error) throw error
  return data ?? []
}

/** Legt de melding vast; false als hij al eerder verstuurd is */
async function claim(m: Melding): Promise<number | null> {
  const { data, error } = await db
    .from('meldingen')
    .insert({ sleutel: m.sleutel, soort: m.soort, titel: m.titel, tekst: m.tekst, url: m.url })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return null
    throw error
  }
  return data.id
}

// ---------- Wie belt er? ----------

async function gebruiker(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data.user ?? null
}

async function isBeheerder(u: { email?: string; is_anonymous?: boolean } | null) {
  if (!u?.email || u.is_anonymous) return false
  const { data } = await db.from('beheerders').select('email').eq('email', u.email.toLowerCase()).maybeSingle()
  return !!data
}

// ---------- Gepland ----------

async function json(pad: string) {
  const r = await fetch(new URL(pad, SITE), { headers: { 'Cache-Control': 'no-cache' } })
  if (!r.ok) throw new Error(`${pad}: ${r.status}`)
  return r.json()
}

async function geslotenStemmingen(nu: number): Promise<GeslotenStemming[]> {
  const vanaf = new Date(nu - 3 * 3600_000).toISOString()
  const { data: st, error } = await db
    .from('stemmingen')
    .select('id, vraag, sluit')
    .lte('sluit', new Date(nu).toISOString())
    .gt('sluit', vanaf)
    // Teststemmingen (testperiode vóór de reis, id 'test-…') geven geen melding
    .not('id', 'like', 'test-%')
  if (error) throw error
  if (!st?.length) return []
  const { data: stemmen, error: e2 } = await db
    .from('stemmen')
    .select('stemming_id, kandidaat')
    .in('stemming_id', st.map((s) => s.id))
  if (e2) throw e2
  return st.map((s) => {
    const telling = new Map<string, number>()
    for (const v of stemmen ?? []) if (v.stemming_id === s.id) telling.set(v.kandidaat, (telling.get(v.kandidaat) ?? 0) + 1)
    return { ...s, uitslag: [...telling].map(([kandidaat, n]) => ({ kandidaat, stemmen: n })) }
  })
}

async function gepland() {
  const nu = Date.now()
  const [planning, spel, stemmingen] = await Promise.all([
    json('data/planning.json').catch(() => ({})),
    json('data/spel.json').catch(() => ({})),
    geslotenStemmingen(nu),
  ])
  const lijst = teVersturen(nu, planning, spel, stemmingen)
  if (!lijst.length) return { verstuurd: [] }
  const abonnementen = await alleAbonnementen()
  const verstuurd = []
  for (const m of lijst) {
    const id = await claim(m)
    if (id === null) continue
    const r = await verstuur(abonnementen, { titel: m.titel, tekst: m.tekst, url: m.url, tag: m.sleutel })
    await db.from('meldingen').update({ aantal: r.gelukt }).eq('id', id)
    verstuurd.push({ sleutel: m.sleutel, ...r })
  }
  return { verstuurd }
}

// ---------- Ingang ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return antwoord({ fout: 'Alleen POST' }, 405)
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // leeg = 'gepland'
  }
  try {
    switch (body.soort ?? 'gepland') {
      case 'sleutel':
        return antwoord({ publiek: (await sleutels()).publiek })

      case 'gepland':
        return antwoord(await gepland())

      case 'test': {
        const u = await gebruiker(req)
        if (!u) return antwoord({ fout: 'niet ingelogd' }, 401)
        const { data, error } = await db.from('push_abonnementen').select('endpoint, p256dh, auth').eq('user_id', u.id)
        if (error) throw error
        if (!data?.length) return antwoord({ fout: 'geen_abonnement' }, 404)
        const r = await verstuur(data, {
          titel: '❄️ Het werkt!',
          tekst: 'Je krijgt nu meldingen van de Tweeslag Wispo-app.',
          url: '#home',
          tag: `test-${Date.now()}`,
        })
        console.log('testmelding', u.id.slice(-6), JSON.stringify(r))
        return antwoord(r)
      }

      case 'bericht': {
        const u = await gebruiker(req)
        if (!(await isBeheerder(u))) return antwoord({ fout: 'geen_beheerder' }, 403)
        const titel = String(body.titel ?? '').trim().slice(0, 60)
        const tekst = String(body.tekst ?? '').trim().slice(0, 300)
        const url = /^#[a-z]+$/.test(String(body.url ?? '')) ? String(body.url) : '#home'
        if (!titel) return antwoord({ fout: 'titel ontbreekt' }, 400)
        const { data: rij, error } = await db
          .from('meldingen')
          .insert({ soort: 'bericht', titel, tekst, url, door: u!.id })
          .select('id')
          .single()
        if (error) throw error
        const r = await verstuur(await alleAbonnementen(), { titel, tekst, url, tag: `bericht-${rij.id}` })
        await db.from('meldingen').update({ aantal: r.gelukt }).eq('id', rij.id)
        return antwoord(r)
      }

      default:
        return antwoord({ fout: 'onbekende soort' }, 400)
    }
  } catch (e) {
    console.error(e)
    return antwoord({ fout: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) }, 500)
  }
})
