# Worker

El proceso que procesa la cola (pg-boss, sobre el mismo Postgres; ver
`docs/decisiones/0003-hexagonal-por-niveles.md` y `0013`). La API solo publica en la cola, dentro
de la transacción del cambio (outbox); el worker toma los trabajos y los procesa.

## Estructura

- `src/worker.ts`: punto de entrada. Conecta la cola con `DATABASE_URL`, registra las tareas y
  se detiene ordenado con SIGTERM (Railway).
- `src/tareas.ts`: `registrarTareas(cola, logger)` declara cada cola y su manejador.

## Tareas

- `caja.pago-registrado` (`PagoRegistrado` de `@app/caja`): hoy solo deja constancia en el log
  con el pago. Mensajería (aviso al alumno) y reportes se suman acá cuando existan.

## Reglas

- **Todo manejador se puede ejecutar dos veces sin efecto doble** (regla 7): pg-boss reintenta lo
  que falla (5 veces, con espera creciente) y después lo deja en la cola `fallidos`.
- Un evento mal formado tira error: se reintenta y termina en `fallidos`, no se pierde.
- Las tareas usan los módulos por su `index.ts`, como la API. Si una tarea necesita la base de un
  centro, corre con `enContexto` y un contexto que diga quién la pide; nunca se consulta sin él
  (regla 1).

## Desarrollo

    pnpm --filter @app/worker dev     # con la base levantada y migrada (ver db/AGENTS.md)

`pnpm dev` (turbo) lo levanta junto con la API y el panel.

## Tests

Vitest contra Postgres real (`globalSetup: ["@app/db/pruebas"]`): se publica un evento y se
espera a que el manejador lo procese.

## Pendientes

- Tareas programadas (cron de pg-boss), por ejemplo generar las cuotas del mes de cada centro:
  necesitan un actor de sistema en el `ContextoCentro`, que hoy no existe (solo usuario y
  soporte). Es una decisión de estructura.
- Latido del worker y alerta si deja de procesar (0015, 0016).
