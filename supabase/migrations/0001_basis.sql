-- Tweeslag Wispo · fase 1: basis
-- Deelnemers (één rij per apparaat, gekoppeld aan de anonieme gebruiker) en beheerders (reisleiding).
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run.
-- Het script mag vaker uitgevoerd worden; bestaande gegevens blijven staan.

-- ---------------------------------------------------------------------------
-- Beheerders: e-mailadressen van de reisleiding. Alleen te vullen via de SQL Editor:
--   insert into public.beheerders (email) values ('jouw@mail.nl');
-- ---------------------------------------------------------------------------
create table if not exists public.beheerders (
  email      text primary key check (email = lower(email)),
  toegevoegd timestamptz not null default now()
);

alter table public.beheerders enable row level security;

-- Je mag alleen zien óf jij zelf beheerder bent (geen lijst met adressen)
drop policy if exists "eigen beheerrij lezen" on public.beheerders;
create policy "eigen beheerrij lezen" on public.beheerders
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Waar: ingelogd met e-mail (niet anoniem) én het adres staat in beheerders
create or replace function public.is_beheerder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and exists (
       select 1 from public.beheerders b
       where b.email = lower(coalesce(auth.jwt() ->> 'email', ''))
     );
$$;

revoke all on function public.is_beheerder() from public, anon;
grant execute on function public.is_beheerder() to authenticated;

-- ---------------------------------------------------------------------------
-- Deelnemers: de gekozen voornaam en kamer per apparaat
-- ---------------------------------------------------------------------------
create table if not exists public.deelnemers (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  naam       text not null check (char_length(trim(naam)) between 1 and 40),
  kamer      text check (kamer is null or char_length(kamer) <= 40),
  bijgewerkt timestamptz not null default now()
);

-- Elke naam hoort bij maximaal één apparaat (zie kies_naam hieronder)
create unique index if not exists deelnemers_naam_uniek on public.deelnemers (lower(naam));

alter table public.deelnemers enable row level security;

drop policy if exists "deelnemers lezen" on public.deelnemers;
create policy "deelnemers lezen" on public.deelnemers
  for select to authenticated
  using (true);

drop policy if exists "eigen rij aanmaken" on public.deelnemers;
create policy "eigen rij aanmaken" on public.deelnemers
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "eigen rij wijzigen" on public.deelnemers;
create policy "eigen rij wijzigen" on public.deelnemers
  for update to authenticated
  using (user_id = auth.uid() or public.is_beheerder())
  with check (user_id = auth.uid() or public.is_beheerder());

drop policy if exists "eigen rij of beheerder verwijderen" on public.deelnemers;
create policy "eigen rij of beheerder verwijderen" on public.deelnemers
  for delete to authenticated
  using (user_id = auth.uid() or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- kies_naam: koppelt de gekozen naam en kamer aan dit apparaat.
-- Heeft een ander apparaat dezelfde naam (bijv. Safari én de app op het beginscherm
-- van dezelfde iPhone), dan neemt dit apparaat de naam over. Omdat elke telefoon zijn
-- eigen voortgang lokaal bewaart en steeds helemaal opnieuw verstuurt, herstelt dat
-- zichzelf als iemand per ongeluk de verkeerde naam kiest.
-- ---------------------------------------------------------------------------
create or replace function public.kies_naam(p_naam text, p_kamer text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_naam text := trim(p_naam);
begin
  if auth.uid() is null then
    raise exception 'niet ingelogd';
  end if;
  if v_naam is null or char_length(v_naam) not between 1 and 40 then
    raise exception 'ongeldige naam';
  end if;

  delete from public.deelnemers
  where lower(naam) = lower(v_naam) and user_id <> auth.uid();

  insert into public.deelnemers (user_id, naam, kamer, bijgewerkt)
  values (auth.uid(), v_naam, nullif(trim(p_kamer), ''), now())
  on conflict (user_id) do update
    set naam = excluded.naam, kamer = excluded.kamer, bijgewerkt = now();
end;
$$;

revoke all on function public.kies_naam(text, text) from public, anon;
grant execute on function public.kies_naam(text, text) to authenticated;
