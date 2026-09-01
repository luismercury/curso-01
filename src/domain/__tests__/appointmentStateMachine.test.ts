import { describe, expect, it } from "vitest";
import {
  AppointmentStatus,
  AppointmentStatusSchema,
  allowedTransitions,
  canTransition,
  isBannerEligible,
  isTerminal,
} from "@/domain/appointmentStateMachine";

describe("AppointmentStatus — frozen enum", () => {
  it("contains exactly PENDIENTE, CONFIRMADO, RECHAZADO, CANCELADO", () => {
    expect([...AppointmentStatus]).toEqual([
      "PENDIENTE",
      "CONFIRMADO",
      "RECHAZADO",
      "CANCELADO",
    ]);
  });

  it("is readonly tuple length 4", () => {
    expect(AppointmentStatus.length).toBe(4);
  });

  it("AppointmentStatusSchema parses each valid status", () => {
    for (const s of AppointmentStatus) {
      expect(AppointmentStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejects COMPLETADO via Zod", () => {
    const result = AppointmentStatusSchema.safeParse("COMPLETADO");
    expect(result.success).toBe(false);
  });

  it("rejects arbitrary invalid strings", () => {
    expect(AppointmentStatusSchema.safeParse("PENDIENTE ").success).toBe(false);
    expect(AppointmentStatusSchema.safeParse("").success).toBe(false);
    expect(AppointmentStatusSchema.safeParse("pending").success).toBe(false);
  });

  it("allowedTransitions is pure object with no COMPLETADO key", () => {
    const keys = Object.keys(allowedTransitions);
    expect(keys).toEqual(
      expect.arrayContaining(["PENDIENTE", "CONFIRMADO", "RECHAZADO", "CANCELADO"])
    );
    expect(keys).not.toContain("COMPLETADO");
    // No nested COMPLETADO either
    for (const from of keys) {
      const nested = Object.keys(
        (allowedTransitions as Record<string, Record<string, unknown>>)[from] ?? {}
      );
      expect(nested).not.toContain("COMPLETADO");
    }
  });
});

describe("isTerminal", () => {
  it.each([
    ["RECHAZADO", true],
    ["CANCELADO", true],
    ["PENDIENTE", false],
    ["CONFIRMADO", false],
  ] as const)("isTerminal(%s) === %s", (status, expected) => {
    expect(isTerminal(status)).toBe(expected);
  });
});

describe("canTransition — valid transitions (6)", () => {
  const validCases: Array<[string, string, string]> = [
    ["PENDIENTE", "CONFIRMADO", "ADMINISTRADOR"],
    ["PENDIENTE", "RECHAZADO", "ADMINISTRADOR"],
    ["PENDIENTE", "CANCELADO", "CLIENTE"],
    ["PENDIENTE", "CANCELADO", "ADMINISTRADOR"],
    ["CONFIRMADO", "CANCELADO", "CLIENTE"],
    ["CONFIRMADO", "CANCELADO", "ADMINISTRADOR"],
  ];

  it.each(validCases)(
    "allows %s -> %s as %s",
    (from, to, role) => {
      expect(
        canTransition(
          from as typeof AppointmentStatus[number],
          to as typeof AppointmentStatus[number],
          role as "CLIENTE" | "ADMINISTRADOR"
        )
      ).toBe(true);
    }
  );

  it("PENDIENTE->CANCELADO with future opts still allows", () => {
    const now = new Date("2026-09-10T08:59:00.000Z");
    const start = new Date("2026-09-10T09:00:00.000Z");
    expect(
      canTransition("PENDIENTE", "CANCELADO", "CLIENTE", {
        now,
        startDateTime: start,
      })
    ).toBe(true);
  });

  it("CONFIRMADO->CANCELADO with future opts still allows", () => {
    const now = new Date("2026-09-10T08:59:00.000Z");
    const start = new Date("2026-09-10T12:00:00.000Z");
    expect(
      canTransition("CONFIRMADO", "CANCELADO", "ADMINISTRADOR", {
        now,
        startDateTime: start,
      })
    ).toBe(true);
  });
});

describe("canTransition — invalid / role / terminal", () => {
  const invalidCases: Array<[string, string, string, string]> = [
    // Role-gated: CLIENTE cannot confirm/reject
    ["PENDIENTE", "CONFIRMADO", "CLIENTE", "role CLIENTE cannot CONFIRMADO"],
    ["PENDIENTE", "RECHAZADO", "CLIENTE", "role CLIENTE cannot RECHAZADO"],
    // Non-allowed edges
    ["PENDIENTE", "PENDIENTE", "ADMINISTRADOR", "self transition"],
    ["CONFIRMADO", "CONFIRMADO", "ADMINISTRADOR", "self confirm"],
    ["CONFIRMADO", "RECHAZADO", "ADMINISTRADOR", "CONFIRMADO->RECHAZADO not allowed"],
    ["CONFIRMADO", "PENDIENTE", "ADMINISTRADOR", "backward"],
    ["PENDIENTE", "CONFIRMADO", "CLIENTE", "duplicate role case"],
    // Terminal sources block everything
    ["RECHAZADO", "PENDIENTE", "ADMINISTRADOR", "terminal RECHAZADO"],
    ["RECHAZADO", "CANCELADO", "ADMINISTRADOR", "terminal RECHAZADO->CANCELADO"],
    ["RECHAZADO", "CONFIRMADO", "CLIENTE", "terminal RECHAZADO any"],
    ["CANCELADO", "PENDIENTE", "ADMINISTRADOR", "terminal CANCELADO"],
    ["CANCELADO", "CONFIRMADO", "CLIENTE", "terminal CANCELADO any"],
    ["CANCELADO", "CANCELADO", "ADMINISTRADOR", "terminal self"],
    ["RECHAZADO", "RECHAZADO", "ADMINISTRADOR", "terminal self RECHAZADO"],
    // Invalid targets / nonsense
    ["CONFIRMADO", "RECHAZADO", "CLIENTE", "CONFIRMADO->RECHAZADO as CLIENTE"],
    ["PENDIENTE", "RECHAZADO", "CLIENTE", "already covered but explicit"],
  ];

  it.each(invalidCases)(
    "denies %s -> %s as %s (%s)",
    (from, to, role) => {
      expect(
        canTransition(
          from as typeof AppointmentStatus[number],
          to as typeof AppointmentStatus[number],
          role as "CLIENTE" | "ADMINISTRADOR"
        )
      ).toBe(false);
    }
  );

  it("denies PENDIENTE->CANCELADO when now >= start (time guard)", () => {
    const atStart = new Date("2026-09-10T09:00:00.000Z");
    const after = new Date("2026-09-10T09:00:01.000Z");
    const start = new Date("2026-09-10T09:00:00.000Z");

    expect(
      canTransition("PENDIENTE", "CANCELADO", "CLIENTE", {
        now: atStart,
        startDateTime: start,
      })
    ).toBe(false);

    expect(
      canTransition("CONFIRMADO", "CANCELADO", "ADMINISTRADOR", {
        now: after,
        startDateTime: start,
      })
    ).toBe(false);
  });

  it("denies CONFIRMADO->CANCELADO when now == start exactly", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    const start = new Date("2026-09-10T12:00:00.000Z");
    expect(
      canTransition("CONFIRMADO", "CANCELADO", "CLIENTE", {
        now,
        startDateTime: start,
      })
    ).toBe(false);
  });

  it("without opts, time guard is not enforced (service will handle)", () => {
    // pure role check passes even without time — intentional
    expect(canTransition("PENDIENTE", "CANCELADO", "CLIENTE")).toBe(true);
  });
});

describe("canTransition — COMPLETADO rejection", () => {
  it("Zod rejects COMPLETADO and canTransition returns false if cast", () => {
    expect(AppointmentStatusSchema.safeParse("COMPLETADO").success).toBe(false);
    // Force-cast to bypass type — pure map has no entry, so false
    expect(
      canTransition(
        "PENDIENTE" as unknown as typeof AppointmentStatus[number],
        "COMPLETADO" as unknown as typeof AppointmentStatus[number],
        "ADMINISTRADOR",
      )
    ).toBe(false);
    expect(
      canTransition(
        "COMPLETADO" as unknown as typeof AppointmentStatus[number],
        "CANCELADO" as unknown as typeof AppointmentStatus[number],
        "ADMINISTRADOR",
      )
    ).toBe(false);
  });
});

describe("isBannerEligible — T-044", () => {
  it.each([
    ["PENDIENTE", true],
    ["CONFIRMADO", true],
    ["CANCELADO", false],
    ["RECHAZADO", false],
    ["COMPLETADO", false],
    ["unknown", false],
  ] as const)("isBannerEligible(%s) === %s", (status, expected) => {
    expect(isBannerEligible(status)).toBe(expected);
  });
});
