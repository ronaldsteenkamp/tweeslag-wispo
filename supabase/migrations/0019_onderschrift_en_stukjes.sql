-- Tweeslag Wispo · clubblad: onderschrift bij een kiekje en ingezonden stukjes
-- 1. Een kiekje mag een kort onderschrift hebben (max. 140 tekens). De redactie ziet het bij het
--    beoordelen; in het clubblad staat het onder de foto.
-- 2. Ingezonden stukjes: een korte tekst (max. 600 tekens) voor de rubriek "Ingezonden", los of
--    bij een challenge. Zelfde redactie als de foto's (0018): ingestuurd → goed / af met reden.
--    Een stukje bij een challenge telt als bewijs (punten zodra hij geplaatst is); een los stukje
--    geeft geen punten. Anderen zien alleen geplaatste stukjes; de maker en de redactie alles.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0018_bewijs_beoordeling.sql),
-- VÓÓR de app-versie met stukjes live gaat. Het script mag vaker uitgevoerd worden.

-- ---------------------------------------------------------------------------
-- Onderschrift bij een foto
-- ---------------------------------------------------------------------------
alter table public.fotos add column if not exists onderschrift text;
alter table public.fotos drop constraint if exists fotos_onderschrift_check;
alter table public.fotos add constraint fotos_onderschrift_check
  check (onderschrift is null or char_length(trim(onderschrift)) between 1 and 140);

-- ---------------------------------------------------------------------------
-- Ingezonden stukjes
-- ---------------------------------------------------------------------------
create table if not exists public.stukjes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  naam            text not null,
  kamer           text,
  challenge_id    text check (challenge_id is null or char_length(challenge_id) between 1 and 80),
  challenge_titel text check (challenge_titel is null or char_length(challenge_titel) between 1 and 120),
  tekst           text not null check (char_length(trim(tekst)) between 1 and 600),
  punten          integer not null default 0 check (punten between 0 and 100),
  status          text not null default 'ingestuurd' check (status in ('ingestuurd', 'goed', 'af')),
  reden           text check (reden is null or char_length(trim(reden)) between 1 and 200),
  beoordeeld_op   timestamptz,
  beoordeeld_door uuid references auth.users (id) on delete set null,
  gemeld          timestamptz,
  gemaakt         timestamptz not null default now()
);

create index if not exists stukjes_status on public.stukjes (status, gemaakt);

-- Bij het insturen: naam en kamer van de server, altijd 'ingestuurd', los stukje = geen punten
create or replace function public.stukje_vullen()
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
  new.tekst := trim(new.tekst);
  new.gemaakt := now();
  new.status := 'ingestuurd';
  new.reden := null;
  new.beoordeeld_op := null;
  new.beoordeeld_door := null;
  new.gemeld := null;
  if new.challenge_id is null then
    new.challenge_titel := null;
    new.punten := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists stukjes_vullen on public.stukjes;
create trigger stukjes_vullen
  before insert on public.stukjes
  for each row execute function public.stukje_vullen();

alter table public.stukjes enable row level security;

drop policy if exists "stukjes lezen" on public.stukjes;
create policy "stukjes lezen" on public.stukjes
  for select to authenticated
  using (public.foto_zichtbaar(user_id, naam, status, 'iedereen'));

drop policy if exists "eigen stukje insturen" on public.stukjes;
create policy "eigen stukje insturen" on public.stukjes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "eigen stukje weghalen" on public.stukjes;
create policy "eigen stukje weghalen" on public.stukjes
  for delete to authenticated
  using (user_id = auth.uid() or public.is_eigen_naam(naam) or public.is_beheerder());

create or replace function public.beoordeel_stukje(p_id uuid, p_status text, p_reden text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_beheerder() then
    raise exception 'geen_beheerder';
  end if;
  if p_status not in ('ingestuurd', 'goed', 'af') then
    raise exception 'verkeerde_status';
  end if;
  if p_status = 'af' and (p_reden is null or char_length(trim(p_reden)) = 0) then
    raise exception 'reden_nodig';
  end if;
  update public.stukjes
  set status = p_status,
      reden = case when p_status = 'af' then left(trim(p_reden), 200) else null end,
      beoordeeld_op = case when p_status = 'ingestuurd' then null else now() end,
      beoordeeld_door = case when p_status = 'ingestuurd' then null else auth.uid() end,
      gemeld = null
  where id = p_id;
  if not found then
    raise exception 'geen_stukje';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Punten: per persoon per challenge één keer, van een geplaatste foto óf een geplaatst stukje
-- (zelfde kolommen als in 0018, dus de klassement-views blijven staan)
-- ---------------------------------------------------------------------------
create or replace view public.bewijs_punten as
select sleutel, sum(punten)::integer as punten
from (
  select distinct on (sleutel, challenge_id) sleutel, punten
  from (
    select lower(naam) as sleutel, challenge_id, punten, gemaakt from public.fotos where status = 'goed'
    union all
    select lower(naam), challenge_id, punten, gemaakt from public.stukjes where status = 'goed' and challenge_id is not null
  ) bewijs
  where now() < timestamptz '2027-03-05 18:00 Europe/Amsterdam'
     or gemaakt >= timestamptz '2027-03-05 18:00 Europe/Amsterdam'
  order by sleutel, challenge_id, punten desc
) per_challenge
group by sleutel;

-- ---------------------------------------------------------------------------
-- Rechten en live verversen
-- ---------------------------------------------------------------------------
revoke all on public.stukjes from anon, authenticated;
grant select, insert, delete on public.stukjes to authenticated;
grant select, insert, update, delete on public.stukjes to service_role;
revoke all on public.bewijs_punten from anon, public;
grant select on public.bewijs_punten to authenticated;
revoke all on function public.stukje_vullen() from public, anon, authenticated;
revoke all on function public.beoordeel_stukje(uuid, text, text) from public, anon;
grant execute on function public.beoordeel_stukje(uuid, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stukjes'
     ) then
    alter publication supabase_realtime add table public.stukjes;
  end if;
end;
$$;
