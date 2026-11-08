Lo que **`asistencia` necesita de `agenda`**: una fecha con su clase y quiénes estaban inscriptos en ese momento. Va antes del módulo `asistencia` (regla 5: un módulo por PR).

**Apilado sobre #11** (`agenda-lista-inscriptos`): tocan los mismos archivos de `agenda`. Mergear #11 primero.

## Qué hace

Suma al `index.ts` tres lecturas que reciben la `Transaccion` de `enContexto`, igual que `obtenerAlumno` de `personas`:

- `obtenerFecha(tx, id)`: la fecha con su clase. Trae `claseId`, `sedeId`, `nombre`, `fecha`, `empiezaEn`, `terminaEn` y `cancelada`.
- `inscriptosEnFecha(tx, { claseId, momento, pagina, porPagina })`: los alumnos con inscripción vigente en ese momento, por orden de inscripción y paginados.
- `estabanInscriptos(tx, { claseId, momento, alumnoIds })`: cuáles de esos alumnos estaban inscriptos. Acepta hasta 100 y sirve para validar una planilla en una sola consulta.

## Decisión: vigente en un momento

Una inscripción está vigente en un momento si se creó antes (o en ese momento) y no tiene baja o la baja es posterior. Así:

- una baja de hoy no saca al alumno de las planillas pasadas;
- quien se inscribe hoy no aparece en las fechas anteriores.

## Cómo se probó

- Test primero, visto fallar (las funciones no existían) antes de implementar.
- Integración contra Postgres real:
  - la fecha con su clase, y que otro centro no la ve (RLS);
  - los inscriptos en la fecha y antes de inscribirse;
  - una baja que separa las fechas anteriores de las posteriores;
  - el tope de 100 alumnos.
- `agenda` 62 tests en verde. Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
