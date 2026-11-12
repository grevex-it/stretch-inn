-- Aislamiento de las reglas de recuperación (ver docs/decisiones/0002 y 0020): una fila por sede,
-- la política es por centro y por sedes visibles.

-- Claves hacia el centro y la sede. Van acá y no en el esquema de Drizzle: asistencia no importa
-- archivos internos de otro módulo.
alter table reglas_de_recuperacion add constraint reglas_de_recuperacion_centro_fk
  foreign key (centro_id) references centros (id);
alter table reglas_de_recuperacion add constraint reglas_de_recuperacion_sede_fk
  foreign key (sede_id) references sedes (id);

alter table reglas_de_recuperacion enable row level security;
alter table reglas_de_recuperacion force row level security;
create policy aislamiento on reglas_de_recuperacion
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Las recuperaciones que ya existían guardan cuándo empieza su fecha (0020: se cuentan por abono).
update recuperaciones r set empieza_en = o.empieza_en
  from ocurrencias o
  where o.id = r.ocurrencia_id and r.empieza_en is null;

-- El permiso de configurar las reglas, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['asistencia.configurar']);
