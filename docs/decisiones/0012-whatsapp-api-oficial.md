# 0012 — WhatsApp con la API oficial de Meta

**Fecha:** 29/10/2026 · **Estado:** reemplazada por 0021

## Contexto

El módulo de mensajería hace campañas masivas y mensajes automáticos. Las conexiones no oficiales (WhatsApp Web automatizado) arriesgan el bloqueo del número cuando se envía en volumen.

## Decisión

- **API oficial de WhatsApp (Cloud API de Meta).**
- **Cada centro conecta su propio número** mediante el registro integrado de Meta (Embedded Signup). Para eso GREVEX se registra como **Tech Provider** de Meta.
- WhatsApp es un adaptador del módulo `mensajeria` (ver 0003): si cambia el proveedor, se reemplaza el adaptador.
- Los envíos pasan por la cola persistente con reintentos.

## Consecuencias

- Las plantillas de mensajes las tiene que aprobar Meta antes de usarse.
- **Meta cobra por mensaje de plantilla.** Ese costo es aparte de la licencia y lo tiene que pagar el centro; hay que dejarlo claro comercialmente.
- El registro como Tech Provider tarda: conviene arrancarlo antes de construir el módulo.
