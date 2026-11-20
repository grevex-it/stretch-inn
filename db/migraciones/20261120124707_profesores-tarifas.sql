CREATE TABLE "tarifas_de_sede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"profe_id" uuid,
	"monto" bigint NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	"sede_id" uuid NOT NULL,
	CONSTRAINT "tarifas_de_sede_monto" CHECK ("tarifas_de_sede"."monto" > 0),
	CONSTRAINT "tarifas_de_sede_vigencia" CHECK ("tarifas_de_sede"."hasta" is null or "tarifas_de_sede"."hasta" >= "tarifas_de_sede"."desde")
);
--> statement-breakpoint
CREATE TABLE "tarifas_del_centro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"profe_id" uuid,
	"monto" bigint NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	CONSTRAINT "tarifas_del_centro_monto" CHECK ("tarifas_del_centro"."monto" > 0),
	CONSTRAINT "tarifas_del_centro_vigencia" CHECK ("tarifas_del_centro"."hasta" is null or "tarifas_del_centro"."hasta" >= "tarifas_del_centro"."desde")
);
--> statement-breakpoint
CREATE TABLE "tipos_de_profe" (
	"profe_id" uuid PRIMARY KEY NOT NULL,
	"centro_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	CONSTRAINT "tipos_de_profe_tipo" CHECK ("tipos_de_profe"."tipo" in ('empleado', 'socio'))
);
--> statement-breakpoint
CREATE INDEX "tarifas_de_sede_centro_sede_desde" ON "tarifas_de_sede" USING btree ("centro_id","sede_id","desde");--> statement-breakpoint
CREATE INDEX "tarifas_del_centro_centro_desde" ON "tarifas_del_centro" USING btree ("centro_id","desde");