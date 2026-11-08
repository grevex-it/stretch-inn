Primera etapa del módulo **`agenda`** (Fase 2): las clases semanales de cada sede y sus fechas concretas. Es la base de inscripciones, asistencia, abonos y caja. Plan: `plan-agenda.md` (PR 1 de 4).

**Va encima de #7** (usa `identidad_dar_al_dueno`): apunta a `identidad-plantilla-dueno`, así que el diff muestra solo la agenda. Se mergea después de #7; al mergear #7, primero hay que apuntar este PR a `main` y recién después borrar la rama.

## Qué hace

- **Clases:** nombre, día de la semana, hora local del centro, duración y cupo. Alta, edición con versión (0013) y baja sin borrar.
- **Fechas (ocurrencias):** la semana de una sede se arma **a pedido** y sin efecto doble (índice único por clase y fecha). Se calculan en la zona horaria del centro (`centros`) y se guardan en UTC. No hay fechas anteriores al alta de la clase.
- **Cambios de horario:** se mueven solo las fechas futuras; si cambia el día, las futuras se borran y se rearman. La baja borra las futuras y conserva las pasadas.
- **Cancelar una fecha** (feriado): se marca, no se borra. Solo antes de que empiece, y se puede deshacer.

## Decisiones

- **Aislado por sede.** Es el primer módulo de negocio con `sede_id`: RLS con la política estándar por centro y sedes visibles, y **cada permiso se controla en la sede de la clase** (`puede(ctx, permiso, sedeId)`), no «en alguna sede».
- **Integridad:** cada fecha apunta a su clase con el mismo centro y sede (FK compuesta). Día, hora, duración y cupo también tienen su `check` en la base.
- **Sin worker:** armar las fechas a pedido evita depender de una tarea programada, y `asistencia` va a tener filas reales donde anotar.

## Permisos

| Permiso | Para qué |
| --- | --- |
| `agenda.ver` | Ver clases y fechas de la sede |
| `agenda.gestionar` | Crear, editar y dar de baja clases; cancelar fechas |
| `agenda.inscribir` | Inscripciones (las usa el PR siguiente) |

Llegan al Dueño de cada centro por migración y están en `herramientas/src/catalogo.ts` (lo exige el guardián de #7).

## Rutas

| Ruta | Permiso |
| --- | --- |
| `GET /agenda/clases?pagina&sede` | `agenda.ver` |
| `POST /agenda/clases` | `agenda.gestionar` |
| `PUT /agenda/clases/:id` | `agenda.gestionar` |
| `PUT` / `DELETE /agenda/clases/:id/baja` | `agenda.gestionar` |
| `GET /agenda/ocurrencias?sede&desde&pagina` | `agenda.ver` |
| `PUT` / `DELETE /agenda/ocurrencias/:id/cancelada` | `agenda.gestionar` |

## Fuera del módulo

Lo mínimo, como en #5: contratos en `paquetes/contratos/src/agenda.ts`, rutas registradas en `apps/api` y la sección en el catálogo de `herramientas`.

## Cómo se probó

- Test primero, cada uno visto fallar por la razón esperada antes de implementar.
- **Dominio (sin base):** validaciones de la clase, fechas en la zona del centro (incluido el cambio de horario de verano de Madrid), clases que cruzan la medianoche, cambios de horario.
- **Integración contra Postgres real:** permisos por sede (con agenda en Norte y otro permiso en Sur), aislamiento entre centros, armado sin efecto doble, sin fechas antes del alta, cambio de hora y de día, baja y reactivación, cancelación y fecha ya empezada.
- **Rutas:** el permiso declarado en cada una, 201/200/204, 400/403/404/409.
- El test de aislamiento de `db` recorre las tablas nuevas: RLS forzado y política por sede.
- Formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos. Tests: agenda 39, contratos 24, api 27, herramientas 20, identidad 126, personas 23, plataforma 25, centros 6, db 25/26 (`salida.test` necesita el Postgres embebido, que no corre en la PC donde se probó; lo cubre el CI).

## Queda afuera

- Inscripciones fijas con cupo (PR siguiente).
- Las pantallas: las hace el panel en paralelo cuando este contrato esté en `main`.
