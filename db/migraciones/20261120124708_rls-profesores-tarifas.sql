-- Aislamiento de los profes y sus tarifas (ver docs/decisiones/0002 y 0024). El tipo de profe y las
-- tarifas de todo el centro son del centro; las de una sede, de esa sede. Las claves hacia centros,
-- sedes y usuarios van acá: profesores no importa archivos internos de otros módulos. Que el profe
-- sea del mismo centro lo controla la app, que lo lee con RLS.
alter table tipos_de_profe add constraint tipos_de_profe_centro_fk
  foreign key (centro_id) references centros (id);
alter table tipos_de_profe add constraint tipos_de_profe_profe_fk
  foreign key (profe_id) references usuarios (id);
alter table tarifas_del_centro add constraint tarifas_del_centro_centro_fk
  foreign key (centro_id) references centros (id);
alter table tarifas_del_centro add constraint tarifas_del_centro_profe_fk
  foreign key (profe_id) references usuarios (id);
alter table tarifas_de_sede add constraint tarifas_de_sede_centro_fk
  foreign key (centro_id) references centros (id);
alter table tarifas_de_sede add constraint tarifas_de_sede_sede_fk
  foreign key (sede_id) references sedes (id);
alter table tarifas_de_sede add constraint tarifas_de_sede_profe_fk
  foreign key (profe_id) references usuarios (id);

alter table tipos_de_profe enable row level security;
alter table tipos_de_profe force row level security;
create policy aislamiento on tipos_de_profe
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));

alter table tarifas_del_centro enable row level security;
alter table tarifas_del_centro force row level security;
create policy aislamiento on tarifas_del_centro
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));

alter table tarifas_de_sede enable row level security;
alter table tarifas_de_sede force row level security;
create policy aislamiento on tarifas_de_sede
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Los permisos de profesores, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['profesores.ver', 'profesores.configurar']);
