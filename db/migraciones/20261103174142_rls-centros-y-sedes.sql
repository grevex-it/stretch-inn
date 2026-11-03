-- Aislamiento de centros y sedes (ver docs/decisiones/0002, 0007 y 0017).

alter table centros enable row level security;
alter table centros force row level security;

-- Cada centro ve y modifica solo su propia fila.
create policy aislamiento on centros
  using (id = (select app_centro_actual()))
  with check (id = (select app_centro_actual()));

alter table sedes enable row level security;
alter table sedes force row level security;

-- Se ven las sedes del centro donde el actor tiene algún permiso (el selector de sede, 0017).
-- Para crear una sede alcanza con que sea del propio centro: todavía nadie tiene permisos en ella.
create policy ver on sedes for select
  using (centro_id = (select app_centro_actual())
         and id = any ((select app_sedes_visibles())::uuid[]));
create policy crear on sedes for insert
  with check (centro_id = (select app_centro_actual()));
create policy modificar on sedes for update
  using (centro_id = (select app_centro_actual())
         and id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual()));
