import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  AppointmentStatus,
  AppointmentStatusSchema,
  canTransition,
  isTerminal,
} from "@/domain/appointmentStateMachine";

// BA 09:00 = UTC 12:00Z — WorkshopConfig.timezone = America/Argentina/Buenos_Aires
const START_12Z = new Date("2026-09-10T12:00:00.000Z");
const NOW_11_59Z = new Date("2026-09-10T11:59:00.000Z");
const NOW_12_00Z = new Date("2026-09-10T12:00:00.000Z");
const NOW_12_00_01Z = new Date("2026-09-10T12:00:01.000Z");

describe("t034 — RN-07 exhaustive 32-cell matrix via canTransition (pure unit)", () => {
  // 4 from × 4 to × 2 roles = 32 combos, no opts (time guard not enforced)
  // True only for the 6 role-allowed edges; 26 false.
  // Spec describes "4 allowed" excluding time-gated duplicates — we assert actual prod: 6 true.
  const matrix: Array<[string, string, string, boolean]> = [
    // PENDIENTE row
    ["PENDIENTE", "PENDIENTE", "CLIENTE", false],
    ["PENDIENTE", "PENDIENTE", "ADMINISTRADOR", false],
    ["PENDIENTE", "CONFIRMADO", "CLIENTE", false],
    ["PENDIENTE", "CONFIRMADO", "ADMINISTRADOR", true],
    ["PENDIENTE", "RECHAZADO", "CLIENTE", false],
    ["PENDIENTE", "RECHAZADO", "ADMINISTRADOR", true],
    ["PENDIENTE", "CANCELADO", "CLIENTE", true],
    ["PENDIENTE", "CANCELADO", "ADMINISTRADOR", true],
    // CONFIRMADO row
    ["CONFIRMADO", "PENDIENTE", "CLIENTE", false],
    ["CONFIRMADO", "PENDIENTE", "ADMINISTRADOR", false],
    ["CONFIRMADO", "CONFIRMADO", "CLIENTE", false],
    ["CONFIRMADO", "CONFIRMADO", "ADMINISTRADOR", false],
    ["CONFIRMADO", "RECHAZADO", "CLIENTE", false],
    ["CONFIRMADO", "RECHAZADO", "ADMINISTRADOR", false],
    ["CONFIRMADO", "CANCELADO", "CLIENTE", true],
    ["CONFIRMADO", "CANCELADO", "ADMINISTRADOR", true],
    // RECHAZADO row — terminal, all false
    ["RECHAZADO", "PENDIENTE", "CLIENTE", false],
    ["RECHAZADO", "PENDIENTE", "ADMINISTRADOR", false],
    ["RECHAZADO", "CONFIRMADO", "CLIENTE", false],
    ["RECHAZADO", "CONFIRMADO", "ADMINISTRADOR", false],
    ["RECHAZADO", "RECHAZADO", "CLIENTE", false],
    ["RECHAZADO", "RECHAZADO", "ADMINISTRADOR", false],
    ["RECHAZADO", "CANCELADO", "CLIENTE", false],
    ["RECHAZADO", "CANCELADO", "ADMINISTRADOR", false],
    // CANCELADO row — terminal, all false
    ["CANCELADO", "PENDIENTE", "CLIENTE", false],
    ["CANCELADO", "PENDIENTE", "ADMINISTRADOR", false],
    ["CANCELADO", "CONFIRMADO", "CLIENTE", false],
    ["CANCELADO", "CONFIRMADO", "ADMINISTRADOR", false],
    ["CANCELADO", "RECHAZADO", "CLIENTE", false],
    ["CANCELADO", "RECHAZADO", "ADMINISTRADOR", false],
    ["CANCELADO", "CANCELADO", "CLIENTE", false],
    ["CANCELADO", "CANCELADO", "ADMINISTRADOR", false],
  ];

  it.each(matrix)(
    "canTransition(%s -> %s as %s) === %s (no opts)",
    (from, to, role, expected) => {
      expect(
        canTransition(
          from as (typeof AppointmentStatus)[number],
          to as (typeof AppointmentStatus)[number],
          role as "CLIENTE" | "ADMINISTRADOR",
        ),
      ).toBe(expected);
    },
  );

  it("matrix has exactly 32 rows and 6 true without opts", () => {
    const trues = matrix.filter(([, , , ok]) => ok).length;
    expect(matrix.length).toBe(32);
    expect(trues).toBe(6);
  });
});

describe("t034 — time guard strict < (now.getTime() < start.getTime())", () => {
  // PENDIENTE -> CANCELADO and CONFIRMADO -> CANCELADO are time-gated when opts provided
  const cancelCases: Array<[string, string, string, Date, boolean]> = [
    ["PENDIENTE", "CANCELADO", "CLIENTE", NOW_11_59Z, true],
    ["PENDIENTE", "CANCELADO", "CLIENTE", NOW_12_00Z, false],
    ["PENDIENTE", "CANCELADO", "CLIENTE", NOW_12_00_01Z, false],
    ["PENDIENTE", "CANCELADO", "ADMINISTRADOR", NOW_11_59Z, true],
    ["PENDIENTE", "CANCELADO", "ADMINISTRADOR", NOW_12_00Z, false],
    ["PENDIENTE", "CANCELADO", "ADMINISTRADOR", NOW_12_00_01Z, false],
    ["CONFIRMADO", "CANCELADO", "CLIENTE", NOW_11_59Z, true],
    ["CONFIRMADO", "CANCELADO", "CLIENTE", NOW_12_00Z, false],
    ["CONFIRMADO", "CANCELADO", "CLIENTE", NOW_12_00_01Z, false],
    ["CONFIRMADO", "CANCELADO", "ADMINISTRADOR", NOW_11_59Z, true],
    ["CONFIRMADO", "CANCELADO", "ADMINISTRADOR", NOW_12_00Z, false],
    ["CONFIRMADO", "CANCELADO", "ADMINISTRADOR", NOW_12_00_01Z, false],
  ];

  it.each(cancelCases)(
    "canTransition(%s -> %s as %s, now=%s) strict <",
    (from, to, role, now, expected) => {
      expect(
        canTransition(
          from as (typeof AppointmentStatus)[number],
          to as (typeof AppointmentStatus)[number],
          role as "CLIENTE" | "ADMINISTRADOR",
          { now, startDateTime: START_12Z },
        ),
      ).toBe(expected);
    },
  );

  it("without opts, time guard not enforced — PENDIENTE->CANCELADO still true", () => {
    expect(canTransition("PENDIENTE", "CANCELADO", "CLIENTE")).toBe(true);
    expect(canTransition("CONFIRMADO", "CANCELADO", "ADMINISTRADOR")).toBe(true);
  });

  it("PENDIENTE->CONFIRMADO / RECHAZADO ignore time guard (only CANCELADO is gated)", () => {
    // canTransition time guard only applies when to === CANCELADO
    expect(
      canTransition("PENDIENTE", "CONFIRMADO", "ADMINISTRADOR", {
        now: NOW_12_00_01Z,
        startDateTime: START_12Z,
      }),
    ).toBe(true);
    expect(
      canTransition("PENDIENTE", "RECHAZADO", "ADMINISTRADOR", {
        now: NOW_12_00_01Z,
        startDateTime: START_12Z,
      }),
    ).toBe(true);
  });
});

describe("t034 — isTerminal and COMPLETADO rejection", () => {
  it.each([
    ["RECHAZADO", true],
    ["CANCELADO", true],
    ["PENDIENTE", false],
    ["CONFIRMADO", false],
  ] as const)("isTerminal(%s) === %s", (status, expected) => {
    expect(isTerminal(status)).toBe(expected);
  });

  it("terminal RECHAZADO blocks all outgoing even with future time guard", () => {
    expect(
      canTransition("RECHAZADO", "CANCELADO", "ADMINISTRADOR", {
        now: NOW_11_59Z,
        startDateTime: START_12Z,
      }),
    ).toBe(false);
    expect(canTransition("RECHAZADO", "CONFIRMADO", "ADMINISTRADOR")).toBe(false);
    expect(canTransition("RECHAZADO", "RECHAZADO", "ADMINISTRADOR")).toBe(false);
  });

  it("terminal CANCELADO blocks all outgoing even with future time guard", () => {
    expect(
      canTransition("CANCELADO", "CANCELADO", "CLIENTE", {
        now: NOW_11_59Z,
        startDateTime: START_12Z,
      }),
    ).toBe(false);
    expect(canTransition("CANCELADO", "CONFIRMADO", "CLIENTE")).toBe(false);
  });

  it("COMPLETADO never allowed — not in AppointmentStatus enum, canTransition returns false", () => {
    expect(AppointmentStatus).not.toContain("COMPLETADO" as unknown as string);
    expect(AppointmentStatusSchema.safeParse("COMPLETADO").success).toBe(false);
    expect(
      canTransition(
        "PENDIENTE" as unknown as (typeof AppointmentStatus)[number],
        "COMPLETADO" as unknown as (typeof AppointmentStatus)[number],
        "ADMINISTRADOR",
      ),
    ).toBe(false);
    expect(
      canTransition(
        "COMPLETADO" as unknown as (typeof AppointmentStatus)[number],
        "CANCELADO" as unknown as (typeof AppointmentStatus)[number],
        "ADMINISTRADOR",
      ),
    ).toBe(false);
    expect(
      canTransition(
        "COMPLETADO" as unknown as (typeof AppointmentStatus)[number],
        "COMPLETADO" as unknown as (typeof AppointmentStatus)[number],
        "ADMINISTRADOR",
      ),
    ).toBe(false);
  });

  it("allowedTransitions has no COMPLETADO key and no FOR UPDATE leakage", () => {
    const keys = Object.keys(allowedTransitions);
    expect(keys).not.toContain("COMPLETADO");
    expect(keys).not.toContain("FOR UPDATE");
    for (const from of keys) {
      const nested = Object.keys(
        (allowedTransitions as Record<string, Record<string, unknown>>)[from] ?? {},
      );
      expect(nested).not.toContain("COMPLETADO");
    }
  });
});
