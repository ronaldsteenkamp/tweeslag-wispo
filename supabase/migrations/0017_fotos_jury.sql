-- Tweeslag Wispo · fotomuur: jurykeuze
-- Een beheerder (de jury) kan een foto een stempel "Jurykeuze" geven. Die foto wordt de
-- openingsfoto van zijn dag en komt op de omslag van het jaarboek. De maker krijgt er 10 punten
-- voor in het klassement: als correctie "Jurykeuze: <challenge>", die vanzelf weer verdwijnt als
-- de stempel eraf gaat of de foto verwijderd wordt.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0016_fotos_opnamedatum.sql),
-- VÓÓR de app-versie die 'jury' opvraagt live gaat. Het script mag vaker uitgevoerd worden.

alter table public.fotos add column if not exists jury boolean not null default false;
-- Welke correctie bij de stempel hoort. Bewust zonder foreign key: met 'on delete set null' zou het
-- weghalen van de correctie (in de trigger hieronder) dezelfde fotorij nog eens willen aanpassen.
alter table public.fotos add column if not exists jury_correctie bigint;

-- Zelfde als in 0016, plus: bij het insturen staat de stempel altijd uit
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
  return new;
end;
$$;

-- Stempel aan: 10 punten erbij (correctie). Stempel uit of foto weg: die punten er weer af.
create or replace function public.foto_jury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if tg_op = 'DELETE' then
    if old.jury_correctie is not null then
      delete from public.correcties where id = old.jury_correctie;
    end if;
    return old;
  end if;
  if new.jury and not old.jury then
    insert into public.correcties (naam, punten, reden)
    values (new.naam, 10, left('Jurykeuze: ' || new.challenge_titel, 120))
    returning id into v_id;
    new.jury_correctie := v_id;
  elsif old.jury and not new.jury then
    if old.jury_correctie is not null then
      delete from public.correcties where id = old.jury_correctie;
    end if;
    new.jury_correctie := null;
  end if;
  return new;
end;
$$;

drop trigger if exists fotos_jury on public.fotos;
create trigger fotos_jury
  before update of jury or delete on public.fotos
  for each row execute function public.foto_jury();

-- Alleen beheerders mogen de stempel zetten, en alleen die ene kolom
drop policy if exists "jurykeuze door beheerder" on public.fotos;
create policy "jurykeuze door beheerder" on public.fotos
  for update to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

grant update (jury) on public.fotos to authenticated;
revoke all on function public.foto_jury() from public, anon, authenticated;
revoke all on function public.foto_vullen() from public, anon, authenticated;
