# Módulo abonos

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Los planes del centro (nombre, clases por semana y precio general), su precio opcional por sede
(0011), y la cuota mensual de cada alumno con el monto congelado al generarla.

## Fuera de alcance

- Cobrar: `caja`, que marca la cuota pagada con `registrarPago`.
- Los datos de cada alumno: `personas` (se leen por su `index.ts`).
- La zona horaria del centro: `centros`.
- Descuentos, recargos por mora y prorrateos: cuando un centro los pida (0011).

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/centros` (zona horaria, para el mes actual)
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
  - `generarCuota(quien, { alumnoId, planId, sedeId, periodo? })`: sin período, el mes actual
    del centro. Devuelve `{ id, monto, periodo }`.
  - `anularCuota(quien, { id })` y `cuotasDeAlumno(quien, { alumnoId, pagina, porPagina })`.
- Para otros módulos (`caja`), con la `Transaccion` de `enContexto`:
  - `obtenerCuota(tx, id)`: la cuota vigente, o undefined.
  - `registrarPago(tx, { cuotaId, pagoId, en })`: la marca pagada una sola vez (la toma con
    `for update`). Falla con `cuota-inexistente` o `cuota-pagada`.
  - `revertirPago(tx, { cuotaId, pagoId })`: si ese pago la saldó, la cuota vuelve a estar sin
    pagar (caja anuló el pago).
- `rutasDeAbonos(abonos)`: `GET /abonos/planes` y `GET /alumnos/:id/cuotas` (`abonos.ver`);
  `POST /abonos/planes`, `PUT /abonos/planes/:id`, `PUT`/`DELETE /abonos/planes/:id/baja` y
  `PUT`/`DELETE /abonos/planes/:id/sedes/:sedeId/precio` (`abonos.gestionar`);
  `POST /abonos/cuotas` y `DELETE /abonos/cuotas/:id` (`abonos.asignar`).
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
- Una cuota vigente por alumno y mes (índice único parcial). El monto se congela al generarla:
  cambiar el precio después no toca las cuotas ya generadas.
- Anular una cuota no la borra, y solo se anula si no está pagada. Una cuota no está pagada y
  anulada a la vez (restricción en la base).
- Toda edición de un plan compara la `version` (0013). La baja de un plan no lo borra: deja de
  poder asignarse.
- Solo se genera la cuota de un alumno activo, con un plan activo.

## Glosario

- **Plan (abono):** lo que contrata el alumno («Dos por semana, $30.000»).
- **Precio de sede:** el precio propio de un plan en una sede.
- **Cuota:** lo que el alumno paga por un mes de su plan.
- **Período:** el mes de la cuota, AAAA-MM, en la zona del centro.

## Configuración por centro

_Ninguna por ahora._ Los precios por sede son datos, no configuración.

## Pendientes

- **[SUPUESTO]** El abono es mensual, por mes calendario del centro, con una cuota por alumno y
  mes. Confirmar con Stretch Inn si es por paquete de clases o desde la fecha de alta.
- **[SUPUESTO]** La sede de la cuota (la que define el precio) es la de las clases del alumno.
- **[SUPUESTO]** Permisos `abonos.ver`, `abonos.gestionar` y `abonos.asignar`.
- Que asistencia consulte si el alumno está al día antes de tomar o reservar.
- Redondeo de precios a $10 o $100, si Stretch Inn lo usa (configuración por centro, 0009).
- Generar las cuotas del mes de todos los alumnos con una tarea del worker, cuando exista.
