# Módulo abonos

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Los planes del centro (nombre, clases por semana y precio general), su precio opcional por sede
(0011), y las cuotas de cada alumno: una por ciclo de 4 semanas (0019), con el monto congelado
al generarla.

## Fuera de alcance

- Cobrar: `caja`, que marca la cuota pagada con `registrarPago`.
- Los datos de cada alumno: `personas` (se leen por su `index.ts`).
- La zona horaria del centro: `centros`.
- Descuentos, recargos por mora y prorrateos: cuando un centro los pida (0011).

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/centros` (zona horaria, para el día de hoy en el centro)
- `@app/personas` (si el alumno existe y está activo)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearAbonos(base, { ahora? })`: devuelve `Abonos`. Cada operación recibe el `ContextoCentro`
  de quien la pide y corre en su propia transacción:
  - `planes(quien, { pagina, porPagina })`: los planes del centro, por nombre, con los precios
    propios de las sedes que se ven.
  - `crearPlan(quien, { nombre, clasesPorSemana, precio })`, `editarPlan` (con `id` y
    `version`) y `fijarActivo(quien, { id, activo })`.
  - `fijarPrecioDeSede(quien, { planId, sedeId, precio })`: con `precio: null`, la sede vuelve
    al general.
  - `generarCuota(quien, { alumnoId, planId, sedeId, desde? })`: un ciclo de 4 semanas desde
    `desde` (AAAA-MM-DD; sin él, hoy en el centro). Devuelve `{ id, monto, desde, hasta }`. No
    puede pisar otro ciclo vigente del alumno (`ya-tiene-cuota`).
  - `anularCuota(quien, { id })` y `cuotasDeAlumno(quien, { alumnoId, pagina, porPagina })`.
  - `cuotasImpagas(quien, { sedeId, pagina, porPagina })`: las impagas de la sede, la más vieja
    primero, con el nombre del alumno y `adeudado` (lo que suman todas, no solo la página).
  - `renovarCuotas(quien, { sedeId, dia? })`: renueva los ciclos de la sede que terminaron hasta
    `dia` (sin él, hoy en el centro). El ciclo siguiente empieza el día en que terminó el último,
    con el mismo plan y el precio de hoy; quien quedó atrás recibe todos los que le faltan, así
    que repetirlo no duplica. Saltea alumnos y planes de baja. Devuelve
    `{ dia, generadas, alumnosDeBaja, planesDeBaja }`. Va de a tandas de 100 alumnos (el tope de
    `obtenerAlumnos`).
- Para otros módulos (`caja`, `asistencia`), con la `Transaccion` de `enContexto`:
  - `obtenerCuota(tx, id)`: la cuota vigente, o undefined.
  - `registrarPago(tx, { cuotaId, pagoId, en })`: la marca pagada una sola vez (la toma con
    `for update`). Falla con `cuota-inexistente` o `cuota-pagada`.
  - `revertirPago(tx, { cuotaId, pagoId })`: si ese pago la saldó, la cuota vuelve a estar sin
    pagar (caja anuló el pago).
  - `finDelAbono(tx, { alumnoId, sedeId, en })`: la medianoche del centro del día en que termina
    el ciclo vigente del alumno en esa sede en ese momento, o undefined. La API se lo pasa a
    `asistencia` para el vencimiento de los créditos (0019).
- `rutasDeAbonos(abonos)`: `GET /abonos/planes`, `GET /abonos/cuotas/impagas?sede&pagina` y
  `GET /alumnos/:id/cuotas` (`abonos.ver`);
  `POST /abonos/planes`, `PUT /abonos/planes/:id`, `PUT`/`DELETE /abonos/planes/:id/baja` y
  `PUT`/`DELETE /abonos/planes/:id/sedes/:sedeId/precio` (`abonos.gestionar`);
  `POST /abonos/cuotas`, `POST /abonos/cuotas/renovacion` y `DELETE /abonos/cuotas/:id`
  (`abonos.asignar`).
- `PERMISOS_ABONOS`: la sección «Abonos» del catálogo (`abonos.ver`, `abonos.gestionar`,
  `abonos.asignar`).

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno_. El pago llega por `registrarPago`, en la transacción del cobro.

## Invariantes

- **Montos en pesos enteros** (`Dinero`, `bigint`): mayores que cero y con un tope de
  $100.000.000 para frenar un cero de más.
- El plan es del centro (RLS por centro); su precio por sede y las cuotas, de una sede (RLS por
  centro y sedes visibles).
- La sede usa su precio propio si lo tiene; si no, el general.
- **Una cuota es un ciclo de 4 semanas** (0019): `hasta = desde + 28` (restricción en la base).
  El siguiente ciclo empieza el día en que termina el anterior.
- **Los ciclos vigentes de un alumno no se pisan**, en ninguna sede: generar toma un bloqueo por
  alumno hasta el fin de la transacción y revisa los que se cruzan; el índice único parcial
  (alumno, desde) es la última barrera.
- El monto se congela al generarla: cambiar el precio después no toca las cuotas ya generadas.
- Anular una cuota no la borra, y solo se anula si no está pagada. Una cuota no está pagada y
  anulada a la vez (restricción en la base).
- Toda edición de un plan compara la `version` (0013). La baja de un plan no lo borra: deja de
  poder asignarse.
- Solo se genera la cuota de un alumno activo, con un plan activo.

## Glosario

- **Plan (abono):** lo que contrata el alumno («Dos por semana, $30.000»).
- **Precio de sede:** el precio propio de un plan en una sede.
- **Cuota:** lo que el alumno paga por un ciclo de su plan.
- **Ciclo:** 4 semanas desde el día en que empieza (`desde`) hasta el día en que empieza el
  siguiente (`hasta`), en la zona del centro.

## Configuración por centro

_Ninguna por ahora._ Los precios por sede son datos, no configuración.

## Pendientes

- **[SUPUESTO]** Si un alumno paga tarde, su ciclo siguiente empieza igual el día en que terminó
  el anterior, no el día del pago (0019, pendiente con Stretch Inn).
- La clase suelta, la clase de prueba paga y el alumno de viaje (media cuota) (0019).
- La sede de la cuota (la que define el precio) es la de las clases del alumno: un alumno tiene
  su horario fijo en una sola sede (0019).
- **[SUPUESTO]** Permisos `abonos.ver`, `abonos.gestionar` y `abonos.asignar`.
- Renovar los ciclos que terminan, y el aviso de pago ese día, con una tarea del worker (falta
  el actor de sistema, ver `docs/pendientes.md`).
- El profe ve si un alumno pagó, pero no tendría que ver el total adeudado (`adeudado`, 0019).
