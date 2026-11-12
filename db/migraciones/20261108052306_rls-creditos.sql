-- Aislamiento de los créditos de recuperación (ver docs/decisiones/0002). Cada crédito es de la
-- sede de la fecha a la que se faltó: la política es por centro y por sedes visibles.

-- Claves hacia el aviso, la fecha, el alumno, el centro y la sede. Las de otros módulos van acá
-- y no en el esquema de Drizzle: asistencia no importa archivos internos de otro módulo.
alter table creditos add constraint creditos_aviso_fk
  foreign key (aviso_id) references avisos_de_ausencia (id);
alter table creditos add constraint creditos_ocurrencia_fk
  foreign key (ocurrencia_id) references ocurrencias (id);
alter table creditos add constraint creditos_alumno_fk
  foreign key (alumno_id) references alumnos (id);
alter table creditos add constraint creditos_centro_fk
  foreign key (centro_id) references centros (id);
alter table creditos add constraint creditos_sede_fk
  foreign key (sede_id) references sedes (id);

alter table creditos enable row level security;
alter table creditos force row level security;
create policy aislamiento on creditos
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));
