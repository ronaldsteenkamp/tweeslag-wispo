/*
 * Zinnen onder het aftellen op Home (vóór de reis). Home kiest bij elke keer openen een willekeurig
 * item dat nog niet is afgevinkt en daar een zin bij:
 * - meestal een zin speciaal voor dat item (ITEM_ZINNEN, op de exacte tekst uit paklijst.json);
 * - anders een zin voor de categorie of een algemene zin, waarin het item wordt ingevuld.
 * Verandert de tekst van een item in paklijst.json, dan valt dat item terug op de categorie- en
 * algemene zinnen. Houd zinnen kort (ongeveer drie regels op een telefoon).
 */

/** Krijgt het item als 'je skijas' (kleine letter, zonder '(2x)' e.d.) */
type Zinmaker = (ding: string) => string

const hoofdletter = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

const ITEM_ZINNEN: Record<string, string[]> = {
  // Papieren en geld
  'Paspoort of ID-kaart': [
    'Zonder paspoort of ID-kaart wordt het een heel korte busreis. Ligt hij al klaar?',
    'Even checken of je ID nog geldig is. Een verlopen pasje maakt van de bus een retourtje parkeerplaats.',
  ],
  'Zorgpas en EHIC-kaart': [
    'Zonder zorgpas neemt de helikopter je niet mee na een monsterval. Zet hem op je telefoon of zoek hem fysiek op.',
    'Je EHIC-kaart: het saaiste pasje dat je hebt, tot je met je knie in een Frans ziekenhuis ligt.',
  ],
  Bankpas: [
    'Zonder bankpas is de après-ski alleen kijken. Zit hij al in je portemonnee?',
    'Je bankpas: onmisbaar voor kaasfondue, tartiflette en spijt.',
  ],
  'Reisverzekering (polisnummer)': [
    'Zet het polisnummer van je reisverzekering in je telefoon, vóórdat je het vanuit een sneeuwbank moet opzoeken.',
    'Reisverzekering geregeld? Een Franse ambulance kost meer dan je skipas.',
  ],
  "Wat contant geld in euro's": [
    "Wat contant geld voor de berghut waar het pinapparaat 'en panne' is. Al gepind?",
    'Een paar euro voor de wc bij het wegrestaurant. Daar wil je om 4 uur ’s nachts niet over onderhandelen.',
  ],

  // Skikleding
  Skijas: [
    'Zonder skijas sta je om kwart over negen alweer in het hotel. Al van zolder gehaald?',
    'Skijas nog zoek? Een vuilniszak is ook waterdicht, maar staat minder goed op de groepsfoto.',
  ],
  Skibroek: [
    'Pas je skibroek alvast even. Beter nu ontdekken dat de knoop na de feestdagen niet meer dicht gaat.',
    'Zonder skibroek wordt elke val een natte broek. Al gevonden?',
  ],
  'Thermoshirt (2x)': [
    'Twee thermoshirts: één om te dragen, één om op de verwarming te laten luchten.',
    'Je thermoshirt is je beste vriend op 3600 meter. Al gevonden?',
  ],
  Thermobroek: [
    'Je thermobroek: niet sexy, wel warm. Al ingepakt?',
    'Een lange onderbroek, maar dan stoer. Ligt je thermobroek klaar?',
  ],
  'Fleece of midlayer': [
    "Je fleece: de laag tussen 'lekker fris' en 'ik voel mijn tenen niet meer'.",
    'Laagjes zijn het geheim, net als bij lasagne. Je midlayer al gevonden?',
  ],
  'Skisokken (3 paar)': [
    'Drie paar skisokken. Echt drie. Je kamergenoten bedanken je later.',
    'Gewone sokken in een skischoen: een blaar met jouw naam erop. Skisokken al gevonden?',
  ],
  Handschoenen: [
    'Zonder handschoenen ben je na de eerste stoeltjeslift je vingers kwijt. Al gevonden?',
    'Je handschoenen: ook handig om sneeuwballen keihard terug te gooien.',
  ],
  'Extra paar dunne handschoenen': [
    'Een extra paar dunne handschoenen, voor als het eerste paar na het sneeuwballengevecht doorweekt is.',
  ],
  Muts: [
    'Je muts: tegen de kou én tegen helmhaar in de après-ski.',
    'Hoe gekker je muts, hoe makkelijker de groep je terugvindt. Al gevonden?',
  ],
  'Nekwarmer of buff': [
    'Een buff: sjaal, muts en bankovervaller-look in één. Al ingepakt?',
    'Op de stoeltjeslift waait het altijd. Ligt je nekwarmer klaar?',
  ],

  // Bescherming
  Helm: [
    'Je hoofd heb je nog nodig voor de pubquiz. Helm al klaar?',
    'Geen eigen helm? Dan krijg je er een bij de verhuur die nog naar de vorige ruikt.',
  ],
  Skibril: [
    'Zonder skibril is de piste één grote witte vlek. Al gevonden?',
    'Je skibril: dé manier om de wasbeerbruine kop te kweken. Al ingepakt?',
  ],
  Zonnebril: [
    'Je zonnebril, voor op het terras. Daar zit je vaker dan je nu denkt.',
    'Sneeuw plus zon is knijpogen de hele dag. Zonnebril al gevonden?',
  ],
  'Zonnebrand (factor 50)': [
    'Om status kreeft te voorkomen: fix goeie zonnebrand!',
    'Factor 50 op 3600 meter, anders kom je thuis als een omgekeerde wasbeer.',
    'De zon op de gletsjer is geen grap, ook al is het min tien. Zonnebrand al ingepakt?',
  ],
  'Lippenbalsem met SPF': [
    'Lippenbalsem met SPF, tenzij je met gesprongen lippen naar het themafeest wil.',
    'Verbrande lippen en hete fondue: geen goed duo. Lippenbalsem al klaar?',
  ],

  // Kleding voor 's avonds
  'Warme trui': [
    'Een warme trui voor de avond. Binnen is het warm, de weg naar de bar niet.',
    'Je warme trui: na een dag in de sneeuw wil je iets dat voelt als een knuffel.',
  ],
  'Spijkerbroek of joggingbroek': [
    'Na het skiën wil je zo snel mogelijk uit die skibroek. Spijkerbroek of jogger al klaar?',
  ],
  Ondergoed: [
    'Ondergoed. We gaan er niet te veel woorden aan vuilmaken. Ingepakt?',
    'Tel de dagen, tel je onderbroeken. Tien dagen, tien stuks. Minimaal.',
  ],
  Pyjama: [
    'Je pyjama: je kamergenoten zijn je er dankbaar voor.',
    'Pyjama al ingepakt? Of ga je voor de alleen-skisokken-look?',
  ],
  'Snowboots of warme schoenen': [
    'Op sneakers door de sneeuw naar de après-ski? Natte sokken gegarandeerd. Snowboots al gevonden?',
    'Warme schoenen: de enige schoenen waarin je na een dag skischoenen weer normaal loopt.',
  ],
  'Slippers voor de douche': [
    'Slippers voor de douche. Geloof ons: je wilt die vloer niet op blote voeten.',
  ],
  'Tweeslag-clubshirt': [
    'Je Tweeslag-clubshirt: verplicht op de groepsfoto. Al uit de wasmand gevist?',
    "Zonder clubshirt sta je op de groepsfoto als 'vriend van'. Al gevonden?",
  ],
  'Outfit voor het themafeest (jaren 80)': [
    'Jaren 80: neon, schoudervullingen en een matje. Al langs de kringloop geweest?',
    'Geen jaren 80-outfit? Een fout skipak uit 1987 telt ook.',
    'Het themafeest wacht niet. Je jaren 80-outfit al bij elkaar?',
  ],

  // Toilettas
  'Tandenborstel en tandpasta': [
    'Tandenborstel en tandpasta. Tien dagen kaasfondue, je weet waarom.',
  ],
  'Douchegel en shampoo': [
    'Douchegel en shampoo: na een dag skiën en een avond après-ski geen overbodige luxe.',
  ],
  Deodorant: [
    'Deodorant. Een nachtbus vol skiërs. Meer hoeven we niet te zeggen.',
    'Je deo: skiën is sporten, ook al voelt het als vakantie.',
  ],
  Handdoek: [
    'Een handdoek. Zoals altijd zijn de saaiste spullen het makkelijkst vergeten.',
    'Je handdoek: ook prima als cape tijdens het themafeest.',
  ],
  Medicijnen: [
    'Je medicijnen: de apotheek in de bergen is ver weg en spreekt Frans. Al ingepakt?',
  ],
  'Pleisters en blarenpleisters': [
    'Blarenpleisters: skischoenen zijn nooit echt ingelopen. Al gekocht?',
    'Pleisters voor als de beachvolleybalskills niet blijken te gelden op de piste.',
  ],

  // Voor de busreis
  Nekkussen: [
    'Een nekkussen, tenzij je wakker wil worden met je hoofd op de schouder van een onbekende.',
    'Zonder nekkussen stap je in Les 2 Alpes uit met een hoofd dat scheef staat. Al gevonden?',
  ],
  Oordopjes: [
    'Oordopjes: er snurkt altijd iemand in de bus. Misschien ben jij het wel.',
  ],
  Slaapmasker: [
    'Een slaapmasker, want het leeslampje van je buurman gaat om drie uur ’s nachts aan.',
  ],
  'Eten en drinken voor onderweg': [
    'Eten voor onderweg: croissants bij het wegrestaurant kosten een klein fortuin.',
    'Snacks voor de bus. Wie deelt, maakt vrienden voor de hele week.',
  ],
  'Oplader en powerbank': [
    'Je powerbank: in de kou loopt je batterij leeg voordat je ‘waar zijn jullie?’ kunt appen.',
    'Oplader en powerbank. Zonder ben je om twee uur je telefoon kwijt en daarna de groep.',
  ],
  Koptelefoon: [
    'Je koptelefoon, voor als de bus gaat meezingen met de playlist van de chauffeur.',
  ],

  // Handig
  'Kleine rugzak voor op de piste': [
    'Een klein rugzakje voor op de piste: voor snacks, zonnebrand en de laag die je om twaalf uur uittrekt.',
  ],
  Drinkfles: [
    'Je drinkfles: op hoogte droog je sneller uit dan je denkt. En water in de berghut is niet gratis.',
  ],
  'Dekbedovertrek en kussensloop': [
    'Dekbedovertrek en kussensloop. Onder een kaal dekbed slapen is kamperen, maar dan slechter.',
  ],
  Hoeslaken: [
    'Een hoeslaken: niemand kan hem netjes opvouwen, maar meenemen lukt iedereen.',
  ],
  'Wasknijpers voor natte kleding': [
    'Wasknijpers, anders hangen je natte sokken straks over de lamp. Al ingepakt?',
  ],
  'Spelletjes of kaarten': [
    'Spelletjes of kaarten, voor als de liften dicht zijn door storm. Al ingepakt?',
    'Een pak kaarten: de goedkoopste après-ski die er is.',
  ],
}

const CATEGORIE_ZINNEN: Record<string, Zinmaker[]> = {
  'Papieren en geld': [
    (d) => `Zonder ${d} wordt het lastig. Al opgezocht waar het ligt?`,
    (d) => `Papierwerk is saai, tot je het nodig hebt. ${hoofdletter(d)} al klaar?`,
  ],
  Skikleding: [
    (d) => `Op de gletsjer wil je ${d} niet missen. Al gevonden?`,
    (d) => `Op 3600 meter vriest het. ${hoofdletter(d)} al uit de kast?`,
  ],
  Bescherming: [
    (d) => `Op 3600 meter wil je ${d} niet vergeten. Al gevonden?`,
    (d) => `${hoofdletter(d)}: klein ding, groot verschil op de piste.`,
  ],
  "Kleding voor 's avonds": [
    (d) => `Ook na het skiën: ${d} al klaargelegd?`,
    (d) => `De après-ski heeft ook een dresscode. ${hoofdletter(d)} al ingepakt?`,
  ],
  Toilettas: [
    (d) => `${hoofdletter(d)} vergeet je zo. Al in je toilettas?`,
    (d) => `${hoofdletter(d)} kun je daar ook kopen, maar dan betaal je bergprijzen.`,
  ],
  'Voor de busreis': [
    (d) => `De busreis is lang. ${hoofdletter(d)} al klaar voor onderweg?`,
    (d) => `Een nacht in de bus naar de Alpen. ${hoofdletter(d)} maakt het een stuk dragelijker.`,
  ],
  Handig: [
    (d) => `${hoofdletter(d)} komt vast van pas. Al klaargelegd?`,
    (d) => `${hoofdletter(d)}: niet sexy, wel slim. Al ingepakt?`,
  ],
  'Eigen spullen': [
    (d) => `Op je eigen lijstje staat ${d} nog open. Al geregeld?`,
    (d) => `Zelf op de lijst gezet, dus vast belangrijk: ${d}. Al klaar?`,
    (d) => `Je eigen lijstje, je eigen verantwoordelijkheid. ${hoofdletter(d)} al ingepakt?`,
  ],
}

const ALGEMENE_ZINNEN: Zinmaker[] = [
  (d) => `Al aan ${d} gedacht? Staat nog niet afgevinkt op je paklijst.`,
  (d) => `Mooi moment om ${d} alvast op te zoeken.`,
  (d) => `${hoofdletter(d)}: al gevonden, of nog ergens achter in de kast?`,
  (d) => `Kleine opdracht voor vandaag: ${d} klaarleggen.`,
  (d) => `Nog open op je paklijst: ${d}. Even afvinken als je het hebt?`,
  (d) => `Wie ${d} vergeet, mag het in de bus komen uitleggen.`,
  (d) => `Nog te doen: ${d}. Weer een vinkje dichter bij de bus.`,
  (d) => `${hoofdletter(d)} staat nog open. De bus wacht op niemand.`,
]

const ALLES_INGEPAKT = [
  'Alles ingepakt. Nu alleen nog wachten op de bus.',
  'Alles afgevinkt. Officieel de best voorbereide skiër van Tweeslag.',
  'Tas dicht, paklijst vol vinkjes. Nu alleen nog de dagen aftellen.',
]

const NOG_GEEN_PAKLIJST = 'Mooi moment om je skibroek alvast te passen. En om je paklijst te beginnen.'

/**
 * Itemnaam midden in een zin: zonder '(2x)' e.d., met een kleine letter (behalve bij namen) en
 * met 'je' ervoor, zodat het bij elk woord klopt ('je skijas', 'je Tweeslag-clubshirt').
 */
function dingInZin(naam: string) {
  const kaal = naam.replace(/\s*\([^)]*\)/g, '').trim()
  const klein = /^[A-Z][a-z]/.test(kaal) && !kaal.startsWith('Tweeslag') ? kaal.charAt(0).toLowerCase() + kaal.slice(1) : kaal
  return /^(wat|je|jouw|mijn|een|de|het)\s/i.test(klein) ? klein : `je ${klein}`
}

const kies = <T,>(lijst: T[], toeval: number) => lijst[Math.min(lijst.length - 1, Math.floor(toeval * lijst.length))]

/**
 * De zin voor Home. `open` = nog niet afgevinkte items (null: paklijst nog niet geladen).
 * `toeval` = drie vaste getallen tussen 0 en 1, één keer gekozen per keer openen.
 */
export function paklijstZin(open: { naam: string; categorie: string }[] | null, toeval: [number, number, number]) {
  if (open === null) return NOG_GEEN_PAKLIJST
  if (open.length === 0) return kies(ALLES_INGEPAKT, toeval[1])
  const item = kies(open, toeval[0])
  const eigen = ITEM_ZINNEN[item.naam]
  // Meestal (3 op 4) de zin speciaal voor dit item, anders een categorie- of algemene zin
  if (eigen?.length && toeval[2] < 0.75) return kies(eigen, toeval[1])
  const zinnen = [...(CATEGORIE_ZINNEN[item.categorie] ?? []), ...ALGEMENE_ZINNEN]
  return kies(zinnen, toeval[1])(dingInZin(item.naam))
}
