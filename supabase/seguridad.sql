-- Refuerzo de seguridad. Ejecutar DESPUÉS de esquema.sql y admin.sql, en
-- Supabase > SQL Editor. Se puede volver a ejecutar sin romper nada.
-- Al final devuelve un control: todas las filas tienen que decir "ok".

-- 1. Nada nuevo queda expuesto por defecto -----------------------------------
-- Supabase le da permisos automáticos a la web (anon/authenticated) sobre toda
-- tabla o función nueva del esquema public. Se quitan: cada permiso se da a mano.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Los visitantes sin sesión no tienen nada que hacer en la base.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2. GraphQL apagado ---------------------------------------------------------
-- La web no lo usa; sin él hay una puerta menos para listar la estructura de la base.

drop extension if exists pg_graphql;

-- 3. Datos del evento con formato válido -------------------------------------

do $$ begin
  alter table public.eventos add constraint eventos_drive_https
    check (drive_url is null or drive_url = '' or drive_url ~* '^https://');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.eventos add constraint eventos_json_listas
    check (
      jsonb_typeof(pagos) = 'array' and jsonb_typeof(incluye) = 'array'
      and jsonb_typeof(condiciones) = 'array'
      and jsonb_typeof(cronograma) in ('array', 'object')
    );
exception when duplicate_object then null; end $$;

-- 4. Archivos: solo PDF e imágenes, de hasta 15 MB -----------------------------

update storage.buckets
set public = false,
    file_size_limit = 15 * 1024 * 1024,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'clientes';

-- 5. Registro de auditoría ---------------------------------------------------
-- Queda anotado quién creó, cambió o borró cada evento y cada usuario.
-- Se consulta desde Table Editor > auditoria. La web no puede leerla ni tocarla.

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  cuando timestamptz not null default now(),
  actor uuid,            -- quién lo hizo (id de usuario)
  accion text not null,  -- evento.insert, evento.update, usuario.crear, ...
  objetivo text not null default '',
  detalle jsonb
);

alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;
grant insert on public.auditoria to service_role;
grant select on public.auditoria to service_role;

create or replace function public.auditar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auditoria (actor, accion, objetivo, detalle)
  values (
    (select auth.uid()),
    'evento.' || lower(tg_op),
    case when tg_op = 'DELETE' then old.id else new.id end::text,
    -- Del evento borrado se guarda una copia completa, por si hay que recuperarlo.
    case when tg_op = 'DELETE' then to_jsonb(old) else null end
  );
  return null;
end;
$$;

revoke all on function public.auditar_evento() from public, anon, authenticated;

drop trigger if exists auditar_evento on public.eventos;
create trigger auditar_evento
  after insert or update or delete on public.eventos
  for each row execute function public.auditar_evento();

-- Borra los registros de más de 2 años. Ejecutar a mano una vez por año:
--   select public.limpiar_auditoria();
create or replace function public.limpiar_auditoria()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auditoria where cuando < now() - interval '2 years';
$$;

revoke all on function public.limpiar_auditoria() from public, anon, authenticated;
grant execute on function public.limpiar_auditoria() to service_role;

-- 6. Cerrar las sesiones de un cliente al cambiarle la contraseña -------------
-- Solo la puede usar la función admin-usuarios (clave de servicio).

create or replace function public.cerrar_sesiones(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = uid;
$$;

revoke all on function public.cerrar_sesiones(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones(uuid) to service_role;

-- 7. Control -----------------------------------------------------------------

select 'RLS activo en ' || c.relname as control,
       case when c.relrowsecurity then 'ok' else 'FALTA' end as estado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
union all
select 'Visitantes sin acceso a ' || table_name, 'FALTA: tiene ' || string_agg(privilege_type, ', ')
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
group by table_name
union all
select 'Bucket clientes privado',
       case when exists (select 1 from storage.buckets where id = 'clientes' and not public) then 'ok' else 'FALTA' end
union all
select 'GraphQL apagado',
       case when not exists (select 1 from pg_extension where extname = 'pg_graphql') then 'ok' else 'FALTA' end
union all
select 'Hay un administrador',
       case when exists (select 1 from public.admins) then 'ok' else 'FALTA' end;
