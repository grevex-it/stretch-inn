-- Quiénes tienen un rol, en todas las sedes del centro del contexto (ver docs/decisiones/0007).
-- Alcance mínimo: con una sede activa, RLS no muestra las asignaciones de las otras, y hace falta
-- verlas para no borrar un rol en uso ni sumarle permisos que quien edita no tiene en esas sedes.
create function identidad_asignaciones_del_rol(p_rol uuid)
  returns table (nombre text, sede_id uuid)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select u.nombre, a.sede_id
    from asignaciones a
    join usuarios u on u.id = a.usuario_id and u.centro_id = a.centro_id
    where a.rol_id = p_rol and a.centro_id = app_centro_actual()
  $$;

revoke execute on function identidad_asignaciones_del_rol(uuid) from public;
grant execute on function identidad_asignaciones_del_rol(uuid) to app_usuario;
