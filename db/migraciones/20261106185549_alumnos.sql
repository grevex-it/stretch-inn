CREATE TABLE "alumnos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"telefono" text NOT NULL,
	"documento" text,
	"email" text,
	"fecha_nacimiento" date,
	"notas" text DEFAULT '' NOT NULL,
	"busqueda" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "alumnos_centro_documento" ON "alumnos" USING btree ("centro_id","documento") WHERE "alumnos"."documento" is not null;--> statement-breakpoint
CREATE INDEX "alumnos_centro_apellido" ON "alumnos" USING btree ("centro_id","apellido","nombre");