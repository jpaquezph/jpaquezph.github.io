-- Área de clientes de la web. Pegar completo en Supabase > SQL Editor y ejecutar una vez.
-- Se puede volver a ejecutar sin romper nada.

-- 1. Tabla con los datos de cada evento -------------------------------------

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  -- Usuario (Authentication > Users) que puede ver este evento.
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente text not null,                 -- nombre para el saludo: "Hola, Martina"
  titulo text not null,                  -- "Fiesta de egresados"
  tipo text not null default '',
  fecha date not null,
  horario text not null default '',      -- "21:00 a 05:00"
  lugar text not null default '',
  direccion text not null default '',
  paquete text not null default '',      -- "Evento completo"
  estado text not null default 'Contrato firmado',
  drive_url text,                        -- carpeta de Google Drive con las fotos
  entrega text not null default '',      -- texto sobre cuándo y cómo se entregan
  cronograma jsonb not null default '[]',-- [{"hora":"21:00","titulo":"Recepción","detalle":"..."}]
  precio_total numeric not null default 0,
  pagos jsonb not null default '[]',     -- [{"concepto":"Seña","monto":135000,"fecha":"2026-10-05"}]
  vencimiento_saldo date,
  incluye jsonb not null default '[]',   -- ["Hasta 3 locaciones","Entrega digital"]
  contrato_firmado date,
  condiciones jsonb not null default '[]',-- vacío = se muestran las condiciones generales de la web
  creado timestamptz not null default now()
);

create index if not exists eventos_user_id on public.eventos (user_id);

-- 2. Cada cliente solo puede LEER su propio evento --------------------------
-- No hay reglas de alta, cambio ni borrado: eso solo se hace desde el panel.

alter table public.eventos enable row level security;

drop policy if exists "El cliente ve su evento" on public.eventos;
create policy "El cliente ve su evento" on public.eventos
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.eventos from anon, authenticated;
grant select on public.eventos to authenticated;

-- 3. Archivos privados: contrato y fotos destacadas -------------------------
-- Cada cliente tiene una carpeta con el nombre de su id de usuario:
--   <id>/contrato.pdf
--   <id>/destacadas/01.jpg, 02.jpg, ...

insert into storage.buckets (id, name, public)
values ('clientes', 'clientes', false)
on conflict (id) do update set public = false;

drop policy if exists "El cliente ve sus archivos" on storage.objects;
create policy "El cliente ve sus archivos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'clientes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 4. Ejemplo para cargar un evento ------------------------------------------
-- Reemplazar el id por el del usuario (Authentication > Users, columna UID).
--
-- insert into public.eventos
--   (user_id, cliente, titulo, tipo, fecha, horario, lugar, direccion, paquete,
--    drive_url, entrega, cronograma, precio_total, pagos, vencimiento_saldo,
--    incluye, contrato_firmado)
-- values
--   ('00000000-0000-0000-0000-000000000000', 'Martina', 'Fiesta de egresados', 'Evento',
--    '2026-12-12', '21:00 a 05:00', 'Salón de ejemplo', 'Av. Siempreviva 742, Rosario',
--    'Evento completo', 'https://drive.google.com/drive/folders/...',
--    'Las fotos editadas se suben a la carpeta dentro de los 20 días posteriores al evento.',
--    '[{"hora":"21:00","titulo":"Recepción","detalle":"Ingreso de invitados"},{"hora":"00:00","titulo":"Baile"}]',
--    450000, '[{"concepto":"Seña","monto":135000,"fecha":"2026-10-05"}]', '2026-12-10',
--    '["Hasta 2 sesiones previas","Cobertura integral","Página de tu evento","Entrega digital"]',
--    '2026-10-05');
