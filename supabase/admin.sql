-- Panel de administración de la web. Ejecutar DESPUÉS de esquema.sql y después
-- de crear el usuario administrador en Authentication > Users.
-- Se puede volver a ejecutar sin romper nada.

-- 1. Quiénes son administradores ---------------------------------------------
-- Nadie puede leer ni modificar esta tabla desde la web: solo desde el panel.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
-- La función admin-usuarios (que corre en Supabase) sí necesita consultarla.
grant select on public.admins to service_role;

-- Responde si quien tiene la sesión abierta es administrador.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- 2. El administrador puede crear, cambiar y borrar eventos ------------------

alter table public.eventos add column if not exists usuario text not null default '';

drop policy if exists "El admin gestiona eventos" on public.eventos;
create policy "El admin gestiona eventos" on public.eventos
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- El permiso es para cualquier sesión, pero la regla de arriba solo deja pasar
-- al administrador; los clientes siguen pudiendo únicamente leer su evento.
grant select, insert, update, delete on public.eventos to authenticated;

-- 3. El administrador puede subir y borrar archivos de los clientes ----------

drop policy if exists "El admin gestiona archivos" on storage.objects;
create policy "El admin gestiona archivos" on storage.objects
  for all to authenticated
  using (bucket_id = 'clientes' and (select public.es_admin()))
  with check (bucket_id = 'clientes' and (select public.es_admin()));

-- 4. Nombrar al administrador ------------------------------------------------
-- Cambiar el mail si el usuario administrador se creó con otro.

insert into public.admins (user_id)
select id from auth.users where email = 'jpaquezph.clientes+admin@gmail.com'
on conflict do nothing;

-- Tiene que devolver una fila con el mail del administrador.
select u.email as administrador
from public.admins a
join auth.users u on u.id = a.user_id;
