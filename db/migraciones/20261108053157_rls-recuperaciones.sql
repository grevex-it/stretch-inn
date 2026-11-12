-- Aislamiento de las recuperaciones (ver docs/decisiones/0002). Cada reserva es de la sede de la
-- fecha en la que se recupera: la política es por centro y por sedes visibles.

-- Claves hacia el crédito, la fecha, el alumno, el centro y la sede. Las de otros módulos van
-- acá y no en el esquema de Drizzle: asistencia no importa archivos internos de otro módulo.
alter table recuperaciones add constraint recuperaciones_credito_fk
  foreign key (credito_id) references creditos (id);
alter table recuperaciones add constraint recuperaciones_ocurrencia_fk
  foreign key (ocurrencia_id) references ocurrencias (id);
alter table recuperaciones add constraint recuperaciones_alumno_fk
  foreign key (alumno_id) references alumnos (id);
alter table recuperaciones add constraint recuperaciones_centro_fk
  foreign key (centro_id) references centros (id);
alter table recuperaciones add constraint recuperaciones_sede_fk
  foreign key (sede_id) references sedes (id);

alter table recuperaciones enable row level security;
alter table recuperaciones force row level security;
create policy aislamiento on recuperaciones
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- El permiso de reservar recuperaciones, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['asistencia.recuperar']);
