# Módulo asistencia

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

La asistencia a cada fecha de clase: la planilla con los inscriptos de esa fecha, tomarla y
corregirla (presente o ausente), las ausencias avisadas antes de la clase, los créditos para
recuperar que generan y las reservas de recuperación en otras fechas, con sus lugares.

## Fuera de alcance

- Las clases, sus fechas y las inscripciones: `agenda` (se leen por su `index.ts`).
- Los datos de cada alumno: `personas` (se leen por su `index.ts`).
- Si el alumno tiene el abono al día: `abonos`, cuando exista.
- Avisos por WhatsApp: `mensajeria`.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/agenda` (la fecha, y quiénes estaban inscriptos en ella)
- `@app/personas` (nombre y apellido de cada alumno)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearAsistencia(base, { ahora?, finDelAbono? })`: devuelve `Asistencia`. `finDelAbono(tx,
{ alumnoId, sedeId, en })` dice cuándo termina el abono vigente del alumno; lo conecta la API
  con `abonos`, así `asistencia` no lo importa. Cada operación recibe el
  `ContextoCentro` de quien la pide y corre en su propia transacción:
  - `planilla(quien, { fechaId, pagina, porPagina })`: la fecha (con su cupo), la misma página
    de sus inscriptos y de los que recuperan (nombre, apellido, si el alumno está activo, su
    `estado` y su `avisoId`, `null` si no se marcó o no avisó) y los `lugares` libres.
  - `tomar(quien, { fechaId, marcas })`: guarda o corrige de 1 a 100 marcas
    (`{ alumnoId, estado }`) de inscriptos o de los que recuperan, todas o ninguna.
  - `avisar(quien, { fechaId, alumnoId })`: registra que no va; devuelve el `id` del aviso y
    `conCredito` (hoy siempre `true`: todo aviso da crédito, 0019).
  - `anularAviso(quien, { id })`: al final viene. No borra el aviso; anula su crédito.
  - `creditos(quien, { alumnoId, pagina, porPagina })`: los vigentes y sin usar del alumno, el
    que vence antes primero, en las sedes donde puede ver la asistencia.
  - `recuperar(quien, { fechaId, alumnoId })`: reserva un lugar con el crédito que vence antes.
  - `anularRecuperacion(quien, { id })`: libera el lugar y el crédito.
- `rutasDeAsistencia(asistencia)`: `GET /asistencia/fechas/:id?pagina` (`asistencia.ver`),
  `PUT /asistencia/fechas/:id` (`asistencia.tomar`), `POST /asistencia/fechas/:id/avisos` y
  `DELETE /asistencia/avisos/:id` (`asistencia.avisar`), `GET /alumnos/:id/creditos?pagina`
  (`asistencia.ver`), y `POST /asistencia/fechas/:id/recuperaciones` y
  `DELETE /asistencia/recuperaciones/:id` (`asistencia.recuperar`).
- `PERMISOS_ASISTENCIA`: la sección «Asistencia» del catálogo (`asistencia.ver`,
  `asistencia.tomar`, `asistencia.avisar`, `asistencia.recuperar`).

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
- Todo aviso genera **un** crédito en la misma transacción (índice único por aviso). No hay
  anticipación mínima (0019).
  Anular el aviso anula su crédito; nada se borra.
- El crédito es de la sede de la fecha a la que se faltó, y vale hasta `vence_en`: el fin del
  abono vigente del alumno en esa fecha (0019). **[SUPUESTO]** Sin abono vigente, 4 semanas
  desde la fecha.
- **Los lugares de una fecha nunca quedan en negativo:** cupo − inscriptos + avisos −
  recuperaciones. Reservar, anular un aviso y anular una recuperación toman la fecha con un
  bloqueo de la transacción (`pg_advisory_xact_lock`, por fecha), así que van de a uno; los
  índices únicos parciales (un crédito por recuperación vigente, un alumno por fecha) son la
  última barrera.
- Se recupera con el crédito de **esa sede** que vence antes, vigente al empezar la fecha
  (`recuperarEnOtraSede`: no, 0011 y 0019). Sin tope de créditos acumulados. Un alumno no
  recupera en una clase en la que está inscripto.
- Anular un aviso cuyo crédito ya se usó se rechaza (primero se anula la recuperación); anular
  un aviso cuyo lugar ya ocupó una recuperación, también.
- Anular una recuperación (antes del inicio) devuelve el crédito con su vencimiento original.

## Glosario

- **Fecha (ocurrencia):** un día concreto de una clase, de `agenda`.
- **Planilla:** los inscriptos de una fecha, con su marca.
- **Marca:** presente o ausente de un alumno en una fecha.
- **Aviso de ausencia:** el alumno (o la recepción por él) avisa antes de la clase que no va.
- **Crédito:** derecho a recuperar una clase, generado por un aviso de ausencia.
- **Recuperación:** un lugar reservado con un crédito en una fecha de otra clase.
- **Lugares:** los que quedan para recuperar en una fecha.

## Configuración por centro

_Ninguna por ahora._ Las reglas de los créditos están en `src/dominio/credito.ts` (0019); si
otro centro las necesita distintas, pasan a configuración por centro (0011).

## Pendientes

- Desde cuándo y hasta cuándo se toma la asistencia: hoy desde una hora antes del inicio y sin
  límite después. Si Stretch Inn quiere cerrar la planilla, va como configuración por centro.
- Si faltar sin avisar también da crédito (0019, pendiente con Stretch Inn). Hoy, no.
- Una fecha cancelada (suspensión) todavía no da crédito a sus inscriptos (0019).
- **Hueco conocido:** si `agenda` inscribe a alguien en una clase que ya tiene recuperaciones
  en una fecha futura, esa fecha puede pasarse del cupo: `agenda` no sabe de recuperaciones.
  Resolverlo con un evento de agenda o con que agenda consulte los lugares a asistencia.
- El alumno avisando y recuperando desde el portal (Fase 4): otro actor, con sus propias reglas.
