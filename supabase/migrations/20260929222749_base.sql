-- Base: extensiones, esquema privado y tipos del dominio.
-- Nombres de tablas/columnas en español a propósito (ver CLAUDE.md).

create extension if not exists citext with schema extensions;

-- Esquema NO expuesto por la API: helpers de RLS y funciones security definer.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Enums para conjuntos cerrados (generan uniones en los tipos TS).
create type public.rol as enum ('administrativo', 'tesorero', 'jugador');
create type public.estado_miembro as enum ('activo', 'lesionado', 'retirado');
create type public.tipo_cobro as enum ('mensualidad', 'afiliacion', 'torneo', 'uniforme', 'otro');
create type public.alcance_cobro as enum ('todos', 'grupo', 'individual');
create type public.estado_evento as enum ('activo', 'cancelado');
create type public.estado_comprobante as enum ('pendiente', 'aceptado', 'rechazado');
create type public.canal_comprobante as enum ('manual', 'whatsapp', 'wompi');
create type public.origen_aplicacion as enum ('propuesta', 'manual', 'saldo_a_favor');
create type public.tipo_regla as enum ('monto_exacto', 'evento_especifico', 'mas_antiguo_primero');
create type public.objetivo_bitacora as enum ('miembro', 'evento_cobro', 'comprobante', 'conciliacion', 'regla');
-- Enum cerrado de la bitácora: agregar un valor es una decisión deliberada (docs/02).
create type public.tipo_bitacora as enum (
  'evento_cobro_creado',
  'evento_cobro_cancelado',
  'jugador_creado',
  'jugador_estado_cambiado',
  'comprobante_subido',
  'comprobante_aceptado',
  'comprobante_rechazado',
  'conciliacion_guardada',
  'regla_conciliacion_cambiada'
);

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Las funciones nuevas no son ejecutables por defecto: se otorga explícitamente.
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema private revoke execute on functions from public, anon;
