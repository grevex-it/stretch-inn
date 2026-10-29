# 0008 — Acceso de soporte de GREVEX

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

GREVEX da de alta los centros, arma los roles a medida y da soporte. Para eso necesita entrar a los centros de los clientes: es la única puerta que cruza entre centros.

## Decisión

- **Cuentas de GREVEX separadas** de las de los centros. Un operador de GREVEX no es un usuario de ningún centro.
- **Consola de plataforma** para dar de alta centros, gestionar licencias y ver los clientes.
- Para operar dentro de un centro, el operador **entra como soporte a un centro por vez**, con una sesión que vence sola. Adentro usa el mismo `ContextoCentro` y el mismo RLS que cualquier usuario: **ningún acceso saltea RLS**.
- **El centro no ve los accesos de GREVEX.** En la auditoría del centro, los cambios que hace soporte figuran como autor **«Sistema»**.
- **Registro interno de GREVEX:** todo lo que hace soporte (quién, en qué centro, qué hizo y cuándo) se guarda en una auditoría de la plataforma que el centro no ve. Protege a GREVEX ante reclamos.

## Consecuencias

- El contrato de licencia tiene que incluir una cláusula que autorice a GREVEX a acceder a los datos para dar soporte (datos personales de alumnos, Ley 25.326). Pendiente: ver `docs/pendientes.md`.
