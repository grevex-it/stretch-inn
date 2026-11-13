# Paquete contratos

Esquemas Zod de lo que viaja entre el front (`apps/web`, `apps/portal`) y la API: los pedidos que
la API valida y las respuestas que el front lee. Un solo lugar para que los dos lados estén de
acuerdo.

## Alcance

- `src/sesion.ts`: login, estado de la sesión, centro y sede activa, cambio de clave (0017).
- `src/equipo.ts`: lista del equipo y de roles, alta, clave temporal (0017).
- `src/alumnos.ts`: lista con buscador, ficha, alta y edición de alumnos (0011).
- `src/agenda.ts`: clases semanales de cada sede y la semana de fechas concretas.
- `src/asistencia.ts`: la planilla de asistencia de una fecha y las marcas que se guardan.
- `src/abonos.ts`: planes del centro, precios por sede y cuotas de los alumnos: paquetes de
  clases (0020).
- `src/caja.ts`: cobros con clave de idempotencia, anulaciones y el día de caja.
- `src/gastos.ts`: gastos de cada sede con clave de idempotencia, anulaciones y por período (0022).
- `src/paginas.ts`: la forma común de toda lista (`paginaDe`, `numeroDePagina`).

## Fuera de alcance

- Reglas de negocio: van en el dominio de cada módulo. Un contrato dice qué forma tiene el dato,
  no si la operación está permitida.
- Tipos internos de los módulos: solo lo que cruza HTTP.

## Depende de

- `zod`.

## API pública

- `pedidoDeIngreso`, `pedidoDeCentro`, `pedidoDeSede`, `pedidoDeCambioDeClave` y
  `estadoDeSesion`, con sus tipos (`PedidoDeIngreso`, `EstadoDeSesion`, …). El centro activo
  trae su `zonaHoraria`: el panel muestra las fechas en esa zona (regla 3).
- `pedidoDePagina` (query `?pagina=N`, de a 50), `pedidoDeAlta`, `paginaDeEquipo`,
  `paginaDeRoles`, `altaHecha` y `claveGenerada`, con sus tipos.
- `pedidoDeAlumnos` (query `?pagina&buscar&bajas=si`), `fichaDeAlumno`, `edicionDeAlumno`,
  `alumno` y `paginaDeAlumnos`, con sus tipos. El celular es opcional; `numeroDeSocio` y
  `fechaDeInicio` también, y si no vienen en la edición se conservan. El alumno trae
  `numeroDeSocio`, `fechaDeInicio`, `bajaEn` y `pendienteDeCompletar` (0022).
- `saludDeAlumno` (`{ patologias, version }`, hasta 4000 caracteres) y `saludGuardada`
  (`{ version }`): los datos de salud del alumno, aparte de la ficha (0019), con su tipo.
- `pedidoDeClases` (query `?pagina&sede`), `fichaDeClase`, `edicionDeClase`, `clase`,
  `paginaDeClases`, `claseCreada`, `claseEditada`, `pedidoDeOcurrencias`
  (query `?sede&desde&pagina`), `ocurrencia` y `paginaDeOcurrencias`, con sus tipos. Las fechas
  viajan en UTC como texto ISO.
- `pedidoDeInscripcion`, `inscripcionHecha`, `inscripto`, `paginaDeInscriptos`, `claseDeAlumno`
  y `paginaDeClasesDeAlumno`, con sus tipos.
- `camasDeSede` (`{ camas }`: de 1 a 500, o null sin tope), las camas de una sede, con su tipo.
- `profeDeSede` (`{ profeId }`, un usuario o null): el profe fijo de una sede y el reemplazo de
  una fecha (0022). La clase y la fecha traen `profeId`; al crear o editar una clase es opcional.
- `pedidoDeDictadas` (query `?sede&desde&hasta`) y `clasesDictadas` (`{ profes, sinProfe }`):
  las clases dictadas por cada profe en un período (0022), con su tipo.
- `pedidoDeAsistencia` (de 1 a 100 marcas `{ alumnoId, estado }`, presente o ausente) y
  `planillaDeAsistencia` (la fecha y una página de sus inscriptos con su `estado` y su
  `avisoId`, `null` si no se marcó o no avisó), con sus tipos.
- `pedidoDeAviso` (`{ alumnoId }`) y `avisoHecho` (`{ id }`: con el id se anula), con sus tipos.
- `pedidoDeAusencias` (`{ sedeId, desde, hasta }`) y `ausenciasAvisadas` (`{ avisos }`): el
  viaje, las ausencias de un período (0022).
- `reglasDeRecuperacion` (`{ anticipacionMinutos, maximoPorAbono, sinAbono }`), las reglas de
  recuperación de una sede (0020), con su tipo.
- `pedidoDeRecuperacion` (`{ alumnoId }`) y `recuperacionHecha` (`{ id }`), con sus tipos. La
  planilla trae también `recuperan` (la misma página de los que recuperan, cada uno con su
  `recuperacionId` para anularla) y `lugares`.
- `fichaDePlan`, `edicionDePlan`, `plan`, `paginaDePlanes`, `planCreado`, `planEditado`,
  `pedidoDePrecioDeSede`, `pedidoDeCuota` (día de inicio opcional `desde`, AAAA-MM-DD),
  `cuotaGenerada`, `cuota` (con `desde`, `clases` y `pagoId`, el pago que la saldó: con él se anula
  desde la ficha) y `paginaDeCuotas`, con sus tipos. El plan
  lleva `clases` (1 a 100). Los montos van en pesos enteros.
- `pedidoDeImpagas` (query `?sede&pagina`), `cuotaImpaga` y `paginaDeImpagas` (con `adeudado`),
  con sus tipos.
- `pedidoDeAbonoDelAlumno` (query `?sede`) y `abonoDelAlumno` (`{ abono }`: `cuotaId`, `desde`,
  `clases`, `usadas`, `restantes`, `fin` y `pagada`, o null), con su tipo.
- `pedidoDeCobro` (cuota, medio y `claveIdempotencia`), `cobroHecho` (`{ id, monto, repetido }`),
  `pedidoDeAnulacion` (`{ motivo }`), `pedidoDelDia` (query `?sede&dia&pagina`), `pago` y
  `diaDeCaja` (una página de pagos más `cobrado`), con sus tipos.
- `pedidoDeGasto` (sede, fecha, monto, categoría, medio, descripción y `claveIdempotencia`),
  `gastoCargado` (`{ id, repetido }`), `pedidoDeGastos` (query `?sede&desde&hasta&pagina`),
  `gasto` y `paginaDeGastos` (una página más `gastado`), con sus tipos. `CATEGORIAS_DE_GASTO`:
  las mismas que `gastos` (un test lo controla). La anulación usa `pedidoDeAnulacion`.

## Reglas de uso

- Del lado de la API, cada ruta valida su cuerpo con el esquema antes de llamar al módulo.
- Los mensajes de error de los esquemas son para el usuario: en español, con voseo (0010).
- Cambiar un contrato afecta a la API y al front a la vez: se cambian en el mismo pull request.

## Invariantes

- Los ids son uuid; la sede activa es un uuid o `"todas"`.
- Las claves tienen un tope de largo: scrypt sobre textos enormes sirve para atacar la CPU.
- Toda lista es una página: `{ pagina, porPagina, total, elementos }`.

## Pendientes

_Ninguno por ahora._
