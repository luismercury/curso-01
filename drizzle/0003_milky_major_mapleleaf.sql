CREATE TABLE "turnos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"vehiculo_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"fecha_hora_inicio" timestamp with time zone NOT NULL,
	"fecha_hora_fin" timestamp with time zone NOT NULL,
	"estado" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_vehiculo_id_vehiculos_id_fk" FOREIGN KEY ("vehiculo_id") REFERENCES "public"."vehiculos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_turno_cliente_id" ON "turnos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_turno_vehiculo_id" ON "turnos" USING btree ("vehiculo_id");--> statement-breakpoint
CREATE INDEX "idx_turno_servicio_id" ON "turnos" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "idx_turno_fecha_hora_inicio" ON "turnos" USING btree ("fecha_hora_inicio");