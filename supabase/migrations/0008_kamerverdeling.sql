-- Tweeslag Wispo · kamerverdeling opslaan vanuit de app
-- De reisleiding maakt de kamerverdeling in de app (Kamers → Kamerverdeling maken) en slaat hem
-- met één knop op. Daarna gaat deze versie voor op public/data/kamers.json. Namen die later nog in
-- kamers.json worden gezet, verschijnen in de app onder "Nog geen kamer".
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0007_profielen.sql).
-- Het script mag vaker uitgevoerd worden.

create table if not exists public.kamerverdeling (
  id         smallint primary key default 1 check (id = 1), -- er is maar één verdeling
  data       jsonb not null,
  door       text check (door is null or char_length(door) <= 40),
  bijgewerkt timestamptz not null default now()
);

-- Dezelfde vorm als kamers.json, en niet te groot
alter table public.kamerverdeling drop constraint if exists kamerverdeling_data_check;
alter table public.kamerverdeling
  add constraint kamerverdeling_data_check check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data -> 'kamers') = 'array'
    and pg_column_size(data) < 100000
  );

create or replace function public.kamerverdeling_bijgewerkt()
returns trigger
language plpgsql
as $$
begin
  new.bijgewerkt := now();
  return new;
end;
$$;

drop trigger if exists kamerverdeling_bijgewerkt on public.kamerverdeling;
create trigger kamerverdeling_bijgewerkt
  before insert or update on public.kamerverdeling
  for each row execute function public.kamerverdeling_bijgewerkt();

alter table public.kamerverdeling enable row level security;

drop policy if exists "kamerverdeling lezen" on public.kamerverdeling;
create policy "kamerverdeling lezen" on public.kamerverdeling
  for select to authenticated
  using (true);

-- Alleen ingelogde beheerders (tabel beheerders) mogen de verdeling opslaan of weghalen
drop policy if exists "kamerverdeling opslaan door beheerder" on public.kamerverdeling;
create policy "kamerverdeling opslaan door beheerder" on public.kamerverdeling
  for insert to authenticated
  with check (public.is_beheerder());

drop policy if exists "kamerverdeling wijzigen door beheerder" on public.kamerverdeling;
create policy "kamerverdeling wijzigen door beheerder" on public.kamerverdeling
  for update to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

drop policy if exists "kamerverdeling verwijderen door beheerder" on public.kamerverdeling;
create policy "kamerverdeling verwijderen door beheerder" on public.kamerverdeling
  for delete to authenticated
  using (public.is_beheerder());

revoke all on public.kamerverdeling from anon, authenticated;
grant select, insert, update, delete on public.kamerverdeling to authenticated;
revoke all on function public.kamerverdeling_bijgewerkt() from public, anon, authenticated;

-- Live verversen: een nieuwe verdeling staat meteen in ieders app
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kamerverdeling'
     ) then
    alter publication supabase_realtime add table public.kamerverdeling;
  end if;
end;
$$;
