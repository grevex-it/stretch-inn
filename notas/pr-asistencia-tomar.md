Módulo nuevo **`asistencia`** (nivel completo), primera parte: **tomar y corregir la asistencia de cada fecha**. La parte que menos depende del relevamiento con Stretch Inn.

**Apilado sobre `agenda-para-asistencia`**, que a su vez sale de #11. Mergear en ese orden.

## Qué hace

- **Planilla de una fecha:** trae a quienes tenían inscripción vigente al empezar la fecha (por la API pública de `agenda`), con nombre y apellido (de `personas`) y su marca, o `null` si todavía no se marcó. Va paginada y sin N+1: tres consultas por página.
- **Tomar:** guarda de 1 a 100 marcas (presente o ausente), todas o ninguna. Hay una marca por alumno y fecha (índice único), así que tomar de nuevo corrige y no duplica.
- Rutas:
  - `GET /asistencia/fechas/:id?pagina`, con `asistencia.ver`.
  - `PUT /asistencia/fechas/:id`, con `asistencia.tomar`.
  - Los dos permisos se controlan en la sede de la fecha.
- Tabla `asistencias`:
  - RLS por centro y sede.
  - Claves hacia `ocurrencias`, `alumnos`, `centros` y `sedes`.
  - Cada marca guarda quién la registró (usuario o soporte), cuándo y su `origen`. Hoy el único origen es `manual`; la huella y las cámaras entran después como adaptadores (0003).
- Los permisos se dan al Dueño por migración y se suman al catálogo.

## Decisiones para revisar

- **Desde cuándo se toma:** desde una hora antes del inicio, por si la recepción marca en la puerta. No hay límite después, para poder corregir. Si Stretch Inn quiere cerrar la planilla, va como configuración por centro.
- **Dos estados, presente y ausente.** La ausencia avisada no es un estado de la planilla: viene después, en su propia tabla, junto con los créditos de recuperación.
- **Quiénes figuran:** los inscriptos al empezar la fecha. Una baja posterior no los saca de las planillas pasadas.

## Cómo se probó

- Test primero en cada capa (dominio, casos de uso, contrato y rutas), visto fallar antes de implementar.
- Dominio sin base: la ventana de tiempo, la fecha cancelada y las marcas vacías, repetidas o de más.
- Integración contra Postgres real:
  - la planilla;
  - tomar y corregir sin duplicar;
  - un alumno no inscripto que frena toda la planilla;
  - antes de hora y fecha cancelada;
  - permisos por sede y otro centro.
- Rutas: el permiso declarado y los códigos 204, 200, 400, 404 y 409.
- En verde: asistencia 13, agenda 62, identidad, personas, plataforma, centros, api, herramientas (incluido el guardián de permisos del Dueño), contratos y web. En db pasan 25 de 26, incluido el test de aislamiento con la tabla nueva; `salida.test` necesita el Postgres embebido y lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
