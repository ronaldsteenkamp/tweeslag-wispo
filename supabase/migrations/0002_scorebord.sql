-- Tweeslag Wispo · fase 2: scorebord
-- Voortgang per apparaat, correcties/bonuspunten door beheerders en het klassement.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0001_basis.sql).
-- Het script mag vaker uitgevoerd worden.
--
-- Waarom de telefoon de punten berekent: de spelregels staan in spel.json op de website,
-- niet in de database. De app rekent met precies dezelfde regels als het scherm "Jouw score"
-- en stuurt naast de punten ook mee wélke challenges en bingovakjes zijn afgevinkt.
-- Beheerders kunnen dat nakijken en met correcties bijsturen; grenzen voorkomen onzin.

-- ---------------------------------------------------------------------------
-- Voortgang: de volledige stand van één apparaat (wordt steeds helemaal overschreven)
-- ---------------------------------------------------------------------------
create table if not exists public.voortgang (
  user_id          uuid primary key default auth.uid() references public.deelnemers (user_id) on delete cascade,
  challenges       text[] not null default '{}' check (cardinality(challenges) <= 200),
  bingo            text[] not null default '{}' check (cardinality(bingo) <= 25),
  challenge_punten integer not null default 0 check (challenge_punten between 0 and 5000),
  bingo_punten     integer not null default 0 check (bingo_punten between 0 and 1000),
  bijgewerkt       timestamptz not null default now()
);

create or replace function public.zet_bijgewerkt()
returns trigger
language plpgsql
as $$
begin
  new.bijgewerkt := now();
  return new;
end;
$$;

drop trigger if exists voortgang_bijgewerkt on public.voortgang;
create trigger voortgang_bijgewerkt
  before insert or update on public.voortgang
  for each row execute function public.zet_bijgewerkt();

alter table public.voortgang enable row level security;

drop policy if exists "voortgang lezen" on public.voortgang;
create policy "voortgang lezen" on public.voortgang
  for select to authenticated
  using (true);

drop policy if exists "eigen voortgang aanmaken" on public.voortgang;
create policy "eigen voortgang aanmaken" on public.voortgang
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "eigen voortgang wijzigen" on public.voortgang;
create policy "eigen voortgang wijzigen" on public.voortgang
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "voortgang verwijderen" on public.voortgang;
create policy "voortgang verwijderen" on public.voortgang
  for delete to authenticated
  using (user_id = auth.uid() or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Correcties en bonuspunten (alleen beheerders). Per persoon (op naam, zodat het
-- blijft gelden als iemand van telefoon wisselt) óf per kamer.
-- ---------------------------------------------------------------------------
create table if not exists public.correcties (
  id       bigint generated always as identity primary key,
  naam     text check (naam is null or char_length(naam) between 1 and 40),
  kamer    text check (kamer is null or char_length(kamer) between 1 and 40),
  punten   integer not null check (punten between -1000 and 1000 and punten <> 0),
  reden    text not null check (char_length(trim(reden)) between 1 and 120),
  door     uuid default auth.uid() references auth.users (id) on delete set null,
  gemaakt  timestamptz not null default now(),
  check (num_nonnulls(naam, kamer) = 1)
);

alter table public.correcties enable row level security;

drop policy if exists "correcties lezen" on public.correcties;
create policy "correcties lezen" on public.correcties
  for select to authenticated
  using (true);

drop policy if exists "correcties beheren" on public.correcties;
create policy "correcties beheren" on public.correcties
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Klassement (views draaien met de rechten van de lezer, dus RLS blijft gelden)
-- ---------------------------------------------------------------------------
drop view if exists public.klassement_kamers;
drop view if exists public.klassement_personen;

create view public.klassement_personen with (security_invoker = true) as
select
  d.naam,
  d.kamer,
  coalesce(v.challenge_punten, 0) as challenge_punten,
  coalesce(v.bingo_punten, 0) as bingo_punten,
  coalesce(c.punten, 0)::integer as correcties,
  (coalesce(v.challenge_punten, 0) + coalesce(v.bingo_punten, 0) + coalesce(c.punten, 0))::integer as totaal,
  v.bijgewerkt
from public.deelnemers d
left join public.voortgang v on v.user_id = d.user_id
left join (
  select lower(naam) as sleutel, sum(punten) as punten
  from public.correcties
  where naam is not null
  group by lower(naam)
) c on c.sleutel = lower(d.naam);

create view public.klassement_kamers with (security_invoker = true) as
with kamers as (
  select kamer from public.deelnemers where kamer is not null
  union
  select kamer from public.correcties where kamer is not null
),
personen as (
  select kamer, sum(totaal) as punten, count(*) as aantal
  from public.klassement_personen
  where kamer is not null
  group by kamer
),
bonus as (
  select kamer, sum(punten) as punten
  from public.correcties
  where kamer is not null
  group by kamer
)
select
  k.kamer,
  coalesce(p.aantal, 0)::integer as aantal,
  coalesce(p.punten, 0)::integer as personen_punten,
  coalesce(b.punten, 0)::integer as kamer_bonus,
  (coalesce(p.punten, 0) + coalesce(b.punten, 0))::integer as totaal
from kamers k
left join personen p on p.kamer = k.kamer
left join bonus b on b.kamer = k.kamer;

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------
revoke all on public.voortgang, public.correcties, public.klassement_personen, public.klassement_kamers from anon;
grant select, insert, update, delete on public.voortgang to authenticated;
grant select, insert, update, delete on public.correcties to authenticated;
grant select on public.klassement_personen, public.klassement_kamers to authenticated;
revoke all on function public.zet_bijgewerkt() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Live verversen (Supabase Realtime). Realtime houdt zich aan de RLS-regels hierboven.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['deelnemers', 'voortgang', 'correcties'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
