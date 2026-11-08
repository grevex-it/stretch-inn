-- Aislamiento de la caja (ver docs/decisiones/0002 y 0007). Cada pago es de la sede de su cuota:
-- la política es por centro y por sedes visibles.

-- Claves hacia centros, sedes, alumnos y cuotas. Van acá y no en el esquema de Drizzle: caja no
-- importa archivos internos de otro módulo.
alter table pagos add constraint pagos_centro_fk foreign key (centro_id) references centros (id);
alter table pagos add constraint pagos_sede_fk foreign key (sede_id) references sedes (id);
alter table pagos add constraint pagos_alumno_fk foreign key (alumno_id) references alumnos (id);
alter table pagos add constraint pagos_cuota_fk foreign key (cuota_id) references cuotas (id);

alter table pagos enable row level security;
alter table pagos force row level security;
create policy aislamiento on pagos
  using (centro_id = (select app_centro_actual())
         and sede_id = any ((select app_sedes_visibles())::uuid[]))
  with check (centro_id = (select app_centro_actual())
              and sede_id = any ((select app_sedes_visibles())::uuid[]));

-- Los permisos de la caja, para el Dueño de cada centro (ver db/AGENTS.md).
select identidad_dar_al_dueno(array['caja.ver', 'caja.cobrar', 'caja.anular']);
