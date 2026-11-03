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
- Todo cambio de permisos queda en `auditoria`.

## Glosario

- **Cuenta:** la persona, con email y contraseña. Es de la plataforma.
- **Usuario:** la membresía de una cuenta en un centro.
- **Rol:** conjunto de permisos. Las plantillas del sistema se copian al centro en el alta.
- **Ajuste:** permiso extra o quitado a un usuario en una sede.
- **Acceso total:** todos los permisos del catálogo en todas las sedes del centro.

## Configuración por centro

_Ninguna por ahora._

## Pendientes

- Plantillas de encargado, recepción y profesor: cuando existan los permisos de caja, agenda y
  asistencia.
- Login, sesiones, alta de usuarios y reset de contraseña (0017).
- Avisar a `auditoria` de cada cambio de permisos, cuando exista ese módulo.
- «Acceso total» exige todos los permisos en todas las sedes: al crear una sede nueva, el alta
  tiene que darle permisos al admin general en ella.
