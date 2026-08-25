import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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
