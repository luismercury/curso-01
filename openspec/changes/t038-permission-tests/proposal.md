# Proposal: t038-permission-tests — Permission Traceability Suite (FASE 7 T-038)

## Intent

Consolidate 4 scattered GWT (already green) into one auditable suite: `PATCH .../confirm` CLIENTE 403 / ADMIN 200 and `GET /api/admin/appointments` CLIENTE 403 / ADMIN 200. Proves H-19 single-owner, INV-03 `401→403→400`, RN-07 `canTransition`, INV-08 no snake leak — 0 prod LOC.

## Scope

### In Scope
- Suite `src/app/api/__tests__/t038-permission.test.ts` mocking `server-only`/`@/db`/`@/services/appointmentService`/`@/lib/auth/requireAuth` (harness from t030/t036)
- 4 GWT + 2 precedence (`401→403→400`: unauth malformed→401, CLIENTE `limit=101`→403, ADMIN `limit=101`→400) + `service not called` on 403
- Defense block: `confirmAppointment(..., CLIENTE)` →409 `INVALID_APPOINTMENT_STATE`
- Single PR, docs only

### Out of Scope
- E2E/DB/JWT, new endpoints, prod/schema/UI, capacity/slot/timezone

## Capabilities

> Contract for sdd-spec. Researched `openspec/specs/appointment`, `availability`, `workshop-schedule`.

### New Capabilities
- None — verification-only, no new prod requirement

### Modified Capabilities
- None — reuses `appointment` Confirm/Query Role Gating; optional trace note else delta NONE

## Approach

Approach A (explore.md): one file imports both handlers (confirm + admin). Fixtures `ADMIN`/`CLIENTE`, `VALID_UUID`/`MALFORMED_UUID`. `requireAuth` mock throws `UnauthorizedError`/`ForbiddenError` before service; 403 asserts mock not called. ADMIN 200 asserts `toTurnoDTO` camelCase (`status` not `estado`). Defense block uses real `canTransition` for CLIENTE 409 vs route 403 distinction.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/__tests__/t038-permission.test.ts` | New | 4 GWT + 2 precedence + defense (~140 LOC) |
| `src/app/api/appointments/[id]/confirm/route.ts` | Unchanged | Thin `requireAuth→assertRole→uuid→service` |
| `src/app/api/admin/appointments/route.ts` | Unchanged | `requireAuth→assertRole→parseQuery→list` |
| `src/services/appointmentService.ts` | Unchanged | H-19 owner, `canTransition` 409 net |
| `src/lib/auth/requireAuth.ts` | Unchanged | 401/403 guards |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auth runs after validation (breaks 401→403→400) | Low | Test unauth malformed→401 + CLIENTE `limit=101`→403 |
| Mock hides matrix (403 vs 409 conflated) | Low | Assert `notCalled` on 403; real `canTransition` CLIENTE→409 block |
| Vitest include mismatch for path | Low | Check `vitest.config.ts` include before PR |

## Rollback Plan

`git revert` or `rm` the test file. No migration/prod to undo; `git diff --stat` = 0 prod LOC.

## Dependencies

- T-035 DONE (`requireAuth`/`assertRole` CLIENTE/ADMINISTRADOR)
- T-030/T-033/T-036 DONE (thin routes, H-19, 401→403→400 harness)
- `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` (INV-06)

## Success Criteria

- [ ] 4 GWT in one file: CLIENTE confirm 403, CLIENTE admin 403, ADMIN confirm 200, ADMIN agenda 200 `?date`
- [ ] Precedence green + `service not called` on 403
- [ ] Defense: direct service CLIENTE →409
- [ ] 0 prod LOC, `pnpm test` green, `tsc --noEmit` clean, `openspec validate` pass
