-- Tweeslag Wispo · meldingen per soort (Instellingen)
-- Per apparaat kiezen welke meldingen je wilt: bus en planning, nieuwe challenges, de uitslag
-- van de stemming en "je kiekje of stukje is beoordeeld". Berichten van de organisatie
-- (soort 'bericht') en de testmelding komen altijd door; die staan hier dus niet tussen.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0021_redactie.sql).
-- Het script mag vaker uitgevoerd worden. Daarna de Edge Function `meldingen` opnieuw deployen
-- (die filtert op de kolom soorten; zonder deze migratie stuurt hij gewoon alles).

-- ---------------------------------------------------------------------------
-- Welke soorten dit apparaat wil (standaard alles)
-- ---------------------------------------------------------------------------
alter table public.push_abonnementen
  add column if not exists soorten text[] not null default array['planning', 'challenges', 'uitslag', 'redactie'];

alter table public.push_abonnementen drop constraint if exists push_abonnementen_soorten_geldig;
alter table public.push_abonnementen add constraint push_abonnementen_soorten_geldig
  check (soorten <@ array['planning', 'challenges', 'uitslag', 'redactie']);

-- ---------------------------------------------------------------------------
-- Opnieuw aanmelden (bewaar_abonnement, zie 0004) houdt de gekozen soorten van dit
-- endpoint vast, ook als het endpoint van een andere gebruiker overgenomen wordt.
-- ---------------------------------------------------------------------------
create or replace function public.bewaar_abonnement(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_soorten text[];
begin
  if auth.uid() is null then
    raise exception 'niet ingelogd';
  end if;
  select soorten into v_soorten from public.push_abonnementen where endpoint = p_endpoint;
  delete from public.push_abonnementen where endpoint = p_endpoint;
  insert into public.push_abonnementen (endpoint, user_id, p256dh, auth, soorten)
  values (
    p_endpoint, auth.uid(), p_p256dh, p_auth,
    coalesce(v_soorten, array['planning', 'challenges', 'uitslag', 'redactie'])
  );
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
-- De keuze van dit apparaat opslaan (alleen voor je eigen abonnement)
-- ---------------------------------------------------------------------------
create or replace function public.zet_meldingsoorten(p_endpoint text, p_soorten text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_soorten text[];
begin
  if auth.uid() is null then
    raise exception 'niet ingelogd';
  end if;
  -- Zonder dubbele en in een vaste volgorde; onbekende soorten worden geweigerd door de check
  select coalesce(array_agg(distinct s order by s), '{}') into v_soorten from unnest(coalesce(p_soorten, '{}')) s;
  update public.push_abonnementen
  set soorten = v_soorten
  where endpoint = p_endpoint and user_id = auth.uid();
  if not found then
    raise exception 'geen_abonnement';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------
revoke all on function public.zet_meldingsoorten(text, text[]) from public, anon;
grant execute on function public.zet_meldingsoorten(text, text[]) to authenticated;
revoke all on function public.bewaar_abonnement(text, text, text) from public, anon;
grant execute on function public.bewaar_abonnement(text, text, text) to authenticated;
