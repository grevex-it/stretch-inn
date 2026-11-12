CREATE TABLE "avisos_de_ausencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"ocurrencia_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"avisado_por_tipo" text NOT NULL,
	"avisado_por_id" uuid NOT NULL,
	"avisado_en" timestamp with time zone NOT NULL,
	"anulado_en" timestamp with time zone,
	CONSTRAINT "avisos_avisado_por" CHECK ("avisos_de_ausencia"."avisado_por_tipo" in ('usuario', 'soporte'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "avisos_ocurrencia_alumno_vigente" ON "avisos_de_ausencia" USING btree ("ocurrencia_id","alumno_id") WHERE "avisos_de_ausencia"."anulado_en" is null;--> statement-breakpoint
CREATE INDEX "avisos_centro_alumno" ON "avisos_de_ausencia" USING btree ("centro_id","alumno_id");