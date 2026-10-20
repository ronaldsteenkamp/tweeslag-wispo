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
  /** Vanaf dit moment is het spel open */
  spelOpen: '2027-03-05T18:00',
  /** Standaardtijd waarop de challenges van een dag opengaan (als 'openOm' ontbreekt in spel.json) */
  challengesOpenOm: '07:00',

  /** Officiële app van Les 2 Alpes (Office du Tourisme des Deux Alpes) */
  les2alpesApp: {
    ios: 'https://apps.apple.com/nl/app/les-2-alpes/id344912914',
    android: 'https://play.google.com/store/apps/details?id=com.lumiplan.montagne.LesDeuxAlpes',
  },
} as const
