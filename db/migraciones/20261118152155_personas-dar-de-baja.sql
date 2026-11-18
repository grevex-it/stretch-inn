-- Dar de baja y reactivar alumnos pasa a tener su permiso propio, aparte de editar la ficha: así
-- cada centro decide quién puede (0007). Se lo da al Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['personas.dar-de-baja']);
