# 0014 — Portal de alumnos con funcionamiento sin conexión

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

Los alumnos usan el portal desde el celular, muchas veces dentro del centro y con poca señal.

## Decisión

El portal es una PWA que funciona de forma limitada sin conexión:

| Acción                            | Sin conexión                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Ver abono, asistencias y horarios | Sí: muestra los últimos datos guardados, con la hora de la última actualización |
| Avisar una ausencia               | Sí: queda en cola y se envía sola al volver la conexión                         |
| Reservar una recuperación         | No: el cupo se decide en el momento, en el servidor                             |

- **Para un aviso de ausencia vale la hora en que lo recibe el servidor, no la del celular** (la del celular se puede adulterar). El portal lo aclara: «Sin conexión: tu aviso se va a enviar cuando vuelvas a tener señal».
- Los avisos en cola llevan clave de idempotencia (ver 0013): si se reenvían, no se duplican.
- Técnica: service worker para la app, datos de TanStack Query persistidos en el dispositivo y cola de envíos pendientes.
