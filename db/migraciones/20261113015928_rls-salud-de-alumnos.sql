-- Aislamiento de los datos de salud de los alumnos (ver docs/decisiones/0002 y 0019): son del
-- centro, como el alumno. La política es por centro.
alter table salud_de_alumnos add constraint salud_de_alumnos_centro_fk
  foreign key (centro_id) references centros (id);

alter table salud_de_alumnos enable row level security;
alter table salud_de_alumnos force row level security;
create policy aislamiento on salud_de_alumnos
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));

-- Los permisos de ver y editar los datos de salud, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['personas.ver-salud', 'personas.editar-salud']);
