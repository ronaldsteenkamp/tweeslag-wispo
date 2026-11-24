-- Tweeslag Wispo · redactie apart van beheer
-- De redactie (de VakanCie) beoordeelt de kiekjes en stukjes aan de redactietafel en zet de
-- jurystempel. Beheer (berichten aan iedereen, stemmingen, punten corrigeren, deelnemers,
-- kamerverdeling, bijnamen wissen, VakanCie-foto's) blijft alleen voor de tabel beheerders.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0020).
-- Het script mag vaker uitgevoerd worden.
--
-- Een redactielid toevoegen (alleen via de SQL Editor):
--   insert into public.redactie (email) values ('naam@voorbeeld.nl');
-- Beheerders horen er vanzelf bij; die hoeven hier niet in.
--
-- Wat verandert: alleen de vier plekken van de redactietafel gebruiken nu is_redactie() in plaats van
-- is_beheerder(). De tabel beheerders, is_beheerder() en de Edge Function blijven zoals ze waren.

-- ---------------------------------------------------------------------------
-- Tabel met e-mailadressen van de redactie (geen lijst zichtbaar in de app)
-- ---------------------------------------------------------------------------
create table if not exists public.redactie (
  email      text primary key check (email = lower(email)),
  toegevoegd timestamptz not null default now()
);

alter table public.redactie enable row level security;
revoke all on table public.redactie from anon, authenticated;
grant all on table public.redactie to service_role;

-- Waar: ingelogd met e-mail (niet anoniem) én beheerder, of het adres staat in redactie
create or replace function public.is_redactie()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_beheerder()
      or (
        coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
        and exists (
          select 1 from public.redactie r
          where r.email = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      );
$$;

revoke all on function public.is_redactie() from public, anon;
grant execute on function public.is_redactie() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Wat ter perse ligt zien (kiekjes en, via dezelfde functie, stukjes) — was is_beheerder (0018)
-- ---------------------------------------------------------------------------
create or replace function public.foto_zichtbaar(p_user uuid, p_naam text, p_status text, p_zichtbaar text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user = auth.uid()
      or public.is_eigen_naam(p_naam)
      or public.is_redactie()
      or (p_status = 'goed' and p_zichtbaar = 'iedereen');
$$;

-- ---------------------------------------------------------------------------
-- 2. Een kiekje beoordelen (0018). Foutcode blijft 'geen_beheerder' zodat oudere apps hem herkennen.
-- ---------------------------------------------------------------------------
create or replace function public.beoordeel_foto(p_id uuid, p_status text, p_reden text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_redactie() then
    raise exception 'geen_beheerder';
  end if;
  if p_status not in ('ingestuurd', 'goed', 'af') then
    raise exception 'verkeerde_status';
  end if;
  if p_status = 'af' and (p_reden is null or char_length(trim(p_reden)) = 0) then
    raise exception 'reden_nodig';
  end if;
  update public.fotos
  set status = p_status,
      reden = case when p_status = 'af' then left(trim(p_reden), 200) else null end,
      beoordeeld_op = case when p_status = 'ingestuurd' then null else now() end,
      beoordeeld_door = case when p_status = 'ingestuurd' then null else auth.uid() end,
      gemeld = null,
      -- Teruggestuurd: dan ook geen jurykeuze meer (de trigger uit 0017 haalt de punten weg)
      jury = case when p_status = 'goed' then jury else false end
  where id = p_id;
  if not found then
    raise exception 'geen_foto';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Een stukje beoordelen (0019)
-- ---------------------------------------------------------------------------
create or replace function public.beoordeel_stukje(p_id uuid, p_status text, p_reden text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_redactie() then
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
-- 4. De jurystempel (0017): alleen de kolom jury, de trigger regelt de 10 punten
-- ---------------------------------------------------------------------------
drop policy if exists "jurykeuze door beheerder" on public.fotos;
drop policy if exists "jurykeuze door redactie" on public.fotos;
create policy "jurykeuze door redactie" on public.fotos
  for update to authenticated
  using (public.is_redactie())
  with check (public.is_redactie());

-- Terugdraaien: draai de definities van foto_zichtbaar en beoordeel_foto uit 0018, beoordeel_stukje
-- uit 0019 en de policy "jurykeuze door beheerder" uit 0017 opnieuw, en daarna:
--   drop policy if exists "jurykeuze door redactie" on public.fotos;
--   drop function if exists public.is_redactie();
--   drop table if exists public.redactie;
