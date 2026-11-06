# Paquete contratos

Esquemas Zod de lo que viaja entre el front (`apps/web`, `apps/portal`) y la API: los pedidos que
la API valida y las respuestas que el front lee. Un solo lugar para que los dos lados estén de
acuerdo.

## Alcance

- `src/sesion.ts`: login, estado de la sesión, centro y sede activa, cambio de clave (0017).
- `src/equipo.ts`: lista del equipo y de roles, alta, clave temporal (0017).

## Fuera de alcance

- Reglas de negocio: van en el dominio de cada módulo. Un contrato dice qué forma tiene el dato,
  no si la operación está permitida.
- Tipos internos de los módulos: solo lo que cruza HTTP.

## Depende de

- `zod`.

## API pública

- `pedidoDeIngreso`, `pedidoDeCentro`, `pedidoDeSede`, `pedidoDeCambioDeClave` y
  `estadoDeSesion`, con sus tipos (`PedidoDeIngreso`, `EstadoDeSesion`, …).
- `pedidoDePagina` (query `?pagina=N`, de a 50), `pedidoDeAlta`, `paginaDeEquipo`,
  `paginaDeRoles`, `altaHecha` y `claveGenerada`, con sus tipos.

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
