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
`omschrijving` en `locatie` mag je weglaten. De volgorde van de dagen bepaalt "Dag X van 10" op het beginscherm. Zet `"melding": true` bij een item, dan krijgt iedereen met meldingen aan 30 minuten van tevoren een seintje (zie *Pushmeldingen*).

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

### plekken.json (pins op de kaarten)
```json
{ "plekken": [
  { "id": "bar-sneeuwpop", "naam": "Bar De Sneeuwpop", "soort": "apres", "kaart": "dorp",
    "x": 42.5, "y": 81.0, "omschrijving": "Aan het plein.", "tijden": "Happy hour 16:00–18:00",
    "route": "https://maps.google.com/?q=..." }
] }
```
- `soort` is `apres` (paars, 🍻, bier, bars en après-ski), `eten` (rood, 🍽️), `afspreek` (donkerblauw, 🚩) of `handig` (groen, ℹ️). Elke soort heeft een eigen kleur en icoon, en onderaan de kaart een filterknop.
- `kaart` is `piste` of `dorp`.
- `x` en `y` zijn **procenten** van de afbeelding: `x` 0 is helemaal links en 100 helemaal rechts, `y` 0 is boven en 100 onder. De punt van de pin staat precies op die plek.
- `omschrijving`, `tijden` en `route` mag je weglaten. De knop *Route* verschijnt alleen als er een `route` (een webadres, bijvoorbeeld een Google Maps-link) is.
- Een plek met een onbekende `soort` wordt `handig`. Een plek zonder naam of met `x`/`y` buiten 0–100 slaat de app over.
- Nu staan er **fictieve voorbeelden** in (met "(voorbeeld)" in de naam). Vervang ze door echte plekken. Op de dorpskaart staan ze al op logische plekken (het plein, bij de bioscoop, het toeristenbureau, een supermarkt).

**Plaatsmodus: x en y opzoeken zonder rekenen.** Open de app met `?plaats=1` achter het adres, bijvoorbeeld `https://ronaldsteenkamp.github.io/tweeslag-wispo/?plaats=1#kaart`. Kies Piste of Dorp, zoom zo nodig in en tik op de plek. Bovenin verschijnen de x en y, met een kant-en-klaar JSON-fragment en een knop *Kopieer JSON*. Plak het in de lijst `plekken` (met een komma tussen twee plekken) en vul naam, soort en de rest in. Een gele pin laat zien waar je tikte. Zonder `?plaats=1` werkt de kaart gewoon zoals altijd.

**De kaart gebruiken:** bovenin wissel je tussen *Piste* en *Dorp* (de app onthoudt je keuze). Tik op een pin voor naam, omschrijving, tijden en route; tik ergens anders op de kaart om het onderblad te sluiten. Slepen werkt ook als je op een pin begint. Pins blijven op elk zoomniveau even groot. Op een smal scherm tonen de filterknoppen alleen hun icoon.

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

**Dorpskaart:** `public/img/dorpskaart.jpg` is een plattegrond van het dorp, getekend uit **OpenStreetMap**-gegevens in de Tweeslag-stijl: straten met namen, gebouwen, liften (met de naam bij het dalstation), herkenningspunten (toeristenbureau, gemeentehuis, post, apotheek, bioscoop, politie), pleinen, een schaal en een noordpijl. Hij wordt offline bewaard. De vermelding *© OpenStreetMap-bijdragers* staat op de kaart en in de app; die is verplicht (licentie ODbL), laat hem staan.

- **Legenda:** links op de kaart staat een legenda met de symbolen (hoofdweg, straat, pad, gebouw, bos en groen, skilift, herkenningspunt, wijk of plein) en de kleuren van de pins in de app. Zoom in om hem te lezen.
- **Bier drinken:** alle bars, pubs en nachtclubs uit OpenStreetMap (nu 21) staan als paarse pin (*Bier & après-ski*) op de dorpskaart, met hun echte naam en een knop *Route* naar Google Maps. Ze komen uit `npm run bars` (script `scripts/dorpskaart/bars.mjs`): dat zet ze in `plekken.json` met een id die begint met `osm-` en vervangt bij opnieuw draaien alleen die plekken. Bars in hetzelfde gebouw schuift het een paar meter uit elkaar, zodat je ze ingezoomd allebei kunt aantikken. Openingstijden staan er alleen bij als OpenStreetMap ze kent; controleer ter plekke. Wil je een bar niet op de kaart, haal hem dan uit `plekken.json`; draai `npm run bars` daarna niet opnieuw, want dan komt hij terug.
- **Opnieuw maken** (bijvoorbeeld als OpenStreetMap is bijgewerkt): `npm run dorpskaart` en daarna `npm run bars`. Het script `scripts/dorpskaart/teken.mjs` haalt de gegevens één keer op via de Overpass-API (bewaard in `scripts/dorpskaart/osm.json`), tekent de kaart en schrijft `public/img/dorpskaart.jpg`. Met `--opnieuw` haalt het verse gegevens op. Kleuren, het kader en welke herkenningspunten erop staan, pas je bovenin het script aan.
- **Eigen plattegrond gebruiken?** Vervang `dorpskaart.jpg` door een andere afbeelding met dezelfde naam. Controleer daarna de `x`/`y` van de plekken op de dorpskaart met de plaatsmodus: de posities zijn procenten van de afbeelding, dus bij een andere kaart liggen ze ergens anders. Dat geldt ook als je het kader in het script aanpast.

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

> **Al gedaan (20 oktober 2026):** project `tweeslag-wispo` (ref `pqxvfewizjyqeoerzjwx`) in *North EU (Stockholm)*, migratie 0001 uitgevoerd (0002 en 0003 op 21 oktober, inclusief de stemmingen uit `stemmingen.json`; 0004, de Edge Function `meldingen`, de cronjob en 0005 met de bucket `fotos` ook op 21 oktober), ronaldsteenkamp@gmail.com als beheerder, anoniem inloggen aan, URL's ingesteld en de GitHub-variabelen gezet. De stappen hieronder zijn er om het opnieuw te kunnen doen.

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

### Dagelijkse stemming (fase 3)
Migratie: `supabase/migrations/0003_stemming.sql` (uitvoeren na 0002).

- **Vragen:** in `public/data/stemmingen.json`, bijvoorbeeld:
  ```json
  { "stemmingen": [
    { "id": "skier-1", "datum": "2027-03-07", "vraag": "⛷️ Skiër van de dag", "open": "15:00", "sluit": "21:30" },
    { "id": "outfit-5", "datum": "2027-03-11", "vraag": "🕺 Beste outfit", "open": "21:30", "sluit": "2027-03-12T12:00" }
  ] }
  ```
  `open` en `sluit` zijn een tijd op `datum`, of een volledige datum-tijd als hij een andere dag sluit. Elke `id` is uniek; **verander een `id` niet meer als er al gestemd is** (de stemmen hangen eraan). Kandidaten zijn automatisch alle namen uit `kamers.json`.
- **Naar de server:** de database moet de sluitingstijden kennen om de regels te bewaken. Dat gaat vanzelf: zodra een ingelogde beheerder de app opent, zet de app `stemmingen.json` (met de namen uit `kamers.json`) in de tabel `stemmingen`. Handmatig kan via *Beheer → Stemmingen → Nu bijwerken*. Pas je de JSON of de kamerverdeling aan, open dan even de app als beheerder. Een vraag die je uit de JSON haalt, verdwijnt dan ook van de server, maar alleen als er nog niet op gestemd is.
- **Overzicht:** onderaan *Spel → Stemmen* staat *📋 Alle stemmingen* met per dag de vragen en hun tijden.
- **Regels (afgedwongen door de database):** stemmen kan alleen terwijl de stemming open is, niet op jezelf, en maar één keer per vraag. Dat geldt per naam, dus ook niet nogmaals vanaf een tweede telefoon. Stemmen gaat alleen via de functie `stem()`, niet rechtstreeks in de tabel.
- **Geheim tot de sluitingstijd:** tijdens de stemming ziet iedereen alleen hoeveel stemmen er zijn. Wie op wie stemde ziet niemand in de app, ook de beheerders niet. Na de sluitingstijd verschijnt de uitslag per kandidaat in *Spel → Stemmen*, en de winnaars staan op Home.
- **Op Home:** een kaart *Stemmen maar!* zolang er een open stemming is waarop je nog niet stemde, en de winnaars van de laatst gesloten dag.
- **Per ongeluk verkeerd gestemd?** Een beheerder kan in *Beheer → Stemmingen* de stem van iemand intrekken (zonder te zien wat het was); diegene kan dan opnieuw stemmen.
- **Zonder internet** zie je de laatst bekende stand en uitslagen; stemmen zelf kan alleen met verbinding.

### Pushmeldingen (fase 4)
Migratie: `supabase/migrations/0004_meldingen.sql`. Edge Function: `supabase/functions/meldingen/` (`index.ts` en `planner.ts`). Planning: `supabase/cron_meldingen.sql`.

- **Aanzetten:** op Home staat een kaart *🔔 Meldingen* met de knop **Meldingen aanzetten**. Pas na die tik vraagt de telefoon om toestemming. Daarna staan er *Testmelding* en *Uitzetten*.
- **iPhone:** meldingen werken alleen in de app op het beginscherm, vanaf iOS 16.4. In Safari legt de kaart uit hoe je de app eerst op je beginscherm zet.
- **Automatisch** (elke 5 minuten kijkt de server wat er aan de beurt is):
  - 30 minuten vóór elk item in `planning.json` met `"melding": true` (in de planning staat daar een 🔔 bij);
  - als de challenges van een dag opengaan;
  - als de uitslag van een stemming bekend is (stemmingen die tegelijk sluiten komen in één melding).
  Elke melding gaat maar één keer. Mist de server een moment (bijvoorbeeld een storing), dan haalt hij het nog in zolang het zin heeft: tot het planningsitem begint, of tot 3 uur na de challenges of de uitslag.
- **Handmatig:** in *Beheer → Meldingen* stuurt de reisleiding een bericht aan iedereen (titel, tekst en welk scherm er opent). Daar zie je ook hoeveel apparaten meldingen aan hebben en wat er laatst is verstuurd.
- **Sleutels:** de VAPID-sleutels maakt de Edge Function zelf bij de eerste aanroep en bewaart ze in de tabel `push_sleutels`, waar alleen de server bij kan. Er hoeft dus niemand een geheime sleutel te kopiëren.

**Opnieuw instellen (bijvoorbeeld in een nieuw project)**
1. Voer `0004_meldingen.sql` uit in de SQL Editor.
2. *Edge Functions → Deploy a new function → Via Editor*: naam `meldingen`, maak de bestanden `index.ts` en `planner.ts` aan met de inhoud uit `supabase/functions/meldingen/`, en kies *Deploy function*. (Of met de Supabase CLI: `supabase functions deploy meldingen --no-verify-jwt`.)
3. Zet bij de functie onder *Settings* **Verify JWT** uit en kies *Save changes*. De functie controleert zelf wie er belt; berichten aan iedereen mogen alleen beheerders sturen.
4. Pas in `supabase/cron_meldingen.sql` zo nodig de project-URL aan en voer het uit.
5. Controleren: `select * from cron.job_run_details order by start_time desc limit 5;` moet *succeeded* laten zien.

### Fotomuur (fase 5)
Migratie: `supabase/migrations/0005_fotomuur.sql` (maakt ook de bucket `fotos` en de regels voor de opslag).

- **Uploaden:** bij elke challenge staat een knopje *📷 Foto als bewijs*. Je kunt een foto maken of er een uit je foto's kiezen. Na het uploaden wordt de challenge vanzelf afgevinkt.
- **Verkleinen:** de telefoon verkleint de foto vóór het uploaden tot max. 1600 px en ~300 kB, plus een kleine versie (480 px) voor de muur. Daarbij gaan ook de locatie- en cameragegevens (EXIF) eruit. Een foto van 3,4 MB werd bij de test 216 kB.
- **Fotomuur:** *Spel → 📸 Fotomuur*, de nieuwste eerst, met naam, kamer, challenge en tijd. Tik op een foto voor het grote formaat. Nieuwe foto's verschijnen vanzelf (Supabase Realtime). Op Home staan de vier nieuwste.
- **Privé:** de bucket is niet openbaar. De app vraagt per foto een tijdelijke link (signed URL) aan die een uur geldig is; dat kan alleen een apparaat dat in de app is aangemeld. Naam en kamer bij een foto zet de server erbij, niet de telefoon.
- **Verwijderen:** iedereen kan zijn eigen foto's verwijderen; beheerders (ingelogd) kunnen elke foto verwijderen. Open de foto en tik op *Verwijderen*.
- **Grenzen:** alleen JPEG of WebP, max. 1 MB per bestand. Het gratis abonnement heeft 1 GB opslag: genoeg voor duizenden foto's.
- **Zonder internet** zie je de laatst geladen muur; uploaden kan alleen met verbinding.

### Let op: gratis project pauzeert
Een gratis Supabase-project wordt **na een week zonder gebruik gepauzeerd**. De app laat dan *Geen verbinding* zien (de rest werkt door). Je zet het weer aan via het Supabase-dashboard → project → *Restore project* (duurt een paar minuten). **Controleer dit een paar dagen voor vertrek** en open de app daarna af en toe; tijdens de reis houdt het gebruik het project vanzelf actief.

Verder handig om te weten over het gratis abonnement: de standaard-mailserver van Supabase verstuurt maar een paar inlogmails per uur (genoeg voor de reisleiding), en per internetverbinding kunnen standaard zo'n 30 anonieme aanmeldingen per uur. Zitten veel mensen tegelijk op één wifi, dan kun je dat verhogen onder *Authentication → Rate Limits*.

### Privacy en opruimen na de reis
- Alleen voornamen en kamernummers gaan naar de server, in een EU-regio. Geen e-mailadressen van deelnemers; alleen de beheerders loggen in met e-mail.
- Stemmen worden opgeslagen met de voornaam van de kiezer (nodig voor "één stem per naam"). Alleen jijzelf ziet in de app op wie je stemde; de beheerders niet.
- **Na de reis alles verwijderen:** voer `supabase/opruimen.sql` uit in de SQL Editor (verwijdert alle gebruikers met hun voortgang en meldingsabonnementen, de correcties, de stemmingen met alle stemmen, het meldingenlogboek en de sleutels, de beheerderslijst, en stopt de planner). De fotobestanden zelf kun je niet met SQL weghalen: ga naar *Storage → fotos*, selecteer alle mappen en kies *Delete*. Of verwijder in één keer het hele project: *Project Settings → General → Delete project*.
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
