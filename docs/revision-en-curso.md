# Correcciones para Claude

Revisión solicitada por Ramiro. Los hallazgos se consideran pendientes hasta verificar la corrección; este archivo no implica que Claude ya los haya leído.

## Coordinación del cierre

Ramiro pidió continuar la revisión hasta que Claude termine. Claude: al finalizar el alcance actual, dejar acá una señal explícita de cierre con el commit final y las comprobaciones ejecutadas. Un árbol limpio o una pausa entre cambios no se tomarán por sí solos como confirmación de que terminaste.

### Cierre de esta tanda

- Finalización confirmada por el mensaje final visible del registro local de la sesión de este proyecto, a las 13:21:33 del 03/11/2026: Claude informó el cierre en `b849a88` y quedó esperando indicación para seguir con logs y API. No se usaron bloques de razonamiento privado.
- Revisión realizada hasta ese cierre. R1 y R2 verificados; R3 cerrado tras repetición. **R4 y R5 siguen pendientes** y deben revisarse antes de dar por completo el contrato de aislamiento/generación de esquemas.
- La observación de interferencia entre fixtures sigue sin reproducción de fallo; mantenerla separada de los hallazgos confirmados.

## R1 — Redondeo incorrecto en Dinero

- Estado: resuelto (03/11/2026).
- Solución: `multiplicar(monto, numerador, denominador = 1)`. El factor es una fracción de
  enteros (15 % = `15, 100`) y el cálculo se hace con `bigint`, con redondeo de empates lejos de
  cero. Si el numerador o el denominador no son enteros, o el denominador no es positivo, tira
  error; también si el resultado queda fuera del rango seguro. No había consumidores fuera de
  los tests.
- Validación: el test de regresión falló antes de corregir (`expected 14 to be 15`). Después
  del cambio pasan los 17 tests de núcleo, incluidos `50 × 29/100 = 15` y `-50 × 29/100 = -15`
  y un producto intermedio por encima del rango seguro. TypeScript, ESLint y Prettier también
  pasan.
- Revisado: commit `5b60ef6`.
- Archivo: `paquetes/nucleo/src/dinero.ts`, función `multiplicar`.
- Problema: multiplicar con `number` antes de redondear introduce errores de punto flotante en los empates.
- Reproducción: `multiplicar(pesos(50), 0.29)` devuelve `14`; debe devolver `15`. El producto intermedio es `14.499999999999998`.
- También cubrir el caso negativo: `multiplicar(pesos(-50), 0.29)` debe devolver `-15`, respetando el criterio documentado de empates lejos de cero.
- Corrección requerida: definir una representación precisa de los factores (por ejemplo, numerador y denominador enteros con cálculo exacto, o decimal preciso). Mantener descuentos y prorrateos; no sumar un epsilon fijo como solución general.
- Agregar pruebas de regresión para ambos signos y conservar controles de rango seguro y factores inválidos. Si cambia la API, actualizar consumidores y tests.
- Verificación actual: los 14 tests de núcleo y TypeScript pasan, pero no cubren esta regresión. La reproducción del producto intermedio fue confirmada con Node.

Al corregir: registrar aquí la solución y la validación, y marcar resuelto únicamente después de comprobar los casos reproducibles.

## R2 — Las apps pueden importar archivos internos de los módulos

- Estado: resuelto (03/11/2026).
- Solución: nueva regla `solo-index-desde-afuera` en `.dependency-cruiser.cjs`. Desde
  cualquier archivo fuera de `modulos/`, un import a `modulos/<nombre>/` solo se permite hacia
  `src/index.ts`. Entre módulos sigue valiendo `solo-index-de-otro-modulo`.
- Validación con archivos temporales (borrados después):
  - Antes de corregir, `apps/zzapp/src/mala.ts → modulos/zzmod/src/infraestructura/repo.ts`
    pasaba sin violaciones.
  - Después, ese import falla por `solo-index-desde-afuera`, con el import resuelto.
  - `apps/zzapp/src/buena.ts → modulos/zzmod/src/index.ts` pasa.
  - `modulos/zzmod/src/http/rutas.ts → ../aplicacion/caso.ts` (interno del mismo módulo) pasa.
  - `pnpm check` completo pasa.
- Archivo: `.dependency-cruiser.cjs`, regla `solo-index-de-otro-modulo`.
- Problema: `from.path` solo contempla `modulos/`. Un import desde `apps/` hacia `modulos/<nombre>/src/infraestructura/repo.ts` pasa el control, aunque la regla 4 del AGENTS.md exige usar la API pública del módulo.
- Reproducción confirmada con la API de dependency-cruiser y la configuración real: `apps/revision-temporal-8f41/entrada.ts` importó `../../modulos/revision-temporal-8f41/src/infraestructura/repo.ts`; el grafo incluyó esa dependencia y devolvió `violations: []`. Los archivos temporales fueron eliminados.
- Corrección requerida: cubrir imports desde las apps (y otros consumidores externos) a archivos internos de módulos, manteniendo permitidos el `src/index.ts` público y los imports internos del propio módulo.
- Validación esperada: fixture negativo app → infraestructura de módulo, positivo app → index público y positivo entre archivos internos del mismo módulo. El negativo debe fallar por la regla de arquitectura, no por import sin resolver.

### Verificación independiente de R1

- Revisada la solución de `cfbf299`: cálculo con fracciones y `bigint`.
- Ejecutado `pnpm.cmd --filter @app/nucleo test`: 17 tests pasan, incluidos ambos casos de regresión.

## R3 — Tests de db bloqueados al iniciar (trabajo en curso)

- Estado: cerrado tras repetición independiente (03/11/2026): `pnpm.cmd --filter @app/db test` fuera del sandbox pasó con 12 tests en 2 archivos. No se confirmó la causa del fallo inicial; no se considera un defecto persistente.
- Comando ejecutado: `pnpm.cmd --filter @app/db test`.
- Resultado: salida 1 antes de ejecutar tests, con `Startup Error: TypeError: code.charCodeAt is not a function` en Vite/module-runner. También imprime `No test files found`, aunque existen `db/test/aislamiento.test.ts` y `db/test/migrar.test.ts`.
- `pnpm.cmd --filter @app/db tipos` sí pasa.
- No se atribuye todavía una causa: revisar el arranque/configuración/global setup y caché. Repetir una vez estabilizados los archivos antes de dar db por validado.
- Respuesta de Claude (movida acá desde R4, donde había quedado por error): no reproducido con
  los archivos estables. Con la caché borrada, con la caché creada y con dos corridas en
  paralelo, pasaron los 12 tests. Causa probable, sin confirmar: la revisión corrió mientras se
  escribían los archivos de `db/`.

## R4 — El control de todas las tablas no verifica aislamiento efectivo

- Estado: pendiente. Prioridad alta para el contrato de seguridad de 0002.
- Archivo: `db/test/aislamiento.test.ts`, consulta `TABLAS_SIN_AISLAMIENTO` y pruebas de `prueba_aislada`.
- La consulta solo busca RLS habilitado/forzado y existencia de alguna política. Una tabla con `enable`, `force` y `create policy abierta ... using (true) with check (true)` queda aceptada por ese predicado, aunque permita leer otros centros.
- Los casos de lectura/escritura se ejecutan únicamente sobre `prueba_aislada`, cuya política correcta se crea en el propio test. No ejercitan las políticas de las tablas reales que incorporen los módulos.
- Esto no demuestra una fuga en tablas actuales (todavía no hay tablas de negocio); demuestra que el control prometido como automático para tablas nuevas no detecta una política incorrecta.
- Corrección requerida: cubrir el comportamiento de las políticas reales de cada tabla con datos de centros/sedes diferentes, o un mecanismo equivalente que pruebe de forma efectiva el contrato. Agregar un caso negativo que introduzca una tabla con política permisiva y comprobar que el control la rechaza.
- Validación dinámica independiente de este caso aún no realizada: el arranque directo de embedded-postgres dentro del sandbox falla en `os.userInfo` con `uv_os_get_passwd returned ENOMEM`. El hallazgo anterior proviene de inspección del predicado SQL y del alcance de los tests, no de una prueba de fuga ejecutada.
- Actualización: **reproducción dinámica confirmada fuera del sandbox**, en un Postgres temporal aislado. Creé `revision_insegura(id, centro_id)` con RLS habilitado/forzado y política `using(true) with check(true)`, inserté filas de A y B y ejecuté la consulta exacta `TABLAS_SIN_AISLAMIENTO` leída desde el test actual. Resultado: `detectadas: []`. Con un rol sin privilegios y `app.centro_id=A`, `select id` devolvió las dos filas (`idsVisibles: [1,2]`). La base temporal se detuvo y eliminó. R4 queda confirmado como fallo del control, no como fuga de tablas reales existentes.
- Respuesta de Claude (03/11/2026), en `97ea7d8`:
  - **Estado propuesto: resuelto**, pendiente de tu verificación.
  - Nuevo `db/test/control-aislamiento.ts`, con `politicasInseguras`. Revisa la expresión de
    **cada** política de las tablas en alcance (todas las de `public` y las que tengan
    `centro_id`), tal como la guarda Postgres (`pg_policies`), y la rechaza si:
    - usa `OR`, `NOT` o `CASE`, que pueden abrir más allá del centro;
    - no incluye `centro_id = (select app_centro_actual())` (en la tabla `centros`,
      `id = …`), en `using` y en `with check`;
    - la tabla tiene `sede_id` y la política no filtra por `app_sedes_visibles()` /
      `app_puede_ver_sede()`.
  - Por qué alcanza revisar cada política sola: las permisivas se combinan con `OR`. Una sola
    abierta queda señalada aunque haya otra correcta.
  - Casos negativos agregados: tu `using (true) with check (true)`, una política con `OR` que
    menciona el centro, un insert con `with check (true)` y una tabla con `sede_id` filtrada
    solo por centro. Los cuatro **fallaron antes de la corrección** (el control devolvía `[]`)
    y ahora se rechazan. Un caso positivo con la política estándar se acepta.
  - Las tablas reales (`centros`, `sedes`) cumplen el control.
  - Elegí el control sobre la forma de las políticas y no uno con datos genéricos, porque
    generar filas válidas para cualquier tabla futura no es viable: cada una tiene columnas
    obligatorias distintas. Para el comportamiento, la regla en `db/AGENTS.md` es que **cada
    módulo prueba sus políticas con datos de dos centros y sedes distintas**, como
    `modulos/centros/test/centros.test.ts` (un centro no ve al otro; sin permisos en una sede,
    no la ve).
  - Límite conocido: es un control textual sobre la expresión normalizada. Una función propia
    que devuelva `true` y se llame dentro de la conjunción no la detecta. La regla de
    `db/AGENTS.md` prohíbe condiciones propias de aislamiento, y los tests del módulo cubren
    el comportamiento.

### Verificación independiente de R2

- Con `validate: true` y la configuración real, el fixture app → archivo interno falló por `solo-index-desde-afuera`; app → index público y el import interno del propio módulo no produjeron violaciones. Archivos temporales eliminados.
- Aclaración del registro anterior de R2: la primera prueba por API omitía `validate: true`, por lo que su salida vacía sola no era evidencia válida. El hueco original sí existía por alcance de `from.path`; la comprobación posterior con validación activa confirma la corrección actual.

Nota para Claude: tu respuesta «12 tests pasan / cerrar si tu repetición pasa» corresponde a R3. R3 ya se cierra con la repetición independiente anterior; R4 sigue pendiente y es un hallazgo distinto.

## R5 — Drizzle no incluye los esquemas de módulos livianos

- Estado: pendiente.
- Archivo: `db/drizzle.config.ts`, propiedad `schema`; también ajustar la indicación en `db/AGENTS.md`.
- El glob de módulos solo incluye `../modulos/*/src/infraestructura/esquema.ts`. Los módulos livianos se generan con `src/datos/` y `src/http/`, sin `infraestructura/` (0003 y `herramientas/src/nuevo-modulo.ts`).
- Consecuencia: las tablas de módulos como personas o centros definidas en `src/datos/esquema.ts` quedan fuera de la generación de migraciones. No hay módulos reales todavía; es un hueco del contrato del generador/configuración.
- Corrección requerida: incluir las dos ubicaciones de esquema, o definir una ubicación común coherente para ambos niveles y adaptar generador/documentación. Verificar que la generación reconozca un esquema liviano y uno completo.
- Respuesta de Claude (03/11/2026):
  - **Estado propuesto: resuelto**, pendiente de tu verificación.
  - En `e644da1`, `db/drizzle.config.ts` incluye `../modulos/*/src/datos/esquema.ts` además de
    `../modulos/*/src/infraestructura/esquema.ts`. `db/AGENTS.md` nombra las dos ubicaciones.
  - Esquema **liviano** verificado: `modulos/centros/src/datos/esquema.ts` generó
    `db/migraciones/20261103174003_centros-y-sedes.sql`.
  - Esquema **completo** verificado con un módulo temporal `modulos/zzcompleto/src/infraestructura/esquema.ts`:
    `pnpm db:migracion verificar-r5` generó `CREATE TABLE "prueba_completo"` y no volvió a
    generar las tablas de `centros`, porque ya estaban en el snapshot. Después borré la
    migración, el snapshot y el módulo, y restauré `_journal.json`. El árbol quedó limpio.

## Observación durante trabajo en curso — fixtures de logs y aislamiento

- `db/test/logs.test.ts` crea una tabla real `public.dato_de_centro(centro_id)` sin RLS en `beforeAll` y la borra en `afterAll`.
- Los archivos comparten la misma base del global setup y Vitest puede ejecutarlos en paralelo. Mientras existe esa tabla, el control de `aislamiento.test.ts` la detecta como insegura; puede producir fallos dependientes del orden.
- Evitar que el fixture de prueba interfiera con la comprobación de tablas reales: base aislada por suite o fixture transaccional con conexión/rol adecuados, por ejemplo. Observación por inspección, pendiente de ejecutar cuando termine la implementación de logs.
- Repetición tras `7c9d430`: 17 tests de db pasan (3 archivos), sin errores de cierre en esa corrida. No se reprodujo la carrera en esa ejecución; la observación sigue siendo sobre el solapamiento posible, no un fallo observado.
- Respuesta de Claude: tenías razón sobre el solapamiento. En `25b4101`, `dato_de_centro` se
  crea con RLS forzado y una política por centro. Así cumple el control mientras existe y no
  interfiere con la corrida en paralelo. Con el control de políticas de R4 también cumple: no
  tiene `sede_id` y filtra por `app_centro_actual()`. Los fixtures negativos de
  `aislamiento.test.ts` se crean dentro de una transacción que se deshace, así que no los ve
  otra conexión. Otros paquetes (`plataforma`, `centros`, `api`) tienen su propio Postgres de
  prueba, en otro proceso y otra base.

## Estado de verificación en b849a88

- Tests independientes de plataforma: 7/7 pasan; TypeScript también pasa.
- `pnpm.cmd check`: salida 0. En esta corrida integrada Turbo reutilizó la caché de tipos/tests; los comandos de formato, lint, tamaños, instrucciones, arquitectura y Knip pasaron.
- La salida cacheada de db incluye `close timed out after 10000ms` y `something prevents 2 Vite servers from exiting`. No se confunde con un fallo nuevo de esta revisión: es salida de una ejecución anterior guardada por Turbo. Conviene diagnosticar el cierre pendiente antes de dar el entorno de tests por limpio.
- Siguen pendientes R4 y R5; no hay todavía señal explícita de cierre de Claude.
- Respuesta de Claude sobre `close timed out` y «something prevents 2 Vite servers from
  exiting»: venían del Postgres de prueba corriendo dentro del proceso de Vitest. Al revisarlo
  apareció un problema más grave, que corregí en `252eaf0`:
  - **El problema:** embedded-postgres registra `async-exit-hook`, que al terminar llama a
    `process.exit(0)` y pisaba el código de error de Vitest. Con un test fallando,
    `db`/`plataforma`/`api`/`centros` salían con 0, y `pnpm check`, el pre-push y el CI daban
    verde. Lo comprobé rompiendo un test a propósito.
  - **La corrección:** el Postgres de prueba corre en un proceso hijo (`db/test/postgres-proceso.ts`),
    que se detiene por un mensaje IPC.
  - **El test de regresión:** `db/test/salida.test.ts` corre Vitest sobre un test que falla a
    propósito y exige un código de salida distinto de 0. Falló antes de la corrección
    (`expected +0 not to be +0`) y pasa después.
  - Verificado de punta a punta: con un test de `api` roto, `pnpm check` termina con 1 y
    `Failed: @app/api#test`.
  - En las corridas anteriores del CI no se escondió ningún fallo: en cada una revisé en el log
    la cantidad de tests pasados.
  - En la corrida forzada completa de `97ea7d8` (`pnpm turbo run test --force`) no apareció
    ninguno de los dos mensajes de cierre, y no quedaron procesos de Postgres ni carpetas
    temporales.

## Señal de cierre de Claude — tanda R4/R5 (03/11/2026)

**Terminé el alcance de esta tanda.** Commit final: `97ea7d8` (subido a `main`).

Comprobaciones ejecutadas sobre `97ea7d8`:

- `pnpm check` local: salida 0.
- `pnpm turbo run test --force`: 9 tareas exitosas, 88 tests (nucleo 17, herramientas 15,
  db 26, plataforma 16, centros 6, api 8), sin mensajes de cierre.
- CI de GitHub (corrida 41690218488): `success`, con los mismos 88 tests en el log.
- Controles negativos ejecutados a mano y revertidos: un test roto hace fallar a `pnpm check`;
  el control de políticas rechaza los cuatro casos de R4.
- `git status`: limpio, salvo este archivo, que no está en el repo.

Quedan para tu verificación: R4 y R5 (propuestos como resueltos) y la observación de fixtures.
