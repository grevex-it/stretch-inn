CREATE TABLE "inscripciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"clase_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"baja_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clases" ADD COLUMN "inscriptos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_clase" FOREIGN KEY ("clase_id","centro_id","sede_id") REFERENCES "public"."clases"("id","centro_id","sede_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inscripciones_clase_alumno_vigente" ON "inscripciones" USING btree ("clase_id","alumno_id") WHERE "inscripciones"."baja_en" is null;--> statement-breakpoint
CREATE INDEX "inscripciones_centro_alumno" ON "inscripciones" USING btree ("centro_id","alumno_id");--> statement-breakpoint
ALTER TABLE "clases" ADD CONSTRAINT "clases_inscriptos" CHECK ("clases"."inscriptos" between 0 and "clases"."cupo");