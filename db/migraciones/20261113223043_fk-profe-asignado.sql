-- El profe asignado del alumno es un usuario del equipo (ver docs/decisiones/0022). La clave va
-- acá y no en el esquema de Drizzle: personas no importa archivos internos de identidad. Que sea
-- del mismo centro lo controla la app, que lo lee con RLS.
alter table alumnos add constraint alumnos_profe_fk foreign key (profe_id) references usuarios (id);
