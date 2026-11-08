-- Aislamiento de los abonos (ver docs/decisiones/0002 y 0011). Los planes son del centro; los
-- precios por sede y las cuotas, de una sede.

-- Claves hacia centros, sedes y alumnos. Van acá y no en el esquema de Drizzle: abonos no
-- importa archivos internos de otro módulo.
alter table planes add constraint planes_centro_fk foreign key (centro_id) references centros (id);
alter table precios_de_sede add constraint precios_de_sede_centro_fk
  foreign key (centro_id) references centros (id);
alter table precios_de_sede add constraint precios_de_sede_sede_fk
  foreign key (sede_id) references sedes (id);
alter table cuotas add constraint cuotas_centro_fk foreign key (centro_id) references centros (id);
alter table cuotas add constraint cuotas_sede_fk foreign key (sede_id) references sedes (id);
alter table cuotas add constraint cuotas_alumno_fk foreign key (alumno_id) references alumnos (id);

alter table planes enable row level security;
alter table planes force row level security;
create policy aislamiento on planes
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));

alter table precios_de_sede enable row level security;
alter table precios_de_sede force row level security;
create policy aislamiento on precios_de_sede
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

alter table cuotas enable row level security;
alter table cuotas force row level security;
create policy aislamiento on cuotas
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Los permisos de los abonos, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['abonos.ver', 'abonos.gestionar', 'abonos.asignar']);
