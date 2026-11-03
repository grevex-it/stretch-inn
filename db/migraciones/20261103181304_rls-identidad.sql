-- Aislamiento de identidad y funciones de alcance mínimo (ver docs/decisiones/0002, 0007 y 0017).

-- Claves hacia centros y sedes. Van acá y no en el esquema de Drizzle: identidad no importa
-- archivos internos de otro módulo.
alter table usuarios add constraint usuarios_centro_fk foreign key (centro_id) references centros (id);
alter table roles add constraint roles_centro_fk foreign key (centro_id) references centros (id);
alter table asignaciones add constraint asignaciones_sede_fk foreign key (sede_id) references sedes (id);
alter table ajustes add constraint ajustes_sede_fk foreign key (sede_id) references sedes (id);

-- Tablas del centro: cada una ve solo su centro.
alter table usuarios enable row level security;
alter table usuarios force row level security;
create policy aislamiento on usuarios
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));

alter table roles enable row level security;
alter table roles force row level security;
create policy aislamiento on roles
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));

alter table permisos_de_rol enable row level security;
alter table permisos_de_rol force row level security;
create policy aislamiento on permisos_de_rol
  using (centro_id = (select app_centro_actual()))
  with check (centro_id = (select app_centro_actual()));

-- Asignaciones y ajustes son por sede: se ven y se cambian solo en las sedes visibles.
alter table asignaciones enable row level security;
alter table asignaciones force row level security;
create policy aislamiento on asignaciones
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

alter table ajustes enable row level security;
alter table ajustes force row level security;
create policy aislamiento on ajustes
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Cuentas: datos de la plataforma, previos a elegir centro. La app las lee y escribe.
grant usage on schema plataforma to app_usuario;
grant select, insert, update on plataforma.cuentas to app_usuario;

-- Permisos de un usuario en un centro, antes de tener contexto: sin ellos no se sabe qué sedes
-- ve. Devuelve solo las filas de esa cuenta en ese centro, y nada si el usuario está inactivo.
create function identidad_permisos_de(p_cuenta uuid, p_centro uuid)
  returns table (sede_id uuid, permiso text, origen text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select a.sede_id, pr.permiso, 'rol'
    from asignaciones a
    join permisos_de_rol pr on pr.rol_id = a.rol_id and pr.centro_id = a.centro_id
    join usuarios u on u.id = a.usuario_id and u.centro_id = a.centro_id
    where u.cuenta_id = p_cuenta and u.centro_id = p_centro and u.activo
    union all
    select aj.sede_id, aj.permiso, aj.tipo
    from ajustes aj
    join usuarios u on u.id = aj.usuario_id and u.centro_id = aj.centro_id
    where u.cuenta_id = p_cuenta and u.centro_id = p_centro and u.activo
  $$;

-- Permisos de todos los usuarios activos del centro del contexto, en todas sus sedes. Lo usa la
-- regla de que siempre quede alguien con acceso total (0007): quien hace el cambio puede no ver
-- todas las sedes. Sin contexto no devuelve nada.
create function identidad_permisos_del_centro()
  returns table (usuario_id uuid, sede_id uuid, permiso text, origen text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select a.usuario_id, a.sede_id, pr.permiso, 'rol'
    from asignaciones a
    join permisos_de_rol pr on pr.rol_id = a.rol_id and pr.centro_id = a.centro_id
    join usuarios u on u.id = a.usuario_id and u.centro_id = a.centro_id
    where a.centro_id = app_centro_actual() and u.activo
    union all
    select aj.usuario_id, aj.sede_id, aj.permiso, aj.tipo
    from ajustes aj
    join usuarios u on u.id = aj.usuario_id and u.centro_id = aj.centro_id
    where aj.centro_id = app_centro_actual() and u.activo
  $$;

-- Ids de todas las sedes del centro del contexto, vea o no el actor cada una: «acceso total» es
-- en todas las sedes del centro, no solo en las que aparecen con permisos. Solo ids.
create function identidad_sedes_del_centro()
  returns setof uuid
  language sql stable security definer
  set search_path = public, pg_temp
  as $$ select id from sedes where centro_id = app_centro_actual() $$;

revoke execute on function identidad_sedes_del_centro() from public;
grant execute on function identidad_sedes_del_centro() to app_usuario;
revoke execute on function identidad_permisos_de(uuid, uuid) from public;
revoke execute on function identidad_permisos_del_centro() from public;
grant execute on function identidad_permisos_de(uuid, uuid) to app_usuario;
grant execute on function identidad_permisos_del_centro() to app_usuario;
