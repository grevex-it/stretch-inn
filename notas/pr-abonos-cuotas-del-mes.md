**abonos**: dos endpoints que el panel necesita para la cobranza. Es negocio.

**Apilado sobre `worker`.**

## Qué agrega

- `GET /abonos/cuotas/impagas?sede&periodo&pagina` (`abonos.ver` en la sede).
  - Devuelve las cuotas sin pagar ni anular de la sede, la más vieja primero, de a 50.
  - Cada cuota trae al alumno (nombre, apellido y si está activo). Se lee con una sola consulta
    a `personas` por página.
  - `adeudado` es lo que suman todas las impagas, no solo las de la página.
  - Con `periodo`, solo las de ese mes.
- `POST /abonos/cuotas/mes` con `{ sedeId, periodo? }` (`abonos.asignar` en la sede).
  - **[SUPUESTO]** Renueva las cuotas vigentes del mes anterior de la sede, con el mismo plan y
    el precio de hoy. Sin período, toma el mes actual del centro.
  - No genera cuotas para alumnos ni planes de baja, y no toca a quien ya tiene la cuota del
    mes. Si se repite, no duplica: lo garantiza el índice único parcial.
  - Devuelve `{ periodo, generadas, yaTenian, alumnosDeBaja, planesDeBaja }`.
  - Procesa de a 100 alumnos (el tope de `obtenerAlumnos`), con tres consultas por tanda en
    lugar de una por alumno.
- Contratos `pedidoDeImpagas`, `cuotaImpaga`, `paginaDeImpagas`, `pedidoDeCuotasDelMes` y
  `cuotasDelMes`.
- Migración con dos índices que empiezan por centro y sede: uno parcial para las impagas y otro
  para las cuotas de un mes.
- Decisión 22 en `DECISIONES_PENDIENTES.md`.

## Para revisar

- Hoy las cuotas del mes salen de las del mes anterior porque todavía no se guarda el plan de
  cada alumno. Si Stretch Inn prefiere una suscripción explícita, cambia el origen de las cuotas,
  pero no el endpoint.
- Generar las cuotas solo el día 1 con el worker necesita el actor de sistema (decisión 21).

## Cómo se probó

- Test primero: los 11 tests nuevos fallaron porque las funciones no existían y después
  pasaron. Son los de `periodoAnterior`, impagas, cuotas del mes y rutas.
- `cuotas-del-mes.integracion.test.ts`:
  - precio de hoy;
  - alumno de baja, plan de baja y cuota anulada que no se renueva;
  - otra sede;
  - repetir sin duplicar;
  - mes actual;
  - 102 alumnos en una sede (dos tandas);
  - permisos.
- Tests con base: abonos 30, caja 14, api 27, worker 1 y herramientas 20. En db pasan 25 de 26:
  `salida.test` lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
