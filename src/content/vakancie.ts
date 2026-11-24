/*
 * ================================================================================================
 *  TEKSTEN VAN DE PAGINA "DE VAKANCIE"
 * ================================================================================================
 *
 *  Hier staat alles wat op de pagina over de VakanCie staat. Je kunt dit bestand op GitHub
 *  aanpassen zonder iets van code te weten:
 *
 *  - Pas alleen de tekst TUSSEN de aanhalingstekens aan: 'zo'. Laat de aanhalingstekens, komma's
 *    en haakjes staan.
 *  - Wil je zelf een ' (apostrof) in de tekst? Zet er dan een \ voor: 'foto\'s'.
 *  - Alles tussen [vierkante haken] moet nog ingevuld worden. In de app staat het geel gemarkeerd,
 *    zodat je het makkelijk terugvindt. Vervang het door de echte tekst (zonder haken).
 *  - Gebruik alleen voornamen of bijnamen: de app is openbaar.
 *  - Na opslaan (in een pull request of op main) staat het na de volgende build in de app.
 *
 *  De getallen bij "Weetjes" (zoals het aantal badges of bergtoppen) rekent de app zelf uit. Hier
 *  staan alleen de weetjes die de app niet kan weten.
 *
 *  De groepsfoto zelf staat NIET in dit bestand (de repo is openbaar). Een beheerder plaatst hem in
 *  de app, onderaan de lege fotoplek. Alleen het onderschrift en de beschrijving staan hier.
 * ================================================================================================
 */

export const vakancie = {
  /** De donkerblauwe kop bovenaan */
  kop: {
    /** Kleine regel boven de titel */
    boven: 'G.S.B.V. Tweeslag',
    /** De grote titel */
    titel: 'De VakanCie',
    /** Regel onder de titel */
    onder: 'De commissie die de wintersport organiseert',
  },

  /** De groepsfoto, als afdruk zoals in het clubblad */
  groepsfoto: {
    /** Het onderschrift onder de foto (kleine kapitalen) */
    bijschrift: 'De VakanCie, [waar en wanneer de foto gemaakt is]',
    /**
     * Beschrijving voor wie de foto niet kan zien (schermlezer). Vertel kort wie er op staan en wat
     * er te zien is, bijvoorbeeld: 'Vier mensen in skipak op een besneeuwde helling, van links
     * naar rechts ...'
     */
    beschrijving: '[beschrijving van de groepsfoto: wie staan erop en wat zie je]',
    /** Wie de foto gemaakt heeft (staat onder de foto als je hem groot bekijkt) */
    fotograaf: '[naam van wie de foto maakte]',
    /** Tekst op de lege plek zolang er nog geen foto is */
    leeg: 'Hier komt de groepsfoto',
    /** Kleine regel daaronder */
    leegOnder: 'Even stilstaan, iedereen erop, en lachen.',
  },

  /** Het stukje "Waarom deze app": een paar alinea's, ondertekend door de VakanCie */
  waarom: {
    /** Kopje boven het stukje */
    kop: 'Waarom deze app',
    /** De alinea's. Elke regel tussen aanhalingstekens is een alinea. */
    alineas: [
      'Elk jaar gaat het ongeveer zo. Een Excel-lijstje voor de kamers, een appje voor het weer, een ander appje voor de pistekaart, en een groepsapp die tegen de tijd dat de bus vertrekt op vierhonderd ongelezen berichten staat. Ergens daartussen zit het antwoord op de vraag hoe laat we ook alweer verzamelen.',
      'Dit jaar staat alles op één plek. De planning, de paklijst, de kamers, het weer, de pistekaart, het spel en het clubblad. En omdat bereik op 3400 meter geen vanzelfsprekendheid is, werkt het ook zonder: wat je boven op de gletsjer doet, gaat mee zodra je weer een streepje hebt.',
      'Maar eerlijk is eerlijk: we hebben hem vooral gebouwd omdat het leuk is. Omdat busbingo een busrit korter maakt, en omdat er nu eindelijk bewijs komt van wie er écht als eerste bij de lift stond.',
      'Veel plezier ermee. Tot in de bus.',
    ],
    /** Regel boven de handtekeningen */
    groet: 'Namens de VakanCie,',
  },

  /** De leden van de VakanCie, met hun plaatje uit de app */
  leden: {
    /** Kopje boven de leden */
    kop: 'De VakanCie',
    /**
     * Wie er in de VakanCie zitten. Gebruik precies dezelfde (voor)naam als in de kamerlijst van de
     * app: dan komt de bijnaam van het plaatje vanzelf mee.
     * De foto: een beheerder zet per lid een eigen VakanCie-foto in de app (onder het lid, "Foto
     * plaatsen"), of zet hem in Supabase Storage in fotos/vakancie/leden/ met de naam van het lid,
     * bijv. "Iepie Leah.jpg". Die staat niet in dit bestand en los van het spelerskaartje. Zonder
     * eigen foto toont de pagina de profielfoto. Een lid toevoegen: kopieer
     * een regel { naam: ..., rol: ... }, met de komma erachter. De volgorde hier is de volgorde op
     * de pagina (en van de handtekeningen onder "Waarom deze app").
     */
    lijst: [
      { naam: 'Sten', rol: 'Voorzitter' },
      { naam: 'Ronald', rol: 'Penningmeester en app-bouwer' },
      { naam: 'Iepie Leah', rol: 'Secretaris en strepenjury' },
      { naam: 'Tom', rol: 'Chef promo: announcements en communicatie' },
      { naam: 'Selma', rol: 'Chef promo: creativiteit en promo' },
      { naam: 'Josje', rol: 'Orakel der wijsheid' },
    ],
  },

  /** Weetjes over de app. De meeste getallen rekent de app zelf uit; deze niet. */
  weetjes: {
    /** Kopje */
    kop: 'In cijfers',
    /**
     * Extra weetjes die de app niet zelf kan tellen. 'getal' staat groot, 'tekst' eronder.
     * Weet je het (nog) niet? Laat de regel dan weg.
     */
    extra: [
      // Bron: les2alpes.com (Ski area: "220 km of slopes", 2026)
      { getal: '220', tekst: 'kilometer piste in Les 2 Alpes' },
      { getal: '214', tekst: 'kopjes koffie tijdens het bouwen' },
    ],
  },

  /** Met dank aan */
  dank: {
    /** Kopje */
    kop: 'Met dank aan',
    /** Over de deelnemers. {aantal} wordt vervangen door het aantal deelnemers in de kamerlijst. */
    deelnemers: 'Iedereen die meegaat: {aantal} mensen die van een week in de sneeuw een wispo maken.',
    /** Regel boven de bronnen */
    bronnenIntro: 'De app staat op de schouders van anderen. Zij vragen terecht om een naamsvermelding:',
    /**
     * De bronnen die de app echt gebruikt, met de naamsvermelding die hun licentie vraagt.
     * LET OP: niet weghalen of inkorten zolang de app ze gebruikt; de licenties vragen erom.
     * 'wat' = waarvoor de app het gebruikt, 'wie' = de vermelding, 'link' = waar het vandaan komt.
     */
    bronnen: [
      {
        wat: 'Liftstations, pistenamen en bergtoppen',
        wie: '© OpenStreetMap-bijdragers, beschikbaar onder de Open Database License (ODbL)',
        link: 'https://www.openstreetmap.org/copyright',
        linkTekst: 'openstreetmap.org/copyright',
      },
      {
        wat: 'Hoogtedata voor het bergpanorama',
        wie: 'Afgeleid van Copernicus DEM GLO-90 (© DLR e.V. 2010–2014 en © Airbus Defence and Space GmbH 2014–2018, geleverd onder COPERNICUS door de Europese Unie en ESA), via de Elevation API van Open-Meteo',
        link: 'https://open-meteo.com/en/docs/elevation-api',
        linkTekst: 'open-meteo.com',
      },
      {
        wat: 'Het weerbericht',
        wie: 'Weergegevens van Open-Meteo.com, onder de licentie CC BY 4.0',
        link: 'https://open-meteo.com/',
        linkTekst: 'open-meteo.com',
      },
      {
        wat: 'De pistekaart',
        wie: 'De officiële pistekaart van Les 2 Alpes',
        link: 'https://www.les2alpes.com/',
        linkTekst: 'les2alpes.com',
      },
      {
        wat: 'Het lawinebericht',
        wie: 'Een link naar het lawinebulletin van Météo-France',
        link: 'https://meteofrance.com/meteo-montagne',
        linkTekst: 'meteofrance.com',
      },
      {
        wat: 'De letters Barlow en Barlow Condensed',
        wie: 'Copyright 2017 The Barlow Project Authors, onder de SIL Open Font License 1.1',
        link: 'https://github.com/jpt/barlow',
        linkTekst: 'github.com/jpt/barlow',
      },
      {
        wat: 'De bouwstenen',
        wie: 'React, Vite en Supabase, allemaal open source',
        link: 'https://github.com/ronaldsteenkamp/tweeslag-wispo',
        linkTekst: 'de code van deze app',
      },
    ],
  },

  /** Helemaal onderaan */
  voet: {
    /** Bij wie je terechtkunt als er iets niet werkt */
    contact: 'Werkt er iets niet, of klopt er iets niet? Laat het Ronald weten, bijvoorbeeld in de groepsapp.',
  },
} as const
