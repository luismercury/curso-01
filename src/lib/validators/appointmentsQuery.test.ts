/**
 * Tests for the URL-state query parser (T-045 UI-04 PR1b).
 *
 * Covers REQ-04 (clamp-on-parse — never throw on user-supplied URL state)
 * and GWT 4.2 (`parseAppointmentsQuery` falls back to defaults on invalid
 * input). The validator is the RSC→client boundary for the upcoming-list
 * pagination controls; production behavior is "any garbage input still
 * produces a renderable first page".
 */
import { describe, expect, it } from "vitest";

import {
  APPOINTMENTS_LIMIT_DEFAULT,
  APPOINTMENTS_QUERY_DEFAULTS,
  appointmentsSortSchema,
  limitSchema,
  pageSchema,
  parseAppointmentsQuery,
} from "@/lib/validators/appointmentsQuery";

describe("parseAppointmentsQuery — clamp-on-parse (REQ-04, GWT 4.2)", () => {
  it("returns defaults for empty / undefined input", () => {
    expect(parseAppointmentsQuery({})).toEqual(APPOINTMENTS_QUERY_DEFAULTS);
    expect(parseAppointmentsQuery(undefined)).toEqual(APPOINTMENTS_QUERY_DEFAULTS);
    expect(parseAppointmentsQuery(null)).toEqual(APPOINTMENTS_QUERY_DEFAULTS);
  });

  it("coerces string page/limit from URL params", () => {
    expect(parseAppointmentsQuery({ page: "2", limit: "5" })).toEqual({
      page: 2,
      limit: 5,
      sort: "startAt:asc",
    });
  });

  it("clamps invalid page=0 → 1 (never 500s)", () => {
    expect(parseAppointmentsQuery({ page: 0 }).page).toBe(1);
  });

  it("clamps invalid limit=101 → 20 default (never 500s)", () => {
    expect(parseAppointmentsQuery({ limit: 101 }).limit).toBe(APPOINTMENTS_LIMIT_DEFAULT);
  });

  it("clamps non-numeric limit → 20 default", () => {
    expect(parseAppointmentsQuery({ limit: "abc" }).limit).toBe(APPOINTMENTS_LIMIT_DEFAULT);
  });

  it("clamps negative page → 1", () => {
    expect(parseAppointmentsQuery({ page: -3 }).page).toBe(1);
  });

  it("preserves valid sort:startAt:asc", () => {
    expect(parseAppointmentsQuery({ sort: "startAt:asc" }).sort).toBe("startAt:asc");
  });

  it("rejects unknown sort values → default", () => {
    expect(parseAppointmentsQuery({ sort: "desc" }).sort).toBe("startAt:asc");
    expect(parseAppointmentsQuery({ sort: "random" }).sort).toBe("startAt:asc");
  });

  it("preserves unknown siblings (composite schema is permissive)", () => {
    // Future admin filter `?status=` MUST NOT crash the parser.
    const result = parseAppointmentsQuery({ status: "PENDIENTE", page: "2" });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(APPOINTMENTS_LIMIT_DEFAULT);
  });
});

describe("pageSchema / limitSchema / appointmentsSortSchema — single-field guards", () => {
  it("pageSchema accepts >=1 integers, rejects 0/negative/non-integer", () => {
    expect(pageSchema.safeParse(1).success).toBe(true);
    expect(pageSchema.safeParse(99).success).toBe(true);
    expect(pageSchema.safeParse(0).success).toBe(false);
    expect(pageSchema.safeParse(-1).success).toBe(false);
    expect(pageSchema.safeParse(1.5).success).toBe(false);
  });

  it("limitSchema accepts 1..100, rejects 0/101/negative", () => {
    expect(limitSchema.safeParse(1).success).toBe(true);
    expect(limitSchema.safeParse(100).success).toBe(true);
    expect(limitSchema.safeParse(0).success).toBe(false);
    expect(limitSchema.safeParse(101).success).toBe(false);
    expect(limitSchema.safeParse(-5).success).toBe(false);
  });

  it("appointmentsSortSchema accepts only startAt:asc", () => {
    expect(appointmentsSortSchema.safeParse("startAt:asc").success).toBe(true);
    expect(appointmentsSortSchema.safeParse("startAt:desc").success).toBe(false);
    expect(appointmentsSortSchema.safeParse("asc").success).toBe(false);
  });
});
