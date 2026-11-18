-- Tweeslag Wispo · fotomuur: opnamemoment van een foto
-- Tot nu toe stond een foto op de muur op het moment van UPLOADEN (gemaakt). Een foto die zonder
-- bereik op dag 3 werd gemaakt en pas op dag 4 verstuurd, kwam daardoor op de verkeerde dag.
-- Nieuwe kolom 'genomen': het moment dat de telefoon opgeeft (uit de foto zelf, of het bestand).
-- De server neemt dat alleen over als het geloofwaardig is: niet in de toekomst en niet ouder dan
-- 30 dagen. Anders (en bij oude versies van de app die het niet meesturen) = het uploadmoment.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0015_profiel_optioneel.sql),
-- VÓÓR de app-versie die 'genomen' opvraagt live gaat. Het script mag vaker uitgevoerd worden.

alter table public.fotos add column if not exists genomen timestamptz;
update public.fotos set genomen = gemaakt where genomen is null;
alter table public.fotos alter column genomen set not null;

create index if not exists fotos_genomen on public.fotos (genomen desc);

-- Zelfde als in 0005, plus de controle op 'genomen'
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
  return new;
end;
$$;

revoke all on function public.foto_vullen() from public, anon, authenticated;
