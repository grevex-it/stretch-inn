-- Equipo del centro: alta, reset de clave y bloqueo (ver docs/decisiones/0017). Las cuentas son
-- de toda la plataforma: estas funciones tocan solo lo indispensable y solo con un centro en el
-- contexto. Sin contexto no hacen nada.

-- Alta: la cuenta de ese email, o una nueva con la clave temporal. Si ya existía no se toca: la
-- persona entra con su clave de siempre (0017, vincular).
create function identidad_cuenta_para_alta(p_email text, p_hash text)
  returns table (cuenta_id uuid, nueva boolean)
  language plpgsql volatile security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_id uuid;
  begin
    if app_centro_actual() is null then
      return;
    end if;
    insert into plataforma.cuentas (email, hash_clave, debe_cambiar_clave)
      values (p_email, p_hash, true)
      on conflict (lower(email)) do nothing
      returning id into v_id;
    if v_id is not null then
      return query select v_id, true;
      return;
    end if;
    return query
      select c.id, false from plataforma.cuentas c where lower(c.email) = lower(p_email);
  end
  $$;

-- Los emails de esos usuarios del centro del contexto, para la lista del equipo.
create function identidad_emails_de_usuarios(p_usuarios uuid[])
  returns table (usuario_id uuid, email text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select u.id, c.email
    from usuarios u
    join plataforma.cuentas c on c.id = u.cuenta_id
    where u.centro_id = app_centro_actual() and u.id = any (p_usuarios)
  $$;

-- Los permisos de un usuario del centro del contexto en todas sus sedes, esté activo o no. Para
-- comparar con los de quien lo gestiona: con una sede activa, RLS no le muestra las otras.
create function identidad_permisos_de_usuario(p_usuario uuid)
  returns table (sede_id uuid, permiso text, origen text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select a.sede_id, pr.permiso, 'rol'
    from asignaciones a
    join permisos_de_rol pr on pr.rol_id = a.rol_id and pr.centro_id = a.centro_id
    where a.usuario_id = p_usuario and a.centro_id = app_centro_actual()
    union all
    select aj.sede_id, aj.permiso, aj.tipo
    from ajustes aj
    where aj.usuario_id = p_usuario and aj.centro_id = app_centro_actual()
  $$;

-- Reset de la clave de un usuario del centro del contexto. Nunca la de una cuenta con usuarios
-- en otros centros, activos o no: sería quedarse con su acceso a ellos (0017). Devuelve 'ok',
-- 'inexistente' u 'otros-centros'. Las reglas de permisos las aplica la app antes.
create function identidad_resetear_clave(p_usuario uuid, p_hash text)
  returns text
  language plpgsql volatile security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_cuenta uuid;
  begin
    select u.cuenta_id into v_cuenta
    from usuarios u
    where u.id = p_usuario and u.centro_id = app_centro_actual();
    if v_cuenta is null then
      return 'inexistente';
    end if;
    if exists (select 1 from usuarios u
               where u.cuenta_id = v_cuenta and u.centro_id <> app_centro_actual()) then
      return 'otros-centros';
    end if;
    update plataforma.cuentas
    set hash_clave = p_hash, debe_cambiar_clave = true, version = version + 1
    where id = v_cuenta;
    return 'ok';
  end
  $$;

revoke execute on function identidad_cuenta_para_alta(text, text) from public;
revoke execute on function identidad_emails_de_usuarios(uuid[]) from public;
revoke execute on function identidad_permisos_de_usuario(uuid) from public;
revoke execute on function identidad_resetear_clave(uuid, text) from public;
grant execute on function identidad_cuenta_para_alta(text, text) to app_usuario;
grant execute on function identidad_emails_de_usuarios(uuid[]) to app_usuario;
grant execute on function identidad_permisos_de_usuario(uuid) to app_usuario;
grant execute on function identidad_resetear_clave(uuid, text) to app_usuario;
