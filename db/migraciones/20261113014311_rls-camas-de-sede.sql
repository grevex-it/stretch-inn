-- Aislamiento de las camas de cada sede (ver docs/decisiones/0002): una fila por sede, la política
-- es por centro y por sedes visibles.

-- Claves hacia el centro y la sede. Van acá y no en el esquema de Drizzle: agenda no importa
-- archivos internos de otro módulo.
alter table camas_de_sede add constraint camas_de_sede_centro_fk
  foreign key (centro_id) references centros (id);
alter table camas_de_sede add constraint camas_de_sede_sede_fk
  foreign key (sede_id) references sedes (id);

alter table camas_de_sede enable row level security;
alter table camas_de_sede force row level security;
create policy aislamiento on camas_de_sede
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));
