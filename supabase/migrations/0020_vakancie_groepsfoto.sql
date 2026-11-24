-- Tweeslag Wispo · groepsfoto van de VakanCie
-- Een beheerder mag in de privé-bucket 'fotos' een groepsfoto plaatsen in de map 'vakancie/'.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0019).
-- Het script mag vaker uitgevoerd worden.
--
-- Wat er al was en zo blijft (0005_fotomuur.sql):
-- - "fotos bekijken": ingelogde apparaten (ook anoniem, dus de app) mogen bestanden in 'fotos'
--   lezen en een tijdelijke link maken. Daarmee ziet iedereen in de app de groepsfoto, en niemand
--   daarbuiten.
-- - "eigen foto of beheerder verwijderen": een beheerder mag elk bestand weghalen, dus ook een oude
--   groepsfoto.
--
-- Nieuw: uploaden in de map 'vakancie/' alleen voor een beheerder (public.is_beheerder(), zie
-- 0001_basis.sql). Gewone uploads blijven alleen in de eigen map (<user_id>/...).

drop policy if exists "groepsfoto plaatsen door beheerder" on storage.objects;
create policy "groepsfoto plaatsen door beheerder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'vakancie'
    and public.is_beheerder()
  );

-- Terugdraaien:
--   drop policy if exists "groepsfoto plaatsen door beheerder" on storage.objects;
--   (en eventueel de bestanden in fotos/vakancie/ weghalen via Storage in het dashboard)
