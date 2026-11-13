CREATE TABLE "gastos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"monto" bigint NOT NULL,
	"categoria" text NOT NULL,
	"medio" text NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"clave_idempotencia" text NOT NULL,
	"registrado_por_tipo" text NOT NULL,
	"registrado_por_id" uuid NOT NULL,
	"registrado_en" timestamp with time zone NOT NULL,
	"anulado_en" timestamp with time zone,
	"anulado_por_tipo" text,
	"anulado_por_id" uuid,
	"motivo_anulacion" text,
	CONSTRAINT "gastos_monto" CHECK ("gastos"."monto" > 0),
	CONSTRAINT "gastos_medio" CHECK ("gastos"."medio" in ('efectivo', 'transferencia')),
	CONSTRAINT "gastos_registrado_por" CHECK ("gastos"."registrado_por_tipo" in ('usuario', 'soporte')),
	CONSTRAINT "gastos_anulacion" CHECK (("gastos"."anulado_en" is null) = ("gastos"."motivo_anulacion" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "gastos_centro_clave" ON "gastos" USING btree ("centro_id","clave_idempotencia");--> statement-breakpoint
CREATE INDEX "gastos_centro_sede_fecha" ON "gastos" USING btree ("centro_id","sede_id","fecha");