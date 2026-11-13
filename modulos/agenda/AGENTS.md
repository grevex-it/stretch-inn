# Módulo agenda

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Las clases semanales de cada sede (nombre, día, hora local, duración y cupo) y sus fechas
concretas (ocurrencias): la semana de una sede, cambios de horario, baja de una clase y
cancelación de una fecha. Las inscripciones fijas de alumnos en cada clase, con su cupo.

## Fuera de alcance

- Los datos de cada alumno: `personas` (se leen por su `index.ts`).
- Asistencia, ausencias avisadas y recuperaciones: `asistencia`.
- Avisos de una fecha cancelada por WhatsApp: `mensajeria`.
- Profesores asignados a clases y `agenda.ver-propias` (0007): cuando exista la plantilla
  Profesor.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/centros` (zona horaria del centro)
- `@app/personas` (si el alumno existe y está activo, y los datos de los inscriptos)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearAgenda(base, { ahora?, ocupadasDeMas? })`: devuelve `Agenda`. `ocupadasDeMas` dice
  cuántos lugares ocupan de más las recuperaciones en cada fecha; lo conecta la API con
  `asistencia` (sin él, no se cuentan). Cada operación recibe el `ContextoCentro` de quien la
  pide y corre en su propia transacción:
  - `clases(quien, { pagina, porPagina, sedeId? })`: las de las sedes donde puede ver la agenda.
  - `crearClase(quien, { sedeId, nombre, dia, hora, duracionMinutos, cupo })`.
  - `editarClase(quien, { id, version, … })`: la sede no se cambia.
  - `fijarActiva(quien, { id, activa })`: baja y reactivación.
  - `semana(quien, { sedeId, desde, pagina, porPagina })`: las fechas de los 7 días desde
    `desde`, armadas a pedido.
  - `fijarCancelada(quien, { id, cancelada })`.
  - `inscribir(quien, { claseId, alumnoId })` y `darDeBajaInscripcion(quien, { id })`.
  - `inscriptos(quien, { claseId, pagina, porPagina })`: los vigentes por orden de inscripción,
    con nombre, apellido, teléfono y si el alumno está activo. Una página de inscripciones y sus
    alumnos en dos consultas (`obtenerAlumnos` de `personas`).
  - `clasesDeAlumno(quien, { alumnoId, pagina, porPagina })`: sus inscripciones vigentes en las
    sedes donde se puede ver la agenda.
  - `camas(quien, { sedeId })` y `fijarCamas(quien, { sedeId, camas })`: las camas de la sede
    (1 a 500, o null: sin tope), el tope del cupo de todas sus clases (pedido del 12/11). Al
    bajarlas, las clases con más cupo bajan con ellas, todas o ninguna; no bajan si dejan afuera a
    los fijos de una clase (`camas-menos-que-inscriptos`) o a las recuperaciones de una fecha
    futura (`fecha-completa`). Subirlas no toca los cupos.
- `rutasDeAgenda(agenda)`: `GET /agenda/clases?pagina&sede`,
  `GET /agenda/ocurrencias?sede&desde&pagina`, `GET /agenda/clases/:id/inscriptos?pagina` y
  `GET /alumnos/:id/clases?pagina` (`agenda.ver`); `POST /agenda/clases`, `PUT /agenda/clases/:id`,
  `PUT`/`DELETE /agenda/clases/:id/baja` y `PUT`/`DELETE /agenda/ocurrencias/:id/cancelada`
  (`agenda.gestionar`); `POST /agenda/clases/:id/inscriptos` y
  `DELETE /agenda/inscripciones/:id` (`agenda.inscribir`); `GET /agenda/sedes/:id/camas`
  (`agenda.ver`) y `PUT /agenda/sedes/:id/camas` (`agenda.gestionar`).
- `PERMISOS_AGENDA`: la sección «Agenda» del catálogo (`agenda.ver`, `agenda.gestionar`,
  `agenda.inscribir`).

Para otros módulos (asistencia y abonos). Reciben la `Transaccion` de `enContexto`:

- `obtenerFecha(tx, id)`: una fecha con su clase (`claseId`, `sedeId`, `nombre`, `cupo`,
  `fecha`, `empiezaEn`, `terminaEn`, `cancelada`), o undefined.
- `inscriptosEnFecha(tx, { claseId, momento, pagina, porPagina })`: los alumnos con inscripción
  vigente **en ese momento**, por orden de inscripción.
- `estabanInscriptos(tx, { claseId, momento, alumnoIds })`: cuáles de esos alumnos (hasta 100)
  la tenían vigente en ese momento.
- `fechasDeAlumno(tx, { alumnoId, sedeId, desde, cantidad })`: las primeras `cantidad` (1 a 100)
  fechas de su horario fijo en la sede desde el día `desde`, en orden (`id`, `claseId`, `fecha`,
  `empiezaEn`, `terminaEn`). No cuentan las canceladas ni las de clases en las que no estaba
  inscripto en ese momento. Arma a pedido las fechas que falten, como `semana`. Para abonos:
  cada una gasta una clase del abono (0020).
- `liberarLugares(tx, { alumnoId, ahora })`: la baja del alumno (0019). Da de baja sus
  inscripciones vigentes con fecha `ahora`, descuenta cada lugar de su clase y devuelve cuántas
  liberó; repetirla no tiene efecto doble. Escribe en las tablas de agenda, desde agenda: la
  llama `personas` al dar de baja, en la misma transacción. Con RLS, libera los lugares de las
  sedes visibles de quien da la baja.

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
- **El cupo nunca se supera.** Inscribir, dar de baja y editar una clase la toman con
  `for update`; el contador `inscriptos` se mueve en la misma transacción, y la restricción
  `clases_inscriptos` (0 ≤ inscriptos ≤ cupo) es la última barrera. Bajar el cupo por debajo de
  los inscriptos se rechaza.
- **Tampoco con recuperaciones:** inscribir y bajar el cupo miran las fechas futuras no
  canceladas de la clase (las primeras 100) y rechazan (`fecha-completa`, con la fecha) si los
  fijos más las recuperaciones de más de alguna pasan el cupo. Las fechas quedan tomadas con el
  bloqueo de `asistencia` hasta el fin de la transacción: una recuperación no gana el lugar en
  el medio.
- **El cupo de una clase no pasa las camas de su sede** (`cupo-mayor-que-camas`), al crearla ni
  al editarla. Cambiar las camas de una sede va de a uno (bloqueo por sede) y toma con
  `for update` las clases que tiene que bajar.
- Un alumno tiene a lo sumo una inscripción vigente por clase (índice único parcial). La baja
  no borra: marca `baja_en`.
- Una inscripción está vigente en un momento si se creó antes (o en ese momento) y no tiene baja
  o la baja es posterior. Una baja de hoy no saca al alumno de las fechas pasadas.
- Solo se inscribe un alumno activo del centro, leído por la API pública de `personas`.

## Glosario

- **Clase:** una clase semanal de una sede («Stretching, lunes 18:30, 60 minutos, 12 lugares»).
- **Ocurrencia (fecha):** un día concreto de una clase.
- **Cupo:** lugares por fecha.
- **Inscripción:** el lugar fijo de un alumno en una clase semanal: va todas las semanas.

## Configuración por centro

Por sede, desde el panel: las camas (`camas_de_sede`; sin fila, sin tope). La zona horaria es del
centro (`centros`).

## Pendientes

- Los inscriptos salen por orden de inscripción: ordenarlos por apellido en la base exigiría
  leer la tabla de `personas` (regla 4). Una clase rara vez pasa de una página: el panel los
  puede ordenar.
- Reservas sueltas por fecha, si un centro trabaja sin horario fijo.
- Crear o editar una clase lee las camas sin tomarlas: si a la vez alguien baja las camas de esa
  sede, la clase nueva puede quedar con más cupo que camas. Es una ventana chica; tomarlas
  ahí cruza el orden de bloqueos con `fijarCamas` (clase y sede al revés).
