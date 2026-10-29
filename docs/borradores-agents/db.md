# Base de datos

## Migraciones

- Se crean siempre con `pnpm db:migracion <nombre>`: quedan nombradas por fecha y hora.
- **Nunca se edita una migración ya mergeada.** Para corregir, se escribe otra.
- Las tablas de un módulo las define el módulo (`src/infraestructura/esquema.ts`);
  la migración se genera desde ahí.

## Toda tabla nueva

- `id uuid` como clave primaria.
- `centro_id uuid not null`. Si el dato pertenece a una sede, también `sede_id uuid not null`.
- `alter table … enable row level security` y `force row level security`.
- Políticas con las funciones de la plataforma: `app_centro_actual()` y
  `app_puede_ver_sede(sede_id)`. No escribas condiciones propias de aislamiento.
- Montos: `bigint` en pesos enteros. Fechas: `timestamptz`.

## Rendimiento y concurrencia (ver 0013)

- Índices que empiezan por `centro_id` (y `sede_id` si la tabla la tiene).
- Funciones usadas en políticas: `STABLE`, y envueltas en `(select …)` para que se
  evalúen una vez por consulta y no por fila.
- Lo que tiene límite (cupos) se protege con bloqueo de fila (`for update`) **y** con
  una restricción en la base. La restricción es la última barrera.
- Tablas editables desde la interfaz: columna `version` para detectar ediciones concurrentes.
- Migraciones en dos pasos: nunca renombrar ni borrar una columna en el mismo deploy
  en que el código deja de usarla.

El test de aislamiento recorre **todas** las tablas con `centro_id` y falla si alguna
no tiene RLS o si un centro puede leer datos de otro. No hay que agregarlas a mano.

## Roles

- La app se conecta con `app_usuario`: sin superusuario y sin `BYPASSRLS`.
- Las migraciones corren con el dueño del esquema. La app nunca usa esa conexión.
