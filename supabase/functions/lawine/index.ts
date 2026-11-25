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
// Aanroep: POST (of GET) zonder body. Antwoord: { xml, opgehaald } of { geen: true } buiten het seizoen
// of { fout } als het niet lukt. Het bulletin verschijnt één keer per dag rond 16 uur; de functie
// onthoudt het 20 minuten, zodat Météo-France niet bij elke opening van de app een verzoek krijgt.

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

let geheugen: { xml: string; opgehaald: number } | null = null

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
    geheugen = { xml, opgehaald: Date.now() }
    return json(geheugen)
  } catch (e) {
    if (geheugen) return json({ ...geheugen, oud: true })
    return json({ fout: `Météo-France niet bereikbaar: ${e instanceof Error ? e.message : String(e)}` }, 502)
  }
})
