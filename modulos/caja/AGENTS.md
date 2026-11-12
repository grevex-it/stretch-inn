# Módulo caja

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Cobrar las cuotas de los alumnos sin cobrar dos veces (regla 7), anular un pago con su motivo y
el día de caja de cada sede con lo cobrado.

## Fuera de alcance

- Qué se cobra y cuánto: la cuota y su monto son de `abonos`.
- Facturación electrónica (AFIP/ARCA), cobros online y conciliación bancaria.
- Gastos y movimientos que no son cobros de cuotas.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/abonos` (la cuota, y marcarla pagada o sin pagar, en la misma transacción)
- `@app/centros` (zona horaria, para el día de caja)
- `@app/contratos` (rutas HTTP)

## API pública

- `crearCaja(base, { ahora?, cola? })`: devuelve `Caja`. Cada operación recibe el `ContextoCentro` de
  quien la pide y corre en su propia transacción:
  - `cobrarCuota(quien, { cuotaId, medio, claveIdempotencia })`: cobra la cuota completa y la
    marca pagada. Devuelve `{ id, monto, repetido }`: con la misma clave, el mismo pago.
  - `anular(quien, { id, motivo })`: la cuota vuelve a estar sin pagar.
  - `delDia(quien, { sedeId, dia, pagina, porPagina })`: los pagos de ese día (zona del centro)
    en la sede, el más nuevo primero, y `cobrado` (sin los anulados).
- `rutasDeCaja(caja)`: `POST /caja/cobros` (`caja.cobrar`; 201, o 200 si se repite),
  `POST /caja/pagos/:id/anulacion` (`caja.anular`) y `GET /caja/pagos?sede&dia&pagina`
  (`caja.ver`).
- `PERMISOS_CAJA`: la sección «Caja» del catálogo (`caja.ver`, `caja.cobrar`, `caja.anular`).
- `MEDIOS`: los medios de pago.

## Eventos

- Emite: `PagoRegistrado` (`EVENTO_PAGO_REGISTRADO = "caja.pago-registrado"`), con el pago,
  el centro, la sede, el alumno, la cuota, el monto, el medio y `registradoEn` (ISO). Se encola
  en la misma transacción del cobro (outbox, 0003) con el id del pago como clave de
  idempotencia: un pago, un evento. Lo procesa `apps/worker`.
- Escucha: _ninguno_.

## Invariantes

- **Toda operación que mueve dinero lleva clave de idempotencia** (regla 7): única por centro
  en la base. El mismo cobro repetido (doble clic, reintento) devuelve el pago que ya se hizo; la
  misma clave en otra cuota se rechaza.
- El pago y la cuota pagada van juntos: si la cuota no se puede marcar (otro cobro la pagó
  recién), el pago se deshace (punto de guardado). `registrarPago` de abonos toma la cuota con
  `for update`.
- **Montos en pesos enteros** (`bigint`), mayores que cero. El monto es el de la cuota: no hay
  pagos parciales.
- Cada pago es de la sede de su cuota: RLS por centro y sedes visibles, y el permiso se controla
  en esa sede.
- Anular no borra: guarda quién, cuándo y por qué (el motivo es obligatorio), y la cuota vuelve
  a estar sin pagar. Un pago anulado no se anula de nuevo.
- El día de caja va de medianoche a medianoche en la zona del centro.
- Medios de pago: efectivo y transferencia (0019); restricción en la base.

## Glosario

- **Cobro:** registrar que el alumno pagó una cuota.
- **Pago:** el registro del cobro, con su medio.
- **Clave de idempotencia:** el identificador de un intento de cobro, que arma el panel.
- **Día de caja:** los pagos de un día en una sede.

## Configuración por centro

_Ninguna por ahora._

## Pendientes

- **[SUPUESTO]** Se cobra la cuota completa; sin pagos parciales, recargos ni descuentos.
- **[SUPUESTO]** Un pago se puede anular en cualquier momento, con motivo. Si Stretch Inn
  quiere cerrar la caja del día, va como regla nueva.
- La cuota se marca pagada en la misma transacción del cobro (por el `index.ts` de abonos), no
  por el evento: así el pago y la cuota quedan juntos o ninguno. El evento queda para los que
  escuchen después (mensajería, reportes). **[REVISAR]** con Pedro.
- Sin `cola` en `crearCaja` no se publica el evento: solo para tests. La API siempre la pasa.
- Cierre de caja y arqueo por medio de pago.
