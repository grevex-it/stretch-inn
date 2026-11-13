CREATE TABLE "camas_de_sede" (
	"sede_id" uuid PRIMARY KEY NOT NULL,
	"centro_id" uuid NOT NULL,
	"camas" integer NOT NULL,
	CONSTRAINT "camas_de_sede_camas" CHECK ("camas_de_sede"."camas" between 1 and 500)
);
