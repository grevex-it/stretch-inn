CREATE TABLE "salud_de_alumnos" (
	"alumno_id" uuid PRIMARY KEY NOT NULL,
	"centro_id" uuid NOT NULL,
	"patologias" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salud_de_alumnos" ADD CONSTRAINT "salud_de_alumnos_alumno_id_alumnos_id_fk" FOREIGN KEY ("alumno_id") REFERENCES "public"."alumnos"("id") ON DELETE no action ON UPDATE no action;