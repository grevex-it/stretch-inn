# 0017 — Cuentas, login y sesiones

**Fecha:** 03/11/2026 · **Estado:** aceptada · Complementa 0002, 0007 y 0008.

## Contexto

Una misma persona puede trabajar en más de un centro que use el sistema (por ejemplo, un
profesor). Tiene que entrar con una sola cuenta y elegir en qué centro trabaja. Pero los datos de
cada centro están aislados con RLS (0002), y los centros pueden ser competidores entre sí: nada de
lo que haga un centro puede darle acceso a otro.

## Decisión

### Cuenta y usuario

- **Cuenta:** la persona. Es de la plataforma, no de un centro: email (único), hash de la
  contraseña y si tiene que cambiarla en el próximo ingreso.
- **Usuario:** la membresía de una cuenta en un centro, con `centro_id` y aislada por RLS. Ahí
  viven sus roles y ajustes por sede (0007). Una cuenta tiene a lo sumo un usuario por centro.
- Dar de alta un usuario con un email que ya tiene cuenta **la vincula**: la persona entra con su
  contraseña de siempre. El centro no ve ni cambia nada de la cuenta salvo el email.
- Dar de baja un usuario lo desactiva en ese centro; la cuenta sigue entrando a los demás.

### Login

- Email y contraseña. Si la cuenta tiene usuarios activos en varios centros, después de entrar
  elige uno; puede cambiar de centro sin volver a entrar.
- Respuesta única ante cualquier falla: «Email o contraseña incorrectos». No revela si el email
  existe.
- **Límite de intentos:** 5 fallidos en 15 minutos por email y por origen bloquean ese par 15
  minutos. En memoria del proceso mientras haya una sola instancia (0013).

### Sesión

- **Cookie httpOnly**, `Secure` y `SameSite=Lax`, con un token aleatorio de 32 bytes. En la base
  se guarda solo su hash: si se filtra la tabla, no sirve para entrar.
- La sesión guarda la cuenta y el centro elegido. **Vence a las 12 horas sin uso**, y siempre a
  los 7 días.
- Salir, bloquear un usuario o cambiar la contraseña revoca las sesiones en el momento.
- Los permisos **no** se guardan en la sesión: se calculan en cada pedido (0007, regla 3).

### Sede activa

- Un usuario con permisos en más de una sede **cambia de sede desde la aplicación**, sin volver
  a entrar. La sesión guarda la sede activa junto al centro.
- Solo puede elegir sedes donde tiene algún permiso. Con una sola sede, el selector no aparece.
- Con una sede elegida, el `ContextoCentro` se arma **solo con los permisos de esa sede**: RLS le
  muestra únicamente esa sede y trabaja como si fuera la única. Es una barrera real, no un filtro
  de pantalla.
- La opción **«Todas mis sedes»** (para el dueño o un encargado general) arma el contexto con
  todas sus sedes, para vistas y reportes consolidados.
- Al entrar se usa la última sede que eligió en ese centro; la primera vez, «Todas mis sedes» si
  tiene varias.
- Si le quitan los permisos en la sede activa, el próximo pedido lo pasa a otra de sus sedes y la
  pantalla se lo avisa.
- Además de `SameSite`, la API rechaza los pedidos que cambian datos si el encabezado `Origin`
  no es el del panel.

### Contraseñas

- Hash con **scrypt** (incluido en Node), con sal propia y los parámetros guardados junto al hash,
  para poder subirlos sin invalidar las existentes.
- Mínimo 10 caracteres, sin reglas de composición.
- **Reset:** lo hace un usuario con `usuarios.gestionar`. Genera una contraseña temporal que hay
  que cambiar en el primer ingreso.
- **Solo a usuarios con menos permisos que él.** Como los roles no tienen jerarquía (0007), «menos»
  se mide por permisos: en cada sede del otro usuario, quien resetea tiene que tener **todos** sus
  permisos efectivos y **al menos uno más** en alguna. Así nadie resetea a un par con los mismos
  permisos ni a alguien con más: dos admins con acceso total no pueden resetearse entre sí. En
  esos casos lo hace el soporte de GREVEX.
- **Regla contra la toma de cuentas:** un centro solo puede resetear la contraseña de una cuenta
  que **no tenga usuarios en otros centros**. Si tiene, el reset lo hace el soporte de GREVEX.
  Sin esta regla, el admin de un centro podría quedarse con el acceso de una persona a otro
  centro.

### Consultas que cruzan centros

- Buscar la cuenta por email y listar los centros de una cuenta necesitan ver más de un centro.
  Pasan por **dos funciones de base de alcance mínimo** (`security definer`): devuelven solo lo
  indispensable (id y nombre del centro, nunca datos de sus usuarios).
- Fuera de esas funciones, ninguna consulta de la app saltea RLS.

### Soporte de GREVEX (0008)

- Los operadores tienen su propio login, separado del de las cuentas de los centros.
- Entrar como soporte crea una sesión fijada a un centro, que vence a las 2 horas. Adentro el
  operador tiene todos los permisos y el mismo RLS que cualquier usuario.

## Consecuencias

- **El panel y la API tienen que estar en el mismo sitio** (por ejemplo `app.dominio` y
  `api.dominio`, o la API bajo el mismo dominio) para que la cookie viaje con `SameSite=Lax`. Los
  dominios `*.up.railway.app` no sirven entre sí: hace falta un dominio propio. Va a pendientes.
- Sin envío de emails en el primer lanzamiento: ni recuperación por enlace ni avisos de login.
  Si se suma, es otra decisión.
- Los plazos (12 horas, 7 días, 2 horas, 5 intentos) son iniciales y se ajustan con el uso.
