# Archive Report: t038-permission-tests — Permission Traceability Suite (FASE 7 T-038)

## Cycle Summary

| Field | Value |
|-------|-------|
| Change | `t038-permission-tests` |
| Type | Verification-only delta NONE |
| Branch | `feature/t038-permission-tests` |
| Commit | `ee07157` |
| Archived to | `openspec/changes/archive/2026-08-31-t038-permission-tests/` |
| Archive date | 2026-08-31 |
| Phase completed | FASE 7 T-038 — Policies & UX (permission matrix consolidation) |
| Artifact store | hybrid (Engram + filesystem) |

## Final Verdict

**READY_FOR_NEXT_CHANGE.** Verification-only delta with 0 ADDED, 0 MODIFIED, 0 REMOVED, 0 RENAMED; all 6 traces PASS in one auditable suite, 0 prod LOC.

## Specs Synced

**NONE.** No delta spec applied to `openspec/specs/appointment/spec.md`,
`openspec/specs/availability/spec.md`, or `openspec/specs/workshop-schedule/spec.md`.
Confirmed via `git diff HEAD -- openspec/specs/` → empty.

| Domain | Action | Details |
|--------|--------|---------|
| appointment | NONE | 0 added, 0 modified, 0 removed, 0 renamed — T-038 documents 6 non-normative traces against existing Confirm/Query Role Gating requirements |
| availability | NONE | untouched |
| workshop-schedule | NONE | untouched |

## Traces Documented (Non-Normative, 6/6 PASS)

| # | Trace | Requirement | Test | Result |
|---|-------|-------------|------|--------|
| T1 | CLIENTE cannot confirm | Confirm — Forbidden CLIENTE | `t038-permission.test.ts:111` | PASS (8 ms) |
| T2 | CLIENTE cannot list admin agenda | Query — Role Gating | `:122` | PASS (1 ms) |
| T3 | ADMIN can confirm | Confirm — Happy path ADMIN | `:134` | PASS (3 ms) |
| T4 | ADMIN can list agenda ?date | Query — Role Gating + Date Filter | `:165` | PASS (5 ms) |
| T5a | unauth + malformed UUID → 401 | Auth precedence | `:206` | PASS (1 ms) |
| T5b | CLIENTE + limit=101 → 403 | Role precedence | `:217` | PASS (1 ms) |
| T5c | ADMIN + limit=101 → 400 | Validation last | `:229` | PASS (1 ms) |
| T6 | canTransition matrix defense | RN-07 state machine | `:244` | PASS (0 ms) |

Coverage: 6/6 traces covered by 8 tests (T5 expanded into T5a/b/c).

## Archive Contents

```
openspec/changes/archive/2026-08-31-t038-permission-tests/
├── apply-progress.md      (5,389 bytes — 8/8 PASS, 0 prod LOC)
├── explore.md             (22,594 bytes — full traceability analysis)
├── proposal.md            (3,324 bytes — Approach A: dedicated permission suite)
├── spec.md                (4,240 bytes — NONE delta, 6 non-normative traces)
├── tasks.md               (4,699 bytes — 14/14 ticked, 3 phases)
└── verify-report.md       (9,875 bytes — verdict:pass, sha256:9cc3bff7...)
```

All 6 files byte-identical to pre-move snapshot — verified via SHA256 comparison
(empty diff equivalent). See "Mechanical Readback" section below.

## Tasks Completed (14/14)

- **Phase 1 — Scaffold + 4 GWT** (5/5): test file created with harness from t030/t036;
  T1 CLIENTE 403 confirm; T2 CLIENTE 403 admin; T3 ADMIN 200 confirm; T4 ADMIN 200 agenda ?date.
- **Phase 2 — Precedence + Defense** (4/4): T5a unauth malformed→401; T5b CLIENTE limit=101→403;
  T5c ADMIN limit=101→400; T6 real canTransition CLIENTE→CONFIRMADO===false (RN-07 matrix).
- **Phase 3 — Verification** (5/5): 8/8 vitest PASS in 1.52s; full suite 885→893 +8 no regressions;
  `pnpm tsc --noEmit` clean; lint clean on new file (1 pre-existing error unrelated);
  `git diff --stat` confirms 0 prod LOC.

## Final Test State

| Command | Exit | Result |
|---------|------|--------|
| `pnpm vitest run src/app/api/__tests__/t038-permission.test.ts` | 0 | **8 passed (8)** in 1.52s |
| `pnpm tsc --noEmit` | 0 | clean |
| `pnpm lint` (new file only) | 0 | clean |
| `pnpm vitest run` (full suite) | — | 893 passed \| 3 failed \| 2 skipped (+8 new, 0 new failures) |
| `git diff --stat master..HEAD` | 0 | 6 files changed, 628 insertions, 0 deletions |
| `git diff HEAD -- openspec/specs/` | — | empty (delta NONE verified) |

Pre-existing failures (NOT introduced by T-038, same as baseline `a807e04`):
1. `src/db/__tests__/clientes.schema.test.ts` — env config (`AUTH_SECRET` missing)
2. `src/db/__tests__/servicios.integration.test.ts` — pgCode assertion mismatch
3. `src/db/__tests__/servicios.schema.test.ts` — HTTP-route inventory assertion
4. `src/db/__tests__/turnos.integration.test.ts` — server-only module loaded from client context

All 4 are unrelated to permission suite (last touched in prior T-033/T-034 commits).

## Invariant Compliance (Final State)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| INV-02 states PENDIENTE\|CONFIRMADO\|RECHAZADO\|CANCELADO | ✅ preserved | T6 asserts terminal states `RECHAZADO→CONFIRMADO`, `CANCELADO→CONFIRMADO`, `CONFIRMADO→CONFIRMADO` all return `false` |
| INV-03 Auth.js + JWT + bcrypt; `401→403→400` precedence | ✅ preserved | T5a (401 wins over 400), T5b (403 wins over 400), T5c (400 only after auth+role pass) |
| INV-06 UTC TIMESTAMPTZ, BA timezone | ✅ untouched | 0 prod LOC; T4 routes `?date=` through unchanged `parseAppointmentQuery` + `getBaDayUtcRange` |
| INV-08 DTO mapping camelCase, no `estado`/`fecha_hora_*` leak | ✅ preserved | T3 + T4 negatively assert absence of `estado`/`fecha_hora_inicio`/`fecha_hora_fin`/`cliente_id`/`vehiculo_id`/`servicio_id` |
| H-19 single-owner `AppointmentService`; routes thin | ✅ preserved | T1/T2/T5a/T5b assert `confirmAppointmentMock`/`listAppointmentsMock` NOT called on 403/401 |
| RN-07 `canTransition` matrix | ✅ preserved | T6 imports real `canTransition` (line 56, NOT in `vi.mock`) and asserts `CLIENTE→CONFIRMADO=false`, `ADMINISTRADOR→CONFIRMADO=true` |

## 0 prod LOC Evidence

`git diff HEAD~1..HEAD -- src/` shows only `src/app/api/__tests__/t038-permission.test.ts` (+262 lines).
Untouched: `src/app/api/appointments/[id]/confirm/route.ts`, `src/app/api/admin/appointments/route.ts`,
`src/services/appointmentService.ts`, `src/lib/auth/requireAuth.ts`, `src/domain/appointmentStateMachine.ts`.

## Mechanical Readback (MANDATORY)

The Mechanical Copy Contract was satisfied with the following SHA256 comparison
against the pre-move snapshot at `sdd-archive-*` (recursively snapshotted before any move):

```
---BEGIN_DIFF_R_EQUIVALENT(SHA256)---
MATCH    apply-progress.md
MATCH    explore.md
MATCH    proposal.md
MATCH    spec.md
MATCH    tasks.md
MATCH    verify-report.md
---END_DIFF_R---
VERDICT=PASS_EMPTY_DIFF_BYTE_IDENTICAL
```

All 6 files are byte-identical between source snapshot and destination.
Empty diff is the only passing evidence.

## Risks & Caveats

- **Pre-existing lint error**: `src/lib/http/appointmentQuery.ts:55` (`prefer-const` on `piped`)
  — NOT introduced by T-038 (last touched in `bcee077 T-033-001`). Recommend separate cleanup.
- **Pre-existing DB/env failures**: 4 failures in `src/db/__tests__/*` unrelated to permission suite.
  Defer to DB hardening phase.
- **Merge decision**: T-038 archive commit will be created on `feature/t038-permission-tests`.
  Per `feature-branch-chain` strategy and prior pattern (`5a17de2 chore(archive): t036b-...`,
  `8268257 chore(archive): t037-...`), only merged tracker merges to master.
  Decision: leave merge to orchestrator; document and hand off.

## Next Steps

1. **Orchestrator**: Commit archive on `feature/t038-permission-tests` with message
   `chore(archive): t038-permission-tests -> archive 2026-08-31, delta NONE 8/8 PASS`
2. **Orchestrator**: Merge `feature/t038-permission-tests` to `master` with `--no-ff`
   per `feature-branch-chain` strategy.
3. **Future**: FASE 8+ continues — T-039..T-049 policies & UX not yet started.
4. **Future**: T-053 security tests will extend the permission matrix for E2E coverage.

## SDD Cycle Status

| Phase | Status |
|-------|--------|
| Explore | DONE (129 lines) |
| Propose | DONE (65 lines) |
| Spec | DONE (NONE delta, 6 traces) |
| Tasks | DONE (14/14) |
| Apply | DONE (8/8 PASS, 0 prod LOC) |
| Verify | DONE (verdict:pass, 6/6 traces) |
| Archive | DONE (this report) |

**Cycle complete. Ready for next change.**

---

*Generated: 2026-08-31 — sdd-archive for `t038-permission-tests` — hybrid artifact.*