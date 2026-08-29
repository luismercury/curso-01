# Exploration: t033-appointment-query — Appointment Query [H-11 / RN-04 / H-28]

## Current State

**T-033 scope (implementation-plan.md:998-1025):** Expose paginated query with RN-04 filtering
```
GET /api/appointments?status=&includeCancelled=false&includeRejected=false&from=&to=&date=&page=&limit=&sort=startAt:asc
GET /api/admin/appointments?date=YYYY-MM-DD&includeCancelled=false&includeRejected=false&page=&limit=&sort=startAt:asc
```
- CLIENTE sees own turnos (filtra `turno.clienteId == authUser.id`), ADMIN sees all. Default próximos = only `PENDIENTE|CONFIRMADO` with `fechaHoraInicio > now` UTC (`America/Argentina/Buenos_Aires`); `CANCELADO`/`RECHAZADO` excluded unless `includeCancelled=true` / `includeRejected=true`. Pagination H-28: `?page=1&limit=20&sort=startAt:asc` (or `?limit=20&offset=0`), helper `paginate()` limit 1..100 default 20, wrapper `{ data, pagination: { page, limit, total, totalPages } }`, `sort` whitelisted.

**Verified on disk 2026-08-28:**

- **Service single owner (T-027):** `src/services/appointmentService.ts:259-276` already implements `listAppointments(deps, query, authUser)`:
  ```ts
  export async function listAppointments(deps, query, authUser) {
    const effectiveQuery = { ...query };
    if (authUser.role === "CLIENTE") effectiveQuery.customerId = authUser.id; // ownership injection, overrides supplied customerId
    if (!effectiveQuery.now) effectiveQuery.now = getNow(deps); // clock injection deterministic
    return findTurnosPaginated(deps.db, effectiveQuery);
  }
  ```
  Plus `getAppointmentById(deps, id, authUser)` with `assertOwnership` (ADMIN bypass) and `confirm/reject/cancel` gated by `canTransition`. Covered by `src/services/__tests__/appointmentService.test.ts:251-294` — `list delegates RN-04 defaults`, `list ADMIN respects flags`, `list CLIENTE overrides customerId`, `DTO camelCase no snake leak`, `limit:101 propagates VALIDATION_ERROR`.

- **Repository RN-04 + pagination (T-027):** `src/db/repositories/turnos.ts:211-303` implements `findTurnosPaginated(db: DbOrTx, query)`:
  - Parses `page ??1`, `limit ??20`, `rawSort ?? "asc"`, `now ?? new Date()` with validation `page>=1 integer`, `limit 1..100`, `sort in {asc,desc,startAt:asc,startAt:desc}` (whitelisted), `now instanceof Date`.
  - Builds `statuses = ["PENDIENTE","CONFIRMADO"]` plus `CANCELADO` if `includeCancelled`, `RECHAZADO` if `includeRejected` (RN-04 default hides both).
  - `where = and(inArray(estado, statuses), gt(fechaHoraInicio, now), eq(clienteId, customerId)?)`, `orderBy = fechaHoraInicio asc|desc` from `sortDir.includes("desc")`, `total = count(*)`, `totalPages = ceil(total/limit)`, `offset=(page-1)*limit`, `select ... orderBy limit offset → toTurnoDTO` (INV-08). `DbOrTx`-injected for future `tx` pass-through. No `from`/`to`/`date`/`status`/`offset` yet.

- **Route layer today:** `src/app/api/appointments/route.ts` (118 LOC) ONLY exposes `POST` (createAppointment) with `isoWithTimezoneRegex` validation, `requireAuth` before parse, `workshopConfig` DI. No `GET` handler. `Test-Path src/app/api/admin/appointments` is `false` — no admin route exists. Auth helpers `requireAuth`, `assertOwnership`, `assertRole`, `UnauthorizedError`/`ForbiddenError` in `src/lib/auth/requireAuth.ts` ready; error envelope `toErrorBody`/`toValidationError` + `ERROR_CODES` in `src/lib/http/errors.ts` ready (`VALIDATION_ERROR 400`, `UNAUTHORIZED 401`, `FORBIDDEN 403`, `APPOINTMENT_NOT_FOUND 404`, `INVALID_APPOINTMENT_STATE 409`). `toTurnoDTO` in `src/db/mappers/turno.ts` enforces INV-08 (DB `fecha_hora_inicio→startDateTime`, `estado→status`). `WorkshopConfig { capacityPerSlot=1, slotStepMinutes=30, timezone=America/Argentina/Buenos_Aires, operatingHours }` frozen in `src/config/workshopConfig.ts`; `workshopSchedule.ts` provides `getOperatingIntervalsForDate` + BA `Intl.DateTimeFormat` dow logic reused by availability.

- **Invariants locked:** INV-02 (4 states UPPER_SNAKE, Zod enum), INV-03 (Auth.js httpOnly JWT), INV-06 (TIMESTAMPTZ UTC, UTC `getTime()`), INV-08 (`toTurnoDTO` camelCase), INV-01/04/05 (booking atomic TX) not touched by read path. `Technical-spec §8.5` pagination table + `§6.4` turno schema + `Functional-spec RN-04` (próximos=`PENDIENTE|CONFIRMADO` with `start>now`, flags opt-in) are sources of truth.

### Affected Areas

- `src/app/api/appointments/route.ts` — **MODIFY: add `GET` handler.** Must parse query with Zod strict: `status? (PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO)`, `includeCancelled?=boolean (default false)`, `includeRejected?=boolean`, `from?=ISO TIMESTAMPTZ`, `to?=ISO TIMESTAMPTZ`, `date?=YYYY-MM-DD`, `page?=int>=1`, `limit?=1..100`, `offset?=int>=0`, `sort?="asc"|"desc"|"startAt:asc"|"startAt:desc"` (default `startAt:asc`). Precedence: `page` over `offset` if both. Delegate to `listAppointments({db, config}, effectiveQuery, authUser)` after `requireAuth`. Return `200 { data: TurnoDTO[], pagination: { page, limit, total, totalPages } }` (always wrapped when paginated per H-28; if no pagination params, still wrap with defaults). Map `ValidationError→400 VALIDATION_ERROR + issues`, `UnauthorizedError→401`, `ForbiddenError→403`. Keep POST untouched.

- `src/app/api/admin/appointments/route.ts` — **NEW.** Admin agenda: `GET ?date=&includeCancelled=&includeRejected=&page=&limit=&sort=&offset=`. Pattern `requireAuth → assertRole(ADMINISTRADOR) → Zod parse → listAppointments({db,config}, query, ADMIN) → 200`. Reuses `AppointmentService.listAppointments` with `role=ADMIN` per T-036 note ("reutiliza T-033 con param role=ADMIN, delega lectura a AppointmentService.query") — **no repo duplication**. Alt alias `GET /api/admin/agenda?date=` per `Technical-spec §8.5` may forward to same handler.

- `src/services/appointmentService.ts#listAppointments` — **CONSUME, extend via query passthrough.** Already injects `customerId` for CLIENTE and `now`. No change needed for role gating, but must ensure it forwards new fields (`status`, `from`, `to`, `date`, `offset`) without mutation. Consider adding thin mapping if repo adds `offset`/`status` fields.

- `src/db/repositories/turnos.ts#findTurnosPaginated` — **EXTEND.** Current signature `FindTurnosPaginatedQuery { customerId?, includeCancelled?, includeRejected?, page?, limit?, sort?, now? }` needs `status?: AppointmentStatus`, `from?: Date`, `to?: Date`, `date?: string (YYYY-MM-DD)`, `offset?: number`. Logic: if `status` supplied, filter `estado == status` (overrides `statuses` array) but validate against `includeCancelled/includeRejected` — recommend `status` takes precedence and `include*` ignored when `status` present, or reject `status=CANCELADO` with `includeCancelled=false` as 400. `from`/`to`/`date` add `gte/lte` on `fechaHoraInicio` (UTC). `date` resolves to UTC range via `getBaDayUtcRange(date, timezone)` (same helper as availability) — `from=00:00 BA → UTC`, `to=23:59:59.999 BA → UTC`. `offset` handled as `(page-1)*limit` when `page` present else raw `offset`. Must keep `gt(fechaHoraInicio, now)` default (RN-04 próximos) unless `from`/`to`/`date` explicitly overrides? Spec says RN-04 always applies: `start>now` even with date filter — keep it and add date bounds conjunctively.

- `src/lib/http/errors.ts` — **REUSE** `ERROR_CODES`, `toErrorBody`, `toValidationError`. No new codes; past turnos still `200 []`, not error.

- `src/lib/auth/requireAuth.ts` (`requireAuth`, `assertRole`) — **REUSE.** `GET /api/appointments` uses `requireAuth` only; `GET /api/admin/appointments` adds `assertRole(ADMINISTRADOR)` → `403 FORBIDDEN` if CLIENTE. `assertOwnership` not needed (list injects filter, not checks row).

- `src/domain/appointmentStateMachine.ts` — **READ-ONLY.** Provides `AppointmentStatus` enum for `status` Zod `z.enum(...)`.

- `src/db/mappers/turno.ts#toTurnoDTO` — **REUSE** for INV-08; route tests must assert `customerId/vehicleId/serviceId/startDateTime/endDateTime/status` present, no `fecha_hora_inicio`/`estado`.

- `src/config/workshopConfig.ts` + `src/config/workshopSchedule.ts` + `src/services/availability/availabilityService#getBaDayUtcRange` — **READ for `date` → UTC range** conversion. Reuse existing BA dow/timezone logic; do not hardcode `-03:00`.

- `src/app/api/appointments/route.test.ts` + `src/app/api/admin/appointments/route.test.ts` — **NEW tests.** Mirror `confirm/route.test.ts` harness: `vi.mock("@/services/appointmentService")` with `listAppointmentsMock`, `vi.mock("@/lib/auth/requireAuth")` with `requireAuthMock`. Tables: `401 before query validation`, `200 default hides CANCELADO/RECHAZADO`, `includeCancelled=true shows`, `status=CANCELADO&includeCancelled=true filtered`, `pagination page/limit/offset/sort`, `limit:101 → 400`, `sort injection → 400`, `date YYYY-MM-DD BA range`, `CLIENTE cannot see other customers' turnos`, `ADMIN sees all`.

### Approaches

1. **Thin GET delegating to AppointmentService.listAppointments — reuse for admin (recommended)**

   Add `GET` to `src/app/api/appointments/route.ts` that does `requireAuth → Zod parse query → listAppointments({db, config}, query, authUser) → NextResponse.json({ data, pagination })`. Create `src/app/api/admin/appointments/route.ts` that does `requireAuth → assertRole(ADMINISTRADOR) → same Zod parse → listAppointments({db, config}, query, ADMIN) → same wrapper`. Repository extends to support `status/from/to/date/offset`. Both routes share `querySchema` (exported from `lib/http/appointmentQuery.ts`).

   - Pros: Lowest risk — service already owns RN-04 + pagination + customerId injection + clock, proven in unit tests; T-032 `cancel`/`confirm` pattern shipped with same `requireAuth→Zod→DI→service→toErrorBody` pipeline. Keeps `AppointmentService` single owner per `Technical-spec §4.5`/`H-19`; admin reuse satisfies `T-036 "reutiliza T-033 con role=ADMIN, delega a AppointmentService.query"` without duplication. Under 400-line budget (route ~70 LOC + admin ~60 LOC + repo extension ~40 LOC + tests). `DbOrTx` injection unchanged.
   - Cons: Shared `querySchema` extraction is minor indirection; `admin` route still duplicates `requireAuth + assertRole + parse` boilerplate (~30 LOC) vs DRY helper — acceptable.
   - Effort: Low (1–2 days). Files: 2 routes + 1 shared schema + repo extension.

2. **Route calls repository directly — bypass service**

   `GET /api/appointments` imports `findTurnosPaginated(db, query)` directly, doing `requireAuth` and manually `if (role===CLIENTE) query.customerId=authUser.id` in route.

   - Pros: One fewer layer, slightly less mocking in route tests.
   - Cons: Duplicates ownership injection in two routes (client + admin) — drift risk if service adds clock or future `date→UTC` conversion. Violates single-owner `AppointmentService` (Technical-spec §4.5) and T-036 reuse note. Service unit tests (`list CLIENTE overrides customerId`) would be bypassed, weakening coverage. No benefit for this read-only path.
   - Effort: Low but negative value.

3. **Shared `withPaginatedQuery` helper abstracting both routes**

   Extract `src/app/api/_helpers/paginatedQuery.ts` that does `requireAuth → (optional) assertRole → parse → normalize page/offset/limit/sort → call listAppointments → paginate wrapper → error mapping`, parameterized by `requireAdmin: boolean`.

   - Pros: DRY — single envelope fix propagates; enforces `401 before 400` precedence once.
   - Cons: Premature abstraction for 2 routes with divergent auth (CLIENTE-injects vs ADMIN-bypass) and future `status vs include*` contradiction logic. Hides `server-only` boundary per route, increases blast radius (helper bug breaks both). `confirm`/`reject`/`cancel` shipped without helper — retrofitting churns archives. `sdd-tasks` guard prefers thin slices over helper churn.
   - Effort: Medium (helper + refactor + helper unit tests).

### Recommendation

**Adopt Approach 1: Thin `GET /api/appointments` + `GET /api/admin/appointments` delegating to `AppointmentService.listAppointments` via shared `querySchema`.**

Why:
- **Contract fidelity:** `Technical-spec §8.5` table requires `status`, `includeCancelled`/`includeRejected` (default `false`), `from`/`to` TIMESTAMPTZ, `date` YYYY-MM-DD (BA zone `America/Argentina/Buenos_Aires` via `WorkshopConfig.timezone`), `page` (1-indexed precedence over `offset`), `limit 1..100 default 20`, `sort whitelisted startAt:asc|desc` default `startAt:asc`, wrapper `{ data, pagination }`. Current repo already implements `limit<=100`, `sort` whitelist, `total/totalPages`, `toTurnoDTO`. Missing fields are additive, not breaking.
- **RN-04 must stay:** Repository's `inArray(estado, ["PENDIENTE","CONFIRMADO"]+flags) + gt(fechaHoraInicio, now)` is correct for próximos; H-11 tests require `cliente sin includeCancelled no ve CANCELADO/RECHAZADO`, `includeCancelled=true sí`, `status=CANCELADO&includeCancelled=true` filtered. Keep `gt(now)` conjunctively even with `date`/`from`/`to`.
- **Open decisions resolved:**
  - **Query param shape:** Keep dual `status` (exact) + `includeCancelled`/`includeRejected` (collection). If `status` present, filter `estado=status`; `include*` flags are ignored for that request but not error — except if `status=CANCELADO` with `includeCancelled=false`, resolve as `400 VALIDATION_ERROR` with message "status=CANCELADO requires includeCancelled=true" to avoid contradiction (propose this; alternative allow silently is lenient but less explicit).
  - **Date semantics:** `date=YYYY-MM-DD` filters `fechaHoraInicio` in that BA calendar day: `where fechaHoraInicio >= baDayStartUTC && fechaHoraInicio < baDayEndUTC` (derived via `getBaDayUtcRange(date, timezone)` reusing availability helper, DST-aware via `Intl`). `from`/`to` are ISO TIMESTAMPTZ exact bounds on `fechaHoraInicio` (UTC compare). If both `date` and `from`/`to` supplied, reject `400 VALIDATION_ERROR` ("use date or from/to, not both"). If none supplied, no date filter beyond `start>now`.
  - **Admin reuse:** Implement `GET /api/admin/appointments` as thin wrapper over same service with `assertRole(ADMINISTRADOR)` before parse; `listAppointments` will not inject `customerId` when `role===ADMINISTRADOR`, thus admin sees all. T-036 is satisfied without extra `AppointmentQueryService`.
  - **INV-08 & error mapping:** Return `TurnoDTO` via `toTurnoDTO`; envelope `{ data: TurnoDTO[], pagination }` (never bare array). Errors: `UNAUTHORIZED 401` before Zod, `VALIDATION_ERROR 400 + issues` for Zod/limit/sort/date/ISO/contradiction, `FORBIDDEN 403` for admin route CLIENTE.
- **Pagination helper:** No `src/lib/http/pagination.ts` exists — repo's inline `page/limit/sort/offset→limit/offset + totalPages` is the helper. `page` has precedence over `offset`. Export shared `parsePagination(query)` if reused.
- **File layout (delta for T-033):**
  ```
  src/lib/http/appointmentQuery.ts            # NEW — exports querySchema + parse helpers (status enum, date regex, ISO)
  src/app/api/appointments/route.ts           # MODIFY — add GET (POST untouched)
  src/app/api/admin/appointments/route.ts     # NEW — GET ADMIN with assertRole
  src/db/repositories/turnos.ts               # EXTEND — FindTurnosPaginatedQuery + findTurnosPaginated (status/from/to/date/offset)
  src/app/api/appointments/route.test.ts      # NEW — tables for RN-04 + pagination
  src/app/api/admin/appointments/route.test.ts# NEW — ADMIN 200 + CLIENTE 403
  ```

### Risks

- **Auth/ownership leak:** If `GET /api/appointments` forgets `if (CLIENTE) query.customerId=authUser.id` (or admin route skips `assertRole`), CLIENTE sees all turnos. Mitigated by delegating to `listAppointments` single owner; route tests must assert `listAppointments` called with correct `customerId` and admin 403.
- **RN-04 off-by-one (now boundary):** Repository uses `gt(fechaHoraInicio, now)` (strict `>`). Must not switch to `gte`; `now == start` is not próximo. Clock must be injected `now` in service (already `getNow(deps)`), not `new Date()` inline in route.
- **Status vs include* contradiction:** `status=CANCELADO` with default `includeCancelled=false` currently would be filtered out incorrectly if repo respects only `statuses` array. Must handle precedence explicitly; propose 400 if contradicts.
- **Date vs from/to ambiguity:** Dual date filtering enables `?date=2026-09-10&from=2026-09-10T00:00:00-03:00` double-constraining. Reject both.
- **Limit validation + sort injection:** `limit` must be `1..100` integer, default 20; `sort` whitelisted `asc|desc|startAt:asc|startAt:desc` (case-sensitive). Missing whitelist enables `ORDER BY` injection via raw `sort` string. Use `sortDir.includes("desc")` only after whitelist.
- **N+1 not relevant, but total count query:** `findTurnosPaginated` does `count(*)` + `select ... limit offset` = 2 queries; ensure both share same `whereClause` (date bounds + status) or pagination total drifts.
- **Test coverage gap:** No integration test for `findTurnosPaginated` exists (only `findTurnosByClienteId` in `turnos.integration.test.ts`). Risk of `inArray` with empty `statuses` or `null` customerId. Add integration tests for empty→200 `[]` with `totalPages 0`, `status` filter, `date` BA conversion, `from/to` ISO bounds.
- **401 before 400 precedence:** Must be `requireAuth` before `Zod parse` per `POST` and `confirm` precedent; unauth + `limit=999` must return 401, not 400. Tests must cover `401 takes precedence over 400`.
- **Snake leak:** Route returns `TurnoDTO` via service→`toTurnoDTO`; test must assert `customerId/startDateTime/status` present, `cliente_id/estado/fecha_hora_inicio` absent.
- **Offset vs page confusion:** Spec says `page` has precedence over `offset`; implement `if (page !== undefined) offset=(page-1)*limit else offset=offsetParam`. Off-by-one if `offset` treated as page.

### Ready for Proposal

Yes — **Ready.** Scope bounded to two thin GET handlers + shared query schema + repo extension reusing proven `listAppointments` ownership/rn-04/pagination pipeline and `toTurnoDTO` (INV-08). No open questions blocking proposal; open decisions have recommended resolutions (dual filter with 400 on contradiction, `date` as BA day UTC range via `getBaDayUtcRange`, `from/to` ISO TIMESTAMPTZ on `fechaHoraInicio`, admin reuse via role param, wrapper `{ data, pagination }` always). Invariants INV-02/03/06/08, `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`, and auth guards (`requireAuth`/`assertRole`/`assertOwnership`) are confirmed on disk.

Next is `sdd-propose` to lock contracts (`GET /api/appointments` and `GET /api/admin/appointments` query params, auth, responses `200 {data, pagination}` vs `400|401|403`, envelope `{error:{code,message,issues?}}`), then `sdd-spec` delta for `appointment` domain (query requirement GWT for RN-04 + H-11 + H-28), then `sdd-design` (sequence `middleware→requireAuth→[assertRole]→Zod→listAppointments→findTurnosPaginated→toTurnoDTO`), then `sdd-tasks`.

## Key Learnings

1. Thin GET handlers delegating to AppointmentService.listAppointments preserve RN-04 ownership and pagination single ownership per Technical-spec 4.5.
2. findTurnosPaginated currently lacks status/from/to/date/offset fields needed for T-033 full contract and requires UTC BA day conversion for date param.
3. Admin query reuse via role=ADMIN param satisfies T-036 without duplicating repository logic or creating a separate AppointmentQueryService.
4. Pagination validation limit 1..100 and sort whitelist startAt:asc/desc must be enforced in Zod before SQL ordering to prevent injection.
5. Date versus from/to parameters must be mutually exclusive and date must resolve through getBaDayUtcRange with WorkshopConfig timezone to handle DST correctly.
