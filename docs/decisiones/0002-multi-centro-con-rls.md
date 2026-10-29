# 0002 — Varios centros en una base compartida, aislados con RLS

**Fecha:** 29/10/2026 · **Estado:** aceptada

## Contexto

El sistema sirve a muchos centros. Que un centro vea datos de otro es el error más grave posible. Dentro de un centro, además, cada usuario ve solo las sedes que le corresponden.

## Decisión

- **Base Postgres compartida**, con `centro_id` en cada fila y **Row Level Security** como segunda barrera.
- Jerarquía: **Centro → Sedes → todo lo demás**. Los datos que pertenecen a una sede llevan también `sede_id`.
- Dos barreras:
  1. **Aplicación:** todo caso de uso recibe un `ContextoCentro` explícito (centro, usuario, permisos por sede) y filtra con él.
  2. **Base de datos:** cada transacción fija el contexto con `SET LOCAL` (`app.centro_id` y sedes visibles) y las políticas RLS bloquean cualquier fila ajena aunque el código tenga un bug.
- **Falla cerrada:** sin contexto fijado, las políticas no devuelven filas.
- Toda tabla con datos de un centro: `enable row level security` y `force row level security`, con políticas basadas en funciones comunes de la plataforma (`app_centro_actual()`, `app_puede_ver_sede(sede_id)`). Nadie escribe condiciones de aislamiento propias.
- **Roles de base:** la app se conecta con `app_usuario`, sin superusuario y **sin `BYPASSRLS`**. Las migraciones corren con el dueño del esquema; la app nunca usa esa conexión.
- RLS controla **qué sedes** ve el usuario (las sedes donde tiene algún permiso). La aplicación controla **qué acciones** puede hacer en cada una (ver 0007).
- Ningún acceso saltea RLS, tampoco el de soporte de GREVEX (ver 0008).

## Consecuencias

- **Trampa conocida:** el usuario por defecto del Postgres de Railway es superusuario y un superusuario ignora RLS. Si la app se conecta con él, el aislamiento parece funcionar y no protege nada.
- Test de aislamiento obligatorio: recorre **todas** las tablas con `centro_id` y falla si alguna no tiene RLS o si un centro (o un usuario sin permiso en una sede) puede leer datos ajenos. Las tablas nuevas quedan cubiertas sin agregarlas a mano.

## Alternativas descartadas

- **Una base por centro:** aislamiento total, pero caro y difícil de operar con muchos clientes.
- **Un schema por centro:** las migraciones se vuelven inmanejables con decenas de centros.
