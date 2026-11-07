-- Métricas de visitas de la web. Ejecutar DESPUÉS de esquema.sql, admin.sql y
-- seguridad.sql, en Supabase > SQL Editor. Se puede volver a ejecutar sin romper nada.
--
-- Sin cookies y sin datos personales: de cada visita se guarda la página, de qué
-- sitio llegó (solo el dominio) y si es celular, tablet o compu. Para contar
-- "visitantes" se guarda una huella que cambia todos los días y no se puede
-- revertir (IP + navegador + fecha + un secreto, pasados por SHA-256): sirve para
-- saber cuántas personas distintas entraron en el día, no quiénes son.
-- De yapa, las visitas mantienen activo el proyecto y el plan gratis no se pausa.

-- 1. Tablas ------------------------------------------------------------------

create table if not exists public.visitas (
  id bigint generated always as identity primary key,
  cuando timestamptz not null default now(),
  ruta text not null,
  referente text not null default '',   -- dominio de origen ("instagram.com"), vacío si entró directo
  dispositivo text not null default '', -- celular | tablet | compu
  visitante text not null default ''    -- huella diaria (ver arriba)
);

create index if not exists visitas_cuando on public.visitas (cuando);
create index if not exists visitas_visitante on public.visitas (visitante, cuando);

alter table public.visitas enable row level security;
revoke all on public.visitas from anon, authenticated;

-- El secreto de la huella. Nadie lo puede leer desde la web.
create table if not exists public.metricas_secreto (
  unico boolean primary key default true check (unico),
  valor text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.metricas_secreto default values on conflict do nothing;
alter table public.metricas_secreto enable row level security;
revoke all on public.metricas_secreto from anon, authenticated;

-- 2. Registrar una visita (lo llama cada página pública) ----------------------

-- Huella diaria del visitante que hace el pedido (ver arriba). Solo la usan las
-- funciones de registro: nadie la puede llamar desde la web.
create or replace function public.huella_visitante()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cabeceras json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  ip text := trim(split_part(coalesce(cabeceras ->> 'x-forwarded-for', cabeceras ->> 'x-real-ip', ''), ',', 1));
  navegador text := left(coalesce(cabeceras ->> 'user-agent', ''), 400);
begin
  if navegador = '' or navegador ~* '(bot|crawl|spider|slurp|preview|headless|lighthouse|monitor)' then return null; end if;
  return encode(
    sha256(convert_to(ip || '|' || navegador || '|' || current_date::text || '|' ||
      (select valor from public.metricas_secreto), 'UTF8')),
    'hex'
  );
end;
$$;

revoke all on function public.huella_visitante() from public, anon, authenticated;

create or replace function public.registrar_visita(ruta text, referente text default '', dispositivo text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  huella text := public.huella_visitante();
begin
  ruta := left(coalesce(ruta, ''), 200);
  if ruta !~ '^/[A-Za-z0-9/_.~%-]*$' or ruta ~ '^(/[^/]+)?/clientes' then return; end if;
  if huella is null then return; end if;

  referente := lower(left(coalesce(substring(referente from '^https?://([^/:?#]+)'), ''), 100));
  referente := regexp_replace(referente, '^(www|m|l|lm)\.', '');
  dispositivo := case when dispositivo in ('celular', 'tablet', 'compu') then dispositivo else 'otro' end;

  -- Freno contra abusos: hasta 300 registros por visitante por día.
  if (select count(*) from public.visitas v where v.visitante = huella and v.cuando >= current_date) >= 300 then
    return;
  end if;

  insert into public.visitas (ruta, referente, dispositivo, visitante)
  values (ruta, referente, dispositivo, huella);
end;
$$;

revoke all on function public.registrar_visita(text, text, text) from public;
grant execute on function public.registrar_visita(text, text, text) to anon, authenticated;

-- 2b. Clics de contacto: WhatsApp, el formulario de Contacto, Instagram, YouTube, mail y el botón Contactar.

create table if not exists public.clics (
  id bigint generated always as identity primary key,
  cuando timestamptz not null default now(),
  ruta text not null,     -- página donde se hizo el clic
  destino text not null,  -- whatsapp | formulario | instagram | youtube | email | contacto
  visitante text not null default ''
);

create index if not exists clics_cuando on public.clics (cuando);
alter table public.clics enable row level security;
revoke all on public.clics from anon, authenticated;

create or replace function public.registrar_clic(ruta text, destino text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  huella text := public.huella_visitante();
begin
  ruta := left(coalesce(ruta, ''), 200);
  if ruta !~ '^/[A-Za-z0-9/_.~%-]*$' or ruta ~ '^(/[^/]+)?/clientes' then return; end if;
  if destino not in ('whatsapp', 'formulario', 'instagram', 'youtube', 'email', 'contacto') or huella is null then return; end if;
  -- Freno contra abusos: hasta 100 clics por visitante por día.
  if (select count(*) from public.clics c where c.visitante = huella and c.cuando >= current_date) >= 100 then
    return;
  end if;
  insert into public.clics (ruta, destino, visitante) values (ruta, destino, huella);
end;
$$;

revoke all on function public.registrar_clic(text, text) from public;
grant execute on function public.registrar_clic(text, text) to anon, authenticated;

-- 3. Resumen para el panel (solo administradores) -----------------------------

create or replace function public.metricas(dias integer default 30)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  desde timestamptz;
  resultado json;
begin
  if not (select public.es_admin()) then raise exception 'No autorizado'; end if;
  dias := least(greatest(coalesce(dias, 30), 1), 365);
  desde := date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
    - make_interval(days => dias - 1);

  with v as (
    select *, (cuando at time zone 'America/Argentina/Buenos_Aires')::date as dia
    from public.visitas where cuando >= desde
  ), c as (
    select *, (cuando at time zone 'America/Argentina/Buenos_Aires')::date as dia
    from public.clics where cuando >= desde
  )
  select json_build_object(
    'dias', dias,
    'visitas', (select count(*) from v),
    'visitantes', (select count(distinct (visitante, dia)) from v),
    'hoy', (select count(*) from v where dia = (now() at time zone 'America/Argentina/Buenos_Aires')::date),
    'porDia', coalesce((
      select json_agg(json_build_object('dia', d.dia, 'visitas', coalesce(x.visitas, 0), 'visitantes', coalesce(x.visitantes, 0)) order by d.dia)
      from (
        select generate_series((desde at time zone 'America/Argentina/Buenos_Aires')::date,
                               (now() at time zone 'America/Argentina/Buenos_Aires')::date, interval '1 day')::date as dia
      ) d
      left join (select dia, count(*) as visitas, count(distinct visitante) as visitantes from v group by dia) x on x.dia = d.dia
    ), '[]'::json),
    'paginas', coalesce((
      select json_agg(json_build_object('ruta', ruta, 'visitas', n) order by n desc)
      from (select ruta, count(*) as n from v group by ruta order by n desc limit 15) p
    ), '[]'::json),
    'referentes', coalesce((
      select json_agg(json_build_object('referente', referente, 'visitas', n) order by n desc)
      from (select coalesce(nullif(referente, ''), 'directo') as referente, count(*) as n from v group by 1 order by n desc limit 10) r
    ), '[]'::json),
    'dispositivos', coalesce((
      select json_agg(json_build_object('dispositivo', dispositivo, 'visitas', n) order by n desc)
      from (select dispositivo, count(*) as n from v group by dispositivo) d
    ), '[]'::json),
    -- Álbumes: páginas /portfolio/categoria/album/
    'albumes', coalesce((
      select json_agg(json_build_object('ruta', ruta, 'visitas', n, 'visitantes', u) order by n desc)
      from (
        select ruta, count(*) as n, count(distinct (visitante, dia)) as u from v
        where ruta ~ '^/portfolio/[^/]+/[^/]+/$' group by ruta order by n desc limit 10
      ) a
    ), '[]'::json),
    'clics', (select count(*) from c),
    'contactaron', (select count(distinct (visitante, dia)) from c),
    'porDestino', coalesce((
      select json_agg(json_build_object('destino', destino, 'clics', n) order by n desc)
      from (select destino, count(*) as n from c group by destino) d
    ), '[]'::json),
    'clicsPorPagina', coalesce((
      select json_agg(json_build_object('ruta', ruta, 'clics', n) order by n desc)
      from (select ruta, count(*) as n from c group by ruta order by n desc limit 10) p
    ), '[]'::json)
  ) into resultado;
  return resultado;
end;
$$;

revoke all on function public.metricas(integer) from public, anon;
grant execute on function public.metricas(integer) to authenticated;

-- 4. Limpieza: se guardan 13 meses. Ejecutar a mano de vez en cuando:
--   select public.limpiar_visitas();
create or replace function public.limpiar_visitas()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.visitas where cuando < now() - interval '13 months';
  delete from public.clics where cuando < now() - interval '13 months';
$$;

revoke all on function public.limpiar_visitas() from public, anon, authenticated;
grant execute on function public.limpiar_visitas() to service_role;

-- 5. Control: tiene que decir "ok".
select 'Métricas instaladas' as control,
       case when exists (select 1 from public.metricas_secreto) then 'ok' else 'FALTA' end as estado
union all
select 'Clics de contacto instalados',
       case when to_regclass('public.clics') is not null then 'ok' else 'FALTA' end;
