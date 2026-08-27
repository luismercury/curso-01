import { servicios } from "@/db/schema";

/**
 * Canonical v1 seed rows — satisfy DB CHECKs:
 *  - duracionMinutos > 0 AND duracionMinutos % 5 = 0
 *  - length(nombre) BETWEEN 1 AND 100, UNIQUE(nombre)
 *  - descripcion varchar(500), activo boolean NOT NULL DEFAULT true
 * All durations are within app validator range 30..120 and %5==0.
 */
export const SEED_SERVICIOS = [
  {
    nombre: "Cambio de aceite",
    descripcion: "Cambio de aceite de motor completo con filtro nuevo.",
    duracionMinutos: 60,
    activo: true,
  },
  {
    nombre: "Revisión general",
    descripcion: "Revisión completa de sistemas críticos del vehículo.",
    duracionMinutos: 120,
    activo: true,
  },
  {
    nombre: "Alineación y balanceo",
    descripcion: "Alineación de suspensión y balanceo de neumáticos.",
    duracionMinutos: 90,
    activo: true,
  },
] as const;

export interface SeedResult {
  inserted: number;
  skipped: number;
}

/**
 * Bulk INSERT with ON CONFLICT DO NOTHING on nombre.
 * Returns counts regardless of whether rows already existed.
 * `db` is a drizzle NodePgDatabase instance supplied by the caller (runner owns lifecycle).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedServicios(db: any): Promise<SeedResult> {
  const before = await db.select().from(servicios);
  await db
    .insert(servicios)
    .values([...SEED_SERVICIOS])
    .onConflictDoNothing({ target: servicios.nombre });
  const after = await db.select().from(servicios);
  const inserted = after.length - before.length;
  return { inserted, skipped: SEED_SERVICIOS.length - inserted };
}
