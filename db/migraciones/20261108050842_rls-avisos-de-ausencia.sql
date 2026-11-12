-- Aislamiento de los avisos de ausencia (ver docs/decisiones/0002 y 0007). Cada aviso es de la
-- sede de su fecha: la política es por centro y por sedes visibles.

-- Claves hacia fechas, alumnos, centros y sedes. Van acá y no en el esquema de Drizzle:
-- asistencia no importa archivos internos de otro módulo.
alter table avisos_de_ausencia add constraint avisos_ocurrencia_fk
  foreign key (ocurrencia_id) references ocurrencias (id);
alter table avisos_de_ausencia add constraint avisos_alumno_fk
  foreign key (alumno_id) references alumnos (id);
alter table avisos_de_ausencia add constraint avisos_centro_fk
  foreign key (centro_id) references centros (id);
alter table avisos_de_ausencia add constraint avisos_sede_fk
  foreign key (sede_id) references sedes (id);

alter table avisos_de_ausencia enable row level security;
alter table avisos_de_ausencia force row level security;
create policy aislamiento on avisos_de_ausencia
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- El permiso de avisar ausencias, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['asistencia.avisar']);
