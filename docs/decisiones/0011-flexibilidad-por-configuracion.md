# 0011 — Flexibilidad por configuración, no por código

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

No sabemos todavía cómo opera cada centro: si un alumno va a varias sedes, si los precios son por sede, cómo son las recuperaciones. El producto tiene que servir a centros que trabajan distinto sin escribir reglas especiales por cliente.

## Decisión

- La flexibilidad vive **en los datos y la configuración de cada centro**, con valores por defecto razonables. Nunca en código específico de un cliente.
- **Alumnos:** pertenecen al **centro**, no a una sede. Sus inscripciones son las que tienen sede. Configuración `recuperarEnOtraSede` (por defecto: no).
- **Planes y precios:** se definen a nivel centro, con **precio opcional por sede**; sin precio propio, la sede usa el general.
- **Roles:** configurables (ver 0007).
- **Límite:** cada opción de configuración nueva se agrega cuando un centro real la necesita. No se agregan opciones «por si acaso».
