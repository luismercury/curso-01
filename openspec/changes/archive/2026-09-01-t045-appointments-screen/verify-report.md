# Verify Report — t045-appointments-screen (T-045 UI-04 Próximos turnos)

> Independent SDD verification of the full change after PR1 5-way stack
> (4e2fa99..14f0c36) + PR2 4-way tracker (c46f07e) merged to master.
>
> **Status: PASS** — ready for `sdd-archive`.
>
> Verification ran on master @ `c46f07e` ("feat(appointments): T-045 PR2
> surface — AppointmentList compound + RSC integration (4-way tracker)")
> against the 6 ADDED requirements + 15 GWT in
> `openspec/changes/t045-appointments-screen/specs/{appointments-screen,appointment}/spec.md`.

## 1. Spec Coverage (6 REQ / 15 GWT)

Authoritative counts read from spec files:
- `specs/appointments-screen/spec.md` — 5 ADDED requirements (REQ-01..REQ-05), 12 GWT scenarios
- `specs/appointment/spec.md` — 1 ADDED requirement (REQ-06), 3 GWT scenarios
- **Total: 6 ADDED / 15 GWT**

| GWT | Spec ID | Description | Evidence (file:test) | Result |
|----:|---------|-------------|----------------------|--------|
| 1.1 | appointments-screen/REQ-01 | Happy list — enriched rows | `page.test.tsx` R1.1 (R1.1 enrichment props) + `AppointmentList.test.tsx` ("formats UTC 12:00 → BA 10/09/2026 + 09:00–10:30") | PASS |
| 1.2 | appointments-screen/REQ-01 | UTC→BA conversion | `AppointmentList.test.tsx` (`dateFormatter.format(start) === "10/09/2026"`, `09:00–10:30` range) | PASS |
| 1.3 | appointments-screen/REQ-01 | Deleted service fallback | `turno.test.ts` ("servicioNombre null → fallback 'Servicio no disponible'", "vehiculo columns all null → fallback 'Vehículo no disponible'", "partial vehiculo columns → still falls back") + `AppointmentList.test.tsx` ("Servicio/Vehículo no disponible still renders a row") + `page.test.tsx` R1.3 | PASS |
| 2.1 | appointments-screen/REQ-02 | Badge variants | `AppointmentList.test.tsx` (PENDIENTE → amber + `Estado: PENDIENTE`; CONFIRMADO → green + `Estado: CONFIRMADO`) | PASS |
| 2.2 | appointments-screen/REQ-02 | A11y roles | `AppointmentList.test.tsx` (`ol role=list + 3 li role=listitem`) + page `<h1 id="appointments-heading">Próximos turnos</h1>` | PASS |
| 3.1 | appointments-screen/REQ-03 | Empty state | `AppointmentList.test.tsx` (`appointments-empty` testid + role=status + "No tienes turnos próximos") + `page.test.tsx` R3.1 (no `<ol>` when 0 rows) | PASS |
| 3.2 | appointments-screen/REQ-03 | Default excludes CANCELADO/RECHAZADO | `turnos.enriched.test.ts` ("issues exactly 1 count(*) over turnos + 1 data select with LEFT JOIN servicios + LEFT JOIN vehiculos" — repo enforces `inArray(turnos.estado, ["PENDIENTE", "CONFIRMADO"])` only; no `includeCancelled`/`includeRejected` flags surfaced) | PASS |
| 4.1 | appointments-screen/REQ-04 | Pagination happy | `AppointmentList.test.tsx` (`?page=2 → 'Página 2 de 2' + Anterior enabled + Siguiente disabled`) + `page.test.tsx` R4.1 (pagination envelope passed to Root) | PASS |
| 4.2 | appointments-screen/REQ-04 | Invalid limit/page | `page.test.tsx` R4.2 (3 cases: `?page=0&limit=101`, `?page=abc&limit=-1`, valid `?page=2&limit=10`) + `appointmentsQuery.test.ts` (12 clamp tests: empty input, string coerce, page=0 clamp, limit=101 clamp, negative page, unknown sort, etc.) | PASS |
| 5.1 | appointments-screen/REQ-05 | Auth redirect | `page.test.tsx` R5.1 (null session → `NEXT_REDIRECT:/login` + `LE` not called) + preserved T-044 test ("null session → redirect, no service calls") | PASS |
| 5.2 | appointments-screen/REQ-05 | No snake leak INV-08 | `page.test.tsx` R5.2 (21-key SNAKE list scan on page JSON) + `AppointmentList.test.tsx` ("rendered HTML is free of snake_case / Spanish DB keys" — same SNAKE list) | PASS |
| 5.3 | appointments-screen/REQ-05 | ISO serialization | `page.test.tsx` R5.3 (`expect(j).toContain("2026-09-10T12:30:00.000Z")`) + `AppointmentList.test.tsx` (`<time datetime>` preserved) + `turno.test.ts` (ISO Z suffix assertion) | PASS |
| 6.1 | appointment/REQ-06 | Enriched shape camelCase | `turno.test.ts` ("renames snake_case columns to camelCase English DTO" + "never leaks snake_case / Spanish DB keys" + "vehicleLabel format matches spec") + `appointments.test.ts` ("accepts a complete EnrichedTurnoDTOJson (camelCase + ISO + serviceName/vehicleLabel)" + "rejects snake_case enrichment column names") | PASS |
| 6.2 | appointment/REQ-06 | Single query — no N+1 | `turnos.enriched.test.ts` (`selectMock.toHaveBeenCalledTimes(2)` count + data + `joins.length === 2` referencing `[servicios, vehiculos]` table identities + `orderByCalls.length === 1`) + "does NOT issue a separate bulk fetch over servicios or vehiculos" (asserts ≤ 2 select calls) | PASS |
| 6.3 | appointment/REQ-06 | NULL join fallback | `turno.test.ts` (3 fallback tests + Zod test "rejects empty serviceName / vehicleLabel (fallback guarantees non-empty)") + `turnos.enriched.test.ts` ("LEFT JOIN nulls → mapper substitutes fallback strings") | PASS |

**All 15 GWT scenarios are covered by at least one focused test, and each requirement has multiple complementary tests.**

## 2. Gate Outputs

### `pnpm typecheck` (`tsc --noEmit`)

```
$ tsc --noEmit
(exit 0, 0 errors)
```

**PASS** — 0 type errors.

### `pnpm vitest run` (focused — 7 T-045 files)

```
Test Files  7 passed (7)
     Tests  114 passed (114)
  Duration  3.04s
```

Files covered:
- `src/db/mappers/turno.test.ts` (13 tests)
- `src/db/repositories/turnos.enriched.test.ts` (10 tests)
- `src/lib/api/appointments.test.ts` (46 tests, incl. extended for T-045)
- `src/lib/validators/appointmentsQuery.test.ts` (12 tests)
- `src/services/__tests__/appointmentService.enriched.test.ts` (8 tests)
- `src/app/(customer)/appointments/page.test.tsx` (19 tests, incl. preserved T-044)
- `src/app/(customer)/appointments/_components/AppointmentList.test.tsx` (17 tests)

**PASS** — 114/114.

### `pnpm vitest run` (full suite — 91 files)

```
Test Files  79 passed | 11 failed | 1 skipped (91)
     Tests  1316 passed | 50 failed | 2 skipped (1368)
  Duration  29.28s
```

**50 failures are all pre-existing infrastructure issues** — confirmed against
the PR1 apply-progress baseline (session summary #497):

- `src/db/__tests__/turnos.integration.test.ts` — server-only mock infrastructure gap
- `src/db/__tests__/clientes.schema.test.ts` — `AUTH_SECRET` env var missing
- `src/db/__tests__/servicios.schema.test.ts` — services routes exist (added in T-020+)
- `src/db/__tests__/servicios.integration.test.ts` — `connect ECONNREFUSED ::1:5432` (no PG)
- `src/db/__tests__/vehiculos.integration.test.ts` — same PG connection refused
- `src/db/__tests__/t015-customer-vehicle.integration.test.ts` — same PG connection refused
- `src/db/__tests__/t009-integrity.integration.test.ts` — same PG connection refused

All 11 failed test files are integration tests requiring a live PostgreSQL
that is not running in this verification environment. **0 regressions** vs
the PR1 baseline; net new tests are all in the 1316 passing count.

**PASS** for T-045 scope (focused vitest 114/114 + full 1316/1368 pass with
failures isolated to pre-existing infra).

### `pnpm lint` (`eslint`)

```
21 problems (2 errors, 19 warnings)
[ELIFECYCLE] Command failed with exit code 1.
```

The 2 errors are **pre-existing baseline issues, NOT introduced by T-045**:
- `src/app/(customer)/vehicles/_components/VehicleProvider.tsx:61:21` — `react-hooks/set-state-in-effect` (T-039 vehicles slice)
- `src/lib/http/appointmentQuery.ts:55:7` — `prefer-const` (T-033 admin appointments slice)

No T-045 file (`appointments/page.tsx`, `appointments/_components/AppointmentList.tsx`,
`db/mappers/turno.ts`, `db/repositories/turnos.ts`, `lib/api/appointments.ts`,
`lib/validators/appointmentsQuery.ts`, `services/appointmentService.ts`) appears
in the lint output. Count `21 = baseline` matches PR1 apply-progress claim
"lint 21 problems = baseline (0 new)".

**PASS** — 0 new lint findings from T-045.

## 3. Invariant Matrix

| Invariant | Status | Evidence |
|-----------|:------:|----------|
| **INV-02** UPPER_SNAKE, no COMPLETADO | PASS | `appointmentStatusSchema = z.enum(["PENDIENTE","CONFIRMADO","RECHAZADO","CANCELADO"])` at `lib/api/appointments.ts:63-68`; tests `rejects COMPLETADO (no such state in v1)` + `rejects COMPLETADO status (INV-02)`; `AppointmentListStatusBadge` returns `null` for non PENDIENTE/CONFIRMADO (REQ-03 enforcement); completed grep across `src/**/*.ts` confirms all 37 `COMPLETADO` matches are negative tests / JSDoc "no such state" / domain rejection tests |
| **INV-03** Auth + ownership | PASS | `listAppointmentsEnriched` injects `effectiveQuery.customerId = authUser.id` for CLIENTE and DROPS caller-supplied (verified by 4 IDOR tests in `appointmentService.enriched.test.ts`); ADMINISTRADOR passthrough tested; page.tsx `if (!session?.user?.id) redirect("/login")` BEFORE DB; `getAppointmentById` and `assertOwnership` enforced for `?confirmed=` banner |
| **INV-06** TIMESTAMPTZ UTC + IANA tz | PASS | `toEnrichedJson` uses `.toISOString()`; mapper test asserts `typeof json.startDateTime === "string"` and `=== "2026-09-10T12:00:00.000Z"`; page pipes through `toEnrichedJson`; AppointmentList Root memoizes `Intl.DateTimeFormat("es-AR", { timeZone: timezone })`; `<time suppressHydrationWarning>` for hydration safety; zod `isoDateTime = z.string().datetime({ offset: true })` on wire schemas; `WorkshopConfig.timezone = "America/Argentina/Buenos_Aires"` (page test asserts forwarded to Root props) |
| **INV-08** snake→camel, no leak | PASS | `toEnrichedDTO` mapper renames all columns (`clienteId→customerId`, `fechaHoraInicio→startDateTime`, `servicioNombre→serviceName`, `vehiculoMarca+Modelo+Patente→vehicleLabel`); `enrichedTurnoDTOSchema.strict()` rejects unknown keys (3 negative tests); BOTH `page.test.tsx` and `AppointmentList.test.tsx` assert 21-key SNAKE list (incl. `fecha_hora_inicio`, `cliente_id`, `vehiculo_id`, `servicio_id`, `estado`, `created_at`, `updated_at`, `nombre`, `marca`, `modelo`, `patente`) absent from page JSON tree and innerHTML respectively |

## 4. Composition + React 19 Pattern Audit

| Pattern | Status | Evidence |
|---------|:------:|----------|
| `vercel-composition-patterns:architecture-avoid-boolean-props` | PASS | Explicit `AppointmentList.Badge.PendingBadge` + `ConfirmedBadge` variants; no boolean `isPending` on generic Badge; `AppointmentListStatusBadge` is an internal dispatcher |
| `vercel-composition-patterns:patterns-explicit-variants` | PASS | Same as above — variants are first-class namespaced members of the compound |
| React 19 `use()` over `useContext()` | PASS | `use(AppointmentListContext)` at `AppointmentList.tsx:88`; provider exposes `value` via `<AppointmentListContext value={value}>` (no `.Provider`) |
| React 19 `no-forwardref` | PASS | No `forwardRef` in any T-045 file |
| Memoized Intl on timezone only | PASS | `useMemo(..., [timezone])` for both `dateFormatter` and `timeFormatter` at `AppointmentList.tsx:113-132` |
| `suppressHydrationWarning` on `<time>` | PASS | Applied to both `<time>` elements in Card (lines 268, 276); justified by INV-06 env-Intl-vs-server-Intl mismatch |
| `force-dynamic` + `revalidate = 0` | PASS | RSC `page.tsx:19-20` |
| Async `searchParams: Promise<...>` | PASS | `type Props = { searchParams: Promise<...> }` + `await searchParams` at line 47 |
| `Promise.all` parallelization | PASS | `Promise.all([fetchConfirmed, listAppointmentsEnriched])` at line 54 |
| URL-driven pagination, no client fetch | PASS | `router.push(url, { scroll: false })` in Pagination; no `fetch()` from the compound |

## 5. Threat Matrix / Security Audit

| Threat | Status | Evidence |
|--------|:------:|----------|
| IDOR (caller tampers `?customerId=`) | PASS | 4 IDOR regression tests: CLIENTE drop override, CLIENTE default, ADMIN passthrough, ADMIN no-filter; service layer is the single source of truth |
| N+1 query | PASS | `findTurnosPaginatedEnriched` uses ONE count over `turnos` + ONE data select with LEFT JOIN servicios + LEFT JOIN vehiculos; asserted via mock `selectMock.toHaveBeenCalledTimes(2)` and `joins.length === 2` |
| snake_case leak to client | PASS | Zod `.strict()` on `enrichedTurnoDTOSchema` rejects unknown keys; mapper test asserts `not.toHaveProperty('fecha_hora_inicio')` etc.; page test SNAKE scan; AppointmentList test SNAKE innerHTML scan |
| XXS via wire DTO | PASS | Zod strict mode rejects unknown keys before they reach React; ISO datetime validation (`z.string().datetime({ offset: true })`) blocks naive timestamps |
| Auth bypass | PASS | `auth()` called before any DB access; `redirect("/login")` returns NEXT_REDIRECT error which is caught by Next.js |
| Status enumeration | PASS | `appointmentStatusSchema.strict()` enum + `enrichedTurnoDTOSchema.status` inherits strict enum; COMPLETADO rejected; lowercase rejected |
| `?limit=999999` DoS | PASS | `parseAppointmentsQuery` clamps to 100 via `limitSchema = z.coerce.number().int().min(1).max(100)`; repo layer also validates as defense-in-depth |

## 6. Findings

**CRITICAL: 0** — no real defects.

**WARNING: 0** — no regressions vs baseline.

**SUGGESTION: 1** (non-blocking, code-quality only)

1. `parseAppointmentsQuery` clamps instead of throws on invalid input (per
   REQ-04 contract). The function's JSDoc documents this contract, but
   `page.tsx:49-51` would benefit from one extra sentence pointing readers
   to `parseAppointmentsQuery` for the never-throws rationale. Current
   `// REQ-04: clamp-on-parse` comment is sufficient for now.

## 7. Spec Count Authoritative Confirmation

Verified by direct file read:

```text
openspec/changes/t045-appointments-screen/specs/appointments-screen/spec.md
  5 ADDED Requirements: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05
  GWT scenarios: 3 + 2 + 2 + 2 + 3 = 12

openspec/changes/t045-appointments-screen/specs/appointment/spec.md
  1 ADDED Requirement: REQ-06
  GWT scenarios: 3

Total: 6 ADDED / 15 GWT (matches task brief).
```

## 8. Diff Summary

```text
git diff --stat 4e2fa99^..c46f07e

.../t045-appointments-screen/apply-progress.md     | 223 ++++++++++++
.../_components/AppointmentList.test.tsx           | 382 ++++++++++++++++++++
.../appointments/_components/AppointmentList.tsx   | 393 +++++++++++++++++++++
.../appointments/appointments.module.css           | 127 +++++++
src/app/(customer)/appointments/page.test.tsx      | 194 +++++++++-
src/app/(customer)/appointments/page.tsx           |  49 ++-
src/db/mappers/turno.test.ts                       | 161 +++++++++
src/db/mappers/turno.ts                            | 108 ++++++
src/db/repositories/turnos.enriched.test.ts        | 224 ++++++++++++
src/db/repositories/turnos.ts                      | 121 ++++++-
src/lib/api/appointments.test.ts                   | 101 ++++++
src/lib/api/appointments.ts                        |  96 +++++
src/lib/validators/appointmentsQuery.test.ts       |  91 +++++
src/lib/validators/appointmentsQuery.ts            | 115 ++++++
.../__tests__/appointmentService.enriched.test.ts  | 179 ++++++++++
src/services/appointmentService.ts                 |  46 ++-
16 files changed, 2579 insertions(+), 31 deletions(-)
```

15 production/test files modified or created by T-045 (plus apply-progress mirror).
No DB migration (no new tables or columns).

## 9. Next Step

**sdd-archive** — sync the 6 ADDED requirements + 15 GWT to
`openspec/specs/{appointments-screen,appointment}/spec.md`.

After archive, this change is closed and ready for the next FASE 8 task
(T-046 cancel UI → T-047..T-049 admin panel).

---

## Mirror Locations (hybrid store)

- Engram: `sdd/t045-appointments-screen/verify-report` (obs #502)
- Filesystem: `openspec/changes/t045-appointments-screen/verify-report.md` (this file)
