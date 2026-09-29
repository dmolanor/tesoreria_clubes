-- Storage de comprobantes (sustituye .data/uploads). Bucket privado: se accede con URLs firmadas.
-- Ruta: {club_id}/{miembro_id}/{uuid}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

-- Convierte un segmento de ruta en uuid sin fallar ante rutas mal formadas.
create function private.uuid_o_null(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
grant execute on function private.uuid_o_null(text) to authenticated;

create policy "Comprobantes: el jugador ve los suyos; tesorería y administración los del club"
on storage.objects for select to authenticated
using (
  bucket_id = 'comprobantes' and (
    private.uuid_o_null((storage.foldername(name))[2]) = any ((select private.mis_miembros())::uuid[])
    or private.uuid_o_null((storage.foldername(name))[1]) = any ((select private.clubes_con_rol('{tesorero,administrativo}'))::uuid[])
  )
);

create policy "Comprobantes: el jugador sube a su propia carpeta"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comprobantes'
  and exists (
    select 1 from public.miembros m
    where m.id = private.uuid_o_null((storage.foldername(name))[2])
      and m.club_id = private.uuid_o_null((storage.foldername(name))[1])
      and m.id = any ((select private.mis_miembros())::uuid[])
  )
);
-- Sin update/delete: un comprobante subido es evidencia.
