El rol **Dueño** de cada centro recibe los permisos de cada módulo nuevo. Cierra el pendiente que dejó #5 en `docs/pendientes.md`.

## El problema

El Dueño se copia de la plantilla con el catálogo del momento del alta. Al sumar un módulo (como `personas`), los centros ya creados no reciben sus permisos:

- nadie del centro los tiene, y nadie los puede dar (0007, regla 1: no se da lo que no se tiene);
- el control de «siempre queda alguien con acceso total» deja de proteger, porque compara contra un `antes > 0` que ya es 0.

Hoy no afecta a nadie porque no hay centros reales.

## Qué hace

- **`roles.plantilla`**: marca el rol que salió de una plantilla del sistema (`'dueno'`), uno por centro. Sigue aunque el centro lo renombre. La migración marca los Dueños existentes por su nombre.
- **`identidad_dar_al_dueno(array[...])`**: para migraciones. Da esos permisos al Dueño de **todos** los centros, sin efecto doble.
  - La app no la puede llamar (`revoke ... from public`).
  - Falla si corre con un rol que pasa por RLS: si no, no vería ningún rol y no haría nada sin avisar.
- La misma migración completa los permisos de los módulos que ya existían (`identidad` y `personas`). Desde acá, cada módulo nuevo se los da en su propia migración.
- **`herramientas/src/catalogo.ts`**: el catálogo completo, que usa la semilla.
- **Guardián** (`herramientas/test/permisos-del-dueno.test.ts`): falla si algún permiso del catálogo no se le da al Dueño en alguna migración.
- `db/AGENTS.md` (sección «Permisos de un módulo nuevo») e `identidad/AGENTS.md`.

## Por qué así

- Un Dueño con «todo el catálogo» implícito obligaría a las funciones SQL de permisos a conocer el catálogo, que vive en el código.
- Sincronizar al arrancar la API escribiría en todos los centros sin contexto (regla 1 de aislamiento).

## Cómo se probó

- Test primero, cada uno visto fallar por la razón esperada (faltaba la columna, faltaba la función, el guardián reclamaba los cinco permisos).
- Integración contra Postgres real: la función da los permisos al Dueño de dos centros y a ningún otro rol, se puede correr dos veces, la app no la puede llamar y la marca solo acepta plantillas conocidas. La semilla crea el Dueño marcado.
- Sobre una base de desarrollo con un centro ya creado y sin los permisos de `personas`: al migrar, el Dueño quedó marcado y los recuperó.
- `identidad` 126, `herramientas` 20, `personas` 23 y `db` 25/26 tests. El que falta es `salida.test`, que necesita el Postgres embebido y no corre en la PC donde se probó (usuario administrador); lo cubre el CI.
- Formato, lint, tamaños, instrucciones, arquitectura, código muerto y tipos.
