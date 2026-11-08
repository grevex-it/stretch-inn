Los **inscriptos de una clase con el nombre de cada alumno**: el último back que necesita la pantalla de inscripciones. Usa `obtenerAlumnos` de `personas` (#10).

## Qué hace

- `GET /agenda/clases/:id/inscriptos?pagina` (`agenda.ver` en la sede de la clase).
- Trae las inscripciones **vigentes**, paginadas, con `nombre`, `apellido`, `telefono` y `activo` de cada alumno. Con el `id` de cada una se da de baja (`DELETE /agenda/inscripciones/:id`).
- Una página de inscripciones y sus alumnos en **dos consultas** (sin N+1, regla 8): las inscripciones de la página y después `obtenerAlumnos(ids)` de `personas`.
- Un alumno dado de baja en `personas` que sigue inscripto aparece con `activo: false`: el panel puede marcarlo.

## Decisión: orden de inscripción

Salen por orden de inscripción, no por apellido. Ordenar por apellido en la base exigiría leer la tabla de `personas` desde `agenda` (regla 4), y ordenar solo la página en memoria daría un orden falso entre páginas. Una clase rara vez pasa de una página (cupo típico de 10 a 20): el panel los puede ordenar por apellido.

## Cómo se probó

- Test primero, visto fallar antes de implementar.
- Integración contra Postgres real: orden y datos del alumno, sin las bajas de la clase, alumno de baja en `personas` marcado, clase de otro centro (no existe) y sin `agenda.ver` en la sede (sin permiso).
- Ruta: permiso declarado y respuesta con los datos del alumno.
- Tests: agenda 58, contratos 26, api, herramientas, identidad, personas, plataforma y centros en verde; db 25/26 (`salida.test` necesita el Postgres embebido, que no corre en la PC donde se probó; lo cubre el CI). Formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
