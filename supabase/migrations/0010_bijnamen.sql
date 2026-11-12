-- Tweeslag Wispo · bijnamen
-- Iedereen kan zelf een bijnaam kiezen. De app toont die overal in plaats van de gewone naam.
-- De gewone naam (uit kamers.json) blijft de sleutel voor scores, stemmen, kamers en profielen;
-- de bijnaam is alleen hoe iemand in beeld komt.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0009).
-- Het script mag vaker uitgevoerd worden.
--
-- Net als een profiel hangt een bijnaam aan de naam, niet aan het apparaat. Schrijven mag alleen
-- het apparaat dat die naam nu heeft (is_eigen_naam uit 0007_profielen.sql). Een beheerder mag
-- een ongepaste bijnaam wissen. Geen bijnaam meer = de rij verwijderen.

create table if not exists public.bijnamen (
  naam       text primary key check (char_length(naam) between 1 and 40 and naam = trim(naam)),
  bijnaam    text not null check (char_length(bijnaam) between 1 and 30 and bijnaam = trim(bijnaam)),
  bijgewerkt timestamptz not null default now()
);

-- Eén rij per naam, en twee mensen kunnen niet dezelfde bijnaam hebben (ook niet met andere hoofdletters)
create unique index if not exists bijnamen_naam_uniek on public.bijnamen (lower(naam));
create unique index if not exists bijnamen_bijnaam_uniek on public.bijnamen (lower(bijnaam));

create or replace function public.bijnaam_bijwerken()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.bijgewerkt := now();
  return new;
end;
$$;

drop trigger if exists bijnamen_bijwerken on public.bijnamen;
create trigger bijnamen_bijwerken
  before insert or update on public.bijnamen
  for each row execute function public.bijnaam_bijwerken();

alter table public.bijnamen enable row level security;

drop policy if exists "bijnamen lezen" on public.bijnamen;
create policy "bijnamen lezen" on public.bijnamen
  for select to authenticated
  using (true);

drop policy if exists "eigen bijnaam aanmaken" on public.bijnamen;
create policy "eigen bijnaam aanmaken" on public.bijnamen
  for insert to authenticated
  with check (public.is_eigen_naam(naam));

drop policy if exists "eigen bijnaam wijzigen" on public.bijnamen;
create policy "eigen bijnaam wijzigen" on public.bijnamen
  for update to authenticated
  using (public.is_eigen_naam(naam))
  with check (public.is_eigen_naam(naam));

drop policy if exists "eigen bijnaam of beheerder verwijderen" on public.bijnamen;
create policy "eigen bijnaam of beheerder verwijderen" on public.bijnamen
  for delete to authenticated
  using (public.is_eigen_naam(naam) or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Rechten en live verversen
-- ---------------------------------------------------------------------------
revoke all on public.bijnamen from anon, authenticated;
grant select, insert, update, delete on public.bijnamen to authenticated;
grant all on public.bijnamen to service_role;
revoke all on function public.bijnaam_bijwerken() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bijnamen'
     ) then
    alter publication supabase_realtime add table public.bijnamen;
  end if;
end;
$$;
