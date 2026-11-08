# Plan — módulo `agenda` (Fase 2)

_Borrador para confirmar antes de implementar (regla 2 de `AGENTS.md`). 07/11/2026._

## Qué resuelve

Las clases semanales de cada sede, sus fechas concretas (ocurrencias) y qué alumnos están
inscriptos en cada una, con un cupo que nunca se supera. Es la base de `asistencia` (ausencias y
recuperaciones), `abonos` y `caja`.

Nivel **completo** (0003): las reglas de horarios y cupos se prueban en el dominio, sin base.

## Modelo

| Tabla | Qué guarda | Claves |
| --- | --- | --- |
| `clases` | Una clase semanal de una sede: nombre («Stretching»), día de la semana, hora de inicio y duración **en la hora local del centro**, cupo, activa, `version`. | `centro_id`, `sede_id`. Índice `(centro_id, sede_id, dia, hora)`. |
| `ocurrencias` | Una fecha concreta de una clase: `empieza_en` y `termina_en` en `timestamptz` (UTC), cancelada. | Única `(clase_id, fecha)`. Hereda `sede_id`. |
| `inscripciones` | Un alumno con lugar fijo en una clase semanal, `desde` y `hasta` (null = vigente). La baja no borra. | Única parcial: un alumno no se inscribe dos veces en la misma clase vigente. |

Las tres llevan `centro_id` **y `sede_id`**, con la política estándar por centro y sedes
visibles: es el primer módulo de negocio aislado por sede.

## Reglas (dominio)

- **Horario:** día 1–7, hora `HH:MM`, duración entre 15 y 240 minutos. Dos clases de la misma sede
  pueden coincidir (puede haber dos salas); no se valida superposición hasta que un centro lo pida
  (0011).
- **Ocurrencias:** se calculan desde la clase y la zona horaria del centro (`centros`), y se
  guardan en UTC (regla 3). Se **materializan a pedido y sin efecto doble**: al consultar un rango
  de fechas, se insertan las que falten (`on conflict do nothing`). Así no hace falta el worker
  todavía, y `asistencia` va a tener filas reales donde anotar.
- **Editar una clase** (horario o cupo) cambia solo las ocurrencias **futuras**; las pasadas
  quedan como fueron.
- **Cupo:** inscribir toma `SELECT … FOR UPDATE` sobre la clase y suma a un contador
  `inscriptos` con `CHECK (inscriptos <= cupo)` (0013). Si dos van por el último lugar a la vez,
  entra uno solo y el otro recibe «La clase está completa». Bajar el cupo por debajo de los
  inscriptos se rechaza.
- **Alumno:** solo se inscribe un alumno activo de `personas` (por su `index.ts`). Puede tener
  clases en cualquier sede: el alumno es del centro (0011).
- **Cancelar una ocurrencia** (feriado, profesor enfermo): queda marcada, no se borra. Los avisos
  por WhatsApp llegan con `mensajeria` (Fase 5).

## Permisos

| Permiso | Para qué | Se controla |
| --- | --- | --- |
| `agenda.ver` | Ver clases, ocurrencias e inscriptos de la sede. | por sede (`puede(ctx, …, sedeId)`) |
| `agenda.gestionar` | Crear, editar y desactivar clases; cancelar ocurrencias. | por sede |
| `agenda.inscribir` | Inscribir y dar de baja alumnos en clases. | por sede |

Migración `select identidad_dar_al_dueno(array['agenda.ver', 'agenda.gestionar',
'agenda.inscribir'])` y la sección en `herramientas/src/catalogo.ts` (lo exige el guardián de #7).

## Rutas

- `GET /agenda/clases?sede&pagina` · `POST /agenda/clases` · `PUT /agenda/clases/:id` ·
  `PUT/DELETE /agenda/clases/:id/baja`
- `GET /agenda/ocurrencias?sede&desde&hasta` (semana, paginado) ·
  `PUT /agenda/ocurrencias/:id/cancelada`
- `GET /agenda/clases/:id/inscriptos?pagina` · `POST /agenda/clases/:id/inscriptos` ·
  `DELETE /agenda/inscripciones/:id`
- `GET /alumnos/:id/clases`: las clases de un alumno (para su ficha). Va en `agenda`, no en
  `personas`.

## Entrega en PRs

1. **Back de clases y ocurrencias** (`modulos/agenda`, negocio): tablas, RLS, dominio de horarios
   y zona horaria, rutas de clases y ocurrencias. Toca lo mínimo de estructura, como #5: registrar
   rutas en `apps/api`, contratos en `paquetes/contratos`, catálogo y migración del Dueño.
2. **Back de inscripciones y cupo** (`modulos/agenda`): inscripciones, contador con bloqueo y
   restricción, `GET /alumnos/:id/clases`.
3. **Pantalla Agenda** (`apps/web`, para Codex en paralelo con el 2): grilla semanal por sede,
   alta y edición de clase, cancelar una fecha.
4. **Inscripciones en el panel** (`apps/web`, Codex): inscriptos de una clase con su cupo, e
   inscribir desde la clase y desde la ficha del alumno.

Los contratos de cada PR de back se mergean antes de que Codex arranque la pantalla
correspondiente.

## Cómo se prueba

- **Dominio (sin base):** validaciones de horario, cálculo de ocurrencias en la zona del centro
  (incluido un cambio de horario de verano, por si un centro está en otra zona), edición que
  afecta solo lo futuro, cupo.
- **Integración (Postgres real):** aislamiento por centro **y por sede** (un usuario sin permiso
  en Sur no ve sus clases), materialización sin efecto doble, **el último lugar con dos
  inscripciones simultáneas** (entra una sola), alumno de baja rechazado.
- **Rutas:** permiso declarado en cada una, permiso por sede en el caso de uso, 400/403/404/409.
- El test de aislamiento de `db` y el guardián de permisos cubren las tablas y permisos nuevos.

## Queda afuera

- Asistencia, ausencias y recuperaciones: `asistencia` (Fase 3).
- Profesores asignados a clases y el permiso `agenda.ver-propias` (0007): cuando exista la
  plantilla Profesor.
- Reservas sueltas por fecha (sin inscripción fija), si un centro trabaja así.
- Qué hacer con las inscripciones de un alumno que se da de baja: definirlo con Stretch Inn.

## Para confirmar

1. **Inscripción fija a la clase semanal** (el alumno tiene «su» horario) y no reserva por fecha.
2. **Ocurrencias materializadas a pedido**, sin worker.
3. **Clase con nombre propio**, sin una tabla de actividades aparte por ahora.
4. **Tres permisos** (`ver`, `gestionar`, `inscribir`), todos por sede.
5. **Entrega en 4 PRs**: los dos de back los hago yo; las dos pantallas, Codex.
