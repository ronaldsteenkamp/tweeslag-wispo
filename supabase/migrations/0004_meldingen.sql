-- Tweeslag Wispo · fase 4: pushmeldingen
-- Abonnementen per apparaat, een logboek van verstuurde meldingen en de VAPID-sleutels.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0003_stemming.sql).
-- Het script mag vaker uitgevoerd worden.
--
-- Het versturen gebeurt door de Edge Function `meldingen` (supabase/functions/meldingen).
-- Die maakt bij de eerste aanroep zelf een VAPID-sleutelpaar en bewaart dat in push_sleutels;
-- niemand hoeft dus een geheime sleutel te kopiëren. De planning (elke 5 minuten) staat in
-- supabase/cron_meldingen.sql.

-- ---------------------------------------------------------------------------
-- Abonnementen: één rij per telefoon/browser die meldingen wil
-- ---------------------------------------------------------------------------
create table if not exists public.push_abonnementen (
  endpoint  text primary key check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh    text not null check (char_length(p256dh) <= 200),
  auth      text not null check (char_length(auth) <= 100),
  gemaakt   timestamptz not null default now()
);

create index if not exists push_abonnementen_user on public.push_abonnementen (user_id);

alter table public.push_abonnementen enable row level security;

drop policy if exists "eigen abonnementen lezen" on public.push_abonnementen;
create policy "eigen abonnementen lezen" on public.push_abonnementen
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "eigen abonnement of beheerder verwijderen" on public.push_abonnementen;
create policy "eigen abonnement of beheerder verwijderen" on public.push_abonnementen
  for delete to authenticated
  using (user_id = auth.uid() or public.is_beheerder());

-- Bewaren via een functie: hetzelfde endpoint kan eerder bij een andere (oude) gebruiker
-- van deze telefoon hebben gehoord. Dan wordt het overgenomen.
create or replace function public.bewaar_abonnement(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'niet ingelogd';
  end if;
  delete from public.push_abonnementen where endpoint = p_endpoint;
  insert into public.push_abonnementen (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth);
  -- Hooguit 5 apparaten per gebruiker: de oudste vervallen
  delete from public.push_abonnementen
  where user_id = auth.uid()
    and endpoint not in (
      select endpoint from public.push_abonnementen
      where user_id = auth.uid()
      order by gemaakt desc
      limit 5
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Logboek: elke verstuurde melding. 'sleutel' voorkomt dat een geplande melding
-- twee keer gaat (bijv. 'planning:2027-03-05:19:30:Vertrek bus').
-- Alleen de Edge Function (service role) schrijft hierin.
-- ---------------------------------------------------------------------------
create table if not exists public.meldingen (
  id       bigint generated always as identity primary key,
  sleutel  text unique,
  soort    text not null,
  titel    text not null,
  tekst    text,
  url      text,
  aantal   integer not null default 0,
  door     uuid references auth.users (id) on delete set null,
  gemaakt  timestamptz not null default now()
);

alter table public.meldingen enable row level security;

drop policy if exists "meldingen lezen door beheerder" on public.meldingen;
create policy "meldingen lezen door beheerder" on public.meldingen
  for select to authenticated
  using (public.is_beheerder());

-- ---------------------------------------------------------------------------
-- VAPID-sleutels: alleen voor de server (geen policies = niemand anders kan erbij)
-- ---------------------------------------------------------------------------
create table if not exists public.push_sleutels (
  id       integer primary key check (id = 1),
  publiek  text not null,
  prive    text not null,
  gemaakt  timestamptz not null default now()
);

alter table public.push_sleutels enable row level security;

-- ---------------------------------------------------------------------------
-- Aantal apparaten met meldingen aan (voor het beheerscherm)
-- ---------------------------------------------------------------------------
create or replace function public.meldingen_statistiek()
returns table (apparaten integer, personen integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_beheerder() then
    raise exception 'geen_beheerder';
  end if;
  return query
    select count(*)::integer, count(distinct d.naam)::integer
    from public.push_abonnementen a
    left join public.deelnemers d on d.user_id = a.user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------
revoke all on public.push_abonnementen, public.meldingen, public.push_sleutels from anon, authenticated;
grant select, delete on public.push_abonnementen to authenticated;
grant select on public.meldingen to authenticated;
revoke all on function public.bewaar_abonnement(text, text, text) from public, anon;
grant execute on function public.bewaar_abonnement(text, text, text) to authenticated;
revoke all on function public.meldingen_statistiek() from public, anon;
grant execute on function public.meldingen_statistiek() to authenticated;
