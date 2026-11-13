CREATE TABLE "profes_de_sede" (
	"sede_id" uuid PRIMARY KEY NOT NULL,
	"centro_id" uuid NOT NULL,
	"profe_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clases" ADD COLUMN "profe_id" uuid;--> statement-breakpoint
ALTER TABLE "ocurrencias" ADD COLUMN "profe_id" uuid;