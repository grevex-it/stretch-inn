-- Aislamiento de alumnos (ver docs/decisiones/0002 y 0011). El alumno es del centro, no de una
-- sede: la política es solo por centro.

-- Clave hacia centros. Va acá y no en el esquema de Drizzle: personas no importa archivos internos
-- de otro módulo.
alter table alumnos add constraint alumnos_centro_fk foreign key (centro_id) references centros (id);

alter table alumnos enable row level security;
alter table alumnos force row level security;
create policy aislamiento on alumnos
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));
