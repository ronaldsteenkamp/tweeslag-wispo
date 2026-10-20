-- Tweeslag Wispo · NA DE REIS: alle gedeelde gegevens verwijderen
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run.
-- Dit kan niet ongedaan worden gemaakt.
--
-- Nog grondiger: verwijder het hele project via
-- Project Settings → General → Delete project. Dan is alles in één keer weg.

-- Alle gebruikers (anonieme apparaten én beheerders). Via "on delete cascade"
-- verdwijnen daarmee ook de deelnemers en alles wat aan hen gekoppeld is.
delete from auth.users;

-- De lijst met beheerders (e-mailadressen)
delete from public.beheerders;

-- Foto's (vanaf fase 5): leeg daarnaast de bucket via Storage → bucket → alles selecteren → Delete.
