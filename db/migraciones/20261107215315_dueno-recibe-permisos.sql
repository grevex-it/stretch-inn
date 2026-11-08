-- El Dueño de cada centro recibe los permisos de cada módulo nuevo (ver docs/decisiones/0007).
-- El rol sale de la plantilla «Dueño» al dar de alta el centro, con el catálogo de ese momento:
-- sin esto, al sumar un módulo nadie del centro tendría sus permisos ni podría darlos.

-- Los Dueños que ya existen salieron de la plantilla.
update roles set plantilla = 'dueno' where nombre = 'Dueño';

-- Un solo Dueño por centro.
create unique index roles_centro_plantilla on roles (centro_id, plantilla)
  where plantilla is not null;

-- Para las migraciones de cada módulo: select identidad_dar_al_dueno(array['modulo.accion', …]).
-- Recorre todos los centros, así que corre con el dueño del esquema, que no pasa por RLS. Si se
-- llamara con un rol que sí pasa por RLS, no vería ningún rol y no haría nada: por eso falla.
create function identidad_dar_al_dueno(p_permisos text[])
  returns void
  language plpgsql volatile
  set search_path = public, pg_temp
  as $$
  begin
    if not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) then
      raise exception 'identidad_dar_al_dueno tiene que correr con el dueño del esquema';
    end if;
    insert into permisos_de_rol (centro_id, rol_id, permiso)
      select r.centro_id, r.id, p.permiso
      from roles r cross join unnest(p_permisos) as p (permiso)
      where r.plantilla = 'dueno'
      on conflict do nothing;
  end
  $$;

revoke execute on function identidad_dar_al_dueno(text[]) from public;

-- Los permisos de los módulos que ya existían antes de este mecanismo. Desde acá, cada módulo
-- nuevo se los da en su propia migración (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['usuarios.ver', 'usuarios.gestionar', 'roles.gestionar']);
select identidad_dar_al_dueno(array['personas.ver', 'personas.editar']);
