import { describe, it, expect } from "vitest";
import { parseAppointmentQuery, querySchema } from "@/lib/http/appointmentQuery";

describe("appointmentQuery", () => {
  it("defaults empty → page1 limit20 asc include false", () => {
    const p = parseAppointmentQuery({});
    expect(p).toMatchObject({ page: 1, limit: 20, sort: "asc", includeCancelled: false, includeRejected: false });
  });
  it("status valid/invalid", () => {
    expect(parseAppointmentQuery({ status: "PENDIENTE" }).status).toBe("PENDIENTE");
    expect(() => parseAppointmentQuery({ status: "COMPLETADO" as never })).toThrow();
  });
  it("include* case-insensitive + boolean", () => {
    expect(parseAppointmentQuery({ includeCancelled: "true" }).includeCancelled).toBe(true);
    expect(parseAppointmentQuery({ includeCancelled: "TRUE" }).includeCancelled).toBe(true);
    expect(parseAppointmentQuery({ includeCancelled: "false" }).includeCancelled).toBe(false);
    expect(parseAppointmentQuery({ includeRejected: "TRUE" }).includeRejected).toBe(true);
    expect(parseAppointmentQuery({ includeCancelled: true as unknown as string }).includeCancelled).toBe(true);
  });
  it("date valid/invalid + calendar", () => {
    expect(parseAppointmentQuery({ date: "2026-09-10" }).date).toBe("2026-09-10");
    expect(() => parseAppointmentQuery({ date: "2026/09/10" })).toThrow();
    expect(() => parseAppointmentQuery({ date: "2026-02-30" })).toThrow();
  });
  it("date vs from/to exclusion", () => {
    expect(() => parseAppointmentQuery({ date: "2026-09-10", from: "2026-09-10T00:00:00-03:00" })).toThrow(/use date/);
    expect(() => parseAppointmentQuery({ date: "2026-09-10", to: "2026-09-11T00:00:00-03:00" })).toThrow();
  });
  it("status CANCELADO/RECHAZADO require flags", () => {
    expect(() => parseAppointmentQuery({ status: "CANCELADO" })).toThrow(/includeCancelled/);
    expect(parseAppointmentQuery({ status: "CANCELADO", includeCancelled: "true" }).status).toBe("CANCELADO");
    expect(() => parseAppointmentQuery({ status: "RECHAZADO" })).toThrow(/includeRejected/);
    expect(parseAppointmentQuery({ status: "RECHAZADO", includeRejected: "true" }).status).toBe("RECHAZADO");
  });
  it("from>to 400, from==to ok", () => {
    expect(() => parseAppointmentQuery({ from: "2026-09-11T00:00:00-03:00", to: "2026-09-10T00:00:00-03:00" })).toThrow(/from must be/);
    expect(parseAppointmentQuery({ from: "2026-09-10T00:00:00-03:00", to: "2026-09-10T00:00:00-03:00" }).from).toBeInstanceOf(Date);
  });
  it("limit 0/101 400, page0 400, sort invalid 400", () => {
    expect(() => parseAppointmentQuery({ limit: "0" })).toThrow();
    expect(() => parseAppointmentQuery({ limit: "101" })).toThrow();
    expect(() => parseAppointmentQuery({ page: "0" })).toThrow();
    expect(() => parseAppointmentQuery({ sort: "DROP" as never })).toThrow();
    expect(parseAppointmentQuery({ limit: "100" }).limit).toBe(100);
    for (const s of ["asc", "desc", "startAt:asc", "startAt:desc"] as const) expect(parseAppointmentQuery({ sort: s }).sort).toBe(s);
  });
  it("page+offset both parsed", () => {
    const p = parseAppointmentQuery({ page: "2", limit: "10", offset: "999" });
    expect(p.page).toBe(2); expect(p.limit).toBe(10); expect(p.offset).toBe(999);
    expect(parseAppointmentQuery({ offset: "20" }).offset).toBe(20);
  });
  it("from without TZ 400, with TZ ok", () => {
    expect(() => parseAppointmentQuery({ from: "2026-09-10T00:00:00" })).toThrow();
    expect(parseAppointmentQuery({ from: "2026-09-10T13:00:00.000Z" }).from?.toISOString()).toBe("2026-09-10T13:00:00.000Z");
    expect(parseAppointmentQuery({ to: "2026-09-10T14:00:00-03:00" }).to).toBeInstanceOf(Date);
  });
  it("duplicate array takes last, strict unknown 400", () => {
    expect(parseAppointmentQuery({ status: ["PENDIENTE", "CONFIRMADO"] as unknown as string }).status).toBe("CONFIRMADO");
    expect(() => querySchema.parse({ unknown: "x" } as never)).toThrow();
  });
});
