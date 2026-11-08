CREATE TABLE "asistencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"ocurrencia_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"estado" text NOT NULL,
	"origen" text DEFAULT 'manual' NOT NULL,
	"registrada_por_tipo" text NOT NULL,
	"registrada_por_id" uuid NOT NULL,
	"registrada_en" timestamp with time zone NOT NULL,
	CONSTRAINT "asistencias_estado" CHECK ("asistencias"."estado" in ('presente', 'ausente')),
	CONSTRAINT "asistencias_origen" CHECK ("asistencias"."origen" in ('manual')),
	CONSTRAINT "asistencias_registrada_por" CHECK ("asistencias"."registrada_por_tipo" in ('usuario', 'soporte'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asistencias_ocurrencia_alumno" ON "asistencias" USING btree ("ocurrencia_id","alumno_id");--> statement-breakpoint
CREATE INDEX "asistencias_centro_alumno" ON "asistencias" USING btree ("centro_id","alumno_id");