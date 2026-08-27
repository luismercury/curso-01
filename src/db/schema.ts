import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Cliente (T-005) — first persisted domain entity.
 *
 * INV-06: timestamps are TIMESTAMPTZ (UTC in storage).
 * INV-08: DB columns snake_case; DTO mapping to camelCase happens in
 * src/db/mappers/cliente.ts.
 *
 * $onUpdate touch note (design D2): fires for every Drizzle UPDATE regardless
 * of caller. Raw-SQL/psql writes bypass it — reassess a DB trigger at T-009
 * hardening if a non-Drizzle writer appears.
 */
export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  apellido: varchar("apellido", { length: 100 }).notNull(),
  telefono: varchar("telefono", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ClienteRow = typeof clientes.$inferSelect;
export type ClienteInsert = typeof clientes.$inferInsert;

/**
 * Vehiculo (T-006) — second persisted domain entity.
 *
 * INV-06: timestamps are TIMESTAMPTZ (UTC in storage).
 * INV-08: DB columns snake_case (marca/modelo/anio/patente stay Spanish per
 * Technical-spec §8.1b); DTO mapping to English camelCase happens in
 * src/db/mappers/vehiculo.ts.
 *
 * FK RESTRICT blocks deleting a cliente that still owns vehicles (F-02).
 * Postgres does not auto-index FK columns, so idx_vehiculo_cliente_id backs
 * findByClienteId and future joins. patente UNIQUE is global (one plate,
 * one vehicle nationwide). No DB CHECKs — deferred to T-009 hardening.
 */
export const vehiculos = pgTable(
  "vehiculos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    marca: varchar("marca", { length: 100 }).notNull(),
    modelo: varchar("modelo", { length: 100 }).notNull(),
    anio: integer("anio").notNull(),
    patente: varchar("patente", { length: 7 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_vehiculo_cliente_id").on(table.clienteId),
    check("vehiculos_patente_format", sql`patente ~ '^[A-Z0-9]{6,7}$'`),
    check(
      "vehiculos_anio_range",
      sql`anio BETWEEN 1900 AND extract(year from now())+1`,
    ),
  ],
);

export type VehiculoRow = typeof vehiculos.$inferSelect;
export type VehiculoInsert = typeof vehiculos.$inferInsert;

/**
 * Servicio (T-007) — third persisted domain entity.
 *
 * INV-05: duracionMinutos consumed by slot generation (INV-05).
 * INV-06: timestamps are TIMESTAMPTZ (UTC in storage).
 * INV-08: DB columns snake_case (nombre/descripcion/duracion_minutos/activo
 * stay Spanish); DTO mapping to English camelCase happens in
 * src/db/mappers/servicio.ts. No DB CHECKs — deferred to T-009.
 */
export const servicios = pgTable(
  "servicios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: varchar("nombre", { length: 100 }).notNull().unique(),
    descripcion: varchar("descripcion", { length: 500 }),
    duracionMinutos: integer("duracion_minutos").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "servicios_duracion_check",
      sql`duracion_minutos > 0 AND duracion_minutos % 5 = 0`,
    ),
    check(
      "servicios_nombre_length",
      sql`length(nombre) BETWEEN 1 AND 100`,
    ),
  ],
);

export type ServicioRow = typeof servicios.$inferSelect;
export type ServicioInsert = typeof servicios.$inferInsert;

/**
 * Turno (T-008) — fourth persisted domain entity.
 *
 * INV-05: fechaHoraFin snapshot = fechaHoraInicio + servicio.durationMinutes.
 * INV-06: timestamps are TIMESTAMPTZ (UTC in storage).
 * INV-08: DB columns snake_case (cliente_id/vehiculo_id/servicio_id/
 * fecha_hora_inicio/fecha_hora_fin/estado); DTO mapping to English camelCase
 * happens in src/db/mappers/turno.ts. No DB CHECKs — deferred to T-009.
 *
 * FKs RESTRICT (not CASCADE/SET NULL) preserve audit trail; indexes on FKs +
 * fecha_hora_inicio back filtering and joins.
 */
// EXCLUDE gap: Drizzle has no EXCLUDE DSL. Constraint no_overlap_per_capacity
// is created manually in drizzle/0004_*.sql (CREATE EXTENSION btree_gist + ALTER
// TABLE ... ADD CONSTRAINT ... EXCLUDE USING gist) and verified via
// pg_constraint contype='x' + file-content tests. See Technical-spec §6.4 / §10.
export const turnos = pgTable(
  "turnos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    vehiculoId: uuid("vehiculo_id")
      .notNull()
      .references(() => vehiculos.id, { onDelete: "restrict" }),
    servicioId: uuid("servicio_id")
      .notNull()
      .references(() => servicios.id, { onDelete: "restrict" }),
    fechaHoraInicio: timestamp("fecha_hora_inicio", { withTimezone: true })
      .notNull(),
    fechaHoraFin: timestamp("fecha_hora_fin", { withTimezone: true }).notNull(),
    estado: varchar("estado", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_turno_cliente_id").on(table.clienteId),
    index("idx_turno_vehiculo_id").on(table.vehiculoId),
    index("idx_turno_servicio_id").on(table.servicioId),
    index("idx_turno_fecha_hora_inicio").on(table.fechaHoraInicio),
    check(
      "turnos_estado_check",
      sql`estado IN ('PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO')`,
    ),
    check(
      "turnos_interval_check",
      sql`fecha_hora_fin > fecha_hora_inicio`,
    ),
  ],
);

export type TurnoRow = typeof turnos.$inferSelect;
export type TurnoInsert = typeof turnos.$inferInsert;
