-- Tweeslag Wispo · fase 3: dagelijkse stemming
-- Stemmingen (vraag + open/sluit), stemmen en de uitslag.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0002_scorebord.sql).
-- Het script mag vaker uitgevoerd worden.
--
-- De vragen staan in public/data/stemmingen.json. De app van een ingelogde beheerder zet
-- ze automatisch in de tabel stemmingen (met de namen uit kamers.json als kandidaten).
-- Zo kent de database de sluitingstijd en kan hij zelf afdwingen dat:
--   · je alleen stemt terwijl de stemming open is,
--   · je niet op jezelf stemt en per vraag maar één keer stemt (per naam, dus ook niet
--     nog een keer vanaf een tweede telefoon),
--   · niemand (ook geen beheerder in de app) de uitslag ziet vóór de sluitingstijd.

-- ---------------------------------------------------------------------------
-- Stemmingen: alleen beheerders schrijven, iedereen leest
-- ---------------------------------------------------------------------------
create table if not exists public.stemmingen (
  id         text primary key check (char_length(id) between 1 and 60),
  datum      date not null,
  vraag      text not null check (char_length(trim(vraag)) between 1 and 120),
  open       timestamptz not null,
  sluit      timestamptz not null,
  kandidaten text[] not null default '{}' check (cardinality(kandidaten) <= 200),
  bijgewerkt timestamptz not null default now(),
  check (sluit > open)
);

alter table public.stemmingen enable row level security;

drop policy if exists "stemmingen lezen" on public.stemmingen;
create policy "stemmingen lezen" on public.stemmingen
  for select to authenticated
  using (true);

drop policy if exists "stemmingen beheren" on public.stemmingen;
create policy "stemmingen beheren" on public.stemmingen
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

drop trigger if exists stemmingen_bijgewerkt on public.stemmingen;
create trigger stemmingen_bijgewerkt
  before insert or update on public.stemmingen
  for each row execute function public.zet_bijgewerkt();

-- ---------------------------------------------------------------------------
-- Stemmen: één per naam per stemming. Alleen te maken via de functie stem().
-- ---------------------------------------------------------------------------
create table if not exists public.stemmen (
  id          bigint generated always as identity primary key,
  stemming_id text not null references public.stemmingen (id) on delete cascade,
  kiezer      text not null check (char_length(kiezer) between 1 and 40),
  kandidaat   text not null check (char_length(kandidaat) between 1 and 40),
  door        uuid default auth.uid() references auth.users (id) on delete set null,
  gemaakt     timestamptz not null default now(),
  check (lower(kiezer) <> lower(kandidaat))
);

create unique index if not exists stemmen_een_per_naam on public.stemmen (stemming_id, lower(kiezer));

alter table public.stemmen enable row level security;

-- Je ziet alleen je eigen stemmen (om te tonen op wie je stemde). Wie op wie stemde
-- blijft verder geheim; de uitslag komt via stemstand() hieronder.
drop policy if exists "eigen stemmen lezen" on public.stemmen;
create policy "eigen stemmen lezen" on public.stemmen
  for select to authenticated
  using (lower(kiezer) = (select lower(d.naam) from public.deelnemers d where d.user_id = auth.uid()));

-- Verwijderen: alleen via stem_intrekken() hieronder (een beheerder hoeft daarvoor
-- niet te kunnen zien wie op wie stemde)
drop policy if exists "stemmen verwijderen door beheerder" on public.stemmen;

-- ---------------------------------------------------------------------------
-- stem(): stemmen met alle controles. Foutmeldingen (voor de app):
--   geen_naam, onbekend, nog_niet_open, gesloten, geen_kandidaat, niet_op_jezelf, al_gestemd
-- ---------------------------------------------------------------------------
create or replace function public.stem(p_stemming text, p_kandidaat text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kiezer    text;
  v_stemming  public.stemmingen%rowtype;
  v_kandidaat text;
begin
  if auth.uid() is null then
    raise exception 'niet ingelogd';
  end if;

  select naam into v_kiezer from public.deelnemers where user_id = auth.uid();
  if v_kiezer is null then
    raise exception 'geen_naam';
  end if;

  select * into v_stemming from public.stemmingen where id = p_stemming;
  if not found then
    raise exception 'onbekend';
  end if;
  if now() < v_stemming.open then
    raise exception 'nog_niet_open';
  end if;
  if now() >= v_stemming.sluit then
    raise exception 'gesloten';
  end if;

  -- De naam precies zoals hij in de kandidatenlijst staat
  select k into v_kandidaat
  from unnest(v_stemming.kandidaten) as k
  where lower(k) = lower(trim(p_kandidaat))
  limit 1;
  if v_kandidaat is null then
    raise exception 'geen_kandidaat';
  end if;
  if lower(v_kandidaat) = lower(v_kiezer) then
    raise exception 'niet_op_jezelf';
  end if;

  begin
    insert into public.stemmen (stemming_id, kiezer, kandidaat)
    values (v_stemming.id, v_kiezer, v_kandidaat);
  exception when unique_violation then
    raise exception 'al_gestemd';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- stem_intrekken(): beheerder haalt de stem van iemand weg (bijv. per ongeluk
-- verkeerd gestemd), zodat diegene opnieuw kan stemmen. Geeft terug of er iets weg was.
-- ---------------------------------------------------------------------------
create or replace function public.stem_intrekken(p_stemming text, p_kiezer text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_beheerder() then
    raise exception 'geen_beheerder';
  end if;
  delete from public.stemmen
  where stemming_id = p_stemming and lower(kiezer) = lower(trim(p_kiezer));
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- stemstand(): per stemming het aantal stemmen (kandidaat = null), en pas na de
-- sluitingstijd ook het aantal stemmen per kandidaat.
-- ---------------------------------------------------------------------------
create or replace function public.stemstand()
returns table (stemming_id text, kandidaat text, stemmen integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, null::text, count(st.id)::integer
  from public.stemmingen s
  left join public.stemmen st on st.stemming_id = s.id
  group by s.id
  union all
  select st.stemming_id, st.kandidaat, count(*)::integer
  from public.stemmen st
  join public.stemmingen s on s.id = st.stemming_id
  where s.sluit <= now()
  group by st.stemming_id, st.kandidaat;
$$;

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------
revoke all on public.stemmingen, public.stemmen from anon;
grant select, insert, update, delete on public.stemmingen to authenticated;
revoke all on public.stemmen from authenticated;
grant select on public.stemmen to authenticated;
revoke all on function public.stem(text, text) from public, anon;
grant execute on function public.stem(text, text) to authenticated;
revoke all on function public.stem_intrekken(text, text) from public, anon;
grant execute on function public.stem_intrekken(text, text) to authenticated;
revoke all on function public.stemstand() from public, anon;
grant execute on function public.stemstand() to authenticated;
