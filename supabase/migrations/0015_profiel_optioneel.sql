-- Tweeslag Wispo · profiel: alle vragen optioneel (spelerskaartje)
-- Tot nu toe moest alles ingevuld zijn voordat een profiel naar de server mocht. Nu mag elk
-- plaatje half zijn: ski/board en niveau mogen leeg (null), de teksten mogen leeg ('').
-- De maximale lengtes blijven.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0014).
-- Het script mag vaker uitgevoerd worden. Oude apps sturen nog steeds volledige profielen;
-- die passen ook in de nieuwe regels.

alter table public.profielen
  alter column ski drop not null,
  alter column niveau drop not null,
  alter column feitje set default '',
  alter column karaoke set default '',
  alter column artiest set default '',
  alter column angst set default '';

alter table public.profielen
  drop constraint if exists profielen_ski_check,
  drop constraint if exists profielen_niveau_check,
  drop constraint if exists profielen_feitje_check,
  drop constraint if exists profielen_karaoke_check,
  drop constraint if exists profielen_artiest_check,
  drop constraint if exists profielen_angst_check;

alter table public.profielen
  add constraint profielen_ski_check check (ski is null or ski in ('ski', 'board', 'allebei', 'nooit')) not valid,
  add constraint profielen_niveau_check check (niveau is null or niveau between 1 and 5) not valid,
  add constraint profielen_feitje_check check (char_length(feitje) <= 140) not valid,
  add constraint profielen_karaoke_check check (karaoke is not null and char_length(karaoke) <= 60) not valid,
  add constraint profielen_artiest_check check (artiest is not null and char_length(artiest) <= 60) not valid,
  add constraint profielen_angst_check check (angst is not null and char_length(angst) <= 80) not valid;
