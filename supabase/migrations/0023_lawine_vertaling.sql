-- Tweeslag Wispo · Nederlandse vertaling van het lawinebulletin
-- De Edge Function `lawine` vertaalt de Franse samenvatting van Météo-France één keer per nieuwe
-- tekst (via de gratis dienst MyMemory) en bewaart de vertaling hier. Zo vraagt hij niet bij elke
-- opening van de app opnieuw een vertaling (de gratis dienst heeft een daglimiet).
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0022_meldingsoorten.sql).
-- Het script mag vaker uitgevoerd worden. Daarna de Edge Function `lawine` opnieuw deployen.

create table if not exists public.lawine_vertalingen (
  -- SHA-256 (hex) van de Franse tekst
  sleutel  text primary key check (char_length(sleutel) = 64),
  frans    text not null check (char_length(frans) <= 4000),
  nl       text not null check (char_length(nl) <= 6000),
  gemaakt  timestamptz not null default now()
);

-- Alleen de Edge Function (service role) leest en schrijft: geen policies voor de app
alter table public.lawine_vertalingen enable row level security;

revoke all on public.lawine_vertalingen from anon, authenticated;
grant select, insert, delete on public.lawine_vertalingen to service_role;
