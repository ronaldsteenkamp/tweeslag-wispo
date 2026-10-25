-- Tweeslag Wispo · foto's op de fotomuur: alleen beheerders mogen verwijderen
-- Eerder mocht ook de maker zijn eigen foto weghalen. Nu alleen een ingelogde beheerder
-- (tabel beheerders), zowel de rij in fotos als de bestanden in de bucket.
--
-- Eigen bestanden die (nog) niet op de fotomuur staan mag je wel blijven weghalen: een oude
-- profielfoto (<user_id>/profiel-….jpg) en een upload die halverwege mislukte.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plak dit bestand → Run (na 0008_kamerverdeling.sql).
-- Het script mag vaker uitgevoerd worden.

-- De rij op de fotomuur
drop policy if exists "eigen foto of beheerder verwijderen" on public.fotos;
drop policy if exists "fotos verwijderen door beheerder" on public.fotos;
create policy "fotos verwijderen door beheerder" on public.fotos
  for delete to authenticated
  using (public.is_beheerder());

-- De bestanden (groot en klein) in de bucket
drop policy if exists "eigen foto of beheerder verwijderen" on storage.objects;
drop policy if exists "fotobestanden verwijderen" on storage.objects;
create policy "fotobestanden verwijderen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (
      public.is_beheerder()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and not exists (
          select 1 from public.fotos f
          where f.pad = storage.objects.name
             or replace(f.pad, '.jpg', '-klein.jpg') = storage.objects.name
        )
      )
    )
  );
