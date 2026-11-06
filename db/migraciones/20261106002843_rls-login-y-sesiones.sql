-- Sesiones y centros de una cuenta, para el login (ver docs/decisiones/0017).

-- Claves hacia centros, sedes y usuarios. Van acá y no en el esquema de Drizzle: identidad no
-- importa archivos internos de otro módulo.
alter table plataforma.sesiones
  add constraint sesiones_centro_fk foreign key (centro_id) references centros (id);
alter table plataforma.sesiones
  add constraint sesiones_usuario_fk foreign key (usuario_id) references usuarios (id);
alter table plataforma.sesiones
  add constraint sesiones_sede_fk foreign key (sede_activa_id) references sedes (id);
alter table usuarios
  add constraint usuarios_ultima_sede_fk foreign key (ultima_sede_id) references sedes (id);

-- Elegir sede exige haber elegido centro.
alter table plataforma.sesiones
  add constraint sesiones_sede_con_centro check (sede_activa_id is null or centro_id is not null);

-- Sesiones: datos de la plataforma, previos a elegir centro. Nunca se borran desde la app: se
-- revocan.
grant select, insert, update on plataforma.sesiones to app_usuario;

-- Centros donde la cuenta tiene un usuario activo, antes de tener contexto: sin esto no puede
-- elegir centro. Devuelve solo lo indispensable: id y nombre del centro y la membresía propia
-- de esa cuenta (su usuario y la última sede que eligió). Nunca datos de otros usuarios.
create function identidad_centros_de(p_cuenta uuid)
  returns table (centro_id uuid, nombre text, usuario_id uuid, ultima_sede_id uuid)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select c.id, c.nombre, u.id, u.ultima_sede_id
    from usuarios u
    join centros c on c.id = u.centro_id
    where u.cuenta_id = p_cuenta and u.activo
    order by c.nombre, c.id
  $$;

revoke execute on function identidad_centros_de(uuid) from public;
grant execute on function identidad_centros_de(uuid) to app_usuario;

-- Nombres de las sedes del selector. Con una sede activa, RLS solo deja ver esa: el selector
-- necesita las demás donde tiene permisos. Solo id y nombre, solo de las sedes pedidas, y solo
-- si la cuenta es un usuario activo de ese centro.
create function identidad_nombres_de_sedes(p_cuenta uuid, p_centro uuid, p_sedes uuid[])
  returns table (id uuid, nombre text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select s.id, s.nombre
    from sedes s
    where s.centro_id = p_centro
      and s.id = any (p_sedes)
      and exists (select 1 from usuarios u
                  where u.cuenta_id = p_cuenta and u.centro_id = p_centro and u.activo)
    order by s.nombre, s.id
  $$;

revoke execute on function identidad_nombres_de_sedes(uuid, uuid, uuid[]) from public;
grant execute on function identidad_nombres_de_sedes(uuid, uuid, uuid[]) to app_usuario;
