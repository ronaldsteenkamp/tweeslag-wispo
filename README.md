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
> | `spel.json` | Dagelijkse challenges, punten en de busbingovakjes |
> | `rad.json` | Pistes, drankjes en klosopdrachten voor het rad |
>
> Pas een bestand aan, zet het op GitHub en de app haalt de nieuwe versie op zodra iemand internet heeft. Zonder internet ziet iedereen de laatst bewaarde versie.

## ⚠️ Privacy

De app staat op een **openbare** website. Zoekmachines worden geweerd (`noindex` en `robots.txt`), maar iedereen met de link kan hem openen. Zet daarom in de JSON-bestanden **alleen voornamen**: geen achternamen, telefoonnummers, adressen, geboortedata of andere persoonsgegevens. Hebben twee mensen dezelfde voornaam, schrijf dan bijvoorbeeld `"Lisa"` en `"Lisa 2"`.

Zonder backend blijft wat iemand in de app doet (vinkjes, gekozen naam, spelscore, profiel) op zijn eigen telefoon. Met de Supabase-backend (zie hieronder) gaan naam, score, stemmen, foto's, profielen en (als je dat aanzet) je locatie naar de server. Daar kan iedereen die de app opent ze zien (niet via zoekmachines of zonder de app). Zet dus ook in je profiel niets wat niet iedereen met de link mag lezen.

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
{ "verblijf": "Résidence La Muzelle",
  "kamers": [ { "nummer": "101", "naam": "Gletsjer", "bewoners": ["Anouk", "Sanne"] } ],
  "zonderKamer": ["Jacco", "Menno"] }
```
Bij het eerste gebruik kiest iedereen zijn naam uit de lijst. Daarna staat zijn eigen kamer bovenaan.

`zonderKamer` (mag ontbreken) is voor wie zeker meegaat maar nog geen kamer heeft. Zij kunnen al hun naam kiezen, een profiel invullen, stemmen en meedoen aan het spel; bij *Kamers* staan ze onder *Nog geen kamer*. In het klassement tellen hun punten pas mee voor een kamer zodra ze er een hebben. De kamerverdeling in de app (*Kamerverdeling maken*) zet hen bij *nog in te delen* en schrijft wie overblijft weer onder `zonderKamer`.

**Kamerverdeling maken zonder JSON te typen:** open in de app *Kamers* en tik onderaan op **Kamerverdeling maken (reisleiding)**. Die knop zien alleen de namen in `reisleiding` in `src/config.ts` (nu Ronald en Sten). Dat is geen echte beveiliging, want iedereen kan in de app elke naam kiezen; de echte drempel is dat opslaan alleen lukt als je als beheerder bent ingelogd (*Kamers → ⚙️ Beheer*). Voeg deelnemers en kamers toe, stel het aantal bedden in en tik een naam en daarna een kamer aan (of gebruik *Automatisch verdelen*). Tik daarna onderaan op **💾 Opslaan in de app**: de verdeling gaat naar Supabase (tabel `kamerverdeling`, migratie `0008_kamerverdeling.sql`) en staat meteen in ieders app, ook zonder internet zodra die hem één keer heeft opgehaald. Ben je nog niet ingelogd als beheerder, dan staat daar een knop om in te loggen. Je werk wordt tussendoor op je telefoon bewaard; de groep ziet de nieuwe verdeling pas na het opslaan. Kan of wil je niet via Supabase, dan staat onder *Of via GitHub* nog de oude manier: *Kopieer kamers.json*, plakken op GitHub en *Commit changes*.

**Wat geldt er?** Staat er een verdeling in de app opgeslagen, dan gaat die voor op `kamers.json`. Wie daarna nog alleen in `kamers.json` wordt gezet, verschijnt in de app onder *Nog geen kamer* (handig om iemand toe te voegen zonder de app). Iemand weghalen of verhuizen doe je dan in de kamerverdeling in de app. Verandert `kamers.json` intussen (bijvoorbeeld nieuwe deelnemers of een andere naam van het verblijf), dan neemt de kamerverdeling dat bij het openen vanzelf over: nieuwe namen komen bij *Nog in te delen*, je eigen indeling en zelf toegevoegde namen blijven staan, en bovenaan staat wat er is bijgewerkt. `bedden` is optioneel; staat het erin, dan ziet iedereen hoeveel plekken er nog vrij zijn.

### spel.json
```json
{ "punten": { "bingoVakje": 2, "bingoRij": 10, "bingoVolleKaart": 50 },
  "challenges": [
    { "datum": "2027-03-08", "openOm": "07:00", "items": [
      { "id": "gletsjer-groepsfoto", "titel": "Top van de gletsjer",
        "omschrijving": "Maak een groepsfoto bij de top van de gletsjer.", "punten": 20 }
    ] }
  ],
  "bingo": { "vrijVakje": "🏐 Vrij!", "vakjes": ["🚧 File", "😴 Iemand snurkt", "..."] } }
```
- Challenges van een dag gaan open op `datum` om `openOm` (zonder `openOm` om 07:00).
- Elke challenge heeft een uniek `id` (kleine letters, geen spaties). **Verander een `id` niet meer tijdens de reis**, anders is iemands vinkje weg. De titel en omschrijving mag je wel aanpassen.
- De **busbingo** is voor in de nachtbus naar Les Deux Alpes (vertrek vr 5 maart 19:30, aankomst za 6 maart 09:00). In de app heet hij overal *Busbingo*; in de code, `spel.json` (`bingo`, `bingoVakje` enz.) en de database heet hij nog gewoon `bingo`.
- De kaart heeft 24 vakjes plus een vrij vakje in het midden. Zet er minstens 24 in (nu 39). Bij meer kiest elke telefoon er willekeurig 24, in een eigen volgorde die daarna vast blijft. Punten: `bingoVakje` per vakje, `bingoRij` per rij, kolom of diagonaal en `bingoVolleKaart` voor een volle kaart; ze tellen mee in het klassement.
- Een vakje is een emoji plus een korte tekst. Houd de tekst op een telefoon van 360 px breed binnen het vakje: max. 2 regels van zo'n 10 tekens, een lang woord eventueel met een streepje (`Wagen-ziek`).
- Haal je een vakje uit de lijst, dan krijgt elke telefoon er bij het openen een ander willekeurig vakje voor terug, en het vinkje op het oude vakje verdwijnt. Zo kregen telefoons met een kaart van de vroegere pistebingo vanzelf een nieuwe busbingokaart, zonder oude punten.
- Het echte spel begint op vrijdag 5 maart 2027 om 18:00 (`spelOpen` in `src/config.ts`).
- **Testperiode:** zolang `spelTestperiode` in `src/config.ts` op `true` staat, is het spel daarvoor al open om uit te proberen, met bovenaan de melding *Testperiode*. Op het moment dat het echte spel begint, wist elke telefoon wat er in de testperiode is gedaan: afgevinkte challenges, busbingovinkjes (met een nieuwe kaart) en de casinofiches en bakken. De telefoon stuurt dan meteen een lege stand, zodat ook het klassement weer op 0 begint. Niet gewist worden profielen, stemmen, foto's op de fotomuur en bonuspunten van beheerders; haal die zo nodig zelf weg. Zet `spelTestperiode` op `false` om het spel tot de start op slot te houden.

### rad.json
Inhoud van het tabblad *Rad* (onderin, tussen Kaart en Spel). Het rad staat altijd open, ook vóór de reis, geeft geen punten en werkt helemaal zonder internet: de uitslag wordt op de telefoon zelf bepaald (met `crypto.getRandomValues`).
```json
{ "pistes": [ { "naam": "Mantel", "kleur": "rood" } ],
  "drankjes": ["Glühwein", "Génépi"],
  "klosOpdrachten": ["haalt de volgende ronde", "doet de afwas"] }
```
- **Vier radden en een casino:** *Klos* (een willekeurige persoon), *Piste*, *Drankje* en *Eigen* (zelf 2 tot 12 opties intypen; die blijven op de telefoon bewaard). Bij *Klos* kies je wie meedoet: iedereen, je eigen kamer, een paar kamers of zelf namen aanvinken (uit `kamers.json`). Na het draaien staat er bijvoorbeeld *Tom is de klos! Haalt de volgende ronde.*
- **`pistes`:** naam en kleur (`groen`, `blauw`, `rood` of `zwart`). Bij het rad filter je op kleur, zodat beginners geen zwarte piste krijgen. De lijst bevat echte, benoemde pistes van Les Deux Alpes met hun kleur uit [OpenStreetMap](https://www.openstreetmap.org) (de genummerde stukjes zijn weggelaten).
- **`drankZinnen`** en **`pisteZinnen`:** de ondertitels onder de uitslag, bijvoorbeeld *Santé!* of *Helm goed vast?*. Bij elke draai wordt er willekeurig één gekozen; bij pistes uit `algemeen` plus die van de kleur van de piste.
- **`drankjes`** en **`klosOpdrachten`:** vrij aan te vullen. Bij het rad *Drankje* kies je zelf welke drankjes meedoen, en kun je er eigen drankjes bij zetten (die blijven op de telefoon bewaard). Schrijf een klosopdracht zonder hoofdletter en zonder punt aan het eind (*haalt de volgende ronde*); de app zet er de naam voor.
- **Casino:** de vijfde keuze bovenin het tabblad Rad, voor iedereen. Het heet altijd *Josjes casino*, maar iedereen speelt met eigen fiches op de eigen telefoon. Wiel, speelveld, fiches en inzet passen samen op één scherm (het wiel schaalt mee met de schermhoogte); je saldo staat rechtsboven op de tafel en daaronder kies je de spelers. De uitslag verschijnt in een popup, bijvoorbeeld *Tom neemt een slok!*.
- **Roulette:** een groene 0 en de getallen 1 tot het aantal spelers (zelfde keuze als bij *Klos*). Oneven is rood, even zwart; elk getal hoort bij één naam, elke ronde opnieuw geschud. De 0 betekent *Iedereen drinkt*. Inzetten met fiches van 10, 25 of 100 op een getal, de 0, rood/zwart of even/oneven, en dan *Rien ne va plus!*. Uitbetaling: rood/zwart/even/oneven 1:1, een getal of de 0 (aantal spelers − 1):1; valt de 0, dan verliezen rood/zwart/even/oneven. De fiches (start 1000) zijn nep en staan alleen op de telefoon. Zijn ze op, dan verschijnt *Trek een bak voor 500 nieuwe fiches*, met een teller hoeveel bakken er al getrokken zijn.
- **Geluid en beweging:** bij het draaien klinkt een tikje (uit te zetten met het knopje linksboven op het rad). Staat op de telefoon *minder beweging* aan, dan verschijnt de uitslag meteen, zonder draaien.

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
- Kiest iemand op een tweede apparaat zelf dezelfde naam (bijvoorbeeld Safari én de app op het beginscherm van dezelfde iPhone, die elk een eigen opslag hebben), dan neemt dat apparaat de naam over. Het oude apparaat pakt hem daarna niet vanzelf terug bij het opnieuw verbinden: het laat de naam los en toont op Home *"… is op een ander apparaat gekozen"* met de knop *Toch dit apparaat gebruiken*. Zo springen naam en score niet meer heen en weer als iemand afwisselend Safari en de app opent (bijvoorbeeld via een link in de groepsapp, die op een iPhone in Safari opent).
- De reisleiding logt in via *Kamers → ⚙️ Beheer (reisleiding)* met een inlogmail (link én code). Wie beheerder is, staat in de tabel `beheerders`.
- Elke tabel heeft Row Level Security: iedereen leest alleen wat nodig is, schrijft alleen eigen rijen; alleen beheerders mogen corrigeren en verwijderen.
- Alle SQL staat in `supabase/migrations/` (op volgorde uitvoeren; elk bestand mag vaker gedraaid worden).

### Eenmalig instellen (stap voor stap)

> **Al gedaan (20 oktober 2026):** project `tweeslag-wispo` (ref `pqxvfewizjyqeoerzjwx`) in *North EU (Stockholm)*, migratie 0001 uitgevoerd (0002 en 0003 op 21 oktober, inclusief de stemmingen uit `stemmingen.json`; 0004, de Edge Function `meldingen`, de cronjob en 0005 met de bucket `fotos` ook op 21 oktober; 0006 voor de live locatie op 23 oktober; 0007 voor de profielen en 0008 voor de kamerverdeling op 25 oktober), ronaldsteenkamp@gmail.com als beheerder, anoniem inloggen aan, URL's ingesteld en de GitHub-variabelen gezet. De stappen hieronder zijn er om het opnieuw te kunnen doen.

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

- **Versturen:** elke telefoon stuurt zijn volledige spelstand (afgevinkte challenges, busbingovakjes en de punten) naar de tabel `voortgang`. Zonder internet blijft er een markering "nog versturen" staan; zodra er weer verbinding is gaat de actuele stand alsnog. Omdat steeds de hele stand gaat, maakt dubbel of laat versturen niets uit.
- **Punten:** de telefoon rekent met dezelfde regels uit `spel.json` als het scherm *Jouw score*; de server bewaart de punten én wat er is afgevinkt, met grenzen (max. 5000 challengepunten, 1000 busbingopunten). Bewust niet op de server berekend: de spelregels staan in `spel.json` op de website en niet in de database, dus dan zou je bij elke wijziging ook de database moeten bijwerken. Klopt er iets niet, dan corrigeert een beheerder.
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
- **Fotomuur:** *Spel → 📸 Fotomuur*, de nieuwste eerst, met naam, kamer, challenge en tijd. Tik op een foto om hem schermvullend te bekijken; veeg naar links of rechts (of gebruik de pijltjes) voor de volgende of vorige foto, en veeg omlaag om te sluiten. Aan het eind van de muur worden vanzelf meer foto's geladen. Nieuwe foto's verschijnen vanzelf (Supabase Realtime). Op Home staan de vier nieuwste.
- **Privé:** de bucket is niet openbaar. De app vraagt per foto een tijdelijke link (signed URL) aan die een uur geldig is; dat kan alleen een apparaat dat in de app is aangemeld. Naam en kamer bij een foto zet de server erbij, niet de telefoon.
- **Verwijderen:** alleen beheerders (ingelogd) kunnen foto's van de muur halen, ook de maker zelf niet. Open de foto en tik op *Verwijderen*. De database dwingt dat af (migratie `0009_fotos_alleen_beheer_verwijdert.sql`).
- **Grenzen:** alleen JPEG of WebP, max. 1 MB per bestand. Het gratis abonnement heeft 1 GB opslag: genoeg voor duizenden foto's.
- **Zonder internet** zie je de laatst geladen muur; uploaden kan alleen met verbinding.

### Live locatie op de pistekaart
Migratie: `supabase/migrations/0006_locaties.sql` (maakt ook een cronjob die oude locaties elk uur weggooit).

- **Delen:** op het scherm *Kaart* staat bovenin **📍 Deel mijn locatie**. De eerste keer legt de app uit wat dat betekent; daarna vraagt de telefoon om toestemming voor je locatie. Zolang het aan staat zie je *Je deelt je locatie · Stop*.
- **Wat anderen zien:** een gekleurde stip met je naam op de pistekaart, die live meebeweegt (Supabase Realtime). Jouw eigen stip heeft een gele ring en heet *Jij*. Een locatie die langer dan 5 minuten niet is bijgewerkt wordt vager; na een uur verdwijnt hij helemaal.
- **Tik op een stip:** naam, kamer, hoe lang geleden, de nauwkeurigheid en een knop **Precies op Google Maps** (de exacte plek). Bij je eigen stip staat ook *Stop met delen*.
- **Buiten de kaart:** iemand die niet in het skigebied is (bijvoorbeeld nog thuis), staat bovenin als *Naam · buiten de kaart*.
- **Alleen met de app open:** een webapp krijgt geen locatie als hij op de achtergrond staat of het scherm uit is. Dan blijft je laatste positie staan, met de tijd erbij. Open je de app weer, dan gaat het vanzelf verder.
- **Privacy:** alleen wie zelf op *Deel mijn locatie* tikt, deelt iets. Alleen apparaten in de app zien de locaties, en alleen van het afgelopen uur. *Stop* verwijdert je locatie meteen van de server; oudere locaties ruimt de server elk uur op. Posities worden afgerond op ongeveer 1 meter.

**Hoe komt een GPS-positie op de getekende pistekaart?** De pistekaart is een panoramatekening, geen kaart op schaal. In `src/lib/georef.ts` staan 13 ijkpunten: liftstations met hun echte coördinaten (uit OpenStreetMap) en hun plek op de tekening. Een *thin-plate spline* buigt de tekening zo vloeiend mogelijk tussen die punten. Op een ijkpunt klopt het precies; ertussen zit het gemiddeld zo'n 50 pixels (ongeveer een pistebreedte op de tekening) naast. Voor de exacte plek is er de knop naar Google Maps. Vervang je `pistekaart.jpg` door een nieuwe kaart, zoek dan dezelfde stations op en pas hun `x`/`y` (in pixels) in `georef.ts` aan.

### Profielen (fase 7)
Migratie: `supabase/migrations/0007_profielen.sql` (uitvoeren na 0006). Gebruikt de bucket `fotos` uit 0005 voor de profielfoto's.

**Migratie draaien:** open in Supabase *SQL Editor → New query*, plak de hele inhoud van `0007_profielen.sql` en klik op *Run*. Het script mag vaker gedraaid worden, ook als je een eerdere versie (zonder artiest) al had gedraaid: dan voegt het de kolom `artiest` toe en zet het de regels opnieuw. Controle: onder *Table Editor* staat nu de tabel `profielen`. Zolang de migratie niet gedraaid is, werkt de rest van de app gewoon; profielen blijven dan alleen op de eigen telefoon staan (met "nog versturen") en gaan vanzelf mee zodra de tabel er is.

- **Invullen:** direct na de eerste keer naam kiezen (welkomstscherm, of bij *Kamers*) komt het profielscherm. Met *Later invullen* sla je het over; dan staat er op Home een herinnering tot het profiel af is. Heeft je naam al een profiel (bijvoorbeeld van je vorige telefoon), dan wordt het niet opnieuw gevraagd.
- **Velden:** ⛷️ ski, board, allebei of nog nooit gedaan; 📊 niveau 1 tot 5 (van *Waar zit de rem?* tot *Zwarte piste voor ontbijt*); 🤫 een feitje dat niemand van je weet (max. 140 tekens); 🎤 karaokenummer: nummer en artiest (elk max. 60); 🥶 grootste angst (max. 80); 📸 een profielfoto. Alle vragen zijn verplicht; alleen de foto mag je overslaan. Pas als alles is ingevuld kun je opslaan, en zolang dat niet zo is staat de herinnering op Home (ook bij wie zijn profiel al eerder half invulde).
- **Aanpassen:** tik op Home op je eigen naam (*Hoi …!*). Daar staan je profiel en *Andere naam kiezen* samen. Of open je eigen kaartje en tik op *Aanpassen*.
- **Bekijken:** tik op een naam bij *Kamers* of in *Spel → Klassement* voor iemands profielkaartje: foto (of initialen), ski/board, niveau, feitje, karaokenummer met artiest (*Dancing Queen – ABBA*) en angst.
- **Foto:** na het kiezen zie je de foto met een rondje erover: sleep om te verplaatsen, knijp (of gebruik de schuif of − en +) om in en uit te zoomen. Wat in het rondje staat wordt de profielfoto; met *Opnieuw bijsnijden* pas je het daarna nog aan. De telefoon snijdt dat vierkant uit en verkleint het tot max. 512 px en ~90 kB JPEG, zonder locatie- en cameragegevens. Hij staat in de privé-bucket `fotos` in de map van het apparaat (`<user_id>/profiel-….jpg`) en is alleen via tijdelijke links te zien, net als de fotomuur. Profielfoto's komen niet op de fotomuur.
- **Op naam:** net als de correcties hangt een profiel aan de naam, niet aan de telefoon. Iedereen in de app mag alle profielen lezen; schrijven mag alleen het apparaat dat die naam nu heeft (regel `is_eigen_naam` in de database). Kiest iemand zijn naam op een nieuwe telefoon, dan komt zijn profiel mee.
- **Zonder internet:** je eigen profiel staat op de telefoon en gaat naar de server zodra er verbinding is (dezelfde "nog versturen"-markering als de spelstand; ook een nieuwe foto wacht dan op de telefoon). De profielen van iedereen en hun foto's worden bewaard, dus kaartjes die je eerder zag (of die bij het openen van de app al binnenkwamen) blijven zonder bereik te zien.
- **Ongepast profiel wissen (beheerders):** log in als beheerder (*Kamers → ⚙️ Beheer*), tik op de naam van diegene bij *Kamers* of in het klassement en kies **Profiel wissen (beheer)**. Het profiel en de foto verdwijnen; op diens telefoon wordt het profiel ook leeggemaakt en verschijnt de herinnering weer. Zonder de app kan het ook in *SQL Editor*:
  ```sql
  delete from public.profielen where lower(naam) = lower('Naam');
  ```
  De foto staat dan nog in *Storage → fotos* (de map met het `user_id`; het pad staat in de kolom `foto_pad`). Verwijder hem daar met *Delete*.

### Kamerverdeling opslaan
Migratie: `supabase/migrations/0008_kamerverdeling.sql` (uitvoeren na 0007). Open *SQL Editor → New query*, plak het bestand en klik op *Run*; het mag vaker. Daarna werkt **Opslaan in de app** bij *Kamerverdeling maken*. Iedereen in de app kan de verdeling lezen; alleen ingelogde beheerders (tabel `beheerders`) kunnen hem opslaan. Zolang de migratie niet gedraaid is, zegt de app dat bij het opslaan en blijft `kamers.json` gelden.

### Let op: gratis project pauzeert
Een gratis Supabase-project wordt **na een week zonder gebruik gepauzeerd**. De app laat dan *Geen verbinding* zien (de rest werkt door). Je zet het weer aan via het Supabase-dashboard → project → *Restore project* (duurt een paar minuten). **Controleer dit een paar dagen voor vertrek** en open de app daarna af en toe; tijdens de reis houdt het gebruik het project vanzelf actief.

Verder handig om te weten over het gratis abonnement: de standaard-mailserver van Supabase verstuurt maar een paar inlogmails per uur (genoeg voor de reisleiding), en per internetverbinding kunnen standaard zo'n 30 anonieme aanmeldingen per uur. Zitten veel mensen tegelijk op één wifi, dan kun je dat verhogen onder *Authentication → Rate Limits*.

### Privacy en opruimen na de reis
- Alleen voornamen en kamernummers gaan naar de server, in een EU-regio. Geen e-mailadressen van deelnemers; alleen de beheerders loggen in met e-mail.
- Stemmen worden opgeslagen met de voornaam van de kiezer (nodig voor "één stem per naam"). Alleen jijzelf ziet in de app op wie je stemde; de beheerders niet.
- **Na de reis alles verwijderen:** voer `supabase/opruimen.sql` uit in de SQL Editor (verwijdert alle gebruikers met hun voortgang en meldingsabonnementen, de correcties, de stemmingen met alle stemmen, het meldingenlogboek en de sleutels, de live locaties, de profielen, de kamerverdeling, de beheerderslijst, en stopt de planner en de opruimtaak van de locaties). De fotobestanden zelf kun je niet met SQL weghalen: ga naar *Storage → fotos*, selecteer alle mappen en kies *Delete*. Of verwijder in één keer het hele project: *Project Settings → General → Delete project*.
- Haal daarna in GitHub de twee variabelen weg; de app werkt dan weer zonder backend.

## QR-code

```bash
npm run qr
```
Dit maakt `qr/tweeslag-wispo-qr.png` (om te printen) en `qr/tweeslag-wispo-qr.svg` met de URL uit `homepage` in `package.json`. Een andere URL kan ook: `npm run qr -- https://voorbeeld.nl/`.

## Installeren op de telefoon

Wie de app voor het eerst opent (bijvoorbeeld via de QR-code), krijgt een welkomstscherm: eerst de eigen naam kiezen, dan het profiel (mag later), daarna uitleg om de app op het beginscherm te zetten. Op een iPhone heeft de app op het beginscherm een eigen opslag, dus daar wordt de naam bij de eerste keer openen nog één keer gevraagd; het welkomstscherm zegt dat er ook bij. Wie alleen Safari gebruikt, raakt naam en voortgang kwijt als de site een week niet geopend wordt (Safari wist dan alle opslag van een website); de app op het beginscherm heeft daar geen last van. Zolang de app nog niet op het beginscherm staat, laat Home ook een banner met uitleg zien:
- **iPhone (Safari):** Deel-knop → *Zet op beginscherm* → *Voeg toe*.
- **Android (Chrome):** knop *Installeren* in de app, of menu ⋮ → *App installeren*.

## Hoe het werkt (voor wie verder wil bouwen)

- Vite + React + TypeScript, met `vite-plugin-pwa` voor het manifest en de service worker.
- De app zelf, de iconen en de pistekaart worden vooraf bewaard (cache-first). De JSON-data gaat network-first: eerst internet (max. 5 seconden wachten), anders de bewaarde versie.
- Persoonlijke gegevens staan in `localStorage` onder `tweeslag-wispo.*`.
- Code: `src/screens/` (de zeven schermen), `src/components/`, `src/lib/` (tijd, opslag, data, bingo, profiel).
