import {
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
  (table) => [index("idx_vehiculo_cliente_id").on(table.clienteId)],
);

export type VehiculoRow = typeof vehiculos.$inferSelect;
export type VehiculoInsert = typeof vehiculos.$inferInsert;
