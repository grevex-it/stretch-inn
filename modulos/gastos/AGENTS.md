# Módulo gastos

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Los gastos de cada sede (0022): cargarlos sin cargar dos veces (clave de idempotencia, regla 7),
anularlos con un motivo y verlos por período, con lo gastado. Lo que sale de la sede, no lo que
entra.

## Fuera de alcance

- Lo que entra (cobros de cuotas): `caja`.
- El pago a los profes por clase dictada: cuando exista el módulo de profesores (0022). Hoy se
  carga como un gasto de categoría `sueldos`.
- Reportes y el consolidado de varias sedes: el módulo de reportes.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/contratos` (rutas HTTP)

## API pública

- `crearGastos(base, { ahora? })`: devuelve `Gastos`. Cada operación recibe el `ContextoCentro`
  de quien la pide y corre en su propia transacción:
  - `cargar(quien, { sedeId, fecha, monto, categoria, medio, descripcion, claveIdempotencia })`:
    devuelve `{ id, repetido }`. El mismo pedido con la misma clave devuelve el gasto que ya se
    cargó; la clave en otro gasto falla con `clave-usada`.
  - `anular(quien, { id, motivo })`: no lo borra.
  - `delPeriodo(quien, { sedeId, desde, hasta, pagina, porPagina })`: los de la sede entre dos
    días (inclusive), el más nuevo primero, y `gastado` (sin los anulados).
- `rutasDeGastos(gastos)`: `POST /gastos` (`gastos.cargar`; 201, o 200 si se repite),
  `POST /gastos/:id/anulacion` (`gastos.anular`) y `GET /gastos?sede&desde&hasta&pagina`
  (`gastos.ver`).
- `PERMISOS_GASTOS`: la sección «Gastos» del catálogo (`gastos.ver`, `gastos.cargar`,
  `gastos.anular`).
- `CATEGORIAS` y `MEDIOS_DE_GASTO`.

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- **Montos en pesos enteros** (`Dinero`, `bigint`): mayores que cero y con un tope de
  $100.000.000 para frenar un cero de más.
- Cada gasto es de **una sede**: RLS aísla por centro y sedes visibles, y cada permiso se
  controla en la sede del gasto (0007). El encargado de una sede carga y ve solo los suyos.
- **Un gasto no se carga dos veces:** la clave de idempotencia es única por centro (índice único,
  la última barrera).
- La fecha es el día del gasto en la zona del centro (`date`), y no puede ser posterior a mañana.
- Anular no borra: marca `anulado_en` con el motivo y quién lo anuló (restricción en la base: sin
  motivo no hay anulación).
- Cada gasto guarda quién lo cargó (usuario o soporte) y cuándo.

## Glosario

- **Gasto:** plata que sale de la sede (alquiler, luz, insumos, sueldos…).
- **Lo gastado:** la suma de los gastos de un período, sin los anulados.

## Configuración por centro

_Ninguna por ahora._

## Pendientes

- **[SUPUESTO]** Las categorías (alquiler, servicios, sueldos, insumos, mantenimiento, impuestos y
  otros) y los medios (efectivo y transferencia). Si un centro pide otras, pasan a ser
  configuración (0011). Están repetidas en `@app/contratos`: un test controla que coincidan.
- **[SUPUESTO]** Permisos `gastos.ver`, `gastos.cargar` y `gastos.anular`.
