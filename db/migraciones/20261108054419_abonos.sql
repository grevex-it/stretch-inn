CREATE TABLE "cuotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"periodo" text NOT NULL,
	"monto" bigint NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"pago_id" uuid,
	"pagada_en" timestamp with time zone,
	"anulada_en" timestamp with time zone,
	CONSTRAINT "cuotas_periodo" CHECK ("cuotas"."periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "cuotas_monto" CHECK ("cuotas"."monto" > 0),
	CONSTRAINT "cuotas_pagada_o_anulada" CHECK ("cuotas"."pagada_en" is null or "cuotas"."anulada_en" is null)
);
--> statement-breakpoint
CREATE TABLE "planes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"clases_por_semana" smallint NOT NULL,
	"precio" bigint NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "planes_clases" CHECK ("planes"."clases_por_semana" between 1 and 7),
	CONSTRAINT "planes_precio" CHECK ("planes"."precio" > 0)
);
--> statement-breakpoint
CREATE TABLE "precios_de_sede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"precio" bigint NOT NULL,
	CONSTRAINT "precios_de_sede_precio" CHECK ("precios_de_sede"."precio" > 0)
);
--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precios_de_sede" ADD CONSTRAINT "precios_de_sede_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuotas_alumno_periodo_vigente" ON "cuotas" USING btree ("alumno_id","periodo") WHERE "cuotas"."anulada_en" is null;--> statement-breakpoint
CREATE INDEX "cuotas_centro_alumno_periodo" ON "cuotas" USING btree ("centro_id","alumno_id","periodo");--> statement-breakpoint
CREATE INDEX "planes_centro_nombre" ON "planes" USING btree ("centro_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "precios_de_sede_plan_sede" ON "precios_de_sede" USING btree ("plan_id","sede_id");--> statement-breakpoint
CREATE INDEX "precios_de_sede_centro_sede" ON "precios_de_sede" USING btree ("centro_id","sede_id");