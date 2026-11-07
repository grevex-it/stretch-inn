# Módulo personas

Nivel: liviano (`src/datos/`, `src/http/`). Ver `docs/decisiones/0003-hexagonal-por-niveles.md`.

## Alcance

Los alumnos del centro: ficha (nombre, apellido, teléfono y, opcionales, documento, email,
fecha de nacimiento y notas), lista con buscador, alta, edición, baja y reactivación.

## Fuera de alcance

- En qué clases está cada alumno y en qué sede: `agenda` (inscripciones).
- Abonos, cobros y asistencia: `abonos`, `caja` y `asistencia`.
- El acceso del alumno al portal (Fase 4).
- Datos de salud (lesiones, contraindicaciones): son datos sensibles (Ley 25.326). Se suman
  después, con un permiso propio y el consentimiento del alumno.

## Depende de

- `@app/nucleo`
- `@app/plataforma`
- `@app/contratos` (rutas HTTP)

## API pública

Las funciones de datos reciben la `Transaccion` de `enContexto` y devuelven `Resultado` cuando
algo puede fallar por una regla.

- `listarAlumnos(tx, { pagina, porPagina, buscar?, conBajas? })`: por apellido y nombre.
- `obtenerAlumno(tx, id)` y `obtenerAlumnos(tx, ids)`: hasta 100 ids en una sola consulta, para
  que otro módulo muestre una página con sus alumnos (los inscriptos de una clase) sin N+1. Los
  ids que no son del centro no vuelven.
- `crearAlumno(tx, ficha)` y `editarAlumno(tx, { ...ficha, id, version })`.
- `fijarActivo(tx, { id, activo })`: baja y reactivación.
- `rutasDeAlumnos(base)`: `GET /alumnos?pagina&buscar&bajas=si` y `GET /alumnos/:id`
  (`personas.ver`); `POST /alumnos`, `PUT /alumnos/:id` y `PUT`/`DELETE /alumnos/:id/baja`
  (`personas.editar`).
- `PERMISOS_PERSONAS`: la sección «Alumnos» del catálogo (0007).

## Eventos

- Emite: _ninguno por ahora_.
- Escucha: _ninguno por ahora_.

## Invariantes

- El alumno es del **centro**, no de una sede (0011): RLS aísla solo por centro y cualquier
  usuario con `personas.ver` en alguna sede ve a todos los alumnos del centro.
- La baja no borra: oculta al alumno de la lista habitual y conserva su historia.
- Si se carga el documento, no se repite dentro del centro (índice único parcial). Se guarda sin
  puntos ni espacios.
- Toda edición compara la `version` que vio quien edita (0013).
- La columna `busqueda` (nombre, apellido, documento y dígitos del teléfono, en minúsculas y sin
  acentos) la arma la app en cada alta y edición: nunca se escribe a mano.
- Nunca se escriben en un log datos de contacto completos de un alumno (0015).

## Glosario

- **Alumno:** persona que toma clases en el centro.
- **Baja:** el alumno dejó de venir; se conserva su ficha.

## Configuración por centro

_Ninguna por ahora._ `recuperarEnOtraSede` (0011) llega con `asistencia`.

## Pendientes

- Datos de salud con permiso propio y consentimiento.
- Exportar o borrar los datos de un alumno que lo pida (Ley 25.326, derecho de supresión).
- Si un centro llega a decenas de miles de alumnos, el buscador (`like` sobre `busqueda`) va a
  necesitar un índice de trigramas.
