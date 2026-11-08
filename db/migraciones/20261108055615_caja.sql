CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"alumno_id" uuid NOT NULL,
	"cuota_id" uuid NOT NULL,
	"monto" bigint NOT NULL,
	"medio" text NOT NULL,
	"clave_idempotencia" text NOT NULL,
	"registrado_por_tipo" text NOT NULL,
	"registrado_por_id" uuid NOT NULL,
	"registrado_en" timestamp with time zone NOT NULL,
	"anulado_en" timestamp with time zone,
	"anulado_por_tipo" text,
	"anulado_por_id" uuid,
	"motivo_anulacion" text,
	CONSTRAINT "pagos_monto" CHECK ("pagos"."monto" > 0),
	CONSTRAINT "pagos_medio" CHECK ("pagos"."medio" in ('efectivo', 'transferencia', 'debito', 'credito', 'mercadopago')),
	CONSTRAINT "pagos_registrado_por" CHECK ("pagos"."registrado_por_tipo" in ('usuario', 'soporte')),
	CONSTRAINT "pagos_anulacion" CHECK (("pagos"."anulado_en" is null) = ("pagos"."motivo_anulacion" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pagos_centro_clave" ON "pagos" USING btree ("centro_id","clave_idempotencia");--> statement-breakpoint
CREATE INDEX "pagos_centro_sede_registrado" ON "pagos" USING btree ("centro_id","sede_id","registrado_en");