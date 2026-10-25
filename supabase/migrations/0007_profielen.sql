-- Tweeslag Wispo · fase 7: profielen
-- Een profiel per deelnemer: ski of board, niveau, een feitje, karaokenummer met artiest,
-- grootste angst (allemaal verplicht) en een optionele profielfoto.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0006_locaties.sql).
-- Het script mag vaker uitgevoerd worden.
--
-- Net als de correcties in het scorebord hangt een profiel aan de naam, niet aan het apparaat.
-- Wisselt iemand van telefoon (of van Safari naar de app op het beginscherm), dan blijft het
-- profiel dus gewoon staan. Schrijven mag alleen het apparaat dat die naam nu heeft
-- (zie kies_naam in 0001_basis.sql). De profielfoto staat in de bucket 'fotos' uit
-- 0005_fotomuur.sql, in de map van het apparaat: <user_id>/profiel-<willekeurig>.jpg

create table if not exists public.profielen (
  naam       text primary key check (char_length(naam) between 1 and 40 and naam = trim(naam)),
  ski        text not null,
  niveau     smallint not null,
  feitje     text not null,
  karaoke    text not null,
  artiest    text not null,
  angst      text not null,
  foto_pad   text,
  bijgewerkt timestamptz not null default now()
);

-- Ook goed als een eerdere versie van dit script al gedraaid is (toen waren karaokenummer en
-- angst nog optioneel en was er nog geen artiest): kolom erbij en de regels opnieuw zetten.
-- Alle vragen zijn verplicht; alleen de foto niet.
alter table public.profielen add column if not exists artiest text;

alter table public.profielen
  drop constraint if exists profielen_ski_check,
  drop constraint if exists profielen_niveau_check,
  drop constraint if exists profielen_feitje_check,
  drop constraint if exists profielen_karaoke_check,
  drop constraint if exists profielen_artiest_check,
  drop constraint if exists profielen_angst_check,
  drop constraint if exists profielen_foto_pad_check;

-- "not valid": alleen voor nieuwe en gewijzigde profielen, zodat het script niet stukloopt
-- op een profiel dat nog volgens de oude regels is ingevuld
alter table public.profielen
  add constraint profielen_ski_check check (ski in ('ski', 'board', 'allebei', 'nooit')) not valid,
  add constraint profielen_niveau_check check (niveau between 1 and 5) not valid,
  add constraint profielen_feitje_check check (char_length(trim(feitje)) between 1 and 140) not valid,
  add constraint profielen_karaoke_check check (karaoke is not null and char_length(trim(karaoke)) between 1 and 60) not valid,
  add constraint profielen_artiest_check check (artiest is not null and char_length(trim(artiest)) between 1 and 60) not valid,
  add constraint profielen_angst_check check (angst is not null and char_length(trim(angst)) between 1 and 80) not valid,
  add constraint profielen_foto_pad_check check (foto_pad is null or char_length(foto_pad) <= 200) not valid;

-- Eén profiel per naam, ook als de hoofdletters verschillen
create unique index if not exists profielen_naam_uniek on public.profielen (lower(naam));

-- Is dit de naam van het apparaat dat nu schrijft?
create or replace function public.is_eigen_naam(p_naam text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.deelnemers d
    where d.user_id = auth.uid() and lower(d.naam) = lower(p_naam)
  );
$$;

revoke all on function public.is_eigen_naam(text) from public, anon;
grant execute on function public.is_eigen_naam(text) to authenticated;

-- Bijgewerkt-tijd van de server, en een nieuwe foto moet in de eigen map staan.
-- Een foto die al in het profiel stond mag blijven (bijv. van je vorige telefoon).
create or replace function public.profiel_controleren()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.foto_pad is not null
     and (tg_op = 'INSERT' or new.foto_pad is distinct from old.foto_pad)
     and split_part(new.foto_pad, '/', 1) <> auth.uid()::text then
    raise exception 'verkeerd_pad';
  end if;
  new.bijgewerkt := now();
  return new;
end;
$$;

drop trigger if exists profielen_controleren on public.profielen;
create trigger profielen_controleren
  before insert or update on public.profielen
  for each row execute function public.profiel_controleren();

alter table public.profielen enable row level security;

drop policy if exists "profielen lezen" on public.profielen;
create policy "profielen lezen" on public.profielen
  for select to authenticated
  using (true);

drop policy if exists "eigen profiel aanmaken" on public.profielen;
create policy "eigen profiel aanmaken" on public.profielen
  for insert to authenticated
  with check (public.is_eigen_naam(naam));

drop policy if exists "eigen profiel wijzigen" on public.profielen;
create policy "eigen profiel wijzigen" on public.profielen
  for update to authenticated
  using (public.is_eigen_naam(naam))
  with check (public.is_eigen_naam(naam));

drop policy if exists "eigen profiel of beheerder verwijderen" on public.profielen;
create policy "eigen profiel of beheerder verwijderen" on public.profielen
  for delete to authenticated
  using (public.is_eigen_naam(naam) or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Rechten en live verversen
-- ---------------------------------------------------------------------------
revoke all on public.profielen from anon, authenticated;
grant select, insert, update, delete on public.profielen to authenticated;
revoke all on function public.profiel_controleren() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profielen'
     ) then
    alter publication supabase_realtime add table public.profielen;
  end if;
end;
$$;
