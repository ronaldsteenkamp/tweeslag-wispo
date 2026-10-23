-- Tweeslag Wispo · NA DE REIS: alle gedeelde gegevens verwijderen
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run.
-- Dit kan niet ongedaan worden gemaakt.
--
-- Nog grondiger: verwijder het hele project via
-- Project Settings → General → Delete project. Dan is alles in één keer weg.

-- Alle gebruikers (anonieme apparaten én beheerders). Via "on delete cascade"
-- verdwijnen daarmee ook de deelnemers en hun spelvoortgang.
delete from auth.users;

-- Gegevens die op naam staan (niet aan een apparaat gekoppeld)
delete from public.correcties;
delete from public.stemmingen;  -- de stemmen gaan automatisch mee

-- Meldingen: logboek en sleutels (de abonnementen gingen al mee met de gebruikers),
-- en de planner die elke 5 minuten draait
delete from public.meldingen;
delete from public.push_sleutels;
select cron.unschedule(jobid) from cron.job where jobname = 'tweeslag-meldingen';

-- Live locaties (gingen al mee met de gebruikers) en de opruimtaak daarvan
delete from public.locaties;
select cron.unschedule(jobid) from cron.job where jobname = 'tweeslag-locaties-opruimen';

-- De lijst met beheerders (e-mailadressen)
delete from public.beheerders;

-- Foto's: de gegevens gingen al mee met de gebruikers. De BESTANDEN zelf kunnen niet via SQL
-- worden verwijderd. Doe dat in het dashboard: Storage → bucket "fotos" → alle mappen
-- selecteren → Delete. Daarna eventueel de bucket zelf verwijderen (… → Delete bucket).
delete from public.fotos;
