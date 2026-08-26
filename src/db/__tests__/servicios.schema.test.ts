import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

// Production modules under test — RED: these do not exist yet before GREEN.
import { servicios } from "@/db/schema";
import type { ServicioRow } from "@/db/schema";
import { servicioInputSchema } from "@/db/validators/servicio";
import { toServicioDTO } from "@/db/mappers/servicio";

function tableConfig() {
  return getTableConfig(servicios);
}

function columnsByName() {
  const config = tableConfig();
  expect(config.name).toBe("servicios");
  return new Map(config.columns.map((column) => [column.name, column]));
}

describe("servicios table shape (REQ-SRV-01)", () => {
  it("is named 'servicios' with exactly the spec'd columns", () => {
    const config = tableConfig();
    expect(config.name).toBe("servicios");
    const names = config.columns.map((c) => c.name).sort();
    expect(names).toEqual([
      "activo",
      "created_at",
      "descripcion",
      "duracion_minutos",
      "id",
      "nombre",
      "updated_at",
    ]);
  });

  it("defines id as uuid primary key with random default", () => {
    const id = columnsByName().get("id");
    expect(id).toBeDefined();
    expect(id?.columnType).toBe("PgUUID");
    expect(id?.primary).toBe(true);
    expect(id?.hasDefault).toBe(true);
  });

  it("defines nombre as varchar(100) NOT NULL UNIQUE", () => {
    const nombre = columnsByName().get("nombre");
    expect(nombre).toBeDefined();
    expect(nombre?.columnType).toBe("PgVarchar");
    expect((nombre as { length?: number }).length).toBe(100);
    expect(nombre?.notNull).toBe(true);
    expect(nombre?.isUnique).toBe(true);
  });

  it("defines descripcion as varchar(500) nullable", () => {
    const descripcion = columnsByName().get("descripcion");
    expect(descripcion).toBeDefined();
    expect(descripcion?.columnType).toBe("PgVarchar");
    expect((descripcion as { length?: number }).length).toBe(500);
    expect(descripcion?.notNull).toBe(false);
  });

  it("defines duracion_minutos as integer NOT NULL (col duracion_minutos)", () => {
    const dur = columnsByName().get("duracion_minutos");
    expect(dur).toBeDefined();
    expect(dur?.columnType).toBe("PgInteger");
    expect(dur?.notNull).toBe(true);
  });

  it("defines activo as boolean NOT NULL DEFAULT true", () => {
    const activo = columnsByName().get("activo");
    expect(activo).toBeDefined();
    expect(activo?.columnType).toBe("PgBoolean");
    expect(activo?.notNull).toBe(true);
    expect(activo?.hasDefault).toBe(true);
  });

  it("defines created_at/updated_at as TIMESTAMPTZ NOT NULL with defaults (INV-06)", () => {
    for (const name of ["created_at", "updated_at"]) {
      const column = columnsByName().get(name);
      expect(column, name).toBeDefined();
      expect(column?.columnType).toBe("PgTimestamp");
      expect((column as { withTimezone?: boolean }).withTimezone).toBe(true);
      expect(column?.notNull).toBe(true);
      expect(column?.hasDefault).toBe(true);
    }
  });

  it("attaches $onUpdate touch to updated_at only", () => {
    const updatedAt = columnsByName().get("updated_at");
    const createdAt = columnsByName().get("created_at");
    expect(typeof (updatedAt as { onUpdateFn?: unknown }).onUpdateFn).toBe(
      "function",
    );
    expect((createdAt as { onUpdateFn?: unknown }).onUpdateFn).toBeUndefined();
  });
});

describe("toServicioDTO mapper (REQ-SRV-04)", () => {
  const row = (): ServicioRow => ({
    id: "1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    nombre: "Alineacion",
    descripcion: "desc",
    duracionMinutos: 90,
    activo: true,
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  });

  it("maps Spanish DB names to English DTO keys with no snake_case leakage", () => {
    const dto = toServicioDTO(row());
    expect(dto).toEqual({
      id: row().id,
      name: "Alineacion",
      description: "desc",
      durationMinutes: 90,
      active: true,
      createdAt: new Date("2026-08-25T13:00:00.000Z"),
      updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    });
    expect(dto).not.toHaveProperty("nombre");
    expect(dto).not.toHaveProperty("descripcion");
    expect(dto).not.toHaveProperty("duracion_minutos");
    expect(dto).not.toHaveProperty("duracionMinutos");
    expect(dto).not.toHaveProperty("activo");
    expect(dto).not.toHaveProperty("created_at");
    expect(dto).not.toHaveProperty("updated_at");
  });

  it("preserves values for a different row with null description (triangulation)", () => {
    const source = row();
    source.nombre = "Cambio de aceite";
    source.descripcion = null;
    source.duracionMinutos = 60;
    source.activo = false;
    const dto = toServicioDTO(source);
    expect(dto.name).toBe("Cambio de aceite");
    expect(dto.description).toBeNull();
    expect(dto.durationMinutes).toBe(60);
    expect(dto.active).toBe(false);
    expect(dto.createdAt).toBe(source.createdAt);
  });
});

describe("servicioInputSchema validator (REQ-SRV-02)", () => {
  const valid = () => ({
    nombre: "Cambio de aceite",
    descripcion: "desc",
    duracionMinutos: 60,
    activo: true,
  });

  it("accepts valid durations 30,60,120 and trims nombre", () => {
    for (const dur of [30, 60, 120]) {
      const parsed = servicioInputSchema.parse({
        nombre: "  A  ",
        descripcion: null,
        duracionMinutos: dur,
      });
      expect(parsed.nombre).toBe("A");
      expect(parsed.duracionMinutos).toBe(dur);
    }
    const withNull = servicioInputSchema.parse({
      nombre: "A",
      descripcion: null,
      duracionMinutos: 60,
    });
    expect(withNull.descripcion).toBeNull();
  });

  it("rejects duration out-of-range 29,121,0", () => {
    for (const dur of [29, 121, 0]) {
      expect(
        () => servicioInputSchema.parse({ ...valid(), duracionMinutos: dur }),
        `duracionMinutos ${dur}`,
      ).toThrow();
    }
  });

  it("rejects duration non-multiple-of-5: 31,47,62,32.5,\"33\"", () => {
    for (const dur of [31, 47, 62, 32.5, "33" as unknown as number]) {
      expect(
        () => servicioInputSchema.parse({ ...valid(), duracionMinutos: dur }),
        `duracionMinutos ${String(dur)}`,
      ).toThrow();
    }
  });

  it("rejects nombre length violations: empty and 101 chars", () => {
    expect(() =>
      servicioInputSchema.parse({ ...valid(), nombre: "" }),
    ).toThrow();
    expect(() =>
      servicioInputSchema.parse({ ...valid(), nombre: "   " }),
    ).toThrow();
    expect(() =>
      servicioInputSchema.parse({ ...valid(), nombre: "x".repeat(101) }),
    ).toThrow();
  });

  it("rejects descripcion >500 and allows empty/undefined/null", () => {
    expect(() =>
      servicioInputSchema.parse({ ...valid(), descripcion: "x".repeat(501) }),
    ).toThrow();
    expect(() =>
      servicioInputSchema.parse({ ...valid(), descripcion: "" }),
    ).not.toThrow();
    expect(() =>
      servicioInputSchema.parse({ ...valid(), descripcion: undefined }),
    ).not.toThrow();
    expect(() =>
      servicioInputSchema.parse({ ...valid(), descripcion: null }),
    ).not.toThrow();
    const trimmed = servicioInputSchema.parse({
      ...valid(),
      descripcion: "  hello  ",
    });
    expect(trimmed.descripcion).toBe("hello");
  });

  it("allows activo optional and defaults to true", () => {
    const parsed = servicioInputSchema.parse({
      nombre: "A",
      duracionMinutos: 60,
    });
    expect(parsed.activo).toBe(true);
    const withFalse = servicioInputSchema.parse({
      nombre: "A",
      duracionMinutos: 60,
      activo: false,
    });
    expect(withFalse.activo).toBe(false);
  });
});

describe("servicios repository negative scope (REQ-SRV-03)", () => {
  it("exposes only expected exports and no ServiceService in repo file", () => {
    const source = readFileSync(
      resolve(__dirname, "../repositories/servicios.ts"),
      "utf8",
    );
    expect(source).toMatch(/createServicio/);
    expect(source).toMatch(/findServicioById/);
    expect(source).toMatch(/findServicioByNombre/);
    expect(source).toMatch(/listServicios/);
    expect(source).not.toMatch(/ServiceService/);
    expect(source).not.toMatch(/23503/);
    expect(source).toMatch(/23505/);
    expect(source).toMatch(/hasPgCode/);
  });
});

describe("t007 negative scope guards (REQ-SRV-06)", () => {
  it("ships no HTTP route under src/app/api for services", () => {
    const apiDir = resolve(__dirname, "../../app/api");
    let entries: string[] = [];
    try {
      entries = readdirSync(apiDir, { recursive: true }).map(String);
    } catch {
      // No api directory — zero matches.
    }
    const serviceRoutes = entries.filter((entry) =>
      entry.replaceAll("\\", "/").includes("services"),
    );
    expect(serviceRoutes).toEqual([]);
  });

  it("has no ServiceService or price field anywhere in src/ (deferred)", () => {
    const schemaSource = readFileSync(resolve(__dirname, "../schema.ts"), "utf8");
    expect(schemaSource).not.toMatch(/price/i);
    expect(schemaSource).not.toContain("deletedAt");
    expect(schemaSource).not.toContain("deleted_at");
    const servicesDir = resolve(__dirname, "../services");
    expect(existsSync(servicesDir)).toBe(false);
  });

  it("defines no DB CHECK for duracion in drizzle sql", () => {
    const drizzleDir = resolve(__dirname, "../../../drizzle");
    let files: string[] = [];
    try {
      files = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
    } catch {
      files = [];
    }
    for (const file of files) {
      const sql = readFileSync(resolve(drizzleDir, file), "utf8");
      expect(sql).not.toMatch(/CHECK.*duracion/i);
    }
  });

  it("has no citext or composite UNIQUE leaked", () => {
    const schemaSource = readFileSync(resolve(__dirname, "../schema.ts"), "utf8");
    expect(schemaSource).not.toMatch(/citext/i);
  });
});
