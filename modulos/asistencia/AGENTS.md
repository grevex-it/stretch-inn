# Módulo asistencia

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

La asistencia a cada fecha de clase: la planilla con los inscriptos de esa fecha, y tomarla y
corregirla (presente o ausente). Más adelante, las ausencias avisadas, los créditos y las
reservas de recuperación.

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
    con nombre, apellido, si el alumno está activo y su `estado` (`null` si no se marcó).
  - `tomar(quien, { fechaId, marcas })`: guarda o corrige de 1 a 100 marcas
    (`{ alumnoId, estado }`), todas o ninguna.
- `rutasDeAsistencia(asistencia)`: `GET /asistencia/fechas/:id?pagina` (`asistencia.ver`) y
  `PUT /asistencia/fechas/:id` (`asistencia.tomar`).
- `PERMISOS_ASISTENCIA`: la sección «Asistencia» del catálogo (`asistencia.ver`,
  `asistencia.tomar`).

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

## Glosario

- **Fecha (ocurrencia):** un día concreto de una clase, de `agenda`.
- **Planilla:** los inscriptos de una fecha, con su marca.
- **Marca:** presente o ausente de un alumno en una fecha.

## Configuración por centro

_Ninguna por ahora._

## Pendientes

- Desde cuándo y hasta cuándo se toma la asistencia: hoy desde una hora antes del inicio y sin
  límite después. Si Stretch Inn quiere cerrar la planilla, va como configuración por centro.
- Ausencias avisadas, créditos y reservas de recuperación (relevar con Stretch Inn: anticipación
  del aviso, vigencia del crédito, en qué clases se recupera).
- Los alumnos que recuperan en una fecha van a figurar en su planilla.
