# Módulo centros

Nivel: liviano (`src/datos/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Los centros y sus sedes: alta de un centro con sus sedes, datos del centro (nombre, zona
horaria), listado y cambios de las sedes.

## Fuera de alcance

- Quién ve cada sede y qué puede hacer en ella: `identidad` (roles y permisos por sede).
- El alta completa de un cliente (centro + admin general + roles): la orquesta el soporte de
  GREVEX y usa `crearCentro` de este módulo.
- Licencias y cobro a los centros: `licencias`.

## Depende de

- `@app/nucleo`
- `@app/plataforma`

## API pública

Todas reciben la `Transaccion` de `enContexto` y devuelven `Resultado` cuando algo puede fallar
por una regla.

- `crearCentro(tx, { id, nombre, zonaHoraria?, sedes })`: el contexto tiene que ser el del centro
  nuevo (el `id` lo genera quien da el alta).
- `obtenerCentro(tx)`: el centro del contexto.
- `listarSedes(tx)`: las sedes visibles para el contexto, por nombre.
- `renombrarSede(tx, { sedeId, nombre, version })`.

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- Un centro ve y modifica solo su propia fila; las sedes se ven solo donde se tiene algún
  permiso (RLS, ver `db/migraciones/*_rls-centros-y-sedes.sql`).
- Dentro de un centro no hay dos sedes con el mismo nombre, y hay a lo sumo una sede central.
- La sede central no da permisos por sí misma (0007): es un dato para reportes consolidados.
- Toda edición de una sede compara la `version` (0013).

## Glosario

- **Centro:** el cliente (un estudio o escuela) con todas sus sedes.
- **Sede:** un local físico del centro.
- **Sede central:** la que encabeza los reportes consolidados.

## Configuración por centro

- `zonaHoraria` (por defecto `America/Argentina/Buenos_Aires`): las fechas se guardan en UTC y se
  muestran en esta zona (0010).

## Pendientes

- Rutas HTTP: se agregan cuando `identidad` arme el contexto desde la sesión.
- Cambiar la sede central y dar de baja una sede.
