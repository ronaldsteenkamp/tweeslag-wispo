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

**Kamerverdeling maken zonder JSON te typen:** open in de app *Kamers* en tik onderaan op **Kamerverdeling maken (reisleiding)**. Die knop zien alleen de namen in `reisleiding` in `src/config.ts` (nu Ronald en Sten). Dat is geen echte beveiliging, want iedereen kan in de app elke naam kiezen; de echte drempel is dat je schrijfrechten op de GitHub-repo nodig hebt om de verdeling online te zetten. Voeg deelnemers en kamers toe, stel het aantal bedden in en tik een naam en daarna een kamer aan (of gebruik *Automatisch verdelen*). Tik daarna op *Kopieer kamers.json*, open *kamers.json op GitHub* via de knop, plak de tekst eroverheen en kies *Commit changes*. Je werk wordt tussendoor op je telefoon bewaard; de groep ziet de nieuwe verdeling pas na de commit. `bedden` is optioneel; staat het erin, dan ziet iedereen hoeveel plekken er nog vrij zijn.

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

### Weer en sneeuw
Het weerbericht komt van [Open-Meteo](https://open-meteo.com) (gratis, geen key nodig) voor twee plekken: het **dorp** (45,010 N 6,124 E, 1650 m) en de **gletsjer** bij de Dôme de Puy Salié (44,997 N 6,223 E, 3400 m). De coördinaten en hoogtes staan in `src/config.ts` onder `weer`; de hoogte wordt meegestuurd, zodat de temperatuur klopt voor die plek.

- **Home:** een compacte weerkaart met dorp en gletsjer naast elkaar. Voor vertrek staat er *Zo is het nu in Les Deux Alpes* (de actuele situatie); tijdens de reis de verwachting voor vandaag. Na thuiskomst verdwijnt de kaart. Tik erop voor het detailscherm.
- **Detailscherm:** vandaag met verwachting per dagdeel (ochtend, middag, avond), daarna de komende dagen met min/max, verse sneeuw, wind en de nulgradengrens. Reisdagen zijn gemarkeerd.
- **Planning:** bij elke dag die al in de verwachting zit een klein icoon met de maximumtemperatuur in het dorp. Open-Meteo kijkt ongeveer 16 dagen vooruit, dus voor de reis verschijnen die vanaf eind februari.
- **Offline:** het laatste gelukte bericht wordt op de telefoon bewaard en getoond met *Bijgewerkt om …*. De app haalt hooguit één keer per uur een nieuw bericht op (instelbaar met `verversMinuten`).

### Overige instellingen
Vertrektijd, thuiskomst, het openen van het spel en de links naar de Les 2 Alpes-app staan in `src/config.ts`.

---

## Pistekaart en logo vervangen

**Pistekaart:** `public/img/pistekaart.jpg` is de officiële kaart van Les 2 Alpes voor winter 2025-2026 (`2026-Plan_Hiver.jpg` van les2alpes.com), licht gecomprimeerd tot ca. 2 MB. Komt de kaart voor 2026-2027 uit, vervang dan dit bestand en houd de naam `pistekaart.jpg` aan. Groot mag (tot 25 MB), maar 2–6 MB laadt prettiger. De kaart wordt automatisch op de telefoon bewaard voor offline gebruik. Let op: de kaart is van Les 2 Alpes en via de openbare URL voor iedereen te zien.

**Logo / app-icoon:** het app-icoon (`public/logo.svg`) en het woordmerk bovenaan Home (`public/img/2slag-wit.svg`) zijn winterversies van het officiële 2slag-logo uit de huisstijl, met sneeuw op de letters, sneeuwvlokken en besneeuwde bergen. Een ander icoon? Vervang `public/logo.svg` (vierkant). Bij elke build worden daaruit automatisch de app-iconen, de favicon en de splashscreens voor iPhone gemaakt. De achtergrondkleur en de ruimte rond het logo stel je in met `ACHTERGROND` en `padding` in `pwa-assets.config.ts`. Heeft je logo een transparante achtergrond, zet dan bij `transparent` de `padding` op bijvoorbeeld `0.1`. Heb je alleen een PNG, zet dan in `pwa-assets.config.ts` `images: ['public/logo.png']` en pas in `index.html` en `src/screens/Home.tsx` `logo.svg` aan naar `logo.png`.

**Kleuren en lettertypen:** die volgen de Tweeslag-stijlgids (donkerblauw `#0d0058`, lichtblauw `#099fc4`, Trebuchet MS voor titels en Georgia voor tekst). Alles staat in `src/styles/theme.css`, bovenaan de clubkleuren. De app staat altijd in de lichte stand, ook als de telefoon op donker staat.

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

## Backend (Supabase)

De app werkt volledig zonder backend. Met een (gratis) Supabase-project komen er gedeelde functies bij: scorebord, dagelijkse stemming, pushmeldingen en een fotomuur. Is Supabase niet ingesteld of niet bereikbaar, dan staat er bij die onderdelen *Geen verbinding* en werkt de rest gewoon door.

**Hoe het werkt**
- Deelnemers loggen niet in. Elk apparaat krijgt stil een eigen anonieme gebruiker (*Anonymous Sign-ins*). De gekozen naam en de kamer uit `kamers.json` worden daaraan gekoppeld.
- Kiest iemand op een tweede apparaat dezelfde naam (bijvoorbeeld Safari én de app op het beginscherm van dezelfde iPhone), dan neemt het nieuwe apparaat de naam over. Elke telefoon bewaart zijn eigen voortgang en stuurt die steeds opnieuw, dus dat herstelt zichzelf.
- De reisleiding logt in via *Kamers → ⚙️ Beheer (reisleiding)* met een inlogmail (link én code). Wie beheerder is, staat in de tabel `beheerders`.
- Elke tabel heeft Row Level Security: iedereen leest alleen wat nodig is, schrijft alleen eigen rijen; alleen beheerders mogen corrigeren en verwijderen.
- Alle SQL staat in `supabase/migrations/` (op volgorde uitvoeren; elk bestand mag vaker gedraaid worden).

### Eenmalig instellen (stap voor stap)

> **Al gedaan (20 oktober 2026):** project `tweeslag-wispo` (ref `pqxvfewizjyqeoerzjwx`) in *North EU (Stockholm)*, migratie 0001 uitgevoerd, ronaldsteenkamp@gmail.com als beheerder, anoniem inloggen aan, URL's ingesteld en de GitHub-variabelen gezet. De stappen hieronder zijn er om het opnieuw te kunnen doen.

1. **Project aanmaken.** Ga naar [supabase.com](https://supabase.com), maak een account en kies *New project*. Naam: `tweeslag-wispo`. Regio: een EU-regio, bijvoorbeeld *Central EU (Frankfurt)* of *West EU (Ireland)*. Kies een sterk databasewachtwoord en bewaar het in je wachtwoordmanager. Abonnement: *Free*.
2. **Tabellen maken.** Open *SQL Editor → New query*, plak de inhoud van `supabase/migrations/0001_basis.sql` en klik op *Run*. Zet daarna jezelf en Sten als beheerder (met jullie eigen adressen):
   ```sql
   insert into public.beheerders (email) values ('ronald@voorbeeld.nl'), ('sten@voorbeeld.nl');
   ```
   E-mailadressen in kleine letters.
3. **Anoniem inloggen aanzetten.** *Authentication → Sign In / Providers* → zet **Allow anonymous sign-ins** aan. *Email* staat standaard al aan; laat dat zo.
4. **Adressen van de app.** *Authentication → URL Configuration*:
   - *Site URL*: `https://ronaldsteenkamp.github.io/tweeslag-wispo/`
   - *Redirect URLs*: dezelfde, plus `http://localhost:4173/tweeslag-wispo/` en `http://localhost:5173/tweeslag-wispo/` (voor lokaal testen).
5. **Inlogmail.** De allereerste keer krijg je een mail *Confirm your signup* (je e-mailadres bestaat dan nog niet als gebruiker); daarna een gewone inloglink. Standaard bevat de mail alleen een link. Op Android werkt die ook voor de geïnstalleerde app; op een iPhone opent hij in Safari, dus daar doe je het beheer in Safari. Wil je ook een code in de mail (zodat je in de app op het beginscherm kunt inloggen), stel dan een eigen mailserver in (*Authentication → Emails → SMTP Settings*, bijvoorbeeld met Resend of een Gmail-app-wachtwoord) en zet in het sjabloon *Magic link or OTP* de regel `Of vul deze code in de app in: {{ .Token }}`. Het beheerscherm heeft daar al een invulveld voor.
6. **Keys opzoeken.** *Project Settings → Data API*: kopieer de **Project URL**. *Project Settings → API Keys*: kopieer de **anon public** key (of de *publishable* key). ⚠️ Gebruik nooit de *service_role*- of *secret*-key in de app of in GitHub: die omzeilt alle beveiliging.
7. **In GitHub zetten.** Repository → *Settings → Secrets and variables → Actions* → tabblad **Variables** → *New repository variable*:
   - `VITE_SUPABASE_URL` = de Project URL
   - `VITE_SUPABASE_ANON_KEY` = de anon/publishable key

   Start daarna de deploy opnieuw: *Actions → Deploy naar GitHub Pages → Run workflow* (of push een wijziging). De anon key is bedoeld om publiek te zijn; de beveiliging zit in de Row Level Security.
8. **Lokaal (optioneel).** Kopieer `.env.example` naar `.env.local` en vul dezelfde twee waarden in. `.env.local` gaat niet mee naar GitHub.
9. **Controleren.** Open de app, kies je naam en ga naar *Kamers → ⚙️ Beheer (reisleiding)*. Daar moet *Verbonden* staan en *Gekoppeld als Ronald · kamer …*. Log in met je e-mail; bij *Beheerder* hoort dan *Ja ✓* te staan. In Supabase zie je onder *Table Editor → deelnemers* een rij per apparaat.

### Scorebord (fase 2)
Migratie: `supabase/migrations/0002_scorebord.sql` (uitvoeren na 0001).

- **Versturen:** elke telefoon stuurt zijn volledige spelstand (afgevinkte challenges, bingovakjes en de punten) naar de tabel `voortgang`. Zonder internet blijft er een markering "nog versturen" staan; zodra er weer verbinding is gaat de actuele stand alsnog. Omdat steeds de hele stand gaat, maakt dubbel of laat versturen niets uit.
- **Punten:** de telefoon rekent met dezelfde regels uit `spel.json` als het scherm *Jouw score*; de server bewaart de punten én wat er is afgevinkt, met grenzen (max. 5000 challengepunten, 1000 bingopunten). Bewust niet op de server berekend: de spelregels staan in `spel.json` op de website en niet in de database, dus dan zou je bij elke wijziging ook de database moeten bijwerken. Klopt er iets niet, dan corrigeert een beheerder.
- **Klassement:** in *Spel → Klassement*, per kamer (opgeteld) en per persoon; je eigen kamer en naam zijn uitgelicht. Het ververst live (Supabase Realtime) en elke 30 seconden als vangnet. Zonder verbinding zie je de laatst bekende stand.
- **Bonuspunten en correcties:** beheerders zien onder het klassement een formulier: kamer of persoon kiezen, punten (min-teken voor aftrek) en een reden die iedereen ziet, bijvoorbeeld *+25 kamer Gletsjer: beste après-ski-outfit*. Correcties op een persoon gaan op naam, dus ze blijven gelden als iemand van telefoon wisselt. Een correctie verwijder je met het kruisje.

### Let op: gratis project pauzeert
Een gratis Supabase-project wordt **na een week zonder gebruik gepauzeerd**. De app laat dan *Geen verbinding* zien (de rest werkt door). Je zet het weer aan via het Supabase-dashboard → project → *Restore project* (duurt een paar minuten). **Controleer dit een paar dagen voor vertrek** en open de app daarna af en toe; tijdens de reis houdt het gebruik het project vanzelf actief.

Verder handig om te weten over het gratis abonnement: de standaard-mailserver van Supabase verstuurt maar een paar inlogmails per uur (genoeg voor de reisleiding), en per internetverbinding kunnen standaard zo'n 30 anonieme aanmeldingen per uur. Zitten veel mensen tegelijk op één wifi, dan kun je dat verhogen onder *Authentication → Rate Limits*.

### Privacy en opruimen na de reis
- Alleen voornamen en kamernummers gaan naar de server, in een EU-regio. Geen e-mailadressen van deelnemers; alleen de beheerders loggen in met e-mail.
- **Na de reis alles verwijderen:** voer `supabase/opruimen.sql` uit in de SQL Editor (verwijdert alle gebruikers en via de koppelingen alles wat eraan hangt) en leeg de foto-bucket onder *Storage*. Of verwijder in één keer het hele project: *Project Settings → General → Delete project*.
- Haal daarna in GitHub de twee variabelen weg; de app werkt dan weer zonder backend.

## QR-code

```bash
npm run qr
```
Dit maakt `qr/tweeslag-wispo-qr.png` (om te printen) en `qr/tweeslag-wispo-qr.svg` met de URL uit `homepage` in `package.json`. Een andere URL kan ook: `npm run qr -- https://voorbeeld.nl/`.

## Installeren op de telefoon

Wie de app voor het eerst opent (bijvoorbeeld via de QR-code), krijgt een welkomstscherm: eerst de eigen naam kiezen, daarna uitleg om de app op het beginscherm te zetten. Op een iPhone heeft de app op het beginscherm een eigen opslag, dus daar wordt de naam bij de eerste keer openen nog één keer gevraagd. Zolang de app nog niet op het beginscherm staat, laat Home ook een banner met uitleg zien:
- **iPhone (Safari):** Deel-knop → *Zet op beginscherm* → *Voeg toe*.
- **Android (Chrome):** knop *Installeren* in de app, of menu ⋮ → *App installeren*.

## Hoe het werkt (voor wie verder wil bouwen)

- Vite + React + TypeScript, met `vite-plugin-pwa` voor het manifest en de service worker.
- De app zelf, de iconen en de pistekaart worden vooraf bewaard (cache-first). De JSON-data gaat network-first: eerst internet (max. 5 seconden wachten), anders de bewaarde versie.
- Persoonlijke gegevens staan in `localStorage` onder `tweeslag-wispo.*`.
- Code: `src/screens/` (de zes schermen), `src/components/`, `src/lib/` (tijd, opslag, data, bingo).
