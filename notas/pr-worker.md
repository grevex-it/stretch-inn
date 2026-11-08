**`apps/worker`**: el proceso que procesa la cola (pg-boss, sobre el mismo Postgres). Es estructura.

**Apilado sobre `caja`**, que en su último commit publica `PagoRegistrado` en la transacción del cobro (outbox, con el id del pago como clave de idempotencia).

## Qué hace

- `src/worker.ts` conecta la cola con `DATABASE_URL`, registra las tareas y se detiene ordenado con SIGTERM.
- `src/tareas.ts` declara `caja.pago-registrado` y lo procesa.
  - Hoy deja constancia en el log con el pago. Es idempotente.
  - Un evento mal formado falla, se reintenta y termina en `fallidos`.
- `pnpm dev` (turbo) lo levanta junto con la API y el panel.
- La API crea la cola, declara la tarea y se la pasa a `crearCaja`.
- Suma `DECISIONES_PENDIENTES.md` en la raíz, con todas las decisiones del back que hay que revisar.

## Para el usuario

- Crear en Railway el servicio del worker (`pnpm --filter @app/worker start`) con la misma `DATABASE_URL` que la API. Lo dejé sin hacer porque cambia infraestructura.

## Cómo se probó

- Test primero: falló porque la cola no existía y después pasó. El test publica un `PagoRegistrado` contra Postgres real y espera a que el worker lo procese.
- En caja, `eventos.integracion.test.ts`: el cobro repetido y otro cobro de la misma cuota dejan un solo evento con los datos del pago.
- En la punta de la pila pasan los tests de todos los paquetes. En db pasan 25 de 26; `salida.test` lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
