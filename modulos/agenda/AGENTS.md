# Módulo agenda

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Las clases semanales de cada sede (nombre, día, hora local, duración y cupo) y sus fechas
concretas (ocurrencias): la semana de una sede, cambios de horario, baja de una clase y
cancelación de una fecha.

## Fuera de alcance

- Inscripciones de alumnos y control de cupo: llegan en este módulo, en la etapa siguiente.
- Asistencia, ausencias avisadas y recuperaciones: `asistencia`.
- Avisos de una fecha cancelada por WhatsApp: `mensajeria`.
- Profesores asignados a clases y `agenda.ver-propias` (0007): cuando exista la plantilla
  Profesor.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/centros` (zona horaria del centro)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearAgenda(base, { ahora? })`: devuelve `Agenda`. Cada operación recibe el `ContextoCentro`
  de quien la pide y corre en su propia transacción:
  - `clases(quien, { pagina, porPagina, sedeId? })`: las de las sedes donde puede ver la agenda.
  - `crearClase(quien, { sedeId, nombre, dia, hora, duracionMinutos, cupo })`.
  - `editarClase(quien, { id, version, … })`: la sede no se cambia.
  - `fijarActiva(quien, { id, activa })`: baja y reactivación.
  - `semana(quien, { sedeId, desde, pagina, porPagina })`: las fechas de los 7 días desde
    `desde`, armadas a pedido.
  - `fijarCancelada(quien, { id, cancelada })`.
- `rutasDeAgenda(agenda)`: `GET /agenda/clases?pagina&sede` y
  `GET /agenda/ocurrencias?sede&desde&pagina` (`agenda.ver`); `POST /agenda/clases`,
  `PUT /agenda/clases/:id`, `PUT`/`DELETE /agenda/clases/:id/baja` y
  `PUT`/`DELETE /agenda/ocurrencias/:id/cancelada` (`agenda.gestionar`).
- `PERMISOS_AGENDA`: la sección «Agenda» del catálogo (`agenda.ver`, `agenda.gestionar`,
  `agenda.inscribir`).

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- La clase y sus fechas son de **una sede**: RLS aísla por centro y sedes visibles, y cada
  permiso se controla en la sede de la clase (`puede(ctx, permiso, sedeId)`), no en alguna.
- La clase está en la hora local del centro; cada fecha se guarda en UTC (`timestamptz`), calculada
  con la zona horaria de `centros`.
- Una fecha por clase y día (índice único): armarlas a pedido no tiene efecto doble.
- No hay fechas anteriores al alta de la clase.
- Cambiar el horario mueve solo las fechas futuras; si cambia el día, las futuras se borran y se
  vuelven a armar. Las pasadas quedan como fueron.
- La baja de una clase no la borra: borra sus fechas futuras y conserva las pasadas.
- Una fecha cancelada se marca, no se borra. Solo se cancela (o se deshace) antes de que empiece.
- Toda edición de una clase compara la `version` (0013).

## Glosario

- **Clase:** una clase semanal de una sede («Stretching, lunes 18:30, 60 minutos, 12 lugares»).
- **Ocurrencia (fecha):** un día concreto de una clase.
- **Cupo:** lugares por fecha.

## Configuración por centro

_Ninguna por ahora._ La zona horaria es del centro (`centros`).

## Pendientes

- Inscripciones fijas con cupo (bloqueo de fila y restricción en la base, 0013) y las clases de
  un alumno para su ficha.
- Qué pasa con las inscripciones de un alumno que se da de baja: definirlo con Stretch Inn.
- Reservas sueltas por fecha, si un centro trabaja sin horario fijo.
