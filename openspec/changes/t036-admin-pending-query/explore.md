# Exploration: t036-admin-pending-query — Admin Pending Query (FASE 7 T-036, H-19)

## Current State

**T-036 scope (implementation-plan.md §10, H-19):** Admin must list all appointments with `estado=PENDIENTE`. H-19 note: if T-036 is only query with filter, **reuse T-033** with `role=ADMIN` (`GET /api/appointments?status=PENDIENTE` vs `GET /api/admin/appointments?status=PENDIENTE`). Do NOT duplicate logic; delegate reading to `AppointmentService.query` / `listAppointments` (single owner).

**Verified on disk 2026-08-31 (cwd `C:\Users\Luis Mercury\proyectos\curso-01`, branch `feature/t034` ahead of master `74795b9`):**

- **Shared query schema (`src/lib/http/appointmentQuery.ts`, 177 LOC):** `querySchema` exports `status: AppointmentStatusSchema.optional()` (z.enum `PENDIENTE|CONFIRMADO|CANCELADO|RECHAZADO`), `includeCancelled/includeRejected` boolean (default `false`, case-insensitive), `from/to` ISO 8601 with TZ (`Z|±HH:MM`), `date` `YYYY-MM-DD`, `page`/`limit`/`offset`, `sort` whitelist `asc|desc|startAt:asc|startAt:desc` default `asc`. `superRefine` enforces `status=CANCELADO` requires `includeCancelled=true`, `status=RECHAZADO` requires `includeRejected=true`, `status=PENDIENTE|"CONFIRMADO"` have **no flag requirement** — so `?status=PENDIENTE` is valid with defaults. Contradiction `date` vs `from/to` and `from>to` also enforced. `parseAppointmentQuery` normalizes arrays (last wins) and is used by both routes.

- **Service single owner (`src/services/appointmentService.ts:259-276`):** `listAppointments(deps, query, authUser)` is the sole read path:
  ```ts
  if (authUser.role === "CLIENTE") effectiveQuery.customerId = authUser.id;
  if (!effectiveQuery.now) effectiveQuery.now = getNow(deps);
  return findTurnosPaginated(deps.db, effectiveQuery);
  ```
  CLIENTE injects scope, ADMIN bypasses (sees all). No duplication; `getAppointmentById` via `assertOwnership`, `confirm/reject/cancel` via `canTransition`.

- **Repository RN-04 + status exact (`src/db/repositories/turnos.ts:212-398`):** `FindTurnosPaginatedQuery` includes `status?: AppointmentStatus`, `from/to/date/offset/dateRange`, `includeCancelled/includeRejected`, `page/limit/sort/now/customerId`. `findTurnosPaginated` validates `status` against allowed set, enforces `status=CANCELADO` → `includeCancelled` and `status=RECHAZADO` → `includeRejected` defensively (400), builds `statuses = [query.status]` if status present else `["PENDIENTE","CONFIRMADO"] + flags`, applies `gt(fechaHoraInicio, now)` conjunctively, resolves `date` via `getBaDayUtcRange(date, workshopConfig.timezone)` (BA DST-aware, half-open `[00:00 BA, next 00:00 BA)` UTC), `from` as `gte`, `to` as `lt`, shared `whereClause` for `count(*)` and data select, `orderBy fechaHoraInicio asc|desc`, `totalPages = ceil(total/limit)` (0 if 0), offset precedence `page` wins over `offset`, `DbOrTx` injected, returns `TurnoDTO` via `toTurnoDTO` (INV-08). `PENDIENTE` path yields `inArray(estado, ["PENDIENTE"]) AND gt(now)` — exactly the pending view.

- **Routes (`src/app/api/appointments/route.ts:124-177` + `src/app/api/admin/appointments/route.ts:19-81`):** Both are thin `server-only` handlers:
  - `GET /api/appointments` (CLIENTE): `requireAuth → parseAppointmentQuery(raw) → listAppointments({db,config,now}, parsed, authUser) → 200 {data,pagination}`. Returns `401 UNAUTHORIZED` before parse, `400 VALIDATION_ERROR` via `toValidationError` for Zod/contradiction, `403` via service if needed. Tested in `src/app/api/appointments/route.test.ts:271-309` (200 envelope + `customerId` injection, `401 before 400`, `400 CANCELADO without flag`, `no snake leak`, `sort/pagination passthrough`, `status=PENDIENTE` for CLIENTE).
  - `GET /api/admin/appointments` (ADMIN): `requireAuth → assertRole(ADMINISTRADOR) → parseAppointmentQuery(raw) → listAppointments(..., ADMIN) → 200`. Returns `401` before `403` before `400`. Tested in `src/app/api/admin/appointments/route.test.ts:20-62` (ADMIN 200 sees all, CLIENTE 403, unauth 401, `401 before 400`, `400 on bad query` (`status=CANCELADO` without flag), `filter passthrough` (`CANCELADO+includeCancelled`), `no snake leak`). `PENDIENTE` uses same `filter passthrough` code path — no extra branch.

- **Invariants locked on disk:**
  - INV-02: `AppointmentStatusSchema = z.enum(["PENDIENTE","CONFIRMADO","RECHAZADO","CANCELADO"])` (`src/domain/appointmentStateMachine.ts:9-18`), no `COMPLETADO`; `canTransition` matrix enforced for mutations, read path filters by exact status.
  - INV-03: `requireAuth` (JWT `httpOnly` via `jose` `jwtVerify`, `AUTH_SECRET>=32`) + `assertRole(ADMINISTRADOR)` + `assertOwnership` (ADMIN bypass) in `src/lib/auth/requireAuth.ts`. Admin route order `401→403→400` matches `confirm/reject` precedent.
  - INV-06: DB `TIMESTAMPTZ` UTC, API accepts ISO with TZ (`Z|±HH:MM`), repo compares UTC `getTime()`, `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` in `src/config/workshopConfig.ts` (frozen).
  - INV-08: `toTurnoDTO` remaps `cliente_id→customerId`, `fecha_hora_inicio→startDateTime`, `estado→status` etc. (`src/db/mappers/turno.ts`). Both routes assert `not.toHaveProperty("estado")`.
  - INV-01/04/05: Not touched by read path; `countActiveOverlappingForUpdate` with `FOR UPDATE` isolated to `createAppointment`.

- **T-033 archived 2026-08-28 (delta #339, 6 ADDED 19 GWT, verify 62/62 mocked tests, `pass_with_warnings`):** Spec at `openspec/changes/archive/2026-08-28-t033-appointment-query/specs/appointment/spec.md` (requirements: RN-04 default, status exact+contradiction, date BA, range, pagination envelope, role gating). Code merged to `master@74795b9`. T-035 (role guard) implicit via FASE 2.5 (`requireAuth`/`assertRole`) and proven by `ADMIN 200 / CLIENTE 403` tests. DAG dependency satisfied: T-033 and T-035 are DONE.

**Gap assessment:** `status=PENDIENTE` is already fully implemented via shared `querySchema` + `findTurnosPaginated` + both routes. No zod enum handling missing, no role guard missing, no pagination missing. The only delta for T-036 is **documentation + explicit test naming** the admin pending view as `GET /api/admin/appointments?status=PENDIENTE` (and optionally `GET /api/appointments?status=PENDIENTE` for CLIENTE own pending). Zero code logic duplication.

### Affected Areas

- `src/lib/http/appointmentQuery.ts` — **NO CHANGE** (already supports `status=PENDIENTE` without flags, contradiction only for CANCELADO/RECHAZADO). Read-only verification that `AppointmentStatusSchema` includes `PENDIENTE`.
- `src/db/repositories/turnos.ts#findTurnosPaginated` — **NO CHANGE** (already handles `status=PENDIENTE` as exact `inArray(estado, ["PENDIENTE"])` plus `gt(now)`, shared whereClause for total/data, half-open date/range, offset precedence, `toTurnoDTO`).
- `src/services/appointmentService.ts#listAppointments` — **NO CHANGE** (single owner; CLIENTE injects `customerId`, ADMIN sees all; injects `now` clock).
- `src/app/api/admin/appointments/route.ts` — **NO CHANGE** (already `assertRole(ADMINISTRADOR)` then `parseAppointmentQuery` then `listAppointments`). Verified that `?status=PENDIENTE` flows through existing `filter passthrough` test shape.
- `src/app/api/appointments/route.ts` — **NO CHANGE** (CLIENTE own pending via same query).
- `src/app/api/admin/appointments/route.test.ts` — **MINOR ADD (or docs-only):** Optionally add one explicit `it("ADMIN pending view — status=PENDIENTE 200 with pagination")` that calls `GET /api/admin/appointments?status=PENDIENTE&page=1&limit=20&sort=startAt:asc` and asserts `listMock` called with `{status:"PENDIENTE", sort:"asc"}` and `role=ADMINISTRADOR`, plus `data` camelCase. Already implicitly covered by existing `filter passthrough` (CANCELADO) and `ADMIN 200 sees all`, but naming the scenario closes H-19 traceability.
- `src/app/api/appointments/route.test.ts` — **OPTIONAL:** Mirror `status=PENDIENTE` for CLIENTE pending (already has `status=PENDIENTE` in CLIENTE GET test). No new logic.
- `openspec/specs/appointment/spec.md` — **NO DELTA REQUIRED** for code; if an audit delta is desired, add a non-normative note under `Query — Status Exact Filter` that `status=PENDIENTE` is the admin pending view (`GET /api/admin/appointments?status=PENDIENTE` → `{data: TurnoDTO[PENDIENTE], pagination}`) to make H-19 explicit without new `ADDED` requirement.
- `openspec/changes/t036-admin-pending-query/*` — **NEW change folder** for exploration/proposal/spec/design/tasks/verify. Per H-19 single-owner note, spec delta is `NONE` or `MODIFIED` note only; no new requirement.

### Approaches

1. **Pure reuse — document + test `status=PENDIENTE` as admin pending view, zero code (recommended)**
   - Declare T-036 satisfied by T-033: admin pending = `GET /api/admin/appointments?status=PENDIENTE` (optionally with `page/limit/sort`), CLIENTE own pending = `GET /api/appointments?status=PENDIENTE`. Both reuse `AppointmentService.listAppointments` / `findTurnosPaginated` single owner, no new endpoint, no repo duplication. Add at most one explicit test name for traceability and a delta note in spec if audit requires.
   - Pros: Honors H-19 "no duplicar lógica; delega lectura a AppointmentService.query" and INV-08/INV-03/INV-02/H-28 verbatim; lowest risk and blast radius (zero prod code churn); stays under 400-line budget with zero lines; preserves `canTransition` single owner; pagination/BA DST/401→403→400 already verified by T-033's 62 mocked tests. Aligns with implementation-plan.md detail that T-036 reuses T-033 with `role=ADMIN` param.
   - Cons: Requires stakeholders to accept "already done via filter" — mitigated by explicit trace test and archival note.
   - Effort: Low (hours — one test + docs).

2. **Thin alias endpoint — e.g., `GET /api/admin/appointments/pending` → forwards to same service**
   - Create alias route that hardcodes `status=PENDIENTE` and forwards to `listAppointments` with same pagination/date filters, or adds `GET /api/admin/pending` label.
   - Pros: Gives H-19 a dedicated URL mnemonic for UI (`Panel administrativo — solicitudes pendientes`).
   - Cons: Duplicates route boilerplate (`requireAuth→assertRole→parse→service`) for a single hardcoded filter; two URLs for same resource invites drift (alias forgets `sort`/`page` propagation); H-19 explicitly prefers reuse over alias; UI can already call `?status=PENDIENTE` without alias. Unnecessary under review budget.
   - Effort: Low but negative value vs Option 1.

3. **Duplication — new `AppointmentQueryService` or duplicated repo query for admin pending (reject)**
   - Create separate query service/method for admin pending that reimplements `status=PENDIENTE` filtering outside `findTurnosPaginated`.
   - Pros: None beyond perceived separation.
   - Cons: Violates `Technical-spec §4.5` single owner (`AppointmentService` owns query) and H-19 note; duplicates `where` clause (RN-04 `gt(now)` + `inArray`) risking divergence; increases maintenance and 400-line cost without benefit; contradicts T-033 archive design decision.
   - Effort: Medium, introduces tech debt.

### Recommendation

**Adopt Approach 1: Pure reuse — T-036 is already satisfied by T-033; no prod code change.**

Why:
- **Contract fidelity:** T-033 already ships `status` exact filter (including `PENDIENTE` without flag), `include*` defaults, `from/to`/`date` BA half-open, pagination envelope `{data,pagination}` with `limit 1..100`, `sort` whitelist, `401 before 403 before 400`, role gating (`CLIENTE` scoped via `customerId` injection, `ADMIN` sees all), and INV-06/08. The pending view is `status=PENDIENTE` with default `gt(now)` — no extra constraint needed. Existing `verify-report.md` (2026-08-28) proves 19/19 scenarios compliant.
- **Single owner preserved:** Both routes already delegate to `AppointmentService.listAppointments` → `findTurnosPaginated` → `toTurnoDTO`. No duplication, satisfying H-19 and `openspec/specs/appointment` single-owner note (`T-036/T-037 delegan a AppointmentService; no duplican lógica de transición`).
- **400-line budget:** Zero prod LOC, one optional test case for naming, one optional non-normative delta note. No API contract change beyond documenting the filter usage.
- **File layout for completion:**
  ```
  openspec/changes/t036-admin-pending-query/
    explore.md   (this file) — proves reuse via evidence
    proposal.md  — intent: admin pending = filter, reuse T-033, no duplication
    spec.md      — delta NONE or MODIFIED note linking status=PENDIENTE to H-19
    design.md    — sequence already in T-033 (requireAuth→assertRole→parse→list→find→toTurnoDTO)
    tasks.md     — T-036-001 document pending view, T-036-002 add explicit pending test, T-036-003 verify no snake leak/401→403→400
    verify.md    — run pnpm vitest run appointmentQuery + turnos.query + admin/appointments route (already pass)
  ```
- **Open decisions resolved:**
  - `?status=PENDIENTE` requires no `include*` flag (only CANCELADO/RECHAZADO do); `GET /api/admin/appointments?status=PENDIENTE&page=1&limit=20&sort=startAt:asc` returns pending future turnos ordered `fechaHoraInicio asc` with pagination.
  - Combined filters (`status=PENDIENTE&date=YYYY-MM-DD` or `&from/to`) remain conjunctive with `gt(now)` as in T-033; no special pending rule.
  - `CONFIRMADO` vs `PENDIENTE` distinction is explicit via `status` value; default without `status` is still `PENDIENTE|CONFIRMADO` per RN-04, but pending view must pass `status=PENDIENTE` to exclude `CONFIRMADO`.

### Risks

- **Perceived gap — "missing dedicated endpoint":** Stakeholders expecting `GET /api/admin/pending` may flag T-036 as incomplete despite H-19 reuse note. Mitigated by proposal/spec explicitly citing `implementation-plan.md §10` H-19 detail and linking to T-033 verify evidence; optional alias is rejected with rationale.
- **Auth/ownership bypass if mocked tests drift:** Repo already injections-tested (`CLIENTE` injects `customerId`, `ADMIN` bypasses). Reuse preserves this; risk is only if future refactor bypasses `listAppointments`. Guarded by single-owner rule and route tests that assert `listMock` last call `role`.
- **401→403→400 precedence regression:** Admin pending must still return `401` for missing JWT even with `?status=PENDIENTE&limit=101`, and `403` for CLIENTE on admin even with invalid `limit`. Already tested (`401 before 400`, `CLIENTE with invalid limit still 403`); adding pending test must preserve same precedence.
- **Snake leak (INV-08):** Pending view returns `TurnoDTO` camelCase; risk is DTO mapper bypass if someone returns raw row. Existing tests assert `not.toHaveProperty("estado")` / `fecha_hora_inicio` — keep them for pending variant.
- **Total vs data whereClause drift:** `findTurnosPaginated` already shares `whereClause` for `count` and data select; reusing pending filter inherits this. No new query path, so no drift risk.
- **Offset vs page confusion for pending pagination:** `page` wins over `offset` (T-033 logic `offset = page>1 ? (page-1)*limit : offset || ...`). Pending pagination must follow same; no change needed but verify test uses `page=2&offset=999` → offset 10 when `limit=10`.
- **Date/BA DST with pending status:** `status=PENDIENTE&date=YYYY-MM-DD` must resolve via `getBaDayUtcRange` and remain `gt(now)`. Already in T-033 `turnos.query.test.ts` BA DST test; pending combo is same path.
- **Spec audit trace:** If spec delta is `NONE`, audit trail relies on exploration/proposal linking; consider adding a `MODIFIED` note under `Query — Status Exact Filter` stating "PENDIENTE is the admin pending view via `GET /api/admin/appointments?status=PENDIENTE`" to make H-19 searchable without new requirement.

### Ready for Proposal

Yes — **Ready.** Scope bounded to zero prod code plus optional named test and documentation. Dependencies T-033 and T-035 are verified DONE on disk and in archive. No open questions blocking proposal; open decisions have recommended resolutions (reuse filter, PENDIENTE needs no flag, admin sees all, pending is not a new endpoint). Invariants INV-02/03/06/08, `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`, and auth guards are confirmed. Next: `sdd-propose` to lock "T-036 = T-033 filter reuse, no duplication" contract, then `sdd-spec` with delta NONE or note-only, then `sdd-design` referencing T-033 sequence, then `sdd-tasks` and `sdd-verify` (reuse T-033 mocks).

## Key Learnings

1. Admin pending is already `GET /api/admin/appointments?status=PENDIENTE` via shared `querySchema` — no code gap; PENDIENTE needs no `include*` flag.
2. Both routes delegate to `AppointmentService.listAppointments` single owner; CLIENTE injects `customerId`, ADMIN bypasses — reuse satisfies H-19 without new service.
3. Repository `findTurnosPaginated` handles `status=PENDIENTE` as exact `inArray` plus `gt(now)`, with BA DST `date` half-open and shared `whereClause` for pagination — pending view inherits all.
4. Auth order `401→403→400` and INV-08 camelCase (`toTurnoDTO`) already verified for pending path; no leak.
5. Optional explicit pending test closes traceability without prod churn; alias/duplicate approaches add risk and violate single-owner rule.
