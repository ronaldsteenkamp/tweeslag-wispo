# Instellingen in de Wispo-app – voorstel

*Stand van `main` op 25-11-2026 (27e6d2e). Er is nog niets gebouwd; dit is een voorstel om goed te keuren.*
*Bijgewerkt na feedback: geen nieuwe stijl, geen tekstgrootte.*

## In het kort

Er is al een scherm **Instellingen**. Je komt er via de onderste rij op Home. Er staan nu een thema, sneeuw, meldingen en twee uitleg-blokken op. Ik stel voor **dat scherm aan te vullen in de stijl die het nu heeft**: dezelfde kop, dezelfde kopjes en dezelfde rijen met een rond bord en een schakelaar. Er komt geen nieuw tabblad en geen nieuwe vormgeving.

Er komen **vijf "moet"-instellingen** bij of worden beter:

1. **Zuinig op de berg**: één schakelaar zet de sneeuw, de animaties en het "scherm aan houden" uit.
2. **Meldingen per soort**: wel een seintje voor de bus, niet voor de stemming. Nu is het alles of niets.
3. **Klaar voor de berg?**: een lijstje dat laat zien wat er offline op je telefoon staat, met een knop *App verversen*.
4. **Op je beginscherm**: de installatie-uitleg staat altijd hier, niet alleen in een banner die een week wegblijft.
5. **Thema**: bestaat al en blijft. De uitleg noemt erbij dat donker zuiniger is.

Een paar dingen uit de opdracht vallen af:
- tekstgrootte
- taal
- noodcontact
- kaarteenheden
- kamernummer kiezen
- vooraf downloaden
- gegevens exporteren

De redenen staan in stap 2.

---

## Stap 1 – Wat is er nu al instelbaar?

Alles wordt bewaard via `src/lib/opslag.ts` (`useOpgeslagen`/`lees`/`schrijf`). Dat is localStorage met het voorvoegsel `tweeslag-wispo.`. De sleutels in `PERSOONLIJK` (`src/lib/persoonsdataregels.ts`) gaan daarnaast per naam naar de server (tabel `persoonsdata`).

### 1a. Al echte instellingen

| Waar | Wat | Sleutel | Bewaard | Standaard |
|---|---|---|---|---|
| Instellingen | Thema Telefoon / Licht / Donker | `thema` (ook gelezen in `index.html` vóór het tekenen) | telefoon | Licht |
| Instellingen | Sneeuw in de blauwe koppen | `sneeuw.aan` | telefoon | aan |
| Instellingen | Meldingen aan/uit (één schakelaar) | `meldingen.uitgezet`, `meldingen.gekoppeld` + tabel `push_abonnementen` | telefoon + server | aan zodra er toestemming is |
| Instellingen | Versie (= bouwdatum), logo → VakanCie-pagina | – | – | – |
| Kaart | Live locatie delen | `locatie.delen` + tabel `locaties` (verdwijnt na 1 uur) | telefoon + server | uit |
| Rad | Geluid en trillen | `rad.geluid` | telefoon | aan |
| Spel | Geluid en trillen (los van het rad) | `spel.geluid` | telefoon | aan |
| Spel | Klassement per persoon of per kamer | `spel.stand.soort` | telefoon | personen |
| Home | Installatiebanner verbergen | `installatie.verborgen` (een week) | telefoon | – |

### 1b. Eigen gegevens die je zelf invult

| Onderdeel | Wat | Bewaard |
|---|---|---|
| Profiel | naam (via *Andere naam kiezen*), bijnaam, foto 4:5, ski/board/allebei/"hier voor bier", niveau 1–5 (pistekleur), feitje, karaoke, artiest, angst | `profiel` + tabel `profielen`, `bijnamen` |
| Paklijst | vinkjes, **eigen items**, knop **alles uit** (bestaat al) | `paklijst.*`, per naam op de server |
| Rad | eigen raderen, drankjes aan/uit, pistekleuren, deelnemers | `rad.*`, per naam op de server |
| Spel | bingokaart, challenges, dagkaarten, krasloten, casinofiches | `spel.*`, `casino.*`, per naam op de server |
| Clubblad | eigen kiekjes en stukjes weghalen (kan al) | server |

### 1c. Ligt vast in de code, maar je wilt het misschien zelf kiezen

| Onderdeel | Ligt nu vast | Zelf kiezen? |
|---|---|---|
| Hele app | **Minder beweging** volgt alleen de systeeminstelling `prefers-reduced-motion` (sneeuw, rad, laadscherm, Spel). Weinig mensen weten dat die bestaat. | Ja, samen met batterij sparen |
| Kaart, Rad, Busbingo | **Scherm blijft aan** (Wake Lock, `src/lib/wakker.ts`), zonder keuze | Ja, uit in de zuinige stand |
| Meldingen | De server kent de soorten **planning** (30 min vooraf), **challenges** (ochtend), **uitslag** (stemming), **redactie** (je kiekje of stukje is geplaatst) en **bericht** (van de beheerder). In de app is het één schakelaar. | Ja, per soort. *Bericht* blijft altijd aan. |
| Rad en Spel | Twee aparte geluidsknoppen, elk op een eigen scherm | Eén plek die ze allebei regelt |
| Updates | `registerType: 'prompt'`: wie nooit op *Vernieuwen* tikt, houdt de oude versie (en kan zo oude data terugsturen) | Een knop *App verversen* als uitweg |
| Offline | De app, de pistekaart en `data/*.json` worden al vooraf opgeslagen. Van de foto's de laatste 150 die je zag. | Niets te kiezen, wel te **laten zien** |
| Taal | Alleen Nederlands (`lang="nl"`, teksten staan direct in de componenten) | Zie stap 2 |

---

## Stap 2 – Welke instellingen zijn handig op de berg?

Uitgangspunt: iemand op de piste met handschoenen aan, één streepje bereik en om drie uur 's middags nog 30 % batterij.

### Houden of toevoegen

**Weergave**
- *Thema* (bestaat al). In de uitleg komt erbij dat donker op de meeste telefoons zuiniger is.
- *Zuinig op de berg*: één schakelaar die
  - de sneeuw uitzet (de rij *Sneeuw* zegt dan "staat uit door Zuinig");
  - animaties zo kort mogelijk maakt (`html[data-zuinig]`, dezelfde route als `prefers-reduced-motion`; `minderBeweging()` leest het ook);
  - het scherm niet meer vanzelf aan houdt op Kaart, Rad en Bingo.

  Een losse schakelaar voor "minder animaties" komt er niet bij. Voor deze groep is het één vraag: "mijn batterij is bijna leeg".

**Meldingen**
- Per soort: **Bus & planning**, **Nieuwe challenges**, **Uitslag van de stemming**, **Jouw kiekje staat erin**. Berichten van de organisatie komen altijd door, en dat staat er ook bij.
- *Stille uren* gaat **eruit**. De meldingen komen op vaste momenten: 30 minuten voor een programmapunt, de challenges 's ochtends en de uitslag 's avonds. 's Nachts gebeurt er niets. Wie de uitslag om 21:30 te laat vindt, zet de soort *Uitslag* uit.

**Geluid**
- *Geluid en trillen*: één rij die Rad én Spel tegelijk aan- of uitzet. De knoppen in Rad en Spel blijven bestaan en lezen dezelfde waarde. Handig in de bus en om 7 uur in het appartement.

**Offline**
- *Klaar voor de berg?*: een overzicht in plaats van een downloadknop. Vooraf downloaden is niet nodig, want de service worker doet dat al. Er staat per regel of het op de telefoon staat:
  - planning
  - pistekaart
  - paklijst
  - kamers
  - weer (met het tijdstip van ophalen)
  - foto's (n van de laatste 150)
  - op beginscherm
  - meldingen
- *App verversen*: haalt de nieuwste versie op, maakt de caches `tweeslag-data` en `tweeslag-fotos` leeg en laadt de app opnieuw. Naam, paklijst en spel blijven staan, want die staan in localStorage en niet in de cache. Dit is de oplossing voor de meeste "hij doet raar"-vragen op de berg.

**Op je beginscherm**
- De `InstallatieUitleg` die er al is, maar dan altijd hier te vinden. Zonder beginscherm geen meldingen op een iPhone.

**Locatie**
- *Locatie delen*: een rij die laat zien dát je locatie gedeeld wordt ("Je stip staat op de kaart, 4 min geleden"), met een schakelaar om het uit te zetten. Je hoeft dan niet eerst naar de kaart.

**Je naam op deze telefoon**
- *Van deze telefoon af*: je naam loskoppelen, de lokale gegevens wissen en terug naar het welkomstscherm. Je gegevens blijven bij je naam op de server staan. Handig als je je telefoon even uitleent. Het uitleg-blok *Bij je naam* gaat hierin op.

**Over de app**
- Versie (bestaat), logo → VakanCie (bestaat). Erbij komt de regel *"Vragen of iets kapot? Vraag het de VakanCie"* met een link naar die pagina.

### Geschrapt of voor later

| Uit de opdracht | Besluit | Waarom |
|---|---|---|
| Tekstgrootte | **Geschrapt** | Op jouw verzoek. De telefoon heeft zelf ook een tekstgrootte. |
| Taal NL/EN | **Later**, eigenlijk geschrapt | De vereniging en de reis zijn Nederlandstalig. Alle teksten staan direct in de componenten, dus vertalen is veel werk voor misschien niemand. Pas doen als er echt een Engelstalige deelnemer meegaat. |
| Noodcontact in profiel | **Geschrapt** | De app is met een open link te bekijken (anonieme login): iedereen met de link kan alle profielen lezen. Daar hoort geen telefoonnummer van je ouders in. Beter is een tip in *Klaar voor de berg?* om de **Medische ID / noodinfo van je telefoon** in te vullen. Die is ook op een vergrendeld scherm te zien. |
| Kaart: eenheden km/m | **Geschrapt** | De kaart is de officiële pistekaart als tekening. De app toont geen afstanden (alleen "zo'n 50 m speling"). |
| Kaart: standaard zoom/startlocatie | **Geschrapt** | "Waar ben ik?" doet dat al met één tik. |
| Kamernummer in profiel | **Geschrapt** | Je kamer komt uit de kamerverdeling van de reisleiding. Je kiest hem niet zelf. |
| Wie ziet mijn profiel / kamer / foto's | **Later** | Met de anonieme login kan de server een deelnemer niet onderscheiden van "iemand met de link". Een schakelaar die iets belooft wat hij niet waarmaakt, is erger dan geen schakelaar. Het blok *Wie ziet wat?* blijft daarom eerlijk uitleggen hoe het zit. |
| Naam bij mijn kiekjes op het clubblad | **Later** | Het clubblad draait juist om namen. Wil je een kiekje toch niet erin, dan haal je het weg (kan al). |
| Gegevens exporteren | **Geschrapt** | Na de reis kan iedereen het clubblad als zip downloaden. Meer is er niet. |
| Gegevens verwijderen (server) | **Later** | Je kunt je profiel al leegmaken en je kiekjes weghalen. Alles wissen op de server is één verzoek aan de beheerder. Een knop is pas nodig als iemand erom vraagt. |
| Paklijst resetten / eigen items | **Bestaat al** | Staat op de Paklijst zelf en hoeft niet dubbel in Instellingen. |
| Profiel (naam, foto, niveau) | **Bestaat al** | Blijft op het profiel. Instellingen gaan over de *telefoon*, het profiel over *jou*. |

---

## Stap 3 – Prioriteiten

| Instelling | Wat het doet | Waarom nuttig tijdens de reis | Moeite | Prioriteit |
|---|---|---|---|---|
| **Zuinig op de berg** | Sneeuw uit, animaties kort, scherm niet vanzelf aan | Een telefoon is in de kou snel leeg, zo houdt hij de middag langer vol | middel | **moet** |
| **Meldingen per soort** | Vier schakelaars onder de hoofdschakelaar | Wie de stemming niet boeit, hoeft niet ook het seintje voor de bus uit te zetten | middel (migratie + Edge Function) | **moet** |
| **Klaar voor de berg?** | Wat staat er offline, plus *App verversen* | Met een gerust hart de lift in zonder bereik; de uitweg als de app "raar doet" | middel | **moet** |
| **Op je beginscherm** | Installatie-uitleg die je altijd kunt terugvinden | Zonder installatie geen meldingen op een iPhone en minder goed offline | klein | **moet** |
| **Thema** | Telefoon / Licht / Donker (bestaat) | Donker in de bus en bij de après-ski | – (bestaat) | **moet** (houden) |
| Geluid en trillen | Eén rij voor Rad + Spel | Stil in de bus en in het appartement | klein | handig |
| Locatie delen | Status + uitzetten vanuit Instellingen | Snel je stip weghalen zonder eerst naar de kaart | klein | handig |
| Van deze telefoon af | Naam loskoppelen, opnieuw beginnen | Telefoon uitlenen of een nieuwe telefoon | klein | handig |
| Contactregel VakanCie | Link naar de VakanCie-pagina | Weten bij wie je terechtkunt | klein | handig |
| Medische ID-tip | Tip in *Klaar voor de berg?* | Veiligheid zonder privacyrisico | klein | handig |
| Privacy-keuzes per onderdeel | Wie ziet wat | Pas zinvol als iedere deelnemer echt inlogt | groot | later |
| Server-gegevens wissen | Alles van jouw naam weg | AVG-netjes | middel | later |
| Engels | Tweede taal | Alleen bij een deelnemer die geen Nederlands spreekt | groot | later |

---

## Stap 4 – Opbouw

### Waar komen ze?

Ze komen **op het bestaande scherm Instellingen**. Er komt geen eigen tabblad (de tabbalk is vol, en je komt hier maar een paar keer per reis) en geen tandwiel in elke kop. De rij onderaan Home blijft. Alleen de onderregel verandert met de stand mee, bijvoorbeeld "Zuinig staat aan" of "Nog 2 dingen voor de berg".

### Hoe worden ze bewaard?

- **Per telefoon in localStorage** via `useOpgeslagen`, net als `thema` en `sneeuw.aan`. Ze komen bewust **niet** in `PERSOONLIJK`: zuinig en geluid horen bij het apparaat. Nieuwe sleutels: `zuinig` (zelf aangezet) en `zuinig.nietVanzelf` (zelf uitgezet terwijl hij vanzelf aan stond). Geluid krijgt geen nieuwe sleutel: de rij zet `rad.geluid` en `spel.geluid` samen.
- *Gebouwd (PR 1):* Zuinig gaat **vanzelf aan bij 20% batterij of minder** als de telefoon niet aan de lader hangt (alleen waar de browser de batterij laat zien, zoals Chrome op Android). Zet je hem dan zelf uit, dan blijft hij uit tot de telefoon aan de lader gaat of weer boven de 20% komt.
- **`index.html`** leest `zuinig` vóór het tekenen, naast `thema`, zodat er niets verspringt.
- **Meldingen per soort op de server**, want daar worden ze verstuurd:
  - Migratie `0022_meldingsoorten`: een kolom `soorten text[]` op `push_abonnementen`, standaard alle vier.
  - Een rpc `zet_meldingsoorten(p_endpoint, p_soorten)`.
  - De Edge Function `meldingen` filtert op die kolom; `bericht` gaat altijd door.

  De keuze geldt dus per apparaat, net als het abonnement. Vlak voor het mergen het laatste migratienummer op `origin/main` controleren.

### Schermindeling (in de huidige stijl)

Alles gebruikt wat er al is: `SchermKop`, kopjes `home__kopje`, rijen `homerij` met een rond `bord` en een `schakelaar`, en het `segment` voor het thema.

```
SchermKop "Instellingen" · ‹ Home

Weergave
  [segment] Telefoon | Licht | Donker
  uitleg: … en op de meeste telefoons zuiniger.
  (blauw bord)  Sneeuw                              [schakelaar]
  (zwart bord)  Zuinig op de berg                   [schakelaar]
                Sneeuw, bewegen en scherm-aan uit

Meldingen
  (rood bord)   Meldingen                           [schakelaar]   ← bestaande MeldingenKaart
                Bus & planning                      [schakelaar]   ← alleen als Meldingen aan staat,
                Nieuwe challenges                   [schakelaar]     ingesprongen onder de hoofdrij
                Uitslag van de stemming             [schakelaar]
                Jouw kiekje staat erin              [schakelaar]
                Berichten van de organisatie komen altijd door.
  (blauw bord)  Geluid en trillen (Rad en Spel)     [schakelaar]
  (groen bord)  Je locatie wordt gedeeld            [schakelaar]   ← alleen als delen aan staat

Klaar voor de berg?
  ✓ Planning · ✓ Pistekaart · ✓ Paklijst · ✓ Kamers
  ✓ Weer (09:12) · ✓ Foto's (87) · – Beginscherm · – Meldingen   ← compacte lijst; tik op een "–" voor uitleg
  Tip: vul de noodinfo van je telefoon in (Medische ID).
  [App verversen]                                                  ← gewone knop (knop--secundair)
  (lichtblauw bord) Op je beginscherm  ›                           ← klapt InstallatieUitleg open

Wie ziet wat?          (bestaand blok)
Van deze telefoon af   (rij met pijl → BevestigDialoog)

voet: logo · "Vragen? De VakanCie helpt" · versie
```

### Volgorde als je akkoord geeft

1. PR 1 (alleen de app): zuinig, geluid, beginscherm, *Klaar voor de berg?* en *App verversen*.
2. PR 2: meldingen per soort (migratie 0022, Edge Function, app).
3. PR 3 (handig): locatie-rij, *Van deze telefoon af*, contactregel.

### Besluiten (25-11-2026)

- Akkoord op PR 1 en PR 2.
- **Zuinig op de berg** mag vanzelf aan bij weinig batterij.
- Berichten **van de organisatie** komen altijd door.
- Na live gaan (25-11-2026): het lijstje *Klaar voor de berg?* en de Medische ID-tip gaan er weer uit. *App verversen* blijft, als los blok "Doet Wispo raar?" onderaan Instellingen.
