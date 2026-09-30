-- Formato de montos negativos en la bitácora: -$5.010.000 (antes salía $-5.010.000).
create or replace function private.cop(p_monto numeric) returns text
language sql immutable set search_path = '' as $$
  select case when p_monto < 0 then '-' else '' end
      || '$' || replace(to_char(round(abs(p_monto)), 'FM999,999,999,990'), ',', '.')
$$;
