-- Aislamiento de la agenda (ver docs/decisiones/0002 y 0007). Las clases y sus fechas son de una
-- sede: la política es por centro y por sedes visibles.

-- Claves hacia centros y sedes. Van acá y no en el esquema de Drizzle: agenda no importa archivos
-- internos de otro módulo.
alter table clases add constraint clases_centro_fk foreign key (centro_id) references centros (id);
alter table clases add constraint clases_sede_fk foreign key (sede_id) references sedes (id);

alter table clases enable row level security;
alter table clases force row level security;
create policy aislamiento on clases
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

alter table ocurrencias enable row level security;
alter table ocurrencias force row level security;
create policy aislamiento on ocurrencias
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Los permisos de la agenda, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['agenda.ver', 'agenda.gestionar', 'agenda.inscribir']);
