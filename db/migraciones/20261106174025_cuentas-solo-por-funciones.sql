-- Las cuentas son de toda la plataforma (0017): la app deja de leerlas y escribirlas directo.
-- Todo pasa por funciones de alcance mínimo, que devuelven o cambian solo lo indispensable.

-- Login: la cuenta de ese email, para verificar la clave. Nunca una lista de cuentas.
create function identidad_cuenta_por_email(p_email text)
  returns table (id uuid, hash_clave text, debe_cambiar_clave boolean)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select c.id, c.hash_clave, c.debe_cambiar_clave
    from plataforma.cuentas c
    where lower(c.email) = lower(p_email)
  $$;

-- La propia cuenta de una sesión, para cambiar la clave.
create function identidad_cuenta_por_id(p_cuenta uuid)
  returns table (id uuid, hash_clave text, debe_cambiar_clave boolean)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select c.id, c.hash_clave, c.debe_cambiar_clave
    from plataforma.cuentas c
    where c.id = p_cuenta
  $$;

-- La persona cambia su propia clave (ya verificada contra la actual): deja de ser temporal.
create function identidad_cambiar_clave(p_cuenta uuid, p_hash text)
  returns void
  language sql volatile security definer
  set search_path = public, pg_temp
  as $$
    update plataforma.cuentas
    set hash_clave = p_hash, debe_cambiar_clave = false, version = version + 1
    where id = p_cuenta
  $$;

-- La sesión vigente de ese token, con el único dato de la cuenta que hace falta en cada pedido.
create function identidad_sesion_por_token(p_hash text)
  returns table (
    id uuid, cuenta_id uuid, centro_id uuid, usuario_id uuid, sede_activa_id uuid,
    creada_en timestamptz, ultimo_uso_en timestamptz, debe_cambiar_clave boolean
  )
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select s.id, s.cuenta_id, s.centro_id, s.usuario_id, s.sede_activa_id,
           s.creada_en, s.ultimo_uso_en, c.debe_cambiar_clave
    from plataforma.sesiones s
    join plataforma.cuentas c on c.id = s.cuenta_id
    where s.hash_token = p_hash and s.revocada_en is null
  $$;

revoke execute on function identidad_cuenta_por_email(text) from public;
revoke execute on function identidad_cuenta_por_id(uuid) from public;
revoke execute on function identidad_cambiar_clave(uuid, text) from public;
revoke execute on function identidad_sesion_por_token(text) from public;
grant execute on function identidad_cuenta_por_email(text) to app_usuario;
grant execute on function identidad_cuenta_por_id(uuid) to app_usuario;
grant execute on function identidad_cambiar_clave(uuid, text) to app_usuario;
grant execute on function identidad_sesion_por_token(text) to app_usuario;

revoke select, insert, update on plataforma.cuentas from app_usuario;
