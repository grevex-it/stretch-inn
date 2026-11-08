-- Aislamiento de las inscripciones (ver docs/decisiones/0002). Son de la sede de su clase: la
-- política es por centro y por sedes visibles.

-- Clave hacia alumnos. Va acá y no en el esquema de Drizzle: agenda no importa archivos internos
-- de personas.
alter table inscripciones add constraint inscripciones_alumno_fk
  foreign key (alumno_id) references alumnos (id);

alter table inscripciones enable row level security;
alter table inscripciones force row level security;
create policy aislamiento on inscripciones
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));
