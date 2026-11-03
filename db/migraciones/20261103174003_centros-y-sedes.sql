CREATE TABLE "centros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"zona_horaria" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sedes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"es_central" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_centro_id_centros_id_fk" FOREIGN KEY ("centro_id") REFERENCES "public"."centros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sedes_centro_nombre" ON "sedes" USING btree ("centro_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "sedes_una_central" ON "sedes" USING btree ("centro_id") WHERE "sedes"."es_central";