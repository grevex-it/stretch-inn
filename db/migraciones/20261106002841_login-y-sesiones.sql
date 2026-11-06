CREATE TABLE "plataforma"."sesiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash_token" text NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"centro_id" uuid,
	"usuario_id" uuid,
	"sede_activa_id" uuid,
	"creada_en" timestamp with time zone NOT NULL,
	"ultimo_uso_en" timestamp with time zone NOT NULL,
	"revocada_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "ultima_sede_id" uuid;--> statement-breakpoint
ALTER TABLE "plataforma"."sesiones" ADD CONSTRAINT "sesiones_cuenta_id_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "plataforma"."cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sesiones_hash_token" ON "plataforma"."sesiones" USING btree ("hash_token");--> statement-breakpoint
CREATE INDEX "sesiones_cuenta" ON "plataforma"."sesiones" USING btree ("cuenta_id");