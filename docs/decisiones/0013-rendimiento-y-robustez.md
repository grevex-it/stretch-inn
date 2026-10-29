# 0013 — Rendimiento y robustez

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

El sistema lo van a usar muchos usuarios, tiene que ser rápido y no puede romperse. Escala esperada el primer año: **3 centros**, con **momentos pico** (todos entrando a la vez, por ejemplo a renovar o reservar).

Con Fastify y Postgres, un solo servidor aguanta miles de pedidos por segundo. Cuando un sistema así anda lento, la causa casi nunca es el stack: son consultas mal hechas, índices faltantes y listas sin paginar. Cuando se rompe, es por concurrencia, reintentos y fallas de servicios externos.

## Decisión

### Desde el día uno: que nada se rompa

- **Cupos:** reservar toma un bloqueo de fila sobre la ocurrencia (`SELECT … FOR UPDATE`) y una restricción en la base hace imposible superar el cupo. Si dos alumnos van por el último lugar a la vez, gana uno solo.
- **Operaciones de dinero idempotentes:** cada cobro (y toda operación que mueva dinero) lleva una clave de idempotencia. El mismo pedido repetido (doble clic, reintento por corte) devuelve el mismo resultado y no cobra dos veces.
- **Edición concurrente:** versión por registro. Si dos usuarios editan lo mismo, el segundo recibe «Esto cambió mientras lo editabas» en lugar de pisar al primero.
- **Servicios externos aislados:** si WhatsApp (u otro) falla, la operación principal sigue. Los envíos van por la cola con reintentos espaciados; los que fallan muchas veces quedan en una lista de fallidos revisable, no se pierden.
- **Tareas idempotentes:** toda tarea del worker se puede ejecutar dos veces sin efecto doble.
- **Deploys sin cortes:** Railway cambia al deploy nuevo solo si responde el chequeo de salud. Migraciones en dos pasos (primero se agrega lo nuevo, después se quita lo viejo; nunca se renombra ni borra una columna en el mismo deploy en que el código deja de usarla).
- **Backups con restauración probada** periódicamente.

### Desde el día uno: velocidad sin costo

- Índices que empiezan por `centro_id` (y `sede_id` donde corresponda).
- Funciones de RLS `STABLE` y envueltas para que se evalúen una vez por consulta, no por fila.
- **Sin N+1:** cada endpoint de lista tiene un máximo de consultas controlado por test.
- **Paginación obligatoria:** ningún endpoint devuelve una lista sin paginar; un esquema de lista sin paginación no pasa el CI.
- Front: cada módulo se carga solo cuando se usa; caché de TanStack Query; actualizaciones optimistas en acciones frecuentes (tomar asistencia); límite de tamaño de bundle en el CI.

### Objetivos medibles

- API: 95 % de los pedidos en menos de 300 ms.
- Pantallas: carga inicial en menos de 2 s con 4G.
- **Prueba de carga** (k6) que simule el pico real sobre los flujos críticos (cobrar, tomar asistencia, reservar recuperación) antes de salir a producción y antes de sumar un cliente grande.

### Para más adelante (no ahora)

PgBouncer, varias instancias de la API y cachés externas. Con 3 centros no hacen falta; se agregan cuando una métrica lo pida.

## Consecuencias

- Reglas nuevas en `db/AGENTS.md` (índices, RLS, bloqueos) y en el `AGENTS.md` raíz (idempotencia, paginación).
- La observabilidad (errores con alertas, tiempos de respuesta, colas atascadas) se define junto con los logs (ver `docs/pendientes.md`).
