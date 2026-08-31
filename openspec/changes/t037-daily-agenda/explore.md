# Exploration: t037-daily-agenda — Daily Agenda (FASE 7 T-037, H-11/H-27/H-19/H-28)

## Current State

**T-037 scope (implementation-plan.md §10 v2):**
```
Cliente: GET /api/appointments?date=YYYY-MM-DD&page=&limit=&sort=startAt:asc
         (filters own, turno.clienteId == authUser.id)
Admin:   GET /api/admin/appointments?date=YYYY-MM-DD&includeCancelled=false&includeRejected=false&page=&limit=&sort=startAt:asc
         or alias GET /api/admin/agenda?date=  (all, ordered startAt:asc)
Default: only active PENDIENTE|CONFIRMADO; flags includeCancelled/includeRejected opt-in
Pagination H-28: ?page=1&limit=20&sort=startAt:asc (or ?limit=&offset=), helper paginate() limit<=100,
         response {data, pagination:{page,limit,total,totalPages}}
H-19: delegates reading to AppointmentService; no transition duplication
Deps:  T-033 (paginated query) and T-035 (role guard) — both DONE. T-036 archived delta NONE.
Technical-spec §8.5: same contract, alias documented as "implement one and document the other".
```

**Verified on disk 2026-08-31 (cwd `C:\Users\Luis Mercury\proyectos\curso-01`, branch `feature/t034` ahead of `74795b9`):**

- **Shared query schema (`src/lib/http/appointmentQuery.ts:1-177`):** `querySchema` is the single validator used by both routes. `dateSchema` = `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidCalendarDate)` (calendar-valid, not just regex). `booleanQueryParam` case-insensitive `"true"/"false"` default `false`. `page`/`limit`/`offset` via `numericStringSchema` (page `1..`, limit `1..100 default 20`, offset `0..`). `from`/`to` = ISO 8601 with TZ `regex(Z|±HH:MM)` + `new Date(v)` valid. `sort` whitelist `asc|desc|startAt:asc|startAt:desc` default `"asc"` (maps to `asc`). `superRefine` enforces `date` vs `from/to` mutual exclusion (`400 "use date or from/to, not both"`), `status=CANCELADO requires includeCancelled=true`, `status=RECHAZADO requires includeRejected=true`, `from>to`. `parseAppointmentQuery` normalizes duplicate array params (last wins). This already satisfies T-037's `date=YYYY-MM-DD`, `page/limit/sort`, `include*` contract.

- **Repository `findTurnosPaginated` (`src/db/repositories/turnos.ts:212-398`):** Handles all T-037 filters:
  - Resolves `date` string to UTC range via `getBaDayUtcRange(date, workshopConfig.timezone)` (line 335-337) when `dateRange` not supplied. Range is half-open `[00:00 BA, next 00:00 BA)` DST-aware.
  - Conjunctive filters: `inArray(estado, statuses)` + `gt(fechaHoraInicio, now)` (RN-04 próximos) + optional `customerId` + `gte(fromUtc)/lt(toUtc)` for date range + `gte(from)/lt(to)` for range params + `orderBy fechaHoraInicio asc|desc` derived from `sort`.
  - `statuses` = `[query.status]` if status present else `["PENDIENTE","CONFIRMADO"] + cancelled/rejected flags` — so `?date=` without status returns active-only (the daily agenda default), with `includeCancelled=true` adds `CANCELADO`.
  - Pagination: shared `whereClause` for `count(*)` + data select, `totalPages=ceil(total/limit)` (0 if 0), `offset` precedence `page wins` (lines 370-384). `limit<=100` validated, `DbOrTx` injected, returns `TurnoDTO` via `toTurnoDTO` (INV-08).
  - DST/date correctness comes from `availabilityService#getBaDayUtcRange` (`src/services/availability/availabilityService.ts:57-85`): validates `YYYY-MM-DD`, uses `baWallTimeToUtcDate(ymd,"00:00",timezone)` + `nextBaYmd` for exclusive end, `Intl.DateTimeFormat` oracle.

- **Service single owner (`src/services/appointmentService.ts:259-276`):** `listAppointments(deps, query, authUser)` is the sole read path — CLIENTE injects `customerId = authUser.id`, ADMIN bypasses (sees all), injects `now` clock if not supplied, delegates to `findTurnosPaginated`. Ownership §4.5 + H-19 preserved: confirm/reject/cancel owned exclusively via `canTransition`, list is read-only delegation.

- **Routes (`src/app/api/appointments/route.ts:124-177` + `src/app/api/admin/appointments/route.ts:19-81`):** Both thin `server-only`:
  - `GET /api/appointments` (CLIENTE): `requireAuth → parseAppointmentQuery(raw) → listAppointments({db,config,now}, parsed, authUser) → 200 {data,pagination}`. `401` before `400`, Zod `toValidationError` for contradiction/bad iso/bad date/limit, `toTurnoDTO` inside service.
  - `GET /api/admin/appointments` (ADMIN): `requireAuth → assertRole(ADMINISTRADOR) → parseAppointmentQuery → listAppointments(..., ADMIN) → 200`. `401→403→400` order. Both already forward `date`, `page/limit/offset/sort`, `include*` to service — the agenda view `?date=YYYY-MM-DD&sort=startAt:asc` is already end-to-end.
  - Tested: `src/app/api/appointments/route.test.ts:271-331` (5 GET suites including `400 date+from`, `limit 101`, `CLIENTE own pending status=PENDIENTE scopes customerId`, `sort/pagination passthrough`, `no snake leak`) and `src/app/api/admin/appointments/route.test.ts:21-102` (8 suites including `ADMIN 200 sees all`, `CLIENTE 403`, `401 before 400`, `400 on bad query`, `filter passthrough CANCELADO+includeCancelled`, `ADMIN pending view status=PENDIENTE 200`, `pending precedence 401→403→400 with limit=101`). T-036 added explicit pending traces; date trace is structurally identical.

- **Spec contract already exists (`openspec/specs/appointment/spec.md:350-368`):** `Requirement: Query — Date Filter (BA Timezone)` with scenarios `Valid BA day` (`date=2026-09-10 → >=2026-09-10T03:00Z AND <2026-09-11T03:00Z plus gt(now)`), `Invalid date is 400`, `date vs from/to exclusion 400`. Pagination envelope and role gating requirements also cover `sort=startAt:asc` and `limit<=100` + `CLIENTE scoped / ADMIN sees all`. T-037 does not need a new requirement — it names the date filter as "agenda diaria".

- **Alias `GET /api/admin/agenda?date=` does NOT exist:** `Glob src/app/api/admin/agenda/**` returns 0 files. `Technical-spec §8.5` documents alias as "implement one and document the other as alias" — current implementation chose `GET /api/admin/appointments` as canonical. T-036 explored analogous alias for pending (`/pending`) and rejected it (same H-19 drift risk; archived `2026-08-31` delta NONE). No code references `agenda` alias.

- **T-036 archive pattern:** `openspec/changes/archive/2026-08-31-t036-admin-pending-query/` proves T-036 satisfied by T-033 filter reuse with zero prod code, one named test, delta NONE. T-037 is the same pattern for `date` instead of `status`.

**Gap conclusion:** Zero logic gap for T-037's daily agenda. `GET /api/appointments?date=YYYY-MM-DD` (CLIENTE own) and `GET /api/admin/appointments?date=YYYY-MM-DD` (ADMIN all) with `sort=startAt:asc`, `page/limit/offset`, and `includeCancelled/includeRejected` flags are fully implemented, DST-aware, with `gt(now)` RN-04 conjunctivity. The only delta is **documentation + explicit agenda trace**: naming the date filter as "agenda diaria" for H-11/H-27/H-28 audit, and optionally handling the `GET /api/admin/agenda?date=` alias decision.

### Affected Areas

- `src/lib/http/appointmentQuery.ts` — **NO CHANGE** (already validates `date YYYY-MM-DD`, calendar date, mutual exclusion `date` vs `from/to`, `include*` defaults `false`, `status` contradiction, `page/limit<=100`, `sort` whitelist, `from/to` ISO with TZ, array normalization).
- `src/db/repositories/turnos.ts#findTurnosPaginated` — **NO CHANGE** (already resolves `date` via `getBaDayUtcRange(YYYY-MM-DD, WorkshopConfig.timezone)` BA half-open, DST-aware, conjunctive with `gt(now)`, shared `whereClause` for total/data, `orderBy fechaHoraInicio asc|desc`, offset precedence `page wins`).
- `src/services/appointmentService.ts#listAppointments` — **NO CHANGE** (single owner; CLIENTE injects `customerId`, ADMIN sees all, injects `now` clock; delegates to repo with `toTurnoDTO` INV-08).
- `src/services/availability/availabilityService.ts#getBaDayUtcRange` — **NO CHANGE** (DST oracle via `baWallTimeToUtcDate` + `nextBaYmd`; reused for date filter, not just availability).
- `src/app/api/appointments/route.ts` — **NO CHANGE** (CLIENTE agenda already `GET ?date=YYYY-MM-DD&page=&limit=&sort=startAt:asc` via shared `parseAppointmentQuery`).
- `src/app/api/admin/appointments/route.ts` — **NO CHANGE** for core; optional **thin alias** `src/app/api/admin/agenda/route.ts` if alias benefit chosen (see Approaches B) — same `requireAuth→assertRole→parse→listAppointments` forwarding.
- `src/app/api/appointments/route.test.ts` + `src/app/api/admin/appointments/route.test.ts` — **MINOR ADD (or docs-only):** Optionally add explicit agenda trace `it("daily agenda — ?date=YYYY-MM-DD 200 ordered startAt:asc with pagination")` asserting `GET ...?date=2026-09-10&page=1&limit=20&sort=startAt:asc` calls `listMock` with `{date:"2026-09-10", sort:"startAt:asc"}` and response `{data: TurnoDTO[], pagination:{page,limit,total,totalPages}}` plus `401→403→400` with `date` param. Already implicitly covered by `filter passthrough` + `date+from 400`, but naming closes H-11/H-27/H-28 traceability.
- `openspec/specs/appointment/spec.md` — **NO DELTA REQUIRED** for logic; if audit prefers explicitness, add non-normative note under `Query — Date Filter (BA Timezone)` that `GET /api/appointments?date=` (CLIENTE own) and `GET /api/admin/appointments?date=` (ADMIN all) are the daily agenda views per F-08/H-27, pagination via H-28, filtered by RN-04 `start>now` + `include*` flags.
- `openspec/changes/t037-daily-agenda/*` — **NEW change folder** (explore/proposal/spec/design/tasks/verify). Per H-19 single-owner, spec delta is `NONE` or `MODIFIED` note only; no new requirement.

### Approaches

1. **Pure reuse — document date filter as daily agenda, zero code (recommended)**

   Declare T-037 satisfied by T-033: daily agenda = `GET /api/appointments?date=YYYY-MM-DD` (CLIENTE own, `turno.clienteId == authUser.id`) and `GET /api/admin/appointments?date=YYYY-MM-DD` (ADMIN all, `sort=startAt:asc` default), default active-only (`PENDIENTE|CONFIRMADO` with `start>now`), optional `includeCancelled=true`/`includeRejected=true`, pagination `page/limit/offset/sort` with `limit<=100` and response `{data, pagination}`. Both reuse `AppointmentService.listAppointments` → `findTurnosPaginated` single owner, no new endpoint, no repo duplication. Add at most one explicit agenda test name for traceability and a delta note if audit requires.

   - Pros: Honors H-19 "delegates reading to AppointmentService; no duplica transición" and Technical-spec §4.5 single owner + INV-02/03/06/08 verbatim; lowest risk/blast radius (zero prod code churn); stays well under 400-line budget with zero lines; preserves BA DST half-open `[00:00, next 00:00)` UTC via `getBaDayUtcRange` and `401→403→400` + `include*` defaults + `gt(now)` conjunctivity already verified by T-033's 62 mocked tests and T-036's 10 route tests. Aligns with `implementation-plan.md §10` T-037 note that T-037 reuses T-033 query with `date` param. UI `T-049 agenda diaria` can already call `?date=` without alias.
   - Cons: Requires stakeholders to accept "already done via filter" — mitigated by explicit named test and archival note citing T-033 verify evidence.
   - Effort: Low (hours — one test + docs).

2. **Thin alias — `GET /api/admin/agenda?date=` forwards to same handler**

   Create `src/app/api/admin/agenda/route.ts` that does `requireAuth → assertRole(ADMINISTRADOR) → parseAppointmentQuery(raw) → listAppointments(..., ADMIN) → 200 {data,pagination}` (or a one-line re-export/redirect to canonical). Optionally keep canonical `GET /api/admin/appointments?date=` as spec truth and document alias as convenience for UI (`Panel administrativo — agenda diaria`).

   - Pros: Gives H-27 a dedicated URL mnemonic matching Technical-spec's alias example (`GET /api/admin/agenda?date=`), fulfills the literal "alias" wording without logic duplication.
   - Cons: Duplicates thin route boilerplate (`requireAuth→assertRole→parse→service`) for a single hardcoded path; two URLs for same resource invite drift (alias forgets `sort`/`page` propagation, inconsistent `401→403→400` order, or stale OpenAPI); H-19 prefers reuse over alias (T-036 rejected analogous `/pending` alias for same reason); UI can already call canonical `?date=` without alias. Adds ~50 LOC + one test file for branding only.
   - Effort: Low but negative value vs Option 1 unless alias is contractually required by downstream UI.

3. **Duplication — new `AppointmentAgendaService` or duplicated repo query for agenda (reject)**

   Create separate agenda service/query that reimplements `date → getBaDayUtcRange → gte/lt fechaHoraInicio` plus `gt(now)` + `orderBy` outside `findTurnosPaginated`.

   - Pros: None beyond perceived separation.
   - Cons: Violates Technical-spec §4.5 single owner (`AppointmentService` owns query) and H-19 note; duplicates `whereClause` (RN-04 `gt(now)` + BA half-open) risking divergence (date off-by-one, DST miscalc, `total`/`data` whereClause drift); increases maintenance and 400-line cost without benefit; contradicts T-033/T-036 archive design decisions.
   - Effort: Medium, introduces tech debt.

### Recommendation

**Adopt Approach 1: Pure reuse — T-037 daily agenda is already shipped via T-033's `date` filter; no prod code change.**

Why:
- **Contract fidelity:** T-033 already ships `date YYYY-MM-DD` BA → `getBaDayUtcRange(timezone)` half-open DST-aware (already spec'd as `Requirement: Query — Date Filter (BA Timezone)`), `includeCancelled/includeRejected` default `false` (H-11 visibility: client agenda excludes `CANCELADO`/`RECHAZADO` unless flagged, admin can audit with flags), `from/to` ISO with TZ, `status` exact filter, `401 before 403 before 400` (`CLIENTE` on admin `403` before `400` even with `?date=&limit=101`), pagination envelope `{data, pagination}` with `limit 1..100`, `sort` whitelist (`startAt:asc` default per T-037's agenda sort, implemented as `asc` relaxed default), `gt(now)` conjunctive, role gating (`CLIENTE` scoped via `customerId` injection, `ADMIN` sees all), and INV-06/08 (TIMESTAMPTZ UTC, `toTurnoDTO`). The agenda view is simply `?date=YYYY-MM-DD` with optional `include*` + `page/limit/sort` — no extra constraint needed. Existing `verify-report.md` (T-033 2026-08-28) proves 19/19 GWT + 62 mocked tests; T-036's `ADMIN pending view` + `CLIENTE own pending` + `pending precedence 401→403→400` tests prove the pattern end-to-end.
- **Single owner preserved:** Both routes delegate to `AppointmentService.listAppointments` → `findTurnosPaginated` → `toTurnoDTO`. No transition duplication, satisfying H-19 and `Technical-spec §4.6` note (`T-036/T-037 delegan a AppointmentService; no duplican lógica de transición`).
- **400-line budget:** Zero prod LOC, one optional named agenda test, one optional non-normative delta note. No migration, no OpenAPI churn beyond documenting the filter usage as agenda.
- **Alias handling:** Approach 2 (alias `GET /api/admin/agenda?date=`) is available as a **deferred thin alias** only if downstream UI contract mandates it; default is to document `GET /api/admin/appointments?date=` as the agenda endpoint and list `GET /api/admin/agenda?date=` as alias in `Technical-spec §8.5` without adding code, matching the decision in T-036 to reject `/pending` alias. If alias becomes required, add `src/app/api/admin/agenda/route.ts` as a one-line forward to the same service — no logic duplication.
- **File layout for completion:**
  ```
  openspec/changes/t037-daily-agenda/
    explore.md  (this file) — proves reuse via evidence
    proposal.md — intent: daily agenda = date filter reuse, no duplication
    spec.md     — delta NONE or MODIFIED note linking date=YYYY-MM-DD to F-08/H-11/H-27/H-28
    design.md   — sequence already in T-033 (requireAuth→[assertRole]→parse→list→find→toTurnoDTO, BA range)
    tasks.md    — T-037-001 document agenda views, T-037-002 add explicit agenda test, T-037-003 verify no snake leak/401→403→400/BA half-open
    verify.md   — run pnpm vitest run appointmentQuery + turnos.query + admin/appointments route (already pass)
  ```
- **Open decisions resolved:**
  - `?date=YYYY-MM-DD` needs no `include*` flag by default (active-only agenda); `?date=&includeCancelled=true` includes `CANCELADO` for audit — same as T-033.
  - Combined filters (`date` + `status=PENDIENTE` for admin filtered agenda, or `date` + `page/limit/sort`) remain conjunctive with `gt(now)`; `date` with `from/to` stays `400` mutual exclusion.
  - Sort is `startAt:asc` ordered `fechaHoraInicio ASC` (current default `asc` maps to same; recommend documenting canonical `startAt:asc` and keeping `asc` as lenient alias).
  - `GET /api/appointments?date=` filters to owner's turnos; `GET /api/admin/appointments?date=` sees all owners (role gating), both with pagination H-28 `{page,limit,total,totalPages}`.

### Risks

- **Perceived gap — "missing dedicated agenda endpoint":** Stakeholders expecting `GET /api/admin/agenda?date=` may flag T-037 incomplete despite Technical-spec's "implement one and document the other as alias." Mitigated by proposal/spec explicitly citing `implementation-plan.md §10` T-037 ("or alias") plus `Technical-spec §8.5` wording and linking to T-033 verify evidence; alias (Approach 2) available on demand as thin forward if contract requires.
- **Sort default `asc` vs `startAt:asc` wording:** T-037 says `sort=startAt:asc` canonical, current `querySchema` default is `asc`. Behavior identical (`sortDir = includes("desc") ? "desc" : "asc"`), but OpenAPI/spec phrasing should note `asc` is lenient alias for `startAt:asc` to avoid audit flag. No runtime fix needed.
- **BA DST half-open correctness:** `date=YYYY-MM-DD` must resolve to `[00:00 BA, next 00:00 BA)` UTC, not `23:59:59.999` naive. Already via `getBaDayUtcRange` + `gte(fromUtc)/lt(toUtc)` conjunctive with `gt(now)`. Already in T-033 `turnos.query.test.ts` BA DST test; agenda combo is same path — no new logic.
- **Auth/ownership bypass if mocked tests drift:** Repo injection already tested (`CLIENTE` injects `customerId`, `ADMIN` bypasses). Reuse preserves this; risk only if future refactor bypasses `listAppointments`. Guarded by single-owner rule and route tests asserting `listMock` last call `role`.
- **401→403→400 precedence regression for agenda:** Agenda with `?date=&limit=101` must still return `401` for missing JWT even with bad limit, and `403` for CLIENTE on admin even with invalid `date`. Already tested (`401 before 400`, `CLIENTE with invalid limit still 403`); adding agenda test must preserve same precedence — include `agenda precedence — 401→403→400 with date=YYYY-MM-DD&limit=101`.
- **Snake leak (INV-08):** Agenda returns `TurnoDTO` camelCase; risk is DTO mapper bypass. Existing tests assert `not.toHaveProperty("estado")`/`fecha_hora_inicio` — keep for agenda variant.
- **`total` vs `data` whereClause drift:** `findTurnosPaginated` shares `whereClause` for `count` and data select; reusing date filter inherits this. No new query path, so no drift.
- **Offset vs page confusion for agenda pagination:** `page` wins over `offset` (T-033 logic `offset = page>1 ? (page-1)*limit : offset`). Agenda pagination must follow same; verify test uses `page=2&offset=999` → offset 10 when `limit=10` if alias added.
- **Spec audit trace:** If spec delta is `NONE`, audit trail relies on exploration/proposal linking; consider adding `MODIFIED` note under `Query — Date Filter (BA Timezone)` stating date is the agenda view (`GET /api/appointments?date=` CLIENTE own + `GET /api/admin/appointments?date=` ADMIN all, `sort=startAt:asc`, pagination H-28, filtered by RN-04 `start>now` + `include*` flags) to make H-11/H-27/H-28 explicit without new requirement.

### Ready for Proposal

Yes — **Ready.** Scope bounded to zero prod code plus optional named agenda test and documentation. Dependencies T-033 and T-035 verified DONE on disk and in archives (`T-033 archived 2026-08-28 6 ADDED 19 GWT 62 tests merged 74795b9`; `T-036 archived 2026-08-31 delta NONE`; role guard via `requireAuth`/`assertRole` proven `ADMIN 200`/`CLIENTE 403`). No open questions blocking proposal; open decisions have recommended resolutions (reuse `date=YYYY-MM-DD` BA half-open DST-aware with `gt(now)` conjunctivity + `include*` flags, canonical `GET /api/admin/appointments?date=` with `GET /api/admin/agenda?date=` documented as alias only if needed, `sort=startAt:asc` canonical, pagination `{data,pagination}` H-28). Invariants INV-02/03/06/08, `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`, and auth guards confirmed.

Next: `sdd-propose` to lock "T-037 = T-033 date filter reuse as daily agenda, no duplication, alias documented not built" contract, then `sdd-spec` with delta NONE or note-only, then `sdd-design` referencing T-033 sequence plus `getBaDayUtcRange`, then `sdd-tasks` and `sdd-verify` (reuse T-033 mocks).

## Key Learnings

1. Daily agenda is already `GET /api/appointments?date=YYYY-MM-DD` (CLIENTE own) and `GET /api/admin/appointments?date=YYYY-MM-DD` (ADMIN all) via shared `querySchema` — zero code gap; `date` half-open DST-aware via `getBaDayUtcRange`.
2. Both routes delegate to `AppointmentService.listAppointments` single owner; CLIENTE injects `customerId`, ADMIN bypasses — reuse satisfies H-19 without new service; pagination/sort via H-28 `{data,pagination}` `limit<=100`.
3. Repository `findTurnosPaginated` handles `date=YYYY-MM-DD` as `gte(fromUtc)/lt(toUtc)` conjunctive with `gt(now)` RN-04, `includeCancelled/Rejected` default `false` for active-only agenda (H-11), shared `whereClause` for total/data.
4. Auth order `401→403→400` and INV-08 camelCase (`toTurnoDTO`) already verified for agenda path; `GET /api/admin/agenda?date=` is documented alias per §8.5 — implement only if contract requires, otherwise document alias (T-036 precedent).
5. Optional explicit agenda test closes H-27/H-28 traceability without prod churn; alias/duplicate approaches add drift and violate single-owner rule.
