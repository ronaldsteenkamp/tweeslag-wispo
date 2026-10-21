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

-- De lijst met beheerders (e-mailadressen)
delete from public.beheerders;

-- Foto's (vanaf fase 5): leeg daarnaast de bucket via Storage → bucket → alles selecteren → Delete.
