-- Base del aislamiento entre centros y sedes (ver docs/decisiones/0002 y 0013).

-- Rol de la app: sin superusuario y sin BYPASSRLS. Su clave la pone `pnpm db:migrar`
-- a partir de DATABASE_URL; nunca está en el repo.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_usuario') then
    create role app_usuario login;
  end if;
end
$$;
alter role app_usuario nosuperuser nobypassrls nocreatedb nocreaterole;

-- La app lee y escribe datos, pero no cambia el esquema.
grant usage on schema public to app_usuario;
revoke create on schema public from public;
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_usuario;
alter default privileges in schema public
  grant usage, select on sequences to app_usuario;

-- Contexto fijado por cada transacción con SET LOCAL (app.centro_id, app.sedes).
-- Sin contexto devuelven null y un arreglo vacío: las políticas no dejan ver nada (falla cerrada).
create function app_centro_actual() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.centro_id', true), '')::uuid $$;

create function app_sedes_visibles() returns uuid[]
  language sql stable
  as $$ select coalesce(nullif(current_setting('app.sedes', true), '')::uuid[], '{}') $$;

create function app_puede_ver_sede(sede_id uuid) returns boolean
  language sql stable
  as $$ select sede_id = any (app_sedes_visibles()) $$;
