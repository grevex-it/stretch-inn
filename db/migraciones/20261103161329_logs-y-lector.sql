-- Esquema logs y rol de solo lectura para `pnpm logs` (ver docs/decisiones/0016).
-- Los logs son datos de la plataforma, no de un centro: no llevan centro_id como aislamiento.

create schema if not exists logs;

-- logs_lector: solo lectura y solo sobre el esquema logs. Su clave la pone `pnpm db:migrar`
-- desde LOGS_DATABASE_URL, si está definida.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'logs_lector') then
    create role logs_lector login;
  end if;
end
$$;
alter role logs_lector nosuperuser nobypassrls nocreatedb nocreaterole;

grant usage on schema logs to logs_lector;
alter default privileges in schema logs grant select on tables to logs_lector;

-- La app escribe y lee logs; nunca los modifica ni los borra (la retención borra particiones).
grant usage on schema logs to app_usuario;
alter default privileges in schema logs grant select, insert on tables to app_usuario;
alter default privileges in schema logs grant usage, select on sequences to app_usuario;
