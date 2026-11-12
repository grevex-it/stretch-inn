CREATE TABLE "reglas_de_recuperacion" (
	"sede_id" uuid PRIMARY KEY NOT NULL,
	"centro_id" uuid NOT NULL,
	"anticipacion_minutos" integer NOT NULL,
	"maximo_por_abono" integer NOT NULL,
	"sin_abono" boolean NOT NULL,
	CONSTRAINT "reglas_de_recuperacion_anticipacion" CHECK ("reglas_de_recuperacion"."anticipacion_minutos" between 0 and 10080),
	CONSTRAINT "reglas_de_recuperacion_maximo" CHECK ("reglas_de_recuperacion"."maximo_por_abono" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "recuperaciones" ALTER COLUMN "credito_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recuperaciones" ADD COLUMN "empieza_en" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "recuperaciones_alumno_sede_empieza" ON "recuperaciones" USING btree ("alumno_id","sede_id","empieza_en");