# Módulo asistencia

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

La asistencia a cada fecha de clase: la planilla con los inscriptos de esa fecha, tomarla y
corregirla (presente o ausente), y las ausencias avisadas antes de la clase. Más adelante, los
créditos y las reservas de recuperación.

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

- `crearAsistencia(base, { ahora? })`: devuelve `Asistencia`. Cada operación recibe el
  `ContextoCentro` de quien la pide y corre en su propia transacción:
  - `planilla(quien, { fechaId, pagina, porPagina })`: la fecha y una página de sus inscriptos,
    con nombre, apellido, si el alumno está activo, su `estado` (`null` si no se marcó) y su
    `avisoId` (`null` si no avisó).
  - `tomar(quien, { fechaId, marcas })`: guarda o corrige de 1 a 100 marcas
    (`{ alumnoId, estado }`), todas o ninguna.
  - `avisar(quien, { fechaId, alumnoId })`: registra que no va; devuelve el `id` del aviso.
  - `anularAviso(quien, { id })`: al final viene. No borra el aviso.
- `rutasDeAsistencia(asistencia)`: `GET /asistencia/fechas/:id?pagina` (`asistencia.ver`),
  `PUT /asistencia/fechas/:id` (`asistencia.tomar`), `POST /asistencia/fechas/:id/avisos` y
  `DELETE /asistencia/avisos/:id` (`asistencia.avisar`).
- `PERMISOS_ASISTENCIA`: la sección «Asistencia» del catálogo (`asistencia.ver`,
  `asistencia.tomar`, `asistencia.avisar`).

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
- Avisar no decide si hay crédito para recuperar: eso es de los créditos. Con aviso, igual se le
  puede tomar asistencia (si vino, queda presente).

## Glosario

- **Fecha (ocurrencia):** un día concreto de una clase, de `agenda`.
- **Planilla:** los inscriptos de una fecha, con su marca.
- **Marca:** presente o ausente de un alumno en una fecha.
- **Aviso de ausencia:** el alumno (o la recepción por él) avisa antes de la clase que no va.

## Configuración por centro

_Ninguna por ahora._

## Pendientes

- Desde cuándo y hasta cuándo se toma la asistencia: hoy desde una hora antes del inicio y sin
  límite después. Si Stretch Inn quiere cerrar la planilla, va como configuración por centro.
- Créditos y reservas de recuperación (relevar con Stretch Inn: con cuánta anticipación un aviso
  da crédito, vigencia del crédito, en qué clases se recupera).
- El alumno avisando desde el portal (Fase 4): otro actor, con sus propias reglas.
- Los alumnos que recuperan en una fecha van a figurar en su planilla.
