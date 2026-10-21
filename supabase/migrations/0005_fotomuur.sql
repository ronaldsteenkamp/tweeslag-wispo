-- Tweeslag Wispo · fase 5: fotomuur
-- Foto's als bewijs bij een challenge: bestanden in een privé-bucket, gegevens in de tabel fotos.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0004_meldingen.sql).
-- Het script mag vaker uitgevoerd worden.
--
-- De bucket is niet openbaar: alleen ingelogde apparaten (dus de app, ook anoniem) kunnen
-- een tijdelijke link (signed URL) maken. Wie de link van een foto doorstuurt, deelt hem
-- maar een uur. De app verkleint en comprimeert foto's vóór het uploaden (max. ~1600 px,
-- ~300 kB) en haalt daarbij ook de locatie- en cameragegevens (EXIF) eruit.

-- ---------------------------------------------------------------------------
-- Bucket (privé, alleen JPEG/WebP, max. 1 MB per bestand)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bestanden staan in een map per gebruiker: <user_id>/<willekeurig>.jpg
drop policy if exists "fotos bekijken" on storage.objects;
create policy "fotos bekijken" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos');

drop policy if exists "eigen foto uploaden" on storage.objects;
create policy "eigen foto uploaden" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigen foto of beheerder verwijderen" on storage.objects;
create policy "eigen foto of beheerder verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_beheerder()));

-- ---------------------------------------------------------------------------
-- Tabel met de gegevens per foto. Naam en kamer worden bij het uploaden vastgelegd
-- (uit deelnemers), zodat ze blijven kloppen als iemand later van telefoon wisselt.
-- ---------------------------------------------------------------------------
create table if not exists public.fotos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  naam            text not null,
  kamer           text,
  challenge_id    text not null check (char_length(challenge_id) between 1 and 80),
  challenge_titel text not null check (char_length(challenge_titel) between 1 and 120),
  pad             text not null unique check (char_length(pad) <= 200),
  breedte         integer check (breedte between 1 and 4000),
  hoogte          integer check (hoogte between 1 and 4000),
  gemaakt         timestamptz not null default now()
);

create index if not exists fotos_gemaakt on public.fotos (gemaakt desc);

-- Bij het invoegen: altijd de eigen gebruiker, naam en kamer van de server, en het pad
-- moet in de eigen map staan
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
  return new;
end;
$$;

drop trigger if exists fotos_vullen on public.fotos;
create trigger fotos_vullen
  before insert on public.fotos
  for each row execute function public.foto_vullen();

alter table public.fotos enable row level security;

drop policy if exists "fotos lezen" on public.fotos;
create policy "fotos lezen" on public.fotos
  for select to authenticated
  using (true);

drop policy if exists "eigen foto toevoegen" on public.fotos;
create policy "eigen foto toevoegen" on public.fotos
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "eigen foto of beheerder verwijderen" on public.fotos;
create policy "eigen foto of beheerder verwijderen" on public.fotos
  for delete to authenticated
  using (user_id = auth.uid() or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Rechten en live verversen
-- ---------------------------------------------------------------------------
revoke all on public.fotos from anon, authenticated;
grant select, insert, delete on public.fotos to authenticated;
grant select, insert, update, delete on public.fotos to service_role;
revoke all on function public.foto_vullen() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fotos'
     ) then
    alter publication supabase_realtime add table public.fotos;
  end if;
end;
$$;
