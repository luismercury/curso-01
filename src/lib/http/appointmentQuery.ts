import { z } from "zod";

import { AppointmentStatusSchema } from "@/domain/appointmentStateMachine";

const isoWithTzRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const yyyymmddRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(ymd: string): boolean {
  const [yStr, mStr, dStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

// Boolean query param: case-insensitive "true"/"false", also handle real boolean, default false
const booleanQueryParam = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") return trimmed; // let enum validation fail
      return trimmed.toLowerCase();
    }
    return val;
  },
  z.enum(["true", "false"]).transform((v) => v === "true").optional().default(false),
) as unknown as z.ZodType<boolean>;

// Helpers for numeric query params that arrive as strings from URLSearchParams
function numericStringSchema(opts: { min?: number; max?: number; defaultValue?: number; optional?: boolean }) {
  const base = z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === "") return undefined;
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") return undefined;
        const n = Number(trimmed);
        return n;
      }
      return val;
    },
    (() => {
      const s = z.number();
      return s;
    })(),
  );

  let piped: z.ZodType<number> = (base as unknown as z.ZodType<number>).pipe(
    z
      .number()
      .refine((v) => Number.isInteger(v), { message: "must be integer" })
      .refine((v) => (opts.min === undefined ? true : v >= opts.min), {
        message: opts.min !== undefined ? `must be >= ${opts.min}` : undefined,
      })
      .refine((v) => (opts.max === undefined ? true : v <= opts.max), {
        message: opts.max !== undefined ? `must be <= ${opts.max}` : undefined,
      }),
  ) as unknown as z.ZodType<number>;

  if (opts.optional) {
    return piped.optional();
  }
  if (opts.defaultValue !== undefined) {
    return piped.optional().default(opts.defaultValue);
  }
  return piped;
}

const pageSchema = numericStringSchema({ min: 1, defaultValue: 1 });
const limitSchema = numericStringSchema({ min: 1, max: 100, defaultValue: 20 });
const offsetSchema = numericStringSchema({ min: 0, optional: true });

const fromSchema = z
  .string()
  .regex(isoWithTzRegex, "from must be ISO 8601 with timezone")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: "from must be valid Date" })
  .transform((v) => new Date(v))
  .optional();

const toSchema = z
  .string()
  .regex(isoWithTzRegex, "to must be ISO 8601 with timezone")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: "to must be valid Date" })
  .transform((v) => new Date(v))
  .optional();

const dateSchema = z
  .string()
  .regex(yyyymmddRegex, "date must be YYYY-MM-DD")
  .refine(isValidCalendarDate, { message: "date must be valid calendar date" })
  .optional();

export const querySchema = z
  .object({
    status: AppointmentStatusSchema.optional(),
    includeCancelled: booleanQueryParam,
    includeRejected: booleanQueryParam,
    from: fromSchema,
    to: toSchema,
    date: dateSchema,
    page: pageSchema,
    limit: limitSchema,
    offset: offsetSchema,
    sort: z.enum(["asc", "desc", "startAt:asc", "startAt:desc"]).optional().default("asc"),
  })
  .strict()
  .superRefine((val, ctx) => {
    // date vs from/to mutual exclusion
    if (val.date !== undefined && (val.from !== undefined || val.to !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "use date or from/to, not both",
        path: ["date"],
      });
    }
    // status CANCELADO without includeCancelled
    if (val.status === "CANCELADO" && !val.includeCancelled) {
      ctx.addIssue({
        code: "custom",
        message: "status CANCELADO requires includeCancelled=true",
        path: ["status"],
      });
    }
    // status RECHAZADO without includeRejected
    if (val.status === "RECHAZADO" && !val.includeRejected) {
      ctx.addIssue({
        code: "custom",
        message: "status RECHAZADO requires includeRejected=true",
        path: ["status"],
      });
    }
    // from > to
    if (val.from !== undefined && val.to !== undefined && val.from.getTime() > val.to.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "from must be <= to",
        path: ["from"],
      });
    }
  });

export type ParsedAppointmentQuery = z.infer<typeof querySchema>;

/**
 * Parse raw query record (from URLSearchParams) into typed ParsedAppointmentQuery.
 * Throws ZodError on validation failure — caller maps via toValidationError to 400.
 */
export function parseAppointmentQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedAppointmentQuery {
  // Normalize: if value is array (duplicate query param), take last
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      normalized[k] = v[v.length - 1];
    } else {
      normalized[k] = v;
    }
  }
  return querySchema.parse(normalized);
}

// Re-export helper for external checks if needed
export function isValidAppointmentStatus(
  value: string,
): value is NonNullable<ParsedAppointmentQuery["status"]> {
  return (["PENDIENTE", "CONFIRMADO", "CANCELADO", "RECHAZADO"] as const).includes(
    value as never,
  );
}
