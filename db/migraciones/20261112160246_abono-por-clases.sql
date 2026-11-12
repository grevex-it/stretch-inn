ALTER TABLE "cuotas" DROP CONSTRAINT "cuotas_ciclo";--> statement-breakpoint
ALTER TABLE "planes" DROP CONSTRAINT "planes_clases";--> statement-breakpoint
ALTER TABLE "cuotas" ALTER COLUMN "hasta" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "planes" ALTER COLUMN "clases_por_semana" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cuotas" ADD COLUMN "clases" smallint DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "planes" ADD COLUMN "clases" smallint DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "cuotas" ADD CONSTRAINT "cuotas_clases" CHECK ("cuotas"."clases" between 1 and 100);--> statement-breakpoint
ALTER TABLE "planes" ADD CONSTRAINT "planes_clases_del_paquete" CHECK ("planes"."clases" between 1 and 100);