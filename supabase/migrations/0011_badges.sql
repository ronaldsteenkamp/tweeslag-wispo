-- Tweeslag Wispo · badges
-- De badges op de profielen rekent de app zelf uit, uit gegevens die er al zijn (spelvoortgang,
-- fotomuur, stemmingen, klassement, profielen). Alleen voor 🎒 Ingepakt is iets nieuws nodig:
-- de paklijst staat alleen op de telefoon, dus de app stuurt mee óf je alles ingepakt hebt.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0010).
-- Het script mag vaker uitgevoerd worden. Zonder dit script werkt de app gewoon; alleen de
-- badge Ingepakt is dan niet bij anderen te zien.
--
-- Rechten: voortgang heeft al tabelrechten en "eigen voortgang wijzigen" (0002_scorebord.sql),
-- dus iedereen kan alleen zijn eigen vlag zetten en iedereen kan hem lezen.

alter table public.voortgang add column if not exists ingepakt boolean not null default false;
