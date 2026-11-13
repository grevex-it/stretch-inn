-- Los profes de la agenda (ver docs/decisiones/0022): el profe es un usuario del equipo.
-- Las claves hacia usuarios, centros y sedes van acá y no en el esquema de Drizzle: agenda no
-- importa archivos internos de otro módulo. Que el profe sea del mismo centro lo controla la app,
-- que lo lee con RLS.
alter table clases add constraint clases_profe_fk foreign key (profe_id) references usuarios (id);
alter table ocurrencias add constraint ocurrencias_profe_fk
  foreign key (profe_id) references usuarios (id);

alter table profes_de_sede add constraint profes_de_sede_centro_fk
  foreign key (centro_id) references centros (id);
alter table profes_de_sede add constraint profes_de_sede_sede_fk
  foreign key (sede_id) references sedes (id);
alter table profes_de_sede add constraint profes_de_sede_profe_fk
  foreign key (profe_id) references usuarios (id);

alter table profes_de_sede enable row level security;
alter table profes_de_sede force row level security;
create policy aislamiento on profes_de_sede
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));
