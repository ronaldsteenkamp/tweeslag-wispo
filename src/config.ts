// Vaste gegevens van de reis. Tijden zijn Nederlandse tijd (Europe/Amsterdam),
// genoteerd als 'JJJJ-MM-DDTUU:MM'.
export const config = {
  appNaam: 'Tweeslag Wispo',
  bestemming: 'Les Deux Alpes',
  tijdzone: 'Europe/Amsterdam',

  /** Vertrek van de bus: hierheen telt de aftelklok op het beginscherm */
  vertrek: '2027-03-05T19:30',
  /** Verwachte thuiskomst: daarna toont Home "Welkom thuis" */
  thuiskomst: '2027-03-14T12:00',
  /** Vanaf dit moment is het spel open (en begint het echte spel) */
  spelOpen: '2027-03-05T18:00',
  /**
   * true: het spel staat al open vóór spelOpen, als testperiode om uit te proberen.
   * Wat iemand in de testperiode doet, wordt op spelOpen op de telefoon gewist (zie lib/testperiode.ts).
   * false: het spel zit tot spelOpen op slot.
   */
  spelTestperiode: true,
  /**
   * Dagelijkse teststemming in de testperiode. Pas aanzetten als de Edge Function 'meldingen'
   * met het filter op 'test-' live staat, anders krijgt iedereen elke nacht een uitslagmelding.
   */
  testStemmingen: false,
  /** Standaardtijd waarop de challenges van een dag opengaan (als 'openOm' ontbreekt in spel.json) */
  challengesOpenOm: '07:00',

  /** Officiële app van Les 2 Alpes (Office du Tourisme des Deux Alpes) */
  les2alpesApp: {
    ios: 'https://apps.apple.com/nl/app/les-2-alpes/id344912914',
    android: 'https://play.google.com/store/apps/details?id=com.lumiplan.montagne.LesDeuxAlpes',
  },

  /**
   * Weerbericht via Open-Meteo (gratis, geen key). De hoogte (elevation) zorgt dat
   * de temperatuur klopt voor die plek. Gecontroleerd met OpenStreetMap en de
   * hoogtekaart van Open-Meteo: dorp ≈ 1663 m, Dôme de Puy Salié ≈ 3408 m.
   */
  weer: {
    locaties: [
      { id: 'dorp', naam: 'Dorp', latitude: 45.01, longitude: 6.1238, hoogte: 1650 },
      { id: 'gletsjer', naam: 'Gletsjer', latitude: 44.9972, longitude: 6.2226, hoogte: 3400 },
    ],
    tijdzone: 'Europe/Paris',
    /** Hooguit zo vaak opnieuw ophalen */
    verversMinuten: 60,
  },

  /** Alleen deze namen zien de knop 'Kamerverdeling maken'. Let op: geen echte beveiliging, iedereen kan in de app elke naam kiezen. */
  reisleiding: ['Ronald', 'Sten'] as readonly string[],

  /** Hier plak je een nieuwe kamers.json uit de kamerverdeling (bewerken op GitHub) */
  kamersBewerkenOpGithub: 'https://github.com/ronaldsteenkamp/tweeslag-wispo/edit/main/public/data/kamers.json',
} as const
