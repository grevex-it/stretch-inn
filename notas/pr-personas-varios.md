`personas` suma **`obtenerAlumnos(tx, ids)`** a su API pública: varios alumnos del centro en una sola consulta.

## Para qué

`agenda` necesita mostrar los inscriptos de una clase con el nombre de cada alumno. Por la regla 4 solo puede leer alumnos por el `index.ts` de `personas`, y hoy solo existe `obtenerAlumno`, de a uno: pedir una página de 50 así sería un N+1 (regla 8). Va en su propio PR porque es un cambio en `personas` (regla 5); la lista de inscriptos en `agenda` viene después.

## Qué hace

- Hasta **100 ids** por consulta (una página de otro módulo, con margen). Más es un error de quien llama y tira una excepción.
- Los ids que no son del centro no vuelven: RLS limita al centro del contexto. Tampoco los que no existen.
- Devuelve también los alumnos de baja: quien llama decide cómo mostrarlos (un inscripto viejo puede estar de baja).
- Con una lista vacía no consulta la base.

## Cómo se probó

- Test primero, visto fallar antes de implementar.
- Integración contra Postgres real: trae los del centro (uno activo y uno de baja), ignora los de otro centro y los inexistentes, lista vacía y tope de 100.
- `personas` 26 tests. Formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
