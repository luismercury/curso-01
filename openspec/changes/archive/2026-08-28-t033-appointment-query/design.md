# Design: T-033 Appointment Query — RN-04 / H-28 / H-11

## Technical Approach

Thin GET handlers in two routes (`/api/appointments` CLIENTE, `/api/admin/appointments` ADMIN) delegate entirely to `AppointmentService.listAppointments` (single owner §4.5). A shared `src/lib/http/appointmentQuery.ts` exposes a Zod `querySchema` and a `parseQuery(raw)` helper consumed by both routes. The repo `findTurnosPaginated` extends `FindTurnosPaginatedQuery` with optional `status`, `from`, `to`, `date`, `offset`, and `dateRange` fields, all additive (backward-compatible), while preserving existing RN-04 `gt(now)` and status-array logic.

## Architecture Decisions

### Decision: Shared querySchema in `src/lib/http/appointmentQuery.ts`

**Choice**: Extract Zod `querySchema` + `parseQuery()` into a shared module, import into both route handlers.

**Alternatives considered**: Duplicate schema in each route — rejected: drift risk; `appointmentQuery.ts` is the correct home for HTTP-layer query contracts per existing patterns (`errors.ts`).

**Rationale**: Single source of truth for validation rules (date/from mutual exclusion, status/include* contradiction, from≤to). Both routes share identical parsing logic without code duplication.

### Decision: Repo extension additive only

**Choice**: Extend `FindTurnosPaginatedQuery` with new optional fields; `findTurnosPaginated` body adds conditional `and(...)` clauses.

**Alternatives considered**: New `findTurnosFiltered` repo method — rejected: duplicates pagination/total logic.

**Rationale**: Additive fields keep the existing well-tested pagination path intact. The `status` filter overrides the `include*` flags (contradiction caught by Zod), preserving the RN-04 default without breaking existing callers.

### Decision: `getBaDayUtcRange` reused from `availabilityService.ts`

**Choice**: Import `getBaDayUtcRange` directly — already exists with string/Date overloads, DST-aware via `Intl`, tested in T-026.

**Alternatives considered**: Duplicate range logic in `workshopSchedule.ts` — rejected: the helper already exists and is tested.

**Rationale**: No new utility needed; `getBaDayUtcRange(dateStr, timezone)` returns `{fromUtc, toUtc}` consumed by the repo `dateRange` condition.

## Data Flow

```
CLIENTE GET /api/appointments
  └── requireAuth(req) → 401 if missing
  └── querySchema.parse(urlParams) → 400 if invalid
  └── parseQuery(raw) → normalized {status, from, to, date, page, limit, offset, sort, includeCancelled, includeRejected}
  └── listAppointments({db, config: {timezone}}, normalized, authUser)
        └── CLIENTE: inject customerId = authUser.id
        └── ADMIN: no customerId (sees all)
        └── findTurnosPaginated(db, {..., now: getNow(deps)})
              ├── gt(fechaHoraInicio, now)          ← RN-04 always
              ├── inArray(turnos.estado, statuses)  ← default PENDIENTE|CONFIRMADO + include*
              ├── if dateRange: gte/lt on fechaHoraInicio
              ├── if from: gte on fechaHoraInicio
              ├── if to: lt on fechaHoraInicio
              ├── if status: eq on estado (contradiction already caught)
              └── if customerId: eq on clienteId
        └── total count (same whereClause)
        └── rows → toTurnoDTO → {data, pagination} 200

ADMIN GET /api/admin/appointments
  └── requireAuth(req) → 401 if missing
  └── assertRole(authUser, ADMINISTRADOR) → 403 if not ADMIN
  └── same querySchema.parse → 400 if invalid
  └── listAppointments({db, config}, normalized, authUser) → 200
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/http/appointmentQuery.ts` | Create | Shared `querySchema` (Zod) + `parseQuery()` helper; status enum, includeCancelled/includeRejected boolean transforms, from/to ISO transforms, date YYYY-MM-DD, page/limit/offset/sort; refinements: date vs from/to exclusion, status CANCELADO/RECHAZADO contradiction, from≤to |
| `src/app/api/appointments/route.ts` | Modify | Add `GET` handler: `requireAuth → querySchema.safeParse → listAppointments → 200 {data,pagination}`; POST unchanged |
| `src/app/api/admin/appointments/route.ts` | Create | `GET` handler: `requireAuth → assertRole(ADMINISTRADOR) → querySchema.safeParse → listAppointments → 200 {data,pagination}` |
| `src/db/repositories/turnos.ts` | Modify | Extend `FindTurnosPaginatedQuery` with `status?: AppointmentStatus`, `from?: Date`, `to?: Date`, `date?: string`, `offset?: number`, `dateRange?: {fromUtc: Date, toUtc: Date}`; extend `findTurnosPaginated` body with date/status/range conditions; total uses identical whereClause |
| `src/services/appointmentService.ts` | Reuse | No change — spread `{...query}` already passes new fields through; `listAppointments` signature unchanged |

## Interfaces / Contracts

### `src/lib/http/appointmentQuery.ts`

```typescript
import { z } from "zod";
import { AppointmentStatusSchema } from "@/domain/appointmentStateMachine";
import { ValidationError } from "@/config/workshopSchedule";
import { getBaDayUtcRange } from "@/services/availability/availabilityService";

const isoWithTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const querySchema = z
  .object({
    status: AppointmentStatusSchema.optional(),
    includeCancelled: z.enum(["true", "false"]).transform((v) => v === "true").default("false"),
    includeRejected: z.enum(["true", "false"]).transform((v) => v === "true").default("false"),
    from: z.string().regex(isoWithTz, "from must be ISO 8601 with timezone").transform((v) => new Date(v)).optional(),
    to: z.string().regex(isoWithTz, "to must be ISO 8601 with timezone").transform((v) => new Date(v)).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
    page: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1)).default("1"),
    limit: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(1).max(100)).default("20"),
    offset: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(0)).optional(),
    sort: z.enum(["asc", "desc", "startAt:asc", "startAt:desc"]).default("asc"),
  })
  .strict()
  .refine(
    ({ date, from, to }) => !(date && (from || to)),
    { message: "use date or from/to, not both", path: ["date"] }
  )
  .refine(
    ({ status, includeCancelled, includeRejected }) => {
      if (status === "CANCELADO" && !includeCancelled) return false;
      if (status === "RECHAZADO" && !includeRejected) return false;
      return true;
    },
    { message: "status requires include flag", path: ["status"] }
  )
  .refine(
    ({ from, to }) => !(from && to && from > to),
    { message: "from must be <= to", path: ["from"] }
  );

export type NormalizedQuery = z.infer<typeof querySchema>;

export function parseQuery(
  raw: Record<string, string>,
  config: { timezone: string },
): NormalizedQuery {
  const parsed = querySchema.parse(raw);
  // Resolve date → UTC range if present
  let dateRange: { fromUtc: Date; toUtc: Date } | undefined;
  if (parsed.date) {
    dateRange = getBaDayUtcRange(parsed.date, config.timezone);
  }
  return { ...parsed, dateRange };
}
```

### `FindTurnosPaginatedQuery` extension

```typescript
// Added fields only — existing fields unchanged
export interface FindTurnosPaginatedQuery {
  customerId?: string;
  includeCancelled?: boolean;
  includeRejected?: boolean;
  page?: number;
  limit?: number;
  sort?: "asc" | "desc" | "startAt:asc" | "startAt:desc";
  now?: Date;
  // --- new fields ---
  status?: AppointmentStatus;       // exact status filter
  from?: Date;                     // >= startDateTime (UTC)
  to?: Date;                       // < startDateTime (UTC)
  date?: string;                   // YYYY-MM-DD → dateRange via getBaDayUtcRange
  offset?: number;                 // raw offset (page takes precedence)
  dateRange?: { fromUtc: Date; toUtc: Date }; // computed from date + timezone
}
```

### Response envelope (both routes)

```typescript
// 200
{
  data: TurnoDTO[],          // via toTurnoDTO (INV-08 camelCase, no snake)
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

### Error envelope mapping

| Condition | Code | Status | Mechanism |
|-----------|------|--------|-----------|
| No JWT | UNAUTHORIZED | 401 | `requireAuth` throws `UnauthorizedError` → route catches |
| Not ADMIN on admin route | FORBIDDEN | 403 | `assertRole` throws `ForbiddenError` → route catches |
| Invalid query params | VALIDATION_ERROR | 400 | Zod `.parse()` throws `ZodError` → `toValidationError` |
| Contradiction (status/flag) | VALIDATION_ERROR | 400 | Zod `.refine()` catches → `toValidationError` |
| from > to | VALIDATION_ERROR | 400 | Zod `.refine()` catches → `toValidationError` |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `querySchema` parsing | Each refinement branch: valid/invalid date, date+from exclusion, status+flag contradiction, from>to, enum validation, transform to boolean/number/Date |
| Unit | `parseQuery` date→dateRange | Assert `getBaDayUtcRange` called with correct args when `date` present, not called when `from/to` used |
| Integration | `findTurnosPaginated` with new fields | RN-04 filter (only PENDIENTE/CONFIRMADO with gt(now)), status exact filter, date BA range, from/to range, pagination offset precedence, total matches data whereClause |
| Integration | BA DST date edge | `date=2026-03-08` with BA `-03:00`→`-02:00` transition proves UTC range correct |
| Route | GET CLIENTE 401/403/400 | Mock `requireAuth` / `assertRole` / `listAppointments`; assert status codes and error codes |
| Route | GET ADMIN | Same as CLIENTE plus `assertRole` called before Zod |
| Route | Pagination envelope | `page=2&limit=10` → `{data:[...], pagination:{page:2,limit:10,total:25,totalPages:3}}` |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollback

No migration required. Rollback: delete `src/app/api/admin/appointments/route.ts`, remove `GET` from `src/app/api/appointments/route.ts`, delete `src/lib/http/appointmentQuery.ts`, revert `src/db/repositories/turnos.ts` to remove added fields. No data impact.

## Open Questions

None — all decisions resolved in proposal/exploration phases.
