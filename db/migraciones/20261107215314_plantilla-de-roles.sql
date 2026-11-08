ALTER TABLE "roles" ADD COLUMN "plantilla" text;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_plantilla" CHECK ("roles"."plantilla" in ('dueno'));