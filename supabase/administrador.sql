-- Cambio de administrador: jpaquez pasa a ser el administrador y se borra todo
-- lo que se llame "admin" (el administrador anterior y cualquier cliente con ese
-- usuario, con sus eventos).
--
-- ANTES de ejecutar esto, crear el usuario nuevo en Authentication > Users >
-- Add user > Create new user:
--   Email:     jpaquezph.clientes+jpaquez@gmail.com
--   Password:  la contraseña del administrador (no se guarda en ningún archivo)
--   Tildar "Auto Confirm User".
-- Después pegar este archivo completo en SQL Editor y ejecutarlo.
-- Se puede volver a ejecutar sin romper nada.

do $$
declare
  nuevo uuid;
  borrados integer;
begin
  select id into nuevo from auth.users where email = 'jpaquezph.clientes+jpaquez@gmail.com';
  if nuevo is null then
    raise exception 'Primero creá el usuario jpaquezph.clientes+jpaquez@gmail.com en Authentication > Users.';
  end if;

  -- 1. jpaquez es administrador.
  insert into public.admins (user_id) values (nuevo) on conflict do nothing;

  -- 2. Se borra todo usuario "admin": el administrador viejo y clientes con ese nombre.
  --    Al borrar el usuario se borran solos su evento y su lugar en la tabla de administradores.
  delete from auth.users u
  where u.id <> nuevo
    and (
      u.email = 'jpaquezph.clientes+admin@gmail.com'
      or exists (select 1 from public.eventos e where e.user_id = u.id and lower(e.usuario) = 'admin')
    );
  get diagnostics borrados = row_count;
  raise notice 'Usuarios "admin" borrados: %', borrados;

  -- 3. Cualquier otro administrador que no sea jpaquez deja de serlo.
  delete from public.admins where user_id <> nuevo;
end $$;

-- 4. Control. Tiene que haber una sola fila: jpaquezph.clientes+jpaquez@gmail.com
select u.email as administrador
from public.admins a
join auth.users u on u.id = a.user_id;

-- 5. Archivos que hayan quedado de usuarios borrados (contratos, fotos).
--    Si aparece alguna fila, borrar esas carpetas desde Storage > clientes.
select name as archivo_huerfano
from storage.objects o
where bucket_id = 'clientes'
  and not exists (select 1 from auth.users u where u.id::text = (storage.foldername(o.name))[1]);
