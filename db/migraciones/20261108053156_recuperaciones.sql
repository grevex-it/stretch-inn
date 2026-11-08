CREATE TABLE "recuperaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"ocurrencia_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"credito_id" uuid NOT NULL,
	"reservada_por_tipo" text NOT NULL,
	"reservada_por_id" uuid NOT NULL,
	"reservada_en" timestamp with time zone NOT NULL,
	"anulada_en" timestamp with time zone,
	CONSTRAINT "recuperaciones_reservada_por" CHECK ("recuperaciones"."reservada_por_tipo" in ('usuario', 'soporte'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recuperaciones_credito_vigente" ON "recuperaciones" USING btree ("credito_id") WHERE "recuperaciones"."anulada_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "recuperaciones_ocurrencia_alumno_vigente" ON "recuperaciones" USING btree ("ocurrencia_id","alumno_id") WHERE "recuperaciones"."anulada_en" is null;--> statement-breakpoint
CREATE INDEX "recuperaciones_centro_alumno" ON "recuperaciones" USING btree ("centro_id","alumno_id");