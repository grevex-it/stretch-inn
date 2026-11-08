CREATE TABLE "creditos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"aviso_id" uuid NOT NULL,
	"ocurrencia_id" uuid NOT NULL,
	"vence_en" timestamp with time zone NOT NULL,
	"anulado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "creditos_aviso" ON "creditos" USING btree ("aviso_id");--> statement-breakpoint
CREATE INDEX "creditos_centro_alumno_vence" ON "creditos" USING btree ("centro_id","alumno_id","vence_en");