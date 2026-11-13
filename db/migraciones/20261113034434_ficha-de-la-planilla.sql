ALTER TABLE "alumnos" ALTER COLUMN "telefono" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alumnos" ADD COLUMN "numero_de_socio" integer;--> statement-breakpoint
-- Los alumnos que ya existían reciben su número de socio por orden de alta, en cada centro.
-- Corre con el dueño del esquema, que no pasa por RLS.
UPDATE "alumnos" a SET "numero_de_socio" = n.numero
  FROM (
    SELECT "id", row_number() OVER (PARTITION BY "centro_id" ORDER BY "creado_en", "id") AS numero
    FROM "alumnos"
  ) n
  WHERE a."id" = n."id";--> statement-breakpoint
ALTER TABLE "alumnos" ALTER COLUMN "numero_de_socio" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alumnos" ADD COLUMN "fecha_de_inicio" date;--> statement-breakpoint
ALTER TABLE "alumnos" ADD COLUMN "baja_en" timestamp with time zone;--> statement-breakpoint
-- Los que ya estaban de baja: no se sabe cuándo; queda la fecha de la migración.
UPDATE "alumnos" SET "baja_en" = now() WHERE NOT "activo";--> statement-breakpoint
CREATE UNIQUE INDEX "alumnos_centro_socio" ON "alumnos" USING btree ("centro_id","numero_de_socio");
