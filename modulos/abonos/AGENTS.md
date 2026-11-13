# Módulo abonos

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Los planes del centro (nombre, clases del paquete y precio general), su precio opcional por sede
(0011), y las cuotas de cada alumno: un paquete de clases (0020), con el monto y las clases
congelados al generarla. Cada fecha del horario fijo del alumno gasta una clase.

## Fuera de alcance

- Cobrar: `caja`, que marca la cuota pagada con `registrarPago`.
- Los datos de cada alumno: `personas` (se leen por su `index.ts`).
- La zona horaria del centro: `centros`.
- El horario fijo del alumno y sus fechas: `agenda` (se leen por su `index.ts`).
- Descuentos, recargos por mora y prorrateos: cuando un centro los pida (0011).

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/centros` (zona horaria, para el día de hoy en el centro)
- `@app/personas` (si el alumno existe y está activo)
- `@app/agenda` (las fechas del horario fijo del alumno, `fechasDeAlumno`)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearAbonos(base, { ahora? })`: devuelve `Abonos`. Cada operación recibe el `ContextoCentro`
  de quien la pide y corre en su propia transacción:
  - `planes(quien, { pagina, porPagina })`: los planes del centro, por nombre, con los precios
    propios de las sedes que se ven.
  - `crearPlan(quien, { nombre, clases, precio })`, `editarPlan` (con `id` y
    `version`) y `fijarActivo(quien, { id, activo })`.
  - `fijarPrecioDeSede(quien, { planId, sedeId, precio })`: con `precio: null`, la sede vuelve
    al general.
  - `generarCuota(quien, { alumnoId, planId, sedeId, desde? })`: un paquete de las clases del
    plan desde `desde` (AAAA-MM-DD). Sin `desde`, empieza el día después de la última clase de su
    abono anterior; si no tiene, o ese abono no tiene todas sus fechas (sin horario fijo), hoy en
    el centro. Devuelve `{ id, monto, desde, clases }`. No puede empezar antes de que termine su
    abono anterior (`ya-tiene-cuota`).
  - `anularCuota(quien, { id })` y `cuotasDeAlumno(quien, { alumnoId, pagina, porPagina })`.
  - `abonoDelAlumno(quien, { alumnoId, sedeId })`: el abono que empezó más tarde hasta hoy en la
    sede (`{ cuotaId, desde, clases, usadas, restantes, fin, pagada }`), aunque ya haya usado
    todas sus clases; null si no tiene. Cada fecha del horario fijo que ya terminó cuenta como
    usada. `fin` es null si no le alcanzan las fechas. Sin montos: lo ve también el profe.
  - `cuotasImpagas(quien, { sedeId, pagina, porPagina })`: las impagas de la sede, la más vieja
    primero, con el nombre del alumno y `adeudado` (lo que suman todas, no solo la página).
- Para otros módulos (`caja`, `asistencia`), con la `Transaccion` de `enContexto`:
  - `obtenerCuota(tx, id)`: la cuota vigente, o undefined.
  - `registrarPago(tx, { cuotaId, pagoId, en })`: la marca pagada una sola vez (la toma con
    `for update`). Falla con `cuota-inexistente` o `cuota-pagada`.
  - `revertirPago(tx, { cuotaId, pagoId })`: si ese pago la saldó, la cuota vuelve a estar sin
    pagar (caja anuló el pago).
  - `abonoVigente(tx, { alumnoId, sedeId, en })`: el abono del alumno en esa sede que está
    vigente en ese momento (`{ cuotaId, inicio, fin, clases }`: `inicio`, la medianoche del día
    en que empieza; `fin`, el final de su última clase), o undefined si no tiene o no le alcanzan
    las fechas del horario fijo. La API se lo pasa a `asistencia` (0020).
- `rutasDeAbonos(abonos)`: `GET /abonos/planes`, `GET /abonos/cuotas/impagas?sede&pagina`,
  `GET /alumnos/:id/cuotas` y `GET /alumnos/:id/abono?sede` (`abonos.ver`);
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
- **Una cuota es un paquete de clases** (0020): cada fecha del horario fijo del alumno en la sede
  desde `desde` gasta una, venga o falte. Las fechas canceladas no gastan. Termina con su última
  clase.
- **Los abonos de un alumno no se pisan**, en ninguna sede: generar toma un bloqueo por alumno
  hasta el fin de la transacción y no deja empezar uno antes de la última clase del anterior; el
  índice único parcial (alumno, desde) es la última barrera.
- El monto y las clases se congelan al generarla: cambiar el plan después no toca las cuotas ya
  generadas.
- Anular una cuota no la borra, y solo se anula si no está pagada. Una cuota no está pagada y
  anulada a la vez (restricción en la base).
- Toda edición de un plan compara la `version` (0013). La baja de un plan no lo borra: deja de
  poder asignarse.
- Solo se genera la cuota de un alumno activo, con un plan activo.

## Glosario

- **Plan (abono):** lo que contrata el alumno («Abono de 4 clases, $30.000»; «Clase suelta,
  1 clase»).
- **Precio de sede:** el precio propio de un plan en una sede.
- **Cuota:** lo que el alumno paga por un paquete de clases de su plan, desde un día.

## Configuración por centro

_Ninguna por ahora._ Los precios por sede son datos, no configuración.

## Pendientes

- El alumno de viaje (media cuota) (0019, por confirmar en 0020).
- Borrar las columnas en desuso `planes.clases_por_semana` y `cuotas.hasta` (dos pasos,
  `db/AGENTS.md`).
- La sede de la cuota (la que define el precio) es la de las clases del alumno: un alumno tiene
  su horario fijo en una sola sede (0019).
- **[SUPUESTO]** Permisos `abonos.ver`, `abonos.gestionar` y `abonos.asignar`.
- Renovar los abonos que terminaron, y el aviso de pago cuando se usa la última clase, con una
  tarea del worker (0020). Hace falta el actor de sistema y una consulta de `agenda` para muchos
  alumnos a la vez; la renovación por calendario de 0019 se sacó.
- El profe ve si un alumno pagó, pero no tendría que ver el total adeudado (`adeudado`, 0019).
