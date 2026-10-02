-- Evidencia del acuerdo de pago: captura del mensaje o documento donde el jugador acepta las
-- condiciones. Sin evidencia no hay acuerdo — la base lo exige con `not null`, no solo la app.
-- En el Supabase remoto no hay acuerdos registrados todavía, así que la columna entra sin backfill.

alter table public.acuerdos_pago add column evidencia_path text not null;

-- La evidencia vive en la carpeta del club, igual que los soportes de egresos.
alter table public.acuerdos_pago add constraint acuerdos_evidencia_ruta
  check (evidencia_path like club_id::text || '/acuerdos/%');

-- Solo tesorería la sube al crear el acuerdo. Una vez creado, la evidencia no se edita:
-- no hay grant de update sobre esta columna (el grant de update de `acuerdos_pago` ya existente
-- solo cubre `notas, estado`, así que no hace falta tocarlo).
grant insert (evidencia_path) on public.acuerdos_pago to authenticated;

-- ---------- Storage: evidencia en el bucket `comprobantes`, ruta {club_id}/acuerdos/{uuid}.{ext} ----------
-- La lectura ya la cubre la política existente de `comprobantes` (tesorería y administración leen
-- `{club_id}/…`); un jugador no la ve porque `acuerdos` no es un id de miembro.

create policy "Evidencia de acuerdos: tesorería sube a la carpeta del club"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comprobantes'
  and (storage.foldername(name))[2] = 'acuerdos'
  and private.uuid_o_null((storage.foldername(name))[1]) = any ((select private.clubes_con_rol('{tesorero}'))::uuid[])
);
