# Base de datos

Postgres con aislamiento por RLS (ver `docs/decisiones/0002` y `0013`).

## Comandos

    pnpm db:levantar                  # Postgres local real, sin Docker (Ctrl+C lo detiene)
    pnpm db:migrar                    # aplica las migraciones (lee .env; copialo de .env.example)
    pnpm db:migracion <nombre>        # genera una migración desde los esquemas de los módulos
    pnpm db:migracion <nombre> --custom   # migración vacía para escribir SQL a mano
    pnpm --filter @app/db test        # tests de integración (levantan su propio Postgres)

## Migraciones

- Se crean siempre con `pnpm db:migracion`: quedan en `migraciones/`, nombradas por fecha y hora.
- **Nunca se edita una migración ya mergeada.** Para corregir, se escribe otra.
- Las tablas de un módulo las define el módulo (`src/infraestructura/esquema.ts`, o
  `src/datos/esquema.ts` en los livianos) y la
  migración se genera desde ahí. Lo que Drizzle no genera (políticas, funciones) va en una
  migración `--custom`.

## Toda tabla nueva

- `id uuid` como clave primaria.
- `centro_id uuid not null`. Si el dato pertenece a una sede, también `sede_id uuid not null`.
- `alter table … enable row level security` y `force row level security`.
- Política estándar, con las funciones de la plataforma y sin condiciones propias de
  aislamiento:

```sql
create policy aislamiento on <tabla>
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));
```

Sin `sede_id`, solo la condición de `centro_id`. El `(select …)` hace que la función se
evalúe una vez por consulta y no por fila; el `::uuid[]` es necesario para que `any`
compare contra el arreglo.

- Montos: `bigint` en pesos enteros. Fechas: `timestamptz`.

## Rendimiento y concurrencia (ver 0013)

- Índices que empiezan por `centro_id` (y `sede_id` si la tabla la tiene).
- Lo que tiene límite (cupos) se protege con bloqueo de fila (`for update`) **y** con
  una restricción en la base. La restricción es la última barrera.
- Tablas editables desde la interfaz: columna `version` para detectar ediciones concurrentes.
- Migraciones en dos pasos: nunca renombrar ni borrar una columna en el mismo deploy
  en que el código deja de usarla.

El test de aislamiento (`test/aislamiento.test.ts`) recorre **todas** las tablas con
`centro_id` y falla si alguna no tiene RLS activado, forzado y con política. No hay que
agregarlas a mano.

## Roles

- La app se conecta con `app_usuario`: sin superusuario y sin `BYPASSRLS`. Puede leer y
  escribir datos, no cambiar el esquema. Su clave la pone `pnpm db:migrar` desde `DATABASE_URL`.
- Las migraciones corren con el dueño del esquema (`DATABASE_URL_MIGRACIONES`). La app
  nunca usa esa conexión.
- `logs_lector` (para `pnpm logs`, ver 0016): solo lectura y solo sobre el esquema `logs`.
  Su clave sale de `LOGS_DATABASE_URL`. La app escribe logs, pero no los modifica ni los borra.
- La cola (pg-boss, esquema `pgboss`) la instala y actualiza `pnpm db:migrar` con el dueño;
  `app_usuario` la usa sin poder cambiar su estructura. Se usa con `publicar` / `trabajar` de
  `@app/plataforma`, que guardan el evento en la misma transacción del cambio (outbox).
- El esquema `logs` queda fuera del test de aislamiento: son datos de la plataforma y su
  `centro_id` sirve para filtrar, no para aislar.
- El contexto lo fija cada transacción con `set_config('app.centro_id', …, true)` y
  `set_config('app.sedes', '{…}', true)`. Sin contexto, las políticas no devuelven filas.
  Desde el código se fija **siempre** con `enContexto` de `@app/plataforma`, nunca a mano.
- Al arrancar, la app llama a `verificarRolSeguro`: no arranca con un rol que saltee RLS.

## Tests de integración en otros paquetes

Usá `globalSetup: ["@app/db/pruebas"]` en su `vitest.config.ts`: levanta un Postgres
descartable con las migraciones aplicadas y deja `urlDueno`, `urlApp` y `urlLogs` en `inject`.
