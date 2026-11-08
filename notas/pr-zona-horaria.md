La **zona horaria del centro en la sesión**. Es estructura: la necesita el panel para mostrar la agenda.

## Qué hace

- `GET /sesion` suma `centroActivo.zonaHoraria`, la zona IANA del centro (`America/Argentina/Buenos_Aires` por defecto).
- `Acceso.zonaHoraria(sesion)` la lee de `centros` con `obtenerCentro`, en el contexto de la sesión (RLS: el centro ve solo su fila). Sin centro elegido devuelve `null`.
- `identidad` pasa a depender de `centros` (`centros` no depende de `identidad`). Sin migración.
- Contrato `estadoDeSesion`: `zonaHoraria` es obligatoria en el centro activo.

## Por qué

Las fechas viajan en UTC y se muestran en la zona del centro (regla 3), no en la del navegador. La pantalla Agenda es la primera que muestra horas. Sin esto, el panel tendría que asumir una zona fija.

## Cómo se probó

- Test primero, visto fallar antes de implementar:
  - el contrato rechaza el centro activo sin zona;
  - la ruta la devuelve;
  - contra Postgres real, `Acceso` lee la zona del centro, también una distinta de la de por defecto (`America/Montevideo`), y devuelve `null` sin centro.
- Tests en verde: identidad (128), api, centros, herramientas, contratos y web.
- Controles: formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
