# Apply Progress: t036-admin-pending-query

## Status

`completed` — 7/7 tasks done. All Phase 1 test additions green; Phase 2 verifications passed; Phase 3 H-19 anchor comment added.

## Completed Tasks

- [x] 1.1 — `ADMIN pending view — status=PENDIENTE 200` added to `src/app/api/admin/appointments/route.test.ts`. Asserts `listMock` receives `{status:"PENDIENTE", sort:"startAt:asc"}`, role `ADMINISTRADOR`, returns `{data,pagination:{page:1,limit:20,total:1,totalPages:1}}`, INV-08 negative `not.toHaveProperty("estado" | "fecha_hora_inicio")`. H-19 / Trace 1 cited inline.
- [x] 1.2 — `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` added to `src/app/api/admin/appointments/route.test.ts`. Three sub-asserts in one `it`: unauth →401 UNAUTHORIZED; CLIENTE →403 FORBIDDEN; ADMIN with `limit=101` →400 VALIDATION_ERROR. `listMock` never called. H-19 / Traces 3+4 cited inline.
- [x] 1.3 — `CLIENTE own pending 200 — status=PENDIENTE scopes customerId` added to `src/app/api/appointments/route.test.ts`. Asserts `listAppointmentsMock` receives `{status:"PENDIENTE"}` + authUser CLIENTE (which the real service uses to inject `customerId=authUser.id`). INV-08 negative asserted. H-19 / Trace 2 cited inline.
- [x] 2.1 — `pnpm vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` → 30/30 passed (was 27/27, +3 new pending tests). No regression on existing T-033 CLIENTE/admin coverage.
- [x] 2.2 — `pnpm tsc --noEmit` → clean, no prod type drift.
- [x] 2.3 — `git diff --stat` confirms 0 prod LOC. Only 2 test files modified (+62 / -0): `src/app/api/admin/appointments/route.test.ts` +40, `src/app/api/appointments/route.test.ts` +22. Spec delta NONE preserved (no `MODIFIED` requirement added).
- [x] 3.1 — One-line H-19 anchor header comment added to `src/app/api/admin/appointments/route.test.ts`: `// H-19 anchor: T-036 admin pending view reuses T-033 filter via ?status=PENDIENTE. T-033 archived 2026-08-28; delta NONE.`

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `src/app/api/admin/appointments/route.test.ts` | +header comment +2 tests | +40 |
| `src/app/api/appointments/route.test.ts` | +1 test | +22 |
| `openspec/changes/t036-admin-pending-query/tasks.md` | mark checkboxes | (cosmetic) |

0 prod files touched: `src/app/api/admin/appointments/route.ts`, `src/services/appointmentService.ts`, `src/db/repositories/turnos.ts`, `src/lib/http/appointmentQuery.ts` all untouched.

## Verification Evidence

```
pnpm vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts
 Test Files  2 passed (2)
      Tests  30 passed (30)

pnpm tsc --noEmit
(no output — clean)

git diff --stat
 src/app/api/admin/appointments/route.test.ts | 40 ++++++++++++++++++++++++++++
 src/app/api/appointments/route.test.ts       | 22 +++++++++++++++
 2 files changed, 62 insertions(+)
```

## INV / Constraint Compliance

- INV-02: states preserved (only PENDIENTE filter used; no mutation path touched).
- INV-03: auth order preserved (`requireAuth` → `assertRole(ADMINISTRADOR)` → `parseAppointmentQuery`); 401→403→400 precedence asserted in test 1.2.
- INV-08: negative `not.toHaveProperty("estado" | "fecha_hora_inicio")` asserted in all 3 new tests.
- H-19: documented in header comment + inline in each test; reuses T-033 single owner (`listAppointments` → `findTurnosPaginated`).
- H-28: pagination envelope `{data, pagination:{page,limit,total,totalPages}}` asserted in tests 1.1 and 1.3.
- 0 prod LOC: confirmed via `git diff --stat`.
- Spec delta NONE: preserved (no `ADDED/MODIFIED/REMOVED/RENAMED` requirement in `openspec/changes/t036-admin-pending-query/spec.md`).

## Next Recommended Step

Hand off to `sdd-verify` for verify report; then `sdd-archive` (delta NONE — archive folder without `MODIFIED` requirement). Single commit `test(appointment): add H-19 admin pending traceability tests + docs anchor` recommended for the work unit (tests + verify together).
