# 0003 — Arquitectura hexagonal por niveles

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Las reglas de negocio (cupos, recuperaciones, abonos, cobros) tienen que poder probarse aisladas, y hay integraciones externas que van a cambiar o sumarse (WhatsApp, huella, cámaras). Pero aplicar hexagonal completa a módulos que solo dan altas, bajas y modificaciones es ceremonia pura, y los agentes tienden a crear interfaces para todo.

## Decisión

Dos niveles según el módulo:

| Nivel        | Capas                                                     | Módulos                                                                   |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Completo** | `dominio/` · `aplicacion/` · `infraestructura/` · `http/` | agenda, asistencia, abonos, caja, mensajeria                              |
| **Liviano**  | `datos/` · `http/`                                        | personas, centros, reportes y los que sean principalmente ABM o consultas |

- `dominio/`: reglas puras, sin base ni HTTP. Solo importa `@app/nucleo`.
- `aplicacion/`: casos de uso; declara en `puertos.ts` lo que necesita.
- `infraestructura/`: adaptadores (Drizzle, WhatsApp, dispositivos).
- `modulo.ts`: conecta adaptadores con puertos **a mano**, verificado por el compilador.
- `index.ts`: la API pública del módulo, lo único que pueden usar los demás.
- **Regla de puertos:** solo para lo que sale del proceso o no es determinista: base de datos, WhatsApp, cola, reloj, dispositivos. El resto es código directo, sin interfaces.
- Los módulos se comunican por su `index.ts` o por **eventos** (ej. `caja` emite `PagoRegistrado` para lo que pasa después, como avisar por WhatsApp). Lo que tiene que quedar en la misma transacción va por el `index.ts`: `caja` marca la cuota pagada con `registrarPago` de `abonos` al cobrar, así no hay un momento con el pago hecho y la cuota impaga. Los efectos externos van por una cola persistente (outbox) con reintentos.
- `dependency-cruiser` en el CI controla la dirección de las dependencias entre capas y módulos, y que no haya ciclos.

## Consecuencias

- Biometría y cámaras entran como **adaptadores nuevos** del puerto de registro de asistencia; el dominio no cambia.
- La mayoría de los tests son unitarios de dominio, rápidos y sin base.
