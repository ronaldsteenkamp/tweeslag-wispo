-- Tweeslag Wispo · kamernamen
-- De bewoners van een kamer kunnen zelf de naam van hun kamer aanpassen (Kamers → Jouw kamer →
-- Naam aanpassen). Die naam staat dan overal in de app in plaats van de naam uit de
-- kamerverdeling. Het kamernummer blijft de sleutel; de naam is alleen hoe de kamer in beeld komt.
-- Geen eigen naam meer = de rij verwijderen (dan geldt weer de naam van de reisleiding).
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0012).
-- Het script mag vaker uitgevoerd worden. Zonder dit script werkt de app gewoon; alleen kan
-- niemand de naam van zijn kamer aanpassen.
--
-- Wie mag schrijven: alleen een apparaat waarvan de naam op de server in die kamer zit
-- (deelnemers.kamer, gezet bij het kiezen van je naam). Een beheerder mag een ongepaste naam wissen.

create table if not exists public.kamernamen (
  nummer     text primary key check (char_length(nummer) between 1 and 40 and nummer = trim(nummer)),
  naam       text not null check (char_length(naam) between 1 and 30 and naam = trim(naam)),
  -- Wie de naam het laatst aanpaste (gewone naam), voor als er iets mis is
  door       text check (door is null or char_length(door) <= 40),
  bijgewerkt timestamptz not null default now()
);

-- Twee kamers kunnen niet dezelfde naam hebben (ook niet met andere hoofdletters)
create unique index if not exists kamernamen_naam_uniek on public.kamernamen (lower(naam));

-- Woont het apparaat dat dit vraagt in deze kamer?
create or replace function public.is_eigen_kamer(p_nummer text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.deelnemers d
    where d.user_id = auth.uid() and d.kamer = p_nummer
  );
$$;

-- Tijd en "door" vult de server zelf in
create or replace function public.kamernaam_bijwerken()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.bijgewerkt := now();
  new.door := (select naam from public.deelnemers where user_id = auth.uid());
  return new;
end;
$$;

drop trigger if exists kamernamen_bijwerken on public.kamernamen;
create trigger kamernamen_bijwerken
  before insert or update on public.kamernamen
  for each row execute function public.kamernaam_bijwerken();

alter table public.kamernamen enable row level security;

drop policy if exists "kamernamen lezen" on public.kamernamen;
create policy "kamernamen lezen" on public.kamernamen
  for select to authenticated
  using (true);

drop policy if exists "eigen kamernaam aanmaken" on public.kamernamen;
create policy "eigen kamernaam aanmaken" on public.kamernamen
  for insert to authenticated
  with check (public.is_eigen_kamer(nummer));

drop policy if exists "eigen kamernaam wijzigen" on public.kamernamen;
create policy "eigen kamernaam wijzigen" on public.kamernamen
  for update to authenticated
  using (public.is_eigen_kamer(nummer))
  with check (public.is_eigen_kamer(nummer));

drop policy if exists "eigen kamernaam of beheerder verwijderen" on public.kamernamen;
create policy "eigen kamernaam of beheerder verwijderen" on public.kamernamen
  for delete to authenticated
  using (public.is_eigen_kamer(nummer) or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Rechten en live verversen
-- ---------------------------------------------------------------------------
revoke all on public.kamernamen from anon, authenticated;
grant select, insert, update, delete on public.kamernamen to authenticated;
grant all on public.kamernamen to service_role;
revoke all on function public.kamernaam_bijwerken() from public, anon, authenticated;
revoke all on function public.is_eigen_kamer(text) from public, anon;
grant execute on function public.is_eigen_kamer(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kamernamen'
     ) then
    alter publication supabase_realtime add table public.kamernamen;
  end if;
end;
$$;
