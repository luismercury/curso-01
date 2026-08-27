import "dotenv/config";

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

/**
 * t009 Tier C dual-source — RED gate. Unit part (file-content) must FAIL
 * before GREEN; integration part is gated skipIf(!DATABASE_URL) and queries
 * pg_constraint / pg_extension / information_schema.check_constraints plus
 * raw bypass INSERTs expecting 23514/23P01.
 *
 * Run with: DATABASE_URL=... pnpm test --run src/db/__tests__/t009-integrity.integration.test.ts
 * Requires: docker compose up -d && pnpm db:migrate
 */
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

describe("t009 dual-source Tier C — file-content (no DB)", () => {
  it("schema file contains btree_gist + CHECKs + EXCLUDE no_overlap_per_capacity", () => {
    const source = readFileSync(resolve("src/db/schema.ts"), "utf8");
    expect(source).toMatch(/btree_gist/);
    expect(source).toMatch(/vehiculos_patente_format/);
    expect(source).toMatch(/vehiculos_anio_range/);
    expect(source).toMatch(/servicios_duracion_check/);
    expect(source).toMatch(/servicios_nombre_length/);
    expect(source).toMatch(/turnos_estado_check/);
    expect(source).toMatch(/turnos_interval_check/);
    expect(source).toMatch(/no_overlap_per_capacity/);
  });

  it("migration 0004 exists with btree_gist preamble and EXCLUDE, journal idx 4", () => {
    const journal = JSON.parse(readFileSync(resolve("drizzle/meta/_journal.json"), "utf8"));
    expect(journal.entries).toHaveLength(5);
    const last = journal.entries[journal.entries.length - 1];
    expect(last.idx).toBe(4);
    expect(last.tag).toMatch(/^0004_/);
    const sql = readFileSync(resolve(`drizzle/${last.tag}.sql`), "utf8");
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS "btree_gist"/);
    expect(sql).toMatch(/no_overlap_per_capacity/);
    expect(sql).toMatch(/EXCLUDE USING gist/);
    expect(sql).toMatch(/tstzrange/);
  });

  it("_journal.json has linear idx 0..4", () => {
    const journal = JSON.parse(readFileSync(resolve("drizzle/meta/_journal.json"), "utf8"));
    const idxs = journal.entries.map((e: { idx: number }) => e.idx).sort((a: number, b: number) => a - b);
    expect(idxs).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("t009 dual-source Tier C — pg_constraint / pg_extension (gated)", () => {
  const d = it.skipIf(!databaseUrl);

  d("pg_constraint shows contype='c' CHECKs and contype='x' EXCLUDE no_overlap_per_capacity", async () => {
    const checks = await pool!.query<{ conname: string; contype: string; consrc?: string }>(
      "SELECT conname, contype FROM pg_constraint WHERE conrelid='turnos'::regclass ORDER BY conname",
    );
    const byName = new Map(checks.rows.map((r) => [r.conname, r.contype]));
    expect(byName.get("turnos_estado_check")).toBe("c");
    expect(byName.get("turnos_interval_check")).toBe("c");
    expect(byName.get("no_overlap_per_capacity")).toBe("x");
    // vehiculos/servicios checks also present
    const vehChecks = await pool!.query<{ conname: string; contype: string }>(
      "SELECT conname, contype FROM pg_constraint WHERE conrelid='vehiculos'::regclass",
    );
    const vehNames = vehChecks.rows.map((r) => r.conname);
    expect(vehNames).toContain("vehiculos_patente_format");
    expect(vehNames).toContain("vehiculos_anio_range");

    const srvChecks = await pool!.query<{ conname: string; contype: string }>(
      "SELECT conname, contype FROM pg_constraint WHERE conrelid='servicios'::regclass",
    );
    const srvNames = srvChecks.rows.map((r) => r.conname);
    expect(srvNames).toContain("servicios_duracion_check");
    expect(srvNames).toContain("servicios_nombre_length");
  });

  d("pg_extension btree_gist exists", async () => {
    const res = await pool!.query("SELECT extname FROM pg_extension WHERE extname='btree_gist'");
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].extname).toBe("btree_gist");
  });

  d("information_schema.check_constraints matches patterns", async () => {
    const res = await pool!.query<{ constraint_name: string; check_clause: string }>(
      "SELECT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE 'turnos_%' OR constraint_name LIKE 'vehiculos_%' OR constraint_name LIKE 'servicios_%'",
    );
    const clauses = res.rows.map((r) => r.check_clause);
    // Postgres normalizes IN (... ) to = ANY (ARRAY[...]); accept either form
    expect(clauses.join(" ")).toMatch(/estado/);
    expect(clauses.join(" ")).toMatch(/PENDIENTE/);
    expect(clauses.join(" ")).toMatch(/fecha_hora_fin > fecha_hora_inicio/);
    expect(clauses.join(" ")).toMatch(/duracion_minutos/);
    expect(clauses.join(" ")).toMatch(/patente/);
  });

  d("raw SQL bypass — invalid patente/anio/duracion/estado/interval → 23514; overlapping PENDIENTE/CONFIRMADO → 23P01; RECHAZADO overlap allowed", async () => {
    // This is a smoke proof that DB defense is active — exact SQL exercised
    // after GREEN migration. Before GREEN, constraints absent so inserts would succeed (FAIL).
    // We assert that invalid inserts are rejected; if DB not hardened they'll pass and test fails.
    const clienteRes = await pool!.query<{ id: string }>(
      "INSERT INTO clientes (nombre, apellido, telefono, email) VALUES ('Test','User','+54 11 1234','t009-check-'||gen_random_uuid()::text) RETURNING id",
    );
    const clienteId = clienteRes.rows[0].id;
    // invalid patente
    await expect(
      pool!.query("INSERT INTO vehiculos (cliente_id, marca, modelo, anio, patente) VALUES ($1,'Toyota','Corolla',2020,'ab-12')", [clienteId]),
    ).rejects.toMatchObject({ code: "23514" });
    // invalid anio
    await expect(
      pool!.query("INSERT INTO vehiculos (cliente_id, marca, modelo, anio, patente) VALUES ($1,'Toyota','Corolla',1800,'AB1234')", [clienteId]),
    ).rejects.toMatchObject({ code: "23514" });
    // invalid duracion
    await expect(
      pool!.query("INSERT INTO servicios (nombre, duracion_minutos) VALUES ('bad-dur-'||gen_random_uuid()::text, 7)"),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pool!.query("INSERT INTO servicios (nombre, duracion_minutos) VALUES ('bad-zero-'||gen_random_uuid()::text, 0)"),
    ).rejects.toMatchObject({ code: "23514" });

    // valid servicio for turno tests
    const servicioRes = await pool!.query<{ id: string }>(
      "INSERT INTO servicios (nombre, duracion_minutos) VALUES ('t009-srv-'||gen_random_uuid()::text, 60) RETURNING id",
    );
    const servicioId = servicioRes.rows[0].id;
    const vehRes = await pool!.query<{ id: string }>(
      "INSERT INTO vehiculos (cliente_id, marca, modelo, anio, patente) VALUES ($1,'Toyota','Corolla',2020, 'T'||upper(substr(md5(random()::text),1,6))) RETURNING id",
      [clienteId],
    );
    const vehiculoId = vehRes.rows[0].id;
    // invalid estado
    await expect(
      pool!.query(
        "INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado) VALUES ($1,$2,$3, now(), now()+interval '1 hour', 'COMPLETADO')",
        [clienteId, vehiculoId, servicioId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    // zero interval
    await expect(
      pool!.query(
        "INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado) VALUES ($1,$2,$3, now(), now(), 'PENDIENTE')",
        [clienteId, vehiculoId, servicioId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    // overlapping PENDIENTE should be blocked with 23P01
    const baseStart = new Date("2026-09-01T09:00:00.000Z");
    const baseEnd = new Date("2026-09-01T10:00:00.000Z");
    await pool!.query(
      "INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado) VALUES ($1,$2,$3,$4,$5,'PENDIENTE')",
      [clienteId, vehiculoId, servicioId, baseStart.toISOString(), baseEnd.toISOString()],
    );
    await expect(
      pool!.query(
        "INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado) VALUES ($1,$2,$3,$4,$5,'PENDIENTE')",
        [clienteId, vehiculoId, servicioId, new Date("2026-09-01T09:30:00.000Z").toISOString(), new Date("2026-09-01T10:30:00.000Z").toISOString()],
      ),
    ).rejects.toMatchObject({ code: "23P01" });

    // RECHAZADO overlap is allowed — insert RECHAZADO then overlapping PENDIENTE should succeed
    await pool!.query(
      "INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado) VALUES ($1,$2,$3,$4,$5,'RECHAZADO')",
      [clienteId, vehiculoId, servicioId, new Date("2026-09-01T11:00:00.000Z").toISOString(), new Date("2026-09-01T12:00:00.000Z").toISOString()],
    );
    await expect(
      pool!.query(
        "INSERT INTO turnos (cliente_id, vehiculo_id, servicio_id, fecha_hora_inicio, fecha_hora_fin, estado) VALUES ($1,$2,$3,$4,$5,'PENDIENTE')",
        [clienteId, vehiculoId, servicioId, new Date("2026-09-01T11:30:00.000Z").toISOString(), new Date("2026-09-01T12:30:00.000Z").toISOString()],
      ),
    ).resolves.toBeDefined();

    // cleanup
    await pool!.query("DELETE FROM turnos WHERE cliente_id=$1", [clienteId]);
    await pool!.query("DELETE FROM vehiculos WHERE cliente_id=$1", [clienteId]);
    await pool!.query("DELETE FROM servicios WHERE id=$1", [servicioId]);
    await pool!.query("DELETE FROM clientes WHERE id=$1", [clienteId]);
  });
});
