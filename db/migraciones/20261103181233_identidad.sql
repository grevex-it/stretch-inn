CREATE SCHEMA "plataforma";
--> statement-breakpoint
CREATE TABLE "ajustes" (
	"centro_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"permiso" text NOT NULL,
	"tipo" text NOT NULL,
	CONSTRAINT "ajustes_centro_id_usuario_id_sede_id_permiso_pk" PRIMARY KEY("centro_id","usuario_id","sede_id","permiso"),
	CONSTRAINT "ajustes_tipo" CHECK ("ajustes"."tipo" in ('extra', 'quitado'))
);
--> statement-breakpoint
CREATE TABLE "asignaciones" (
	"centro_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"sede_id" uuid NOT NULL,
	"rol_id" uuid NOT NULL,
	CONSTRAINT "asignaciones_centro_id_usuario_id_sede_id_rol_id_pk" PRIMARY KEY("centro_id","usuario_id","sede_id","rol_id")
);
--> statement-breakpoint
CREATE TABLE "plataforma"."cuentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"hash_clave" text NOT NULL,
	"debe_cambiar_clave" boolean DEFAULT true NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permisos_de_rol" (
	"centro_id" uuid NOT NULL,
	"rol_id" uuid NOT NULL,
	"permiso" text NOT NULL,
	CONSTRAINT "permisos_de_rol_centro_id_rol_id_permiso_pk" PRIMARY KEY("centro_id","rol_id","permiso")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centro_id" uuid NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permisos_de_rol" ADD CONSTRAINT "permisos_de_rol_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cuenta_id_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "plataforma"."cuentas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuentas_email" ON "plataforma"."cuentas" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "roles_centro_nombre" ON "roles" USING btree ("centro_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_centro_cuenta" ON "usuarios" USING btree ("centro_id","cuenta_id");