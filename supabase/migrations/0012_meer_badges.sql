-- Tweeslag Wispo · meer badges
-- Drie dingen voor de nieuwe badges (zie src/lib/badgeregels.ts):
--
--  1. voortgang.badges: de badges die alleen de telefoon zelf kan zien (app op het beginscherm,
--     meldingen aan, casino, op de gletsjer, vroeg of midden in de nacht open, je eigen stemmen).
--     De telefoon stuurt ze mee met de spelvoortgang, zodat anderen ze op je profiel zien.
--     Vorm: {"vaste-gast": 1, "waarzegger": 3}: badge → aantal.
--  2. voortgang.ingepakt_op: wanneer je de hele paklijst voor het eerst af had (🐦 Vroege vogel).
--     De app zet dit één keer en past het daarna niet meer aan.
--  3. rad_uitslagen: wie het klos-rad koos (🎡 Lot uit de loterij). Op de server, zodat het telt
--     voor iedereen en niet alleen op de telefoon die draaide.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0011).
-- Het script mag vaker uitgevoerd worden. Zonder dit script werkt de app gewoon; alleen zien
-- anderen de badges van je telefoon dan niet en zijn Vroege vogel en Lot uit de loterij niet te halen.
--
-- Rechten: voortgang heeft al "eigen voortgang wijzigen" (0002_scorebord.sql), dus iedereen kan
-- alleen zijn eigen badges en moment zetten, en iedereen kan ze lezen.

-- ---------------------------------------------------------------------------
-- 1 en 2: nieuwe kolommen in voortgang
-- ---------------------------------------------------------------------------
alter table public.voortgang add column if not exists badges jsonb not null default '{}'::jsonb;
alter table public.voortgang add column if not exists ingepakt_op timestamptz;

-- Een object met hooguit een paar tientallen badges, geen onzin
alter table public.voortgang drop constraint if exists voortgang_badges_vorm;
alter table public.voortgang add constraint voortgang_badges_vorm
  check (jsonb_typeof(badges) = 'object' and pg_column_size(badges) <= 2000);

-- ---------------------------------------------------------------------------
-- 3: uitslagen van het klos-rad
-- ---------------------------------------------------------------------------
create table if not exists public.rad_uitslagen (
  id        bigint generated always as identity primary key,
  -- Wie er gekozen is (gewone naam uit kamers.json)
  naam      text not null check (char_length(naam) between 1 and 40 and naam = trim(naam)),
  -- Wanneer er gedraaid is, volgens de telefoon (kan later verstuurd zijn, na een tijd zonder bereik)
  gedraaid  timestamptz not null check (gedraaid <= now() + interval '10 minutes'),
  door      uuid not null default auth.uid() references public.deelnemers (user_id) on delete cascade,
  gemaakt   timestamptz not null default now()
);

create index if not exists rad_uitslagen_naam on public.rad_uitslagen (lower(naam));

alter table public.rad_uitslagen enable row level security;

drop policy if exists "rad_uitslagen lezen" on public.rad_uitslagen;
create policy "rad_uitslagen lezen" on public.rad_uitslagen
  for select to authenticated
  using (true);

-- Alleen een apparaat met een naam, en altijd als zichzelf
drop policy if exists "eigen rad_uitslag aanmaken" on public.rad_uitslagen;
create policy "eigen rad_uitslag aanmaken" on public.rad_uitslagen
  for insert to authenticated
  with check (door = auth.uid());

-- Wijzigen kan niet; weghalen alleen door een beheerder (bijv. na een grap die te ver ging)
drop policy if exists "rad_uitslagen verwijderen door beheerder" on public.rad_uitslagen;
create policy "rad_uitslagen verwijderen door beheerder" on public.rad_uitslagen
  for delete to authenticated
  using (public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------
revoke all on public.rad_uitslagen from anon, authenticated;
grant select, insert, delete on public.rad_uitslagen to authenticated;
grant all on public.rad_uitslagen to service_role;
