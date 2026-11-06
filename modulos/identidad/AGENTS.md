# Módulo identidad

Nivel: completo (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Quién es cada persona y qué puede hacer: cuentas y usuarios por centro, login y sesiones
(0017), catálogo de permisos, roles, roles por sede, ajustes individuales por sede y el cálculo
de los permisos efectivos (0007).

## Fuera de alcance

- Centros y sedes: `centros`.
- El historial de cambios de permisos que ve el centro: `auditoria` (este módulo le avisa).
- Qué módulos contrató el centro: `licencias` (filtra el catálogo, 0007 regla 5).

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/contratos` (rutas HTTP)

## API pública

Dominio (puro):

- `permisosEfectivos(asignaciones, ajustes)`: roles de cada sede + extras − quitados.
- `faltantesParaOtorgar(quien, sedeId, permisos)` y `faltantesEnAlgunaSede(quien, permisos)`:
  lo que `quien` no puede dar.
- `tieneMenosPermisos(objetivo, quien)`: para resetear contraseñas (0017).
- `tieneAccesoTotal(efectivos, catalogo, sedes)`.
- `crearCatalogo(secciones)`, `PERMISOS_IDENTIDAD`, `plantillasDelSistema(catalogo)`.

Casos de uso (reciben la `Transaccion` de `enContexto`):

- `cargarPermisos(tx, cuentaId, centroId)`: permisos efectivos, para armar el `ContextoCentro`.
- `crearRol(tx, quien, { nombre, permisos })`.
- `asignarRol(tx, quien, { usuarioId, sedeId, rolId })`.
- `quitarAsignacion(tx, asignacion, catalogo)` y `ajustarPermiso(tx, quien, ajuste, catalogo)`:
  si el centro se quedaría sin nadie con acceso total, devuelven falla y no cambian nada.

Login y sesiones (0017):

- `crearAcceso(base, { ahora?, limite? })`: una instancia por proceso, porque el límite de
  intentos vive en su memoria. Devuelve `Acceso`: `entrar`, `resolver(token)` (la sesión con su
  `ContextoCentro` ya limitado a la sede activa), `centros`, `sedes` (las del selector, con
  nombre), `elegirCentro`, `elegirSede`,
  `salir` y `cambiarClave`.
- `rutasDeSesion(acceso)`: plugin de Fastify con `POST/GET/DELETE /sesion` y
  `PUT /sesion/centro`, `/sesion/sede` y `/sesion/clave`. La API resuelve la sesión antes
  (`apps/api/src/base/sesion.ts`).

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- Permisos efectivos = roles de cada sede + extras − quitados. Si un permiso es extra y quitado
  en la misma sede, gana el quitado.
- Los ajustes son por sede (0017).
- Nadie da permisos que no tiene: en una asignación, en esa sede; en un rol, en alguna sede.
- Siempre queda al menos un usuario con acceso total en el centro.
- Solo se resetea la contraseña de quien tiene menos permisos (subconjunto en cada sede y al
  menos uno menos), y nunca la de una cuenta con usuarios en otros centros (0017).
- Los permisos se calculan en cada pedido; no se guardan en la sesión.
- En la base se guarda solo el hash del token de sesión. La sesión vence a las 12 horas sin uso
  y siempre a los 7 días; salir y cambiar la clave la revocan.
- Ante cualquier falla del login, la misma respuesta: «Email o contraseña incorrectos». Con un
  email que no existe se verifica igual contra un hash de relleno, para que tarde lo mismo.
- Con una sede activa, el contexto lleva solo esa sede: RLS no le muestra las demás.
- Todo cambio de permisos queda en `auditoria`.

## Glosario

- **Cuenta:** la persona, con email y contraseña. Es de la plataforma.
- **Usuario:** la membresía de una cuenta en un centro.
- **Rol:** conjunto de permisos. Las plantillas del sistema se copian al centro en el alta.
- **Ajuste:** permiso extra o quitado a un usuario en una sede.
- **Acceso total:** todos los permisos del catálogo en todas las sedes del centro.
- **Sede activa:** la sede con la que trabaja la sesión, o «Todas mis sedes».
- **Clave temporal:** la que genera un reset; hasta cambiarla solo se puede ver la sesión,
  cambiar la clave o salir.

## Configuración por centro

_Ninguna por ahora._

## Pendientes

- Plantillas de encargado, recepción y profesor: cuando existan los permisos de caja, agenda y
  asistencia.
- Alta de usuarios y reset de contraseña (0017).
- Bloquear un usuario tiene que revocar sus sesiones en ese centro (0017).
- Login de operadores de soporte y sesión fijada a un centro por 2 horas (0008).
- Limpiar las sesiones vencidas o revocadas viejas: tarea del worker cuando exista.
- Avisar a `auditoria` de cada cambio de permisos, cuando exista ese módulo.
- «Acceso total» exige todos los permisos en todas las sedes: al crear una sede nueva, el alta
  tiene que darle permisos al admin general en ella.
