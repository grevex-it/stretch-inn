# 0021 — WhatsApp con WAHA

**Fecha:** 13/11/2026 · **Estado:** aceptada · Reemplaza a 0012.

## Contexto

0012 eligió la API oficial de Meta. La cotización a Stretch Inn del 12/11 se vendió con WAHA
(WhatsApp HTTP API): un servidor que maneja una sesión de WhatsApp Web, con un solo número. El
equipo lo confirmó el 13/11.

## Decisión

- **WhatsApp por WAHA**, con un número por centro.
- WhatsApp sigue siendo un adaptador del módulo `mensajeria` (0003): si más adelante conviene la
  API de Meta, se cambia el adaptador y no los módulos que mandan mensajes.
- Los envíos pasan por la cola persistente con reintentos (0003) y con un ritmo de envío
  limitado: pocos mensajes por minuto, sin ráfagas.

## Consecuencias

- **Riesgo de bloqueo del número:** WAHA no es oficial, y WhatsApp puede bloquear un número que
  manda mucho o recibe denuncias. Por eso los mensajes son de servicio (aviso de pago, clase
  cancelada, recuperación) y no campañas masivas, y el ritmo de envío es bajo.
- No hay plantillas que apruebe Meta ni costo por mensaje. Sí hay que alojar y mantener el
  servidor de WAHA, y volver a vincular el número si se cae la sesión.
- Se cae el trámite de Tech Provider de Meta.
- Los datos de los alumnos pasan por el servidor de WAHA: va en la infraestructura de GREVEX, no
  en un servicio de terceros.
