CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_duracion_check" CHECK (duracion_minutos > 0 AND duracion_minutos % 5 = 0);--> statement-breakpoint
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_nombre_length" CHECK (length(nombre) BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_estado_check" CHECK (estado IN ('PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'));--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_interval_check" CHECK (fecha_hora_fin > fecha_hora_inicio);--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_patente_format" CHECK (patente ~ '^[A-Z0-9]{6,7}$');--> statement-breakpoint
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_anio_range" CHECK (anio BETWEEN 1900 AND extract(year from now())+1);--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "no_overlap_per_capacity" EXCLUDE USING gist (tstzrange(fecha_hora_inicio, fecha_hora_fin) WITH &&) WHERE (estado IN ('PENDIENTE','CONFIRMADO'));
