# Tweeslag Wispo – Les Deux Alpes 2027

Web-app (PWA) voor de wintersport van G.S.B.V. Tweeslag: aftelklok, planning, paklijst, kamers, pistekaart en een spel. Na één keer openen werkt de app ook offline.

> **Inhoud aanpassen zonder te programmeren**
> Alle teksten staan in vier bestanden in `public/data/`:
>
> | Bestand | Wat staat erin |
> |---|---|
> | `planning.json` | Per dag het programma (tijd, titel, omschrijving, locatie) |
> | `paklijst.json` | Categorieën met spullen om mee te nemen |
> | `kamers.json` | Kamers met nummer, naam en bewoners |
> | `spel.json` | Dagelijkse challenges, punten en de bingovakjes |
>
> Pas een bestand aan, zet het op GitHub en de app haalt de nieuwe versie op zodra iemand internet heeft. Zonder internet ziet iedereen de laatst bewaarde versie.

## ⚠️ Privacy

De app staat op een **openbare** website. Zoekmachines worden geweerd (`noindex` en `robots.txt`), maar iedereen met de link kan hem openen. Zet daarom in de JSON-bestanden **alleen voornamen**: geen achternamen, telefoonnummers, adressen, geboortedata of andere persoonsgegevens. Hebben twee mensen dezelfde voornaam, schrijf dan bijvoorbeeld `"Lisa"` en `"Lisa 2"`.

Wat iemand in de app doet (vinkjes, gekozen naam, spelscore) blijft op zijn eigen telefoon en wordt nergens naartoe gestuurd.

---

## De JSON-bestanden aanpassen

Je kunt de bestanden direct op github.com bewerken (open het bestand → potloodje → *Commit changes*). Een paar regels:

- Teksten staan tussen `"dubbele aanhalingstekens"`.
- Tussen items in een lijst staat een komma, **na het laatste item niet**.
- Datums schrijf je als `"2027-03-08"`, tijden als `"09:30"` (24-uurs, Nederlandse tijd).
- Het veld `_uitleg` bovenaan elk bestand is alleen een geheugensteuntje. De app doet er niets mee.
- Twijfel je? Plak de inhoud in [jsonlint.com](https://jsonlint.com). Zit er toch een fout in, dan meldt de app welk bestand het is.

### planning.json
```json
{ "dagen": [
  { "datum": "2027-03-06", "titel": "Aankomst", "items": [
    { "tijd": "16:00", "titel": "Inchecken", "omschrijving": "Kamers zijn klaar.", "locatie": "Receptie" }
  ] }
] }
```
`omschrijving` en `locatie` mag je weglaten. De volgorde van de dagen bepaalt "Dag X van 10" op het beginscherm.

### paklijst.json
```json
{ "categorieen": [
  { "naam": "Skikleding", "icoon": "🎿", "items": ["Skijas", "Skibroek"] }
] }
```
Verander je de tekst van een item, dan verdwijnt het vinkje bij dat ene item. Iedereen kan in de app ook eigen items toevoegen.

### kamers.json
```json
{ "verblijf": "Naam van het chalet",
  "kamers": [ { "nummer": "101", "naam": "Gletsjer", "bewoners": ["Anouk", "Sanne"] } ] }
```
Bij het eerste gebruik kiest iedereen zijn naam uit de lijst. Daarna staat zijn eigen kamer bovenaan.

### spel.json
```json
{ "punten": { "bingoVakje": 2, "bingoRij": 10, "bingoVolleKaart": 50 },
  "challenges": [
    { "datum": "2027-03-08", "openOm": "07:00", "items": [
      { "id": "gletsjer-groepsfoto", "titel": "Top van de gletsjer",
        "omschrijving": "Maak een groepsfoto bij de top van de gletsjer.", "punten": 20 }
    ] }
  ],
  "bingo": { "vrijVakje": "❄️ Vrij vakje", "vakjes": ["Hond op de piste", "..."] } }
```
- Challenges van een dag gaan open op `datum` om `openOm` (zonder `openOm` om 07:00).
- Elke challenge heeft een uniek `id` (kleine letters, geen spaties). **Verander een `id` niet meer tijdens de reis**, anders is iemands vinkje weg. De titel en omschrijving mag je wel aanpassen.
- De bingokaart heeft 24 vakjes plus een vrij vakje in het midden. Zet er minstens 24 in. Bij meer kiest elke telefoon er willekeurig 24, in een eigen volgorde die daarna vast blijft.
- Het spel gaat open op vrijdag 5 maart 2027 om 18:00.

### Overige instellingen
Vertrektijd, thuiskomst, het openen van het spel en de links naar de Les 2 Alpes-app staan in `src/config.ts`.

---

## Pistekaart en logo vervangen

**Pistekaart:** vervang `public/img/pistekaart.jpg` door de officiële kaart. Houd de naam `pistekaart.jpg` aan. Groot mag (tot 25 MB), maar 3–6 MB laadt prettiger. Liefst een brede afbeelding van minstens 3000 pixels, zodat je goed kunt inzoomen. De kaart wordt automatisch op de telefoon bewaard voor offline gebruik.

**Logo / app-icoon:** het app-icoon (`public/logo.svg`) en het woordmerk bovenaan Home (`public/img/2slag-wit.svg`) zijn gemaakt van het officiële 2slag-logo uit de huisstijl. Een ander icoon? Vervang `public/logo.svg` (vierkant). Bij elke build worden daaruit automatisch de app-iconen, de favicon en de splashscreens voor iPhone gemaakt. De achtergrondkleur en de ruimte rond het logo stel je in met `ACHTERGROND` en `padding` in `pwa-assets.config.ts`. Heeft je logo een transparante achtergrond, zet dan bij `transparent` de `padding` op bijvoorbeeld `0.1`. Heb je alleen een PNG, zet dan in `pwa-assets.config.ts` `images: ['public/logo.png']` en pas in `index.html` en `src/screens/Home.tsx` `logo.svg` aan naar `logo.png`.

**Kleuren en lettertypen:** die volgen de Tweeslag-stijlgids (donkerblauw `#0d0058`, lichtblauw `#099fc4`, Trebuchet MS voor titels en Georgia voor tekst). Alles staat in `src/styles/theme.css`, bovenaan de clubkleuren. Daaronder staan de lichte en de donkere versie (dark mode volgt de instelling van de telefoon).

---

## Lokaal draaien

Je hebt [Node.js](https://nodejs.org) 20 of nieuwer nodig.

```bash
npm install
npm run dev
```

Open daarna de link die in beeld verschijnt (meestal http://localhost:5173/tweeslag-wispo/).

Offline testen kan alleen met een productie-build:
```bash
npm run build
npm run preview
```

### Testen alsof het een andere dag is
- `?nu=2027-03-08T10:00` doet alsof het dat moment is (ook `?nu=2027-03-08`). Zo kun je Home, de planning en het spel tijdens de reis bekijken.
- `?unlock=1` opent het spel en alle challenges meteen.

Voorbeeld: `http://localhost:5173/tweeslag-wispo/?nu=2027-03-09T15:00#planning`

---

## Online zetten (GitHub Pages)

1. Maak op GitHub een repository aan, bijvoorbeeld `tweeslag-wispo`.
2. Zet de code erin (branch `main`).
3. Ga in de repository naar **Settings → Pages** en kies bij *Source* voor **GitHub Actions**.
4. Bij elke wijziging op `main` bouwt de workflow (`.github/workflows/deploy.yml`) de app en zet hem online. Volg dat onder het tabblad **Actions**.

De app staat dan op `https://<gebruikersnaam>.github.io/<repo-naam>/`. De workflow zet het juiste pad (`base`) automatisch. Gebruik je een andere repo-naam, pas dan ook `homepage` in `package.json` aan (die gebruikt het QR-script) en de standaardwaarde in `vite.config.ts` (die is alleen voor lokaal gebruik).

Na een update krijgen gebruikers bij de volgende keer openen de melding *"Er is een nieuwe versie van de app"* met een knop **Vernieuwen**. Nieuwe JSON-data komt direct door zodra er internet is; daar is geen update voor nodig.

## QR-code

```bash
npm run qr
```
Dit maakt `qr/tweeslag-wispo-qr.png` (om te printen) en `qr/tweeslag-wispo-qr.svg` met de URL uit `homepage` in `package.json`. Een andere URL kan ook: `npm run qr -- https://voorbeeld.nl/`.

## Installeren op de telefoon

De app laat zelf een banner zien met uitleg zolang hij nog niet op het beginscherm staat:
- **iPhone (Safari):** Deel-knop → *Zet op beginscherm* → *Voeg toe*.
- **Android (Chrome):** knop *Installeren* in de app, of menu ⋮ → *App installeren*.

## Hoe het werkt (voor wie verder wil bouwen)

- Vite + React + TypeScript, met `vite-plugin-pwa` voor het manifest en de service worker.
- De app zelf, de iconen en de pistekaart worden vooraf bewaard (cache-first). De JSON-data gaat network-first: eerst internet (max. 5 seconden wachten), anders de bewaarde versie.
- Persoonlijke gegevens staan in `localStorage` onder `tweeslag-wispo.*`.
- Code: `src/screens/` (de zes schermen), `src/components/`, `src/lib/` (tijd, opslag, data, bingo).
