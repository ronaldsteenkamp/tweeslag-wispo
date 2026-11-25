// Edge Function 'lawine': het officiële lawinebulletin (BERA) van Météo-France voor het massief Oisans,
// waar Les Deux Alpes onder valt. Haalt het XML-bestand op met de API-sleutel en geeft het ongewijzigd
// door aan de app; de app leest het zelf uit (src/lib/lawine.ts). De sleutel blijft zo op de server.
//
// Sleutel: geheim METEOFRANCE_APIKEY (Edge Functions → Secrets), een "API Key" van het API-portaal van
// Météo-France met een abonnement op "Données Publiques BRA" (gratis, Licence Ouverte, bron: Météo-France).
//
// Online zetten: Edge Functions → Deploy a new function → Via Editor, naam `lawine`, dit bestand als
// index.ts. "Verify JWT" mag aan blijven: de app stuurt de anon key mee.
//
// Aanroep: POST (of GET) zonder body. Antwoord: { xml, opgehaald, samenvattingNl } of { geen: true }
// buiten het seizoen of { fout } als het niet lukt. Het bulletin verschijnt één keer per dag rond 16 uur;
// de functie onthoudt het 20 minuten, zodat Météo-France niet bij elke opening van de app een verzoek krijgt.
//
// Vertaling: de Franse samenvatting (<RESUME>) wordt één keer per nieuwe tekst naar het Nederlands
// vertaald met de gratis dienst MyMemory (geen sleutel) en bewaard in de tabel lawine_vertalingen
// (migratie 0023). Lukt dat niet, dan is samenvattingNl null en toont de app het Frans.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const SLEUTEL = Deno.env.get('METEOFRANCE_APIKEY')
/** Oisans in de lijst van Météo-France (/liste-massifs) */
const MASSIEF = 15
const BRON = `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA?id-massif=${MASSIEF}&format=xml`
const VERS_MS = 20 * 60 * 1000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

let geheugen: { xml: string; opgehaald: number; samenvattingNl: string | null } | null = null

// ---------- Vertalen ----------

/** De Franse samenvatting uit het bulletin (met of zonder CDATA) */
function samenvatting(xml: string): string {
  const m = xml.match(/<RESUME>([\s\S]*?)<\/RESUME>/)
  if (!m) return ''
  const c = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (c ? c[1] : m[1]).replace(/\r\n/g, '\n').trim()
}

async function sha256(tekst: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Eén stuk tekst (hooguit 500 bytes) via MyMemory; null als het niet lukt */
async function vertaalStuk(stuk: string): Promise<string | null> {
  const u = `https://api.mymemory.translated.net/get?langpair=fr|nl&q=${encodeURIComponent(stuk)}`
  const r = await fetch(u)
  if (!r.ok) return null
  const j = await r.json()
  const nl = String(j?.responseData?.translatedText ?? '').trim()
  // Bij een overschreden daglimiet of een fout geeft MyMemory een waarschuwing als 'vertaling'
  if (Number(j?.responseStatus) !== 200 || !nl || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(nl)) return null
  return nl
}

/** In stukken van hooguit ~450 bytes, op regels en zinnen (MyMemory neemt maximaal 500 bytes) */
function stukken(regel: string): string[] {
  if (new TextEncoder().encode(regel).length <= 450) return [regel]
  const uit: string[] = []
  let huidig = ''
  for (const zin of regel.split(/(?<=[.!?;])\s+/)) {
    const samen = huidig ? `${huidig} ${zin}` : zin
    if (huidig && new TextEncoder().encode(samen).length > 450) {
      uit.push(huidig)
      huidig = zin
    } else huidig = samen
  }
  if (huidig) uit.push(huidig)
  return uit
}

/** Nederlandse vertaling van de samenvatting: eerst uit de tabel, anders vertalen en bewaren */
async function vertaling(frans: string): Promise<string | null> {
  if (!frans) return null
  try {
    const sleutel = await sha256(frans)
    const { data } = await db.from('lawine_vertalingen').select('nl').eq('sleutel', sleutel).maybeSingle()
    if (data?.nl) return data.nl
    const regels: string[] = []
    for (const regel of frans.split('\n')) {
      if (!regel.trim()) {
        regels.push('')
        continue
      }
      const delen: string[] = []
      for (const stuk of stukken(regel.trim())) {
        const nl = await vertaalStuk(stuk)
        if (!nl) return null
        delen.push(nl)
      }
      regels.push(delen.join(' '))
    }
    const nl = regels.join('\n').trim()
    await db.from('lawine_vertalingen').upsert({ sleutel, frans, nl }, { onConflict: 'sleutel', ignoreDuplicates: true })
    return nl
  } catch (e) {
    console.warn('vertalen mislukt', e instanceof Error ? e.message : String(e))
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!SLEUTEL) return json({ fout: 'Geen sleutel ingesteld (geheim METEOFRANCE_APIKEY).' }, 500)
  if (geheugen && Date.now() - geheugen.opgehaald < VERS_MS) return json(geheugen)

  try {
    const r = await fetch(BRON, { headers: { apikey: SLEUTEL, accept: 'application/xml' } })
    // Buiten het seizoen (ongeveer juni tot november) is er geen bulletin
    if (r.status === 404 || r.status === 204) return json({ geen: true })
    if (!r.ok) {
      // Météo-France even niet bereikbaar: dan het laatste dat we hebben, als dat er is
      if (geheugen) return json({ ...geheugen, oud: true })
      return json({ fout: `Météo-France antwoordde met ${r.status}.` }, 502)
    }
    const xml = await r.text()
    if (!xml.includes('<BULLETINS_NEIGE_AVALANCHE')) return json({ geen: true })
    geheugen = { xml, opgehaald: Date.now(), samenvattingNl: await vertaling(samenvatting(xml)) }
    return json(geheugen)
  } catch (e) {
    if (geheugen) return json({ ...geheugen, oud: true })
    return json({ fout: `Météo-France niet bereikbaar: ${e instanceof Error ? e.message : String(e)}` }, 502)
  }
})
