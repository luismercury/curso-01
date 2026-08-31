import "dotenv/config";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Db } from "@/db";
import {
  getDaySchedule,
  getWeeklySchedule,
  getWorkshopConfig,
  upsertDaySchedule,
} from "@/db/repositories/workshopSchedules";
import { DEFAULT_OPERATING_INTERVALS } from "@/config/workshopSchedule";
import { ValidationError } from "@/config/workshopSchedule";

/**
 * T-036b PR #1 repository integration tests.
 * skipIf(!DATABASE_URL) — run after `docker compose up -d && pnpm db:migrate`.
 *
 * Covers:
 *  - empty table → Mon-Fri DEFAULT_OPERATING_INTERVALS, Sat/Sun []
 *  - upsert round-trip with jsonb intervals
 *  - row overrides only that dow (others still fallback)
 *  - validateIntervals guard fires before write (no DB mutation)
 *  - getWorkshopConfig composes full WorkshopConfig
 */
const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const db = pool ? (drizzle(pool) satisfies Db) : null;

function getDb(): Db {
  if (!db) {
    throw new Error("Integration database unavailable — DATABASE_URL must be set");
  }
  return db;
}

async function truncateWorkshopSchedules(): Promise<void> {
  if (!pool) return;
  await pool.query("TRUNCATE TABLE workshop_schedules");
}

describe("workshopSchedules repository (integration — T-036b PR #1)", () => {
  const d = it.skipIf(!databaseUrl);

  d("empty table → Mon-Fri DEFAULT, Sat/Sun [] (INV-01/05 parametrizable fallback)", async () => {
    await truncateWorkshopSchedules();
    const week = await getWeeklySchedule(getDb());
    for (let dow = 0 as 0 | 1 | 2 | 3 | 4 | 5 | 6; dow <= 6; dow = (dow + 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6) {
      if (dow === 0 || dow === 6) {
        expect(week[dow]).toEqual([]);
      } else {
        expect(week[dow]).toEqual([...DEFAULT_OPERATING_INTERVALS]);
      }
    }
  });

  d("getDaySchedule returns null when no row for that dow", async () => {
    await truncateWorkshopSchedules();
    const intervals = await getDaySchedule(getDb(), 2);
    expect(intervals).toBeNull();
  });

  d("upsertDaySchedule persists jsonb intervals and reads them back", async () => {
    await truncateWorkshopSchedules();
    const custom = [{ start: "10:00", end: "13:00" }];
    const persisted = await upsertDaySchedule(getDb(), 2, custom);
    expect(persisted).toEqual(custom);

    // Round-trip via raw SQL to confirm jsonb column shape
    if (pool) {
      const rows = await pool.query<{ day_of_week: number; open_intervals: unknown }>(
        "SELECT day_of_week, open_intervals FROM workshop_schedules WHERE day_of_week = 2",
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]!.day_of_week).toBe(2);
      expect(rows.rows[0]!.open_intervals).toEqual(custom);
    }

    // Row overrides only that dow; others fall back to defaults
    const week = await getWeeklySchedule(getDb());
    expect(week[2]).toEqual(custom);
    expect(week[1]).toEqual([...DEFAULT_OPERATING_INTERVALS]);
    expect(week[6]).toEqual([]);
  });

  d("upsertDaySchedule updates an existing row (idempotent repatch)", async () => {
    await truncateWorkshopSchedules();
    await upsertDaySchedule(getDb(), 3, [{ start: "09:00", end: "12:00" }]);
    const updated = await upsertDaySchedule(getDb(), 3, [
      { start: "08:00", end: "10:00" },
      { start: "14:00", end: "17:00" },
    ]);
    expect(updated).toEqual([
      { start: "08:00", end: "10:00" },
      { start: "14:00", end: "17:00" },
    ]);
    const row = await getDaySchedule(getDb(), 3);
    expect(row).toEqual(updated);
  });

  d("upsertDaySchedule rejects invalid intervals via validateIntervals guard", async () => {
    await truncateWorkshopSchedules();
    await expect(
      upsertDaySchedule(getDb(), 4, [{ start: "12:00", end: "09:00" }]),
    ).rejects.toBeInstanceOf(ValidationError);
    // No row persisted on validation failure
    if (pool) {
      const rows = await pool.query("SELECT day_of_week FROM workshop_schedules WHERE day_of_week = 4");
      expect(rows.rows).toHaveLength(0);
    }
  });

  d("upsertDaySchedule rejects overlapping intervals via guard", async () => {
    await truncateWorkshopSchedules();
    await expect(
      upsertDaySchedule(getDb(), 5, [
        { start: "09:00", end: "12:00" },
        { start: "11:30", end: "14:00" },
      ]),
    ).rejects.toThrow(/overlapping/);
  });

  d("getWorkshopConfig composes full WorkshopConfig with frozen capacity/step/timezone", async () => {
    await truncateWorkshopSchedules();
    await upsertDaySchedule(getDb(), 2, [{ start: "08:00", end: "11:00" }]);
    const config = await getWorkshopConfig(getDb());
    expect(config.capacityPerSlot).toBe(1);
    expect(config.slotStepMinutes).toBe(30);
    expect(config.timezone).toBe("America/Argentina/Buenos_Aires");
    expect(config.operatingHours?.[2]).toEqual([{ start: "08:00", end: "11:00" }]);
    expect(config.operatingHours?.[1]).toEqual([...DEFAULT_OPERATING_INTERVALS]);
    expect(config.operatingHours?.[0]).toEqual([]);
  });

  d("CHECK constraint day_of_week BETWEEN 0 AND 6 enforced at DB level", async () => {
    await truncateWorkshopSchedules();
    // Bypass Drizzle to confirm raw-SQL 23514 fires for out-of-range
    if (pool) {
      await expect(
        pool.query("INSERT INTO workshop_schedules (day_of_week, open_intervals) VALUES (7, '[]'::jsonb)"),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        pool.query("INSERT INTO workshop_schedules (day_of_week, open_intervals) VALUES (-1, '[]'::jsonb)"),
      ).rejects.toMatchObject({ code: "23514" });
    }
  });

  if (!databaseUrl) {
    it.skip("skipped: DATABASE_URL is not set", () => {});
  }
});
