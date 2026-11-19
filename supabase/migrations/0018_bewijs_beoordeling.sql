-- Tweeslag Wispo · bewijs bij challenges: de redactie beoordeelt
-- Tot nu toe telde een foto als bewijs meteen: de telefoon zette zelf een stempel en meldde de
-- punten. Nu beoordeelt de redactie (beheerders) elk kiekje:
--   ingestuurd ("ter perse") → goed ("geplaatst", punten) of af ("briefje terug", met een reden).
-- De challengepunten in het klassement komen voortaan van de server: per persoon per challenge
-- één keer de punten van een goedgekeurde foto. Wat de telefoon zelf meldt (voortgang.challenge_punten)
-- telt niet meer mee.
--
-- Privacy: anderen zien alleen geplaatste foto's die voor iedereen zijn. Je eigen foto's (ook
-- 'ter perse', 'briefje terug' en 'alleen de redactie') zie je zelf; beheerders zien alles. Dat
-- geldt ook voor de bestanden in de bucket. Je mag je eigen foto weghalen.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0017_fotos_jury.sql),
-- VÓÓR de app-versie met de redactietafel live gaat. Het script mag vaker uitgevoerd worden.

-- ---------------------------------------------------------------------------
-- Nieuwe kolommen
-- ---------------------------------------------------------------------------
alter table public.fotos add column if not exists status text not null default 'ingestuurd';
alter table public.fotos add column if not exists reden text;
alter table public.fotos add column if not exists beoordeeld_op timestamptz;
alter table public.fotos add column if not exists beoordeeld_door uuid references auth.users (id) on delete set null;
-- 'iedereen': mag op de muur zodra hij geplaatst is; 'redactie': alleen de maker en de redactie
alter table public.fotos add column if not exists zichtbaar text not null default 'iedereen';
-- Punten van de challenge (uit spel.json, meegestuurd door de app; de redactie ziet ze bij het beoordelen)
alter table public.fotos add column if not exists punten integer not null default 0;
-- 'camera' of 'galerij' (welke knop er gebruikt is)
alter table public.fotos add column if not exists bron text not null default 'camera';
-- Wanneer de maker een pushmelding over de beoordeling kreeg (Edge Function meldingen)
alter table public.fotos add column if not exists gemeld timestamptz;

alter table public.fotos drop constraint if exists fotos_status_check;
alter table public.fotos add constraint fotos_status_check check (status in ('ingestuurd', 'goed', 'af'));
alter table public.fotos drop constraint if exists fotos_reden_check;
alter table public.fotos add constraint fotos_reden_check check (reden is null or char_length(trim(reden)) between 1 and 200);
alter table public.fotos drop constraint if exists fotos_zichtbaar_check;
alter table public.fotos add constraint fotos_zichtbaar_check check (zichtbaar in ('iedereen', 'redactie'));
alter table public.fotos drop constraint if exists fotos_punten_check;
alter table public.fotos add constraint fotos_punten_check check (punten between 0 and 100);
alter table public.fotos drop constraint if exists fotos_bron_check;
alter table public.fotos add constraint fotos_bron_check check (bron in ('camera', 'galerij'));

create index if not exists fotos_status on public.fotos (status, gemaakt);

-- Foto's van vóór deze migratie hadden hun stempel al: die blijven geplaatst, met de punten uit
-- spel.json (alleen als de punten nog 0 zijn, zodat opnieuw draaien niets overschrijft)
do $$
begin
  if not exists (select 1 from public.fotos where beoordeeld_op is not null) then
    update public.fotos set status = 'goed', beoordeeld_op = gemaakt, gemeld = now();
  end if;
end;
$$;

update public.fotos f
set punten = p.punten
from (values
  ('bus-selfie', 10), ('bus-lied', 15), ('eerste-croissant', 10), ('kamerfoto', 10), ('eerste-sneeuwbal', 5),
  ('eerste-afdaling', 10), ('lift-gesprek', 10), ('pistebord', 5), ('gletsjer-groepsfoto', 20), ('ijsgrot', 10),
  ('quiz-winnaar', 15), ('sneeuwvolleybal-punt', 15), ('duik', 10), ('rode-piste', 10), ('venosc', 15),
  ('fondue-brood', 10), ('lokale-kaas', 5), ('clubkleuren', 10), ('jaren80', 20), ('dansje', 10),
  ('eerste-lift', 15), ('laatste-afdaling', 10), ('compliment', 5), ('kamer-schoon', 15), ('souvenir', 10),
  ('thuis', 5)
) as p (challenge_id, punten)
where f.challenge_id = p.challenge_id and f.punten = 0;

-- ---------------------------------------------------------------------------
-- Bij het insturen: altijd 'ingestuurd', nooit al beoordeeld (zelfde als 0017, plus de nieuwe kolommen)
-- ---------------------------------------------------------------------------
create or replace function public.foto_vullen()
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
  if split_part(new.pad, '/', 1) <> auth.uid()::text then
    raise exception 'verkeerd_pad';
  end if;
  new.user_id := auth.uid();
  new.naam := v_naam;
  new.kamer := v_kamer;
  new.gemaakt := now();
  if new.genomen is null
     or new.genomen > now() + interval '10 minutes'
     or new.genomen < now() - interval '30 days' then
    new.genomen := new.gemaakt;
  end if;
  new.jury := false;
  new.jury_correctie := null;
  new.status := 'ingestuurd';
  new.reden := null;
  new.beoordeeld_op := null;
  new.beoordeeld_door := null;
  new.gemeld := null;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mag de huidige gebruiker deze foto zien? (maker, beheerder, of geplaatst en voor iedereen)
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
      or public.is_beheerder()
      or (p_status = 'goed' and p_zichtbaar = 'iedereen');
$$;

-- Voor de bucket: een bestand van een foto die je niet mag zien, mag je ook niet openen.
-- Bestanden die niet bij een foto horen (zoals profielfoto's) blijven leesbaar zoals voorheen.
create or replace function public.foto_bestand_zichtbaar(p_pad text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.fotos f
    where (f.pad = p_pad or replace(f.pad, '.jpg', '-klein.jpg') = p_pad)
      and not public.foto_zichtbaar(f.user_id, f.naam, f.status, f.zichtbaar)
  );
$$;

drop policy if exists "fotos lezen" on public.fotos;
create policy "fotos lezen" on public.fotos
  for select to authenticated
  using (public.foto_zichtbaar(user_id, naam, status, zichtbaar));

drop policy if exists "fotos bekijken" on storage.objects;
create policy "fotos bekijken" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos' and public.foto_bestand_zichtbaar(name));

-- Je eigen foto weghalen (ook van je vorige telefoon, op naam). De bestanden ruimt de app daarna
-- op; dat lukt alleen vanaf de telefoon waarmee hij gemaakt is (regel uit 0009).
drop policy if exists "eigen foto weghalen" on public.fotos;
create policy "eigen foto weghalen" on public.fotos
  for delete to authenticated
  using (user_id = auth.uid() or public.is_eigen_naam(naam));

-- ---------------------------------------------------------------------------
-- Beoordelen (alleen beheerders) en zichtbaarheid kiezen (alleen de maker)
-- ---------------------------------------------------------------------------
create or replace function public.beoordeel_foto(p_id uuid, p_status text, p_reden text default null)
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

create or replace function public.zet_zichtbaar(p_id uuid, p_zichtbaar text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_zichtbaar not in ('iedereen', 'redactie') then
    raise exception 'verkeerde_keuze';
  end if;
  update public.fotos
  set zichtbaar = p_zichtbaar
  where id = p_id and (user_id = auth.uid() or public.is_eigen_naam(naam));
  if not found then
    raise exception 'geen_foto';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Klassement: challengepunten van de server (geplaatste foto's), niet meer van de telefoon.
-- Vóór de start van het spel (testperiode) telt alles; daarna alleen foto's van ná de start.
-- bewijs_punten draait met de rechten van de eigenaar, zodat ook punten van foto's die alleen de
-- redactie mag zien meetellen (de view geeft alleen naam + punten).
-- ---------------------------------------------------------------------------
drop view if exists public.klassement_kamers;
drop view if exists public.klassement_personen;
drop view if exists public.bewijs_punten;

create view public.bewijs_punten as
select sleutel, sum(punten)::integer as punten
from (
  select distinct on (lower(naam), challenge_id) lower(naam) as sleutel, punten
  from public.fotos
  where status = 'goed'
    and (now() < timestamptz '2027-03-05 18:00 Europe/Amsterdam'
         or gemaakt >= timestamptz '2027-03-05 18:00 Europe/Amsterdam')
  order by lower(naam), challenge_id, punten desc
) per_challenge
group by sleutel;

create view public.klassement_personen with (security_invoker = true) as
select
  d.naam,
  d.kamer,
  coalesce(b.punten, 0)::integer as challenge_punten,
  coalesce(v.bingo_punten, 0) as bingo_punten,
  coalesce(c.punten, 0)::integer as correcties,
  (coalesce(b.punten, 0) + coalesce(v.bingo_punten, 0) + coalesce(c.punten, 0))::integer as totaal,
  v.bijgewerkt
from public.deelnemers d
left join public.voortgang v on v.user_id = d.user_id
left join public.bewijs_punten b on b.sleutel = lower(d.naam)
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
revoke all on public.bewijs_punten, public.klassement_personen, public.klassement_kamers from anon, public;
grant select on public.bewijs_punten, public.klassement_personen, public.klassement_kamers to authenticated;
grant select, insert, update, delete on public.fotos to service_role;
revoke all on function public.foto_vullen() from public, anon, authenticated;
revoke all on function public.foto_zichtbaar(uuid, text, text, text) from public, anon;
grant execute on function public.foto_zichtbaar(uuid, text, text, text) to authenticated;
revoke all on function public.foto_bestand_zichtbaar(text) from public, anon;
grant execute on function public.foto_bestand_zichtbaar(text) to authenticated;
revoke all on function public.beoordeel_foto(uuid, text, text) from public, anon;
grant execute on function public.beoordeel_foto(uuid, text, text) to authenticated;
revoke all on function public.zet_zichtbaar(uuid, text) from public, anon;
grant execute on function public.zet_zichtbaar(uuid, text) to authenticated;
