Segunda etapa de **`agenda`**: inscripciones fijas de alumnos en las clases semanales, con un cupo que nunca se supera (0013). Plan: `plan-agenda.md` (PR 2 de 4).

**Va encima de #8**: apunta a `agenda-clases`, así que el diff muestra solo las inscripciones. Orden de merge: #7 → #8 → este. Antes de borrar cada rama, apuntar el PR siguiente a `main`.

## Qué hace

- **Inscribir** a un alumno activo del centro en una clase: ocupa su lugar todas las semanas. Un alumno no tiene dos inscripciones vigentes en la misma clase.
- **Baja de una inscripción:** no borra, marca `baja_en` y libera el lugar. Después se puede volver a inscribir.
- **Cupo:** las clases y las fechas informan sus `inscriptos`. Bajar el cupo por debajo de los inscriptos se rechaza.
- **Las clases de un alumno**, para su ficha (`GET /alumnos/:id/clases`): sus inscripciones vigentes en las sedes donde se puede ver la agenda. Vive en `agenda` porque `personas` no sabe de clases.

## El cupo (0013)

- Inscribir, dar de baja y editar una clase la toman con `SELECT … FOR UPDATE`. Si varios van por el último lugar, el primero entra y los demás esperan y ven «La clase está completa».
- El contador `clases.inscriptos` se mueve en la misma transacción que la inscripción.
- La restricción `clases_inscriptos` (`0 <= inscriptos <= cupo`) es la última barrera.

## Rutas

| Ruta | Permiso |
| --- | --- |
| `POST /agenda/clases/:id/inscriptos` | `agenda.inscribir` |
| `DELETE /agenda/inscripciones/:id` | `agenda.inscribir` |
| `GET /alumnos/:id/clases?pagina` | `agenda.ver` |

Estados: 201, 204, 404 (clase, alumno o inscripción), 409 (clase completa o de baja, alumno de baja, ya inscripto, cupo menor que los inscriptos), 403 sin permiso en la sede.

## Cómo se probó

- Test primero, cada uno visto fallar por la razón esperada antes de implementar.
- **El último lugar con ocho pedidos a la vez.** Con dos pedidos sueltos la carrera casi nunca se da, así que el test toma la clase desde otra conexión, espera a que los ocho queden frenados y la suelta: salen juntos. Comprobado a mano: **sin el bloqueo falla** contra `clases_inscriptos`; con el bloqueo entra uno solo y los otros siete reciben «clase completa». Estable en varias corridas.
  - Detalle para quien escriba tests así: dentro de una transacción, Postgres congela `pg_stat_activity`; hay que llamar a `pg_stat_clear_snapshot()` en cada vuelta del sondeo.
- Integración contra Postgres real: lugar ocupado en la clase y en la semana, alumno repetido, clase completa, alumno de baja y de otro centro, sin `agenda.inscribir` en la sede, baja y reinscripción, cupo menor que los inscriptos, clases de un alumno.
- Rutas: el permiso declarado en cada una y sus estados.
- Formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos. Tests: agenda 55, contratos 25, api 27, herramientas 20, identidad 126, personas 23, plataforma 25, centros 6, db 25/26 (`salida.test` necesita el Postgres embebido, que no corre en la PC donde se probó; lo cubre el CI).

## Queda afuera

- **La lista de inscriptos de una clase con el nombre de cada alumno.** Necesita leer varios alumnos a la vez por la API pública de `personas` (hoy solo existe `obtenerAlumno`, de a uno); eso es un cambio en `personas` y va en su propio PR (regla 5).
- Qué pasa con las inscripciones de un alumno que se da de baja: definirlo con Stretch Inn.
