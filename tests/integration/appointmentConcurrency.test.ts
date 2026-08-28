import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";

const hasDb = !!process.env.DATABASE_URL;

// Gate entire suite when no DATABASE_URL (CI without docker)
describe.skipIf(!hasDb)("T-029 two-worker concurrency (real PG)", () => {
  // Lazy import after dotenv so DATABASE_URL is present
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let pool: { end: () => Promise<void> };
  let clientes: typeof import("@/db/schema").clientes;
  let vehiculos: typeof import("@/db/schema").vehiculos;
  let servicios: typeof import("@/db/schema").servicios;
  let turnos: typeof import("@/db/schema").turnos;

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    pool = dbMod.pool;
    const schema = await import("@/db/schema");
    clientes = schema.clientes;
    vehiculos = schema.vehiculos;
    servicios = schema.servicios;
    turnos = schema.turnos;
  });

  afterAll(async () => {
    // do not close pool here — other suites may still use it; vitest will teardown
  });

  async function seedFixture() {
    const { createAppointment } = await import("@/services/appointmentService");
    const { workshopConfig } = await import("@/config/workshopConfig");

    const suffix = Math.random().toString(36).slice(2, 8);
    const email1 = `t029-a-${suffix}@example.com`;
    const email2 = `t029-b-${suffix}@example.com`;

    const [cliente1] = await db
      .insert(clientes)
      .values({
        nombre: "T029",
        apellido: "A",
        telefono: `11${suffix}1`,
        email: email1,
      })
      .returning();
    const [cliente2] = await db
      .insert(clientes)
      .values({
        nombre: "T029",
        apellido: "B",
        telefono: `11${suffix}2`,
        email: email2,
      })
      .returning();

    const plate1 = `T0${suffix.slice(0, 4).toUpperCase()}1`.padEnd(7, "X").slice(0, 7);
    const plate2 = `T0${suffix.slice(0, 4).toUpperCase()}2`.padEnd(7, "X").slice(0, 7);

    const [vehiculo1] = await db
      .insert(vehiculos)
      .values({
        clienteId: cliente1.id,
        marca: "Toyota",
        modelo: "Corolla",
        anio: 2020,
        patente: plate1,
      })
      .returning();
    const [vehiculo2] = await db
      .insert(vehiculos)
      .values({
        clienteId: cliente2.id,
        marca: "Toyota",
        modelo: "Corolla",
        anio: 2021,
        patente: plate2,
      })
      .returning();

    const svcName = `T029-svc-${suffix}`;
    const [servicio] = await db
      .insert(servicios)
      .values({
        nombre: svcName,
        descripcion: "T029 concurrency fixture",
        duracionMinutos: 60,
        activo: true,
      })
      .returning();

    const owner1 = { id: cliente1.id, email: cliente1.email, role: "CLIENTE" as const };
    const owner2 = { id: cliente2.id, email: cliente2.email, role: "CLIENTE" as const };

    // Unique slot per test run: pick next open weekday at 10:00 BA to avoid collisions
    // Use a deterministic future date far enough to avoid overlap with other runs
    const slot10Ba = "2026-09-10T10:00:00-03:00"; // Thu 10:00 BA -> 13:00Z, duration 60 inside 09-12
    const slot10 = new Date(slot10Ba); // UTC 13:00Z
    const slot11Ba = "2026-09-10T11:00:00-03:00"; // 14:00Z, adjacent half-open

    const config = {
      timezone: workshopConfig.timezone as "America/Argentina/Buenos_Aires",
      operatingHours: workshopConfig.operatingHours,
      capacityPerSlot: 1 as const,
    };

    const cleanup = async () => {
      // Delete in FK order
      try {
        await db.delete(turnos).where(sql`${turnos.servicioId} = ${servicio.id}`);
      } catch {}
      try {
        await db.delete(vehiculos).where(sql`${vehiculos.id} IN (${vehiculo1.id}, ${vehiculo2.id})`);
      } catch {}
      try {
        await db.delete(servicios).where(sql`${servicios.id} = ${servicio.id}`);
      } catch {}
      try {
        await db.delete(clientes).where(sql`${clientes.id} IN (${cliente1.id}, ${cliente2.id})`);
      } catch {}
    };

    return {
      cliente1,
      cliente2,
      vehiculo1,
      vehiculo2,
      servicio,
      owner1,
      owner2,
      slot10Ba,
      slot10,
      slot11Ba,
      slot11: new Date(slot11Ba),
      config,
      cleanup,
      createAppointment,
    };
  }

  it("1 × 201 + 1 × 409 for same slot capacity=1 (tstzrange && half-open)", async () => {
    const f = await seedFixture();
    try {
      const results = await Promise.allSettled([
        f.createAppointment(
          { db, config: f.config },
          {
            vehicleId: f.vehiculo1.id,
            serviceId: f.servicio.id,
            startDateTime: f.slot10,
            authUser: f.owner1,
          },
        ),
        f.createAppointment(
          { db, config: f.config },
          {
            vehicleId: f.vehiculo2.id,
            serviceId: f.servicio.id,
            startDateTime: f.slot10,
            authUser: f.owner2,
          },
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const reason = (rejected[0] as PromiseRejectedResult).reason as { code?: string; message?: string };
      expect(reason.code).toBe("APPOINTMENT_NOT_AVAILABLE");
      expect(String(reason.message)).toContain("El horario seleccionado ya no se encuentra disponible");

      // DB count 1 for that slot (tstzrange &&)
      const rows = await db
        .select()
        .from(turnos)
        .where(sql`tstzrange(${turnos.fechaHoraInicio}, ${turnos.fechaHoraFin}) && tstzrange(${f.slot10}, ${new Date(f.slot10.getTime() + 60 * 60_000)}) AND ${turnos.estado} IN ('PENDIENTE','CONFIRMADO')`);
      expect(rows).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });

  it("adjacent 10-11 vs 11-12 both 201 — half-open [) does not collide", async () => {
    const f = await seedFixture();
    try {
      const r1 = await f.createAppointment(
        { db, config: f.config },
        {
          vehicleId: f.vehiculo1.id,
          serviceId: f.servicio.id,
          startDateTime: f.slot10,
          authUser: f.owner1,
        },
      );
      expect(r1.status).toBe("PENDIENTE");
      // Adjacent slot 11:00 BA uses different vehicle/owner but same service; [, ) so 10-11 && 11-12 false
      const r2 = await f.createAppointment(
        { db, config: f.config },
        {
          vehicleId: f.vehiculo2.id,
          serviceId: f.servicio.id,
          startDateTime: f.slot11,
          authUser: f.owner2,
        },
      );
      expect(r2.status).toBe("PENDIENTE");

      const rows = await db
        .select()
        .from(turnos)
        .where(sql`${turnos.servicioId} = ${f.servicio.id}`);
      // Both persisted
      expect(rows.length).toBe(2);
    } finally {
      await f.cleanup();
    }
  });
});
