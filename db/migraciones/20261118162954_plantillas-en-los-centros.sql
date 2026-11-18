-- Las plantillas Encargado, Profesor, Recepción y Contaduría (ver docs/decisiones/0007 y 0019)
-- en los centros que ya existen. Los centros nuevos las copian de plantillasDelSistema; acá se les
-- da lo mismo, y herramientas/test/plantillas.test.ts controla que no se desfasen.

-- Crea el rol de la plantilla en cada centro que no lo tiene. Si el centro ya tiene un rol propio
-- con ese nombre, lo deja como está y ese centro no recibe la plantilla. Recorre todos los
-- centros, así que corre con el dueño del esquema, como identidad_dar_al_dueno.
create function identidad_sumar_plantilla(p_plantilla text, p_nombre text)
  returns void
  language plpgsql volatile
  set search_path = public, pg_temp
  as $$
  begin
    if not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) then
      raise exception 'identidad_sumar_plantilla tiene que correr con el dueño del esquema';
    end if;
    insert into roles (centro_id, nombre, plantilla)
      select c.id, p_nombre, p_plantilla from centros c
      on conflict do nothing;
  end
  $$;

revoke execute on function identidad_sumar_plantilla(text, text) from public;

-- Para las migraciones de cada módulo, como identidad_dar_al_dueno: le da esos permisos al rol de
-- esa plantilla en todos los centros (ver db/AGENTS.md).
create function identidad_dar_a_plantilla(p_plantilla text, p_permisos text[])
  returns void
  language plpgsql volatile
  set search_path = public, pg_temp
  as $$
  begin
    if not (select rolsuper or rolbypassrls from pg_roles where rolname = current_user) then
      raise exception 'identidad_dar_a_plantilla tiene que correr con el dueño del esquema';
    end if;
    insert into permisos_de_rol (centro_id, rol_id, permiso)
      select r.centro_id, r.id, p.permiso
      from roles r cross join unnest(p_permisos) as p (permiso)
      where r.plantilla = p_plantilla
      on conflict do nothing;
  end
  $$;

revoke execute on function identidad_dar_a_plantilla(text, text[]) from public;

select identidad_sumar_plantilla('encargado', 'Encargado');
select identidad_dar_a_plantilla('encargado', array[
  'usuarios.ver',
  'personas.ver', 'personas.editar', 'personas.dar-de-baja',
  'personas.ver-salud', 'personas.editar-salud',
  'agenda.ver', 'agenda.gestionar', 'agenda.inscribir',
  'asistencia.ver', 'asistencia.tomar', 'asistencia.avisar', 'asistencia.recuperar',
  'abonos.ver', 'abonos.asignar',
  'caja.ver', 'caja.cobrar', 'caja.anular',
  'gastos.ver', 'gastos.cargar', 'gastos.anular'
]);

select identidad_sumar_plantilla('profesor', 'Profesor');
select identidad_dar_a_plantilla('profesor', array[
  'personas.ver', 'personas.editar', 'personas.dar-de-baja',
  'personas.ver-salud', 'personas.editar-salud',
  'agenda.ver', 'agenda.gestionar', 'agenda.inscribir',
  'asistencia.ver', 'asistencia.tomar', 'asistencia.avisar', 'asistencia.recuperar',
  'abonos.ver', 'abonos.asignar',
  'caja.cobrar', 'caja.anular'
]);

select identidad_sumar_plantilla('recepcion', 'Recepción');
select identidad_dar_a_plantilla('recepcion', array[
  'personas.ver', 'personas.editar',
  'agenda.ver', 'agenda.inscribir',
  'asistencia.ver', 'asistencia.avisar', 'asistencia.recuperar',
  'abonos.ver', 'abonos.asignar',
  'caja.cobrar'
]);

select identidad_sumar_plantilla('contadora', 'Contaduría');
select identidad_dar_a_plantilla('contadora', array[
  'usuarios.ver', 'personas.ver', 'agenda.ver', 'asistencia.ver',
  'abonos.ver', 'caja.ver', 'gastos.ver'
]);
