-- Tweeslag Wispo · persoonsdata per naam
-- Alles wat iemand zelf bijhoudt (paklijst, badges, gezien-lijsten, spel, casino) hoort bij de
-- naam, niet bij de telefoon. Kiest iemand zijn naam op een andere telefoon of in een andere
-- browser, dan komt alles mee. Eén rij per naam en sleutel; welke sleutels er zijn en hoe ze
-- samengevoegd worden staat in src/lib/persoonsdataregels.ts.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0013_kamernamen.sql).
-- Het script mag vaker uitgevoerd worden. Zonder dit script werkt de app zoals vroeger: alles
-- blijft dan alleen op de telefoon.
--
-- Net als bij de profielen (0007_profielen.sql): geen pincode. Lezen en schrijven mag alleen het
-- apparaat dat de naam op dit moment heeft (kies_naam in 0001_basis.sql, is_eigen_naam in 0007).
-- 'bijgewerkt' is het moment van de wijziging op de telefoon (niet van de server): daarmee kiest
-- de app bij het samenvoegen de nieuwste waarde, ook als er offline gewerkt is.

create table if not exists public.persoonsdata (
  naam       text not null check (char_length(naam) between 1 and 40 and naam = trim(naam)),
  sleutel    text not null check (sleutel ~ '^[a-z][a-zA-Z0-9.]{0,59}$'),
  waarde     jsonb,
  bijgewerkt timestamptz not null default now(),
  primary key (naam, sleutel),
  constraint persoonsdata_waarde_grootte check (waarde is null or octet_length(waarde::text) <= 65536)
);

-- Alle rijen van één naam, ook als de hoofdletters verschillen
create index if not exists persoonsdata_naam on public.persoonsdata (lower(naam));

alter table public.persoonsdata enable row level security;

drop policy if exists "eigen persoonsdata lezen" on public.persoonsdata;
create policy "eigen persoonsdata lezen" on public.persoonsdata
  for select to authenticated
  using (public.is_eigen_naam(naam));

drop policy if exists "eigen persoonsdata aanmaken" on public.persoonsdata;
create policy "eigen persoonsdata aanmaken" on public.persoonsdata
  for insert to authenticated
  with check (public.is_eigen_naam(naam));

drop policy if exists "eigen persoonsdata wijzigen" on public.persoonsdata;
create policy "eigen persoonsdata wijzigen" on public.persoonsdata
  for update to authenticated
  using (public.is_eigen_naam(naam))
  with check (public.is_eigen_naam(naam));

drop policy if exists "eigen persoonsdata of beheerder verwijderen" on public.persoonsdata;
create policy "eigen persoonsdata of beheerder verwijderen" on public.persoonsdata
  for delete to authenticated
  using (public.is_eigen_naam(naam) or public.is_beheerder());

-- ---------------------------------------------------------------------------
-- Rechten (nieuwe tabellen worden in dit project niet automatisch opengezet)
-- ---------------------------------------------------------------------------
revoke all on public.persoonsdata from anon, authenticated;
grant select, insert, update, delete on public.persoonsdata to authenticated;
grant all on public.persoonsdata to service_role;
