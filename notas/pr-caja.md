Módulo nuevo **`caja`**: cobrar cuotas con clave de idempotencia, anular pagos y el día de caja.

**Apilado sobre `abonos`**, que suma `revertirPago` en un commit propio.

## Qué hace

- **Cobrar una cuota:** se cobra completa y se marca pagada en `abonos`, en la misma transacción.
  - Si la cuota no se puede marcar (otro cobro la pagó recién), el pago se deshace con un punto de guardado. O quedan los dos, o ninguno.
- **Idempotencia (regla 7):** la clave es única por centro en la base.
  - El mismo cobro repetido (doble clic o reintento) devuelve el pago que ya se hizo, con `repetido: true` y HTTP 200.
  - La misma clave usada en otra cuota se rechaza.
- **Anular un pago:**
  - pide un motivo y guarda quién y cuándo;
  - no borra el pago;
  - deja la cuota sin pagar (`revertirPago` de `abonos`).
- **Día de caja:** los pagos de un día en una sede, de medianoche a medianoche en la zona del centro, con lo cobrado sin contar los anulados.
- **Rutas:**
  - `POST /caja/cobros` pide `caja.cobrar`;
  - `POST /caja/pagos/:id/anulacion` pide `caja.anular`;
  - `GET /caja/pagos?sede&dia&pagina` pide `caja.ver`.
- **Base:** tabla `pagos` con RLS por centro y sede. Los permisos se dan al Dueño y se suman al catálogo.

## Decisiones para revisar

- **El pago marca la cuota en la misma transacción**, llamando al `index.ts` de `abonos`. No usa el evento `PagoRegistrado` del ejemplo de la 0003. Hoy no existe `apps/worker`, y así el cobro y la cuota pagada quedan atómicos. Publicar `PagoRegistrado` por la cola queda pendiente para cuando haya quien lo escuche.
- **[SUPUESTO]** Los medios de pago son efectivo, transferencia, débito, crédito y Mercado Pago.
- **[SUPUESTO]** No hay pagos parciales: se cobra la cuota completa.
- **[SUPUESTO]** Un pago se puede anular en cualquier momento, con motivo. No hay cierre de caja.

## Cómo se probó

- Test primero en dominio, casos de uso y contrato, visto fallar antes de implementar. En las rutas, el test falló solo porque faltaba el export.
- Dominio sin base: los medios, la clave, el motivo y el día de caja en la zona del centro.
- Integración contra Postgres real:
  - cobrar una vez y con la misma clave;
  - **el doble clic: el mismo cobro dos veces a la vez deja un solo pago**;
  - medio inválido, clave corta y clave de otra cuota;
  - anular, el día de caja y permisos por sede.
- Rutas: el permiso declarado y los códigos 201, 200, 204, 400 y 409.
- En verde: caja 13, abonos 20, api, herramientas, contratos y web. En db pasan 25 de 26; `salida.test` lo cubre el CI.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
