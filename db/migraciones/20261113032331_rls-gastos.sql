-- Aislamiento de los gastos (ver docs/decisiones/0002 y 0022): cada gasto es de una sede, la
-- política es por centro y por sedes visibles.

-- Claves hacia el centro y la sede. Van acá y no en el esquema de Drizzle: gastos no importa
-- archivos internos de otro módulo.
alter table gastos add constraint gastos_centro_fk foreign key (centro_id) references centros (id);
alter table gastos add constraint gastos_sede_fk foreign key (sede_id) references sedes (id);

alter table gastos enable row level security;
alter table gastos force row level security;
create policy aislamiento on gastos
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Los permisos de los gastos, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['gastos.ver', 'gastos.cargar', 'gastos.anular']);
