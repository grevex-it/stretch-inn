-- Si alguien tiene el Dueño o la Contaduría (por su marca de plantilla) en alguna sede del centro
-- del contexto (ver docs/decisiones/0007). A esas personas solo les cambia roles y ajustes quien
-- gestiona roles. Alcance mínimo: con una sede activa, RLS no muestra las asignaciones de las otras.
create function identidad_es_protegido(p_usuario uuid)
  returns boolean
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select exists (
      select 1
      from asignaciones a
      join roles r on r.id = a.rol_id and r.centro_id = a.centro_id
      where a.usuario_id = p_usuario
        and a.centro_id = app_centro_actual()
        and r.plantilla in ('dueno', 'contadora')
    )
  $$;

revoke execute on function identidad_es_protegido(uuid) from public;
grant execute on function identidad_es_protegido(uuid) to app_usuario;
