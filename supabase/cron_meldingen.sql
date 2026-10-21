-- Tweeslag Wispo · fase 4: geplande meldingen elke 5 minuten
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run,
-- NADAT de Edge Function `meldingen` is gedeployd. Mag vaker uitgevoerd worden.
-- Ander project? Pas hieronder de URL aan (Project Settings → Data API → Project URL).
--
-- De functie kijkt elke keer wat er "aan de beurt" is (30 minuten voor een planningsitem
-- met "melding": true, nieuwe challenges, uitslagen van stemmingen) en verstuurt alleen
-- wat nog niet verstuurd is. Daarom is er geen geheim nodig: vaker aanroepen kan geen kwaad.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'tweeslag-meldingen';

select cron.schedule(
  'tweeslag-meldingen',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://pqxvfewizjyqeoerzjwx.supabase.co/functions/v1/meldingen',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"soort": "gepland"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Controleren: select * from cron.job_run_details order by start_time desc limit 5;
--              select * from net._http_response order by created desc limit 5;
-- Stoppen:     select cron.unschedule('tweeslag-meldingen');
