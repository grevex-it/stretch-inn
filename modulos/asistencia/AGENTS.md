# Módulo asistencia

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

La asistencia a cada fecha de clase: la planilla con los inscriptos de esa fecha, tomarla y
corregirla (presente o ausente), las ausencias avisadas antes de la clase (liberan el lugar), las
reservas de recuperación en otras fechas, con sus lugares, y las reglas de recuperación de cada
sede (0020).

## Fuera de alcance

- Las clases, sus fechas y las inscripciones: `agenda` (se leen por su `index.ts`).
- Los datos de cada alumno: `personas` (se leen por su `index.ts`).
- El abono del alumno: `abonos`. La API le pasa a `asistencia` el abono vigente (`abonoVigente`),
  así `asistencia` no lo importa.
- Avisos por WhatsApp: `mensajeria`.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/agenda` (la fecha, y quiénes estaban inscriptos en ella)
- `@app/personas` (nombre y apellido de cada alumno)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearAsistencia(base, { ahora?, abonoVigente? })`: devuelve `Asistencia`. `abonoVigente`
  dice el abono vigente del alumno (`{ inicio, fin }`); lo conecta la API con `abonos`. Sin él,
  nadie tiene abono vigente. Cada operación recibe el `ContextoCentro` de quien la pide y corre
  en su propia transacción:
  - `planilla(quien, { fechaId, pagina, porPagina })`: la fecha (con su cupo), la misma página
    de sus inscriptos y de los que recuperan (nombre, apellido, si el alumno está activo, su
    `estado` y su `avisoId`, `null` si no se marcó o no avisó; los que recuperan traen además su
    `recuperacionId`, para anularla) y los `lugares` libres.
  - `tomar(quien, { fechaId, marcas })`: guarda o corrige de 1 a 100 marcas
    (`{ alumnoId, estado }`) de inscriptos o de los que recuperan, todas o ninguna.
  - `avisar(quien, { fechaId, alumnoId })`: registra que no va y libera su lugar; devuelve el
    `id` del aviso.
  - `anularAviso(quien, { id })`: al final viene. No borra el aviso.
  - `recuperar(quien, { fechaId, alumnoId })`: reserva un lugar si hay, según las reglas de la
    sede. No hace falta un aviso previo (0020).
  - `anularRecuperacion(quien, { id })`: libera el lugar.
  - `reglas(quien, { sedeId })` y `fijarReglas(quien, { sedeId, … })` (anticipación en minutos,
    máximo por abono y si se puede sin abono): las reglas de recuperación de la sede; sin
    configurar, las de por defecto (las de Río Tercero: 0 minutos, 4 por abono, sin abono no).
- `rutasDeAsistencia(asistencia)`: `GET /asistencia/fechas/:id?pagina` (`asistencia.ver`),
  `PUT /asistencia/fechas/:id` (`asistencia.tomar`), `POST /asistencia/fechas/:id/avisos` y
  `DELETE /asistencia/avisos/:id` (`asistencia.avisar`),
  `POST /asistencia/fechas/:id/recuperaciones` y `DELETE /asistencia/recuperaciones/:id`
  (`asistencia.recuperar`), y
  `GET /asistencia/sedes/:id/reglas` (`asistencia.ver`) y `PUT /asistencia/sedes/:id/reglas`
  (`asistencia.configurar`).
- Para otros módulos (`agenda`), con la `Transaccion` de `enContexto`:
  - `ocupadasDeMas(tx, { ocurrenciaIds })`: hasta 100 fechas; cuántos lugares ocupan de más las
    recuperaciones en cada una (recuperaciones menos avisos vigentes), solo donde sobran. Toma
    cada fecha con el mismo bloqueo que recuperar, así agenda inscribe a un fijo sin que una
    recuperación le gane el lugar en el medio. La API se lo pasa a `agenda`.
- `PERMISOS_ASISTENCIA`: la sección «Asistencia» del catálogo (`asistencia.ver`,
  `asistencia.tomar`, `asistencia.avisar`, `asistencia.recuperar`, `asistencia.configurar`).

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- Cada marca es de **una sede**, la de su fecha: RLS aísla por centro y sedes visibles, y cada
  permiso se controla en la sede de la fecha (`puede(ctx, permiso, sedeId)`).
- En la planilla figuran quienes tenían inscripción vigente **al empezar la fecha**: una baja
  posterior no los saca, y quien se inscribe después no aparece en las fechas anteriores.
- Solo se marca a quien estaba inscripto en esa fecha. Si una marca no cumple, no se guarda
  ninguna.
- Una marca por alumno y fecha (índice único). Tomar de nuevo la corrige: no hay efecto doble.
- No se toma asistencia de una fecha cancelada, ni antes de una hora del inicio.
- Cada marca guarda quién la registró (usuario o soporte) y cuándo, y su `origen` (hoy solo
  `manual`; la huella y las cámaras entran como adaptadores nuevos, 0003).
- Un aviso de ausencia vigente por alumno y fecha (índice único parcial). Solo avisa quien
  estaba inscripto, antes del inicio y en una fecha no cancelada; anular sigue la misma regla y
  no borra: marca `anulado_en`.
- Con aviso, igual se le puede tomar asistencia (si vino, queda presente).
- **Los lugares de una fecha nunca quedan en negativo:** cupo − inscriptos + avisos −
  recuperaciones. Reservar, anular un aviso y anular una recuperación toman la fecha con un
  bloqueo de la transacción (`pg_advisory_xact_lock`, por fecha), así que van de a uno; los
  índices únicos parciales (un alumno por fecha) son la última barrera.
- **Recuperar (0020):** si hay lugar, sin aviso previo, en la sede del alumno
  (`recuperarEnOtraSede`: no, 0011 y 0019), y según las reglas de la sede: con su anticipación,
  dentro del abono vigente (o sin abono, si la sede lo permite) y sin pasar su máximo por abono.
  El máximo cuenta las recuperaciones en fechas del abono; las de un mismo alumno van de a una
  (bloqueo por alumno). Un alumno no recupera en una clase en la que está inscripto.
- Anular un aviso cuyo lugar ya ocupó una recuperación se rechaza.
- Anular una recuperación (antes del inicio) libera el lugar.

## Glosario

- **Fecha (ocurrencia):** un día concreto de una clase, de `agenda`.
- **Planilla:** los inscriptos de una fecha, con su marca.
- **Marca:** presente o ausente de un alumno en una fecha.
- **Aviso de ausencia:** el alumno (o la recepción por él) avisa antes de la clase que no va.
- **Recuperación:** un lugar reservado en una fecha de otra clase de la sede.
- **Lugares:** los que quedan para recuperar en una fecha.

## Configuración por centro

Por sede, desde el panel (0020): anticipación para anotarse a recuperar, máximo de recuperaciones
por abono y si se puede recuperar sin abono vigente (`reglas_de_recuperacion`; sin fila, las de
por defecto, `src/dominio/reglas.ts`).

## Pendientes

- Desde cuándo y hasta cuándo se toma la asistencia: hoy desde una hora antes del inicio y sin
  límite después. Si Stretch Inn quiere cerrar la planilla, va como configuración por centro.
- Borrar la tabla `creditos` y la columna `recuperaciones.credito_id`, en desuso desde 0020 (dos
  pasos, `db/AGENTS.md`).
- **Hueco conocido:** si `agenda` inscribe a alguien en una clase que ya tiene recuperaciones
  en una fecha futura, esa fecha puede pasarse del cupo. `ocupadasDeMas` ya está; falta que
  `agenda` la consulte al inscribir y al bajar el cupo.
- El alumno avisando y recuperando desde el portal (Fase 4): otro actor, con sus propias reglas.
