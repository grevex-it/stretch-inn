CREATE TABLE "clases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"dia" smallint NOT NULL,
	"hora" text NOT NULL,
	"duracion_minutos" integer NOT NULL,
	"cupo" integer NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "clases_id_centro_sede" UNIQUE("id","centro_id","sede_id"),
	CONSTRAINT "clases_dia" CHECK ("clases"."dia" between 1 and 7),
	CONSTRAINT "clases_hora" CHECK ("clases"."hora" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "clases_duracion" CHECK ("clases"."duracion_minutos" between 15 and 240),
	CONSTRAINT "clases_cupo" CHECK ("clases"."cupo" between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "ocurrencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"clase_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"empieza_en" timestamp with time zone NOT NULL,
	"termina_en" timestamp with time zone NOT NULL,
	"cancelada" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ocurrencias_termina_despues" CHECK ("ocurrencias"."termina_en" > "ocurrencias"."empieza_en")
);
--> statement-breakpoint
ALTER TABLE "ocurrencias" ADD CONSTRAINT "ocurrencias_clase" FOREIGN KEY ("clase_id","centro_id","sede_id") REFERENCES "public"."clases"("id","centro_id","sede_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clases_centro_sede_dia_hora" ON "clases" USING btree ("centro_id","sede_id","dia","hora");--> statement-breakpoint
CREATE UNIQUE INDEX "ocurrencias_clase_fecha" ON "ocurrencias" USING btree ("clase_id","fecha");--> statement-breakpoint
CREATE INDEX "ocurrencias_centro_sede_empieza" ON "ocurrencias" USING btree ("centro_id","sede_id","empieza_en");