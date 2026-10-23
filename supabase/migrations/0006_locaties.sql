-- Tweeslag Wispo · live locatie op de pistekaart
-- Wie dat wil, deelt zijn positie; de rest ziet een stip met naam op de pistekaart.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0005_fotomuur.sql).
-- Het script mag vaker uitgevoerd worden.
--
-- Privacy:
--   · alleen wie zelf op "Deel mijn locatie" tikt, staat in deze tabel (één rij per apparaat);
--   · uitzetten verwijdert de rij meteen;
--   · iedereen in de app ziet alleen locaties van het afgelopen uur;
--   · oudere locaties worden elk uur automatisch verwijderd (pg_cron, zie onderaan).

create table if not exists public.locaties (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  naam           text not null,
  kamer          text,
  lat            double precision not null check (lat between -90 and 90),
  lon            double precision not null check (lon between -180 and 180),
  nauwkeurigheid integer check (nauwkeurigheid between 0 and 100000),
  bijgewerkt     timestamptz not null default now()
);

-- Altijd de eigen gebruiker, met naam en kamer van de server, en de tijd van de server
create or replace function public.locatie_vullen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_naam  text;
  v_kamer text;
begin
  select naam, kamer into v_naam, v_kamer from public.deelnemers where user_id = auth.uid();
  if v_naam is null then
    raise exception 'geen_naam';
  end if;
  new.user_id := auth.uid();
  new.naam := v_naam;
  new.kamer := v_kamer;
  new.bijgewerkt := now();
  -- Afronden op ~1 m: nauwkeuriger heeft geen zin en het scheelt gegevens
  new.lat := round(new.lat::numeric, 5);
  new.lon := round(new.lon::numeric, 5);
  return new;
end;
$$;

drop trigger if exists locaties_vullen on public.locaties;
create trigger locaties_vullen
  before insert or update on public.locaties
  for each row execute function public.locatie_vullen();

alter table public.locaties enable row level security;

drop policy if exists "recente locaties lezen" on public.locaties;
create policy "recente locaties lezen" on public.locaties
  for select to authenticated
  -- Je eigen rij altijd (anders kan een oude eigen locatie niet meer worden bijgewerkt)
  using (bijgewerkt > now() - interval '1 hour' or user_id = auth.uid());

drop policy if exists "eigen locatie delen" on public.locaties;
create policy "eigen locatie delen" on public.locaties
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "eigen locatie bijwerken" on public.locaties;
create policy "eigen locatie bijwerken" on public.locaties
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "eigen locatie of beheerder verwijderen" on public.locaties;
create policy "eigen locatie of beheerder verwijderen" on public.locaties
  for delete to authenticated
  using (user_id = auth.uid() or public.is_beheerder());

revoke all on public.locaties from anon, authenticated;
grant select, insert, update, delete on public.locaties to authenticated;
grant select, insert, update, delete on public.locaties to service_role;
revoke all on function public.locatie_vullen() from public, anon, authenticated;

-- Live verversen
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locaties'
     ) then
    alter publication supabase_realtime add table public.locaties;
  end if;
end;
$$;

-- Elk uur oude locaties weggooien (alleen als pg_cron er is; zie cron_meldingen.sql)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tweeslag-locaties-opruimen';
    perform cron.schedule(
      'tweeslag-locaties-opruimen',
      '7 * * * *',
      $job$ delete from public.locaties where bijgewerkt < now() - interval '1 hour' $job$
    );
  end if;
end;
$$;
