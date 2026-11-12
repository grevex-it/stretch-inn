-- Aislamiento de la asistencia (ver docs/decisiones/0002 y 0007). Cada marca es de la sede de su
-- fecha: la política es por centro y por sedes visibles.

-- Claves hacia fechas, alumnos, centros y sedes. Van acá y no en el esquema de Drizzle:
-- asistencia no importa archivos internos de otro módulo.
alter table asistencias add constraint asistencias_ocurrencia_fk
  foreign key (ocurrencia_id) references ocurrencias (id);
alter table asistencias add constraint asistencias_alumno_fk
  foreign key (alumno_id) references alumnos (id);
alter table asistencias add constraint asistencias_centro_fk
  foreign key (centro_id) references centros (id);
alter table asistencias add constraint asistencias_sede_fk
  foreign key (sede_id) references sedes (id);

alter table asistencias enable row level security;
alter table asistencias force row level security;
create policy aislamiento on asistencias
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Los permisos de la asistencia, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['asistencia.ver', 'asistencia.tomar']);
