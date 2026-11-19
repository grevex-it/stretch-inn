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
- `@app/centros` (la zona horaria del centro activo, para la sesión)
- `@app/contratos` (rutas HTTP)

## API pública

Dominio (puro):

- `permisosEfectivos(asignaciones, ajustes)`: roles de cada sede + extras − quitados.
- `faltantesParaOtorgar(quien, sedeId, permisos)` y `faltantesEnAlgunaSede(quien, permisos)`:
  lo que `quien` no puede dar.
- `tieneMenosPermisos(objetivo, quien)`: para resetear contraseñas (0017).
- `tieneAccesoTotal(efectivos, catalogo, sedes)`.
- `crearCatalogo(secciones)` y `PERMISOS_IDENTIDAD`.
- `plantillasDelSistema(catalogo)`: Dueño (todo el catálogo), Encargado, Profesor, Recepción y
  Contaduría (`dominio/plantillas.ts`, lo acordado en 0019). Cada una trae su marca (`dueno`,
  `encargado`, `profesor`, `recepcion`, `contadora`), que se guarda en `roles.plantilla` al
  copiarla, y solo los permisos que están en el catálogo que recibe.

Para migraciones (SQL, con el dueño del esquema):

- `identidad_dar_al_dueno(array['modulo.accion', …])`: le da esos permisos al rol Dueño de
  **todos** los centros. Todo módulo que declara permisos la llama en una migración `--custom`;
  `herramientas/test/permisos-del-dueno.test.ts` falla si falta algún permiso del catálogo.
- `identidad_dar_a_plantilla('profesor', array[…])`: lo mismo con el rol de otra plantilla. Si
  un módulo le suma permisos a una plantilla en `plantillasDelSistema`, se los da también por
  migración; `herramientas/test/plantillas.test.ts` falla si el código y las migraciones no dan
  lo mismo.
- `identidad_sumar_plantilla('profesor', 'Profesor')`: crea el rol de la plantilla en los centros
  que no lo tienen (un centro con un rol propio de ese nombre no la recibe). Para una plantilla
  nueva.

Casos de uso (reciben la `Transaccion` de `enContexto`):

- `cargarPermisos(tx, cuentaId, centroId)`: permisos efectivos, para armar el `ContextoCentro`.
- `identidad_asignaciones_del_rol(rol)` (SQL, alcance mínimo): quiénes tienen un rol, en todas
  las sedes del centro.
- `identidad_es_protegido(usuario)` (SQL, alcance mínimo): si tiene el Dueño o la Contaduría en
  alguna sede del centro.

Roles a medida y permisos de cada integrante (0007):

- `crearRoles(base, { catalogo })`: devuelve `Roles`, con `catalogo`, `rol`, `crearRol`,
  `editarRol`, `borrarRol`, `permisosDe` (por sede y permiso: de qué roles viene, su ajuste y si
  al final lo tiene; `enOtrasSedes`, si tiene roles o ajustes en sedes fuera del contexto;
  y `esQuienConsulta`), `asignar`, `quitarAsignacion`, `ajustar` y `quitarAjuste`. Cada uno recibe
  el `ContextoCentro` de quien lo pide y corre en su transacción. Lo que puede sacar permisos se
  deshace entero si deja al centro sin nadie con acceso total. El catálogo lo arma la API
  (`apps/api/src/catalogo.ts`).
- `rutasDeRoles(roles)`: `GET /equipo/catalogo` y `GET /equipo/:id/permisos` (`usuarios.ver`);
  `GET`, `PUT` y `DELETE /equipo/roles/:id` y `POST /equipo/roles` (`roles.gestionar`);
  `POST /equipo/:id/asignaciones`, `DELETE /equipo/:id/asignaciones/:sedeId/:rolId`,
  `PUT /equipo/:id/ajustes` y `DELETE /equipo/:id/ajustes/:sedeId/:permiso`
  (`usuarios.gestionar`). `GET /equipo/roles` (en `rutasDeEquipo`) dice la plantilla de cada rol.

Para otros módulos (reciben la `Transaccion` de `enContexto`):

- `obtenerUsuarios(tx, ids)`: hasta 100 usuarios del centro en una sola consulta
  (`{ id, nombre, activo }`), para que `agenda` y `personas` muestren y validen un profe (0022).
  Los ids que no son del centro no vuelven.
- `listarUsuariosActivos(tx, { pagina, porPagina })`: los integrantes activos del centro, por
  nombre y paginados (`{ id, nombre }`), para elegir el profe de un alumno (0022). Cualquiera del
  equipo puede dar clases.

Login y sesiones (0017):

- `crearAcceso(base, { ahora?, limite? })`: una instancia por proceso, porque el límite de
  intentos vive en su memoria. Devuelve `Acceso`: `entrar`, `resolver(token)` (la sesión con su
  `ContextoCentro` ya limitado a la sede activa), `centros`, `sedes` (las del selector, con
  nombre), `zonaHoraria` (la del centro activo, leída de `centros`), `elegirCentro`,
  `elegirSede`, `salir` y `cambiarClave`.
- `rutasDeSesion(acceso)`: plugin de Fastify con `POST/GET/DELETE /sesion` y
  `PUT /sesion/centro`, `/sesion/sede` y `/sesion/clave`. La API resuelve la sesión antes
  (`apps/api/src/base/sesion.ts`).

Equipo del centro (0017):

- `crearEquipo(base, { ahora? })`: devuelve `Equipo`, con `listar` y `roles` (paginados),
  `darDeAlta`, `resetearClave`, `bloquear` y `reactivar`. Cada uno recibe el `ContextoCentro` de
  quien lo pide y corre en su propia transacción.
- `rutasDeEquipo(equipo)`: `GET /equipo` (`usuarios.ver`), `GET /equipo/roles`, `POST /equipo`,
  `POST /equipo/:id/clave` y `PUT`/`DELETE /equipo/:id/bloqueo` (`usuarios.gestionar`). Las
  respuestas con clave temporal van con `Cache-Control: no-store`.

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- Permisos efectivos = roles de cada sede + extras − quitados. Si un permiso es extra y quitado
  en la misma sede, gana el quitado.
- Los ajustes son por sede (0017).
- Nadie da permisos que no tiene: en una asignación, en esa sede; en un rol, en alguna sede.
- Siempre queda al menos un usuario con acceso total en el centro.
- El rol Dueño de cada centro (`roles.plantilla = 'dueno'`, uno por centro) tiene todos los
  permisos del catálogo, también los de módulos sumados después del alta. Se lo identifica por
  la marca, no por el nombre: el centro lo puede renombrar.
- Cada centro tiene un rol por plantilla (índice único por marca). Los roles con marca no se
  editan ni se borran: se duplican para armar uno propio (0007).
- Un rol que alguien tiene no se borra: el mensaje dice quiénes, de todas las sedes. Sumarle un
  permiso a un rol en uso pide tenerlo en cada sede donde se usa.
- Asignar o quitar un rol, o ajustar un permiso, a otro en una sede: con `usuarios.gestionar` en
  **esa** sede, nunca a uno mismo (tampoco un dueño), y nadie da lo que no tiene ahí. Solo un
  dueño (acceso total en el contexto) toca a quien tiene más permisos o permisos en otra sede;
  los dueños se cubren entre ellos. Con una sede activa, el dueño queda como cualquier otro.
- A quien tiene el Dueño o la Contaduría (por la marca, en cualquier sede) solo le asigna, quita
  o ajusta quien tiene `roles.gestionar` en la sede del cambio, aunque tenga menos permisos.
- Los permisos de un módulo nuevo llegan solos al Dueño; a las demás plantillas, solo si la
  migración del módulo se los da.
- Solo se resetea la contraseña de quien tiene menos permisos (subconjunto en cada sede y al
  menos uno menos), y nunca la de una cuenta con usuarios en otros centros (0017). Bloquear y
  reactivar siguen la misma regla de «menos permisos»; nadie se resetea ni se bloquea a sí mismo.
- La comparación de permisos usa los del objetivo en **todas** sus sedes, aunque quien gestiona
  tenga una sede activa: con la sede Norte activa no se gestiona a alguien con permisos en Sur.
- La clave temporal la genera el sistema y se muestra una sola vez. Un alta con un email que ya
  tiene cuenta la vincula, sin clave nueva. Resetear cierra todas las sesiones de la cuenta;
  bloquear, las de ese centro.
- La app no tiene permisos sobre `plataforma.cuentas`: login, alta, reset y emails del equipo
  pasan por funciones de alcance mínimo (`identidad_cuenta_por_email`, `identidad_cuenta_para_alta`,
  `identidad_resetear_clave`, `identidad_emails_de_usuarios`, …).
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
- **Rol:** conjunto de permisos. Las plantillas del sistema se copian al centro en el alta, con
  su marca en `roles.plantilla`.
- **Plantilla:** rol que viene con el sistema (Dueño, Encargado, Profesor, Recepción y
  Contaduría). No se edita; se duplica.
- **Ajuste:** permiso extra o quitado a un usuario en una sede.
- **Acceso total:** todos los permisos del catálogo en todas las sedes del centro.
- **Sede activa:** la sede con la que trabaja la sesión, o «Todas mis sedes».
- **Clave temporal:** la que genera un reset; hasta cambiarla solo se puede ver la sesión,
  cambiar la clave o salir.

## Configuración por centro

_Ninguna por ahora._

## Pendientes

- `GET /equipo/roles` pide `usuarios.gestionar`: quien tiene `roles.gestionar` sin él no ve la
  lista de la pantalla Roles. Hoy solo el Dueño tiene `roles.gestionar`.
- Sumar los permisos de `reportes` al Encargado (los de su sede) y a Contaduría cuando exista
  el módulo.
- Editar el nombre de un usuario desde el equipo.
- El actor de soporte (0008) sigue las mismas reglas que un usuario; revisarlas cuando exista
  su login.
- Login de operadores de soporte y sesión fijada a un centro por 2 horas (0008).
- Limpiar las sesiones vencidas o revocadas viejas: tarea del worker cuando exista.
- Avisar a `auditoria` de cada cambio de permisos, cuando exista ese módulo.
- «Acceso total» exige todos los permisos en todas las sedes: al crear una sede nueva, el alta
  tiene que darle permisos al admin general en ella.
