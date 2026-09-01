# Archive Report: t040-service-selection — Service Selection UI (FASE 8 UI-02 T-040)

## Cycle Summary

| Field | Value |
|-------|-------|
| Change | `t040-service-selection` |
| Type | NEW capability (new domain `service-selection`, alias `service`) |
| Branch (tracker) | `feature/t040-service-selection` |
| Tip commit (after chain consolidation) | `9dd3f18` (`chore(docs): commit still-untracked SDD tracker docs`) |
| Chain | feature-branch-chain — 3 PRs stacked + 1 docs commit: PR1 `bd584e7`, PR2 `11e4551`, PR3 tests `832a69b`, PR3 docs `9dd3f18` |
| Consolidation | tracker fast-forwarded `bd584e7 → 9dd3f18` (no merge commit, history preserved) |
| Archived to | `openspec/changes/archive/2026-08-31-t040-service-selection/` |
| Archive date | 2026-08-31 |
| Phase completed | FASE 8 UI-02 T-040 — Service Selection UI (RSC `/(customer)/services` + compound `ServiceSelector` islands; feeds T-041→T-043 via `serviceId + durationMinutes`) |
| Artifact store | hybrid (Engram + filesystem) |
| Delivery strategy | auto-chain (3-PR feature-branch-chain ~900 LOC budget, ~2547 total insertions) |
| Review budget | 400 LOC/PR enforced (PR1 299 code, PR2 ~295 code, PR3 0 prod) |

## Final Verdict

**READY_FOR_NEXT_CHANGE.** 4 ADDED requirements / 8 GWT scenarios PASS, all 22 tasks complete, 82 new tests PASS across 8 new test files, `tsc --noEmit` + `pnpm build` clean, 3 pre-existing master failures identical to baseline (no regressions introduced).

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `service-selection` | **CREATED** (NEW domain) | 4 ADDED requirements, 8 GWT scenarios — first new spec domain for T-040 |
| `service` | **CREATED** (mirror alias of `service-selection`) | Identical content; canonical is `service-selection` |

### Sync verification (Mechanical Copy Contract)

Both global spec files were created via shell `Copy-Item` from the delta spec (no model-mediated content rewrite). SHA256 byte-identity verified:

```
Delta spec   (openspec/changes/t040-service-selection/specs/service-selection/spec.md)
  SHA256 = 7C5D3F14CDE91E527377641BE3A372373102EF1A70FA0D1073FCF4E1111EFE91
  Lines   = 63

Global spec  (openspec/specs/service-selection/spec.md)
  SHA256 = 7C5D3F14CDE91E527377641BE3A372373102EF1A70FA0D1073FCF4E1111EFE91
  Lines   = 63

Delta spec   (openspec/changes/t040-service-selection/specs/service/spec.md)
  SHA256 = B718781FCDF664BCA7E0C4FA50368CF168FAB488D05BFAF3154C7EDDB2648E09
  Lines   = 63

Global spec  (openspec/specs/service/spec.md)
  SHA256 = B718781FCDF664BCA7E0C4FA50368CF168FAB488D05BFAF3154C7EDDB2648E09
  Lines   = 63

=== diff -r (source vs destination, verbatim) ===
[git diff --no-index --stat service-selection]
(empty)
[git diff --no-index --stat service]
(empty)
[git diff exit codes] service-selection=0 service=0

VERDICT=PASS_EMPTY_DIFF_BYTE_IDENTICAL
```

No MODIFIED, REMOVED, or RENAMED requirements — this is a pure NEW domain delta (mirror alias of the canonical `service-selection`).

## Requirements Verified (4/4, 8/8 GWT)

| # | Requirement | Scenarios | Test files | Result |
|---|-------------|-----------|------------|--------|
| REQ-SVC-01 | Service List via RSC Server-Direct (INV-08, T-017) | S1, S2, S3 | `services/page.test.tsx`, `tests/integration/services-dto-leak.test.ts`, `tests/integration/services-route-activeOnly.test.ts`, `services/_components/ServiceList.test.tsx` | **PASS** |
| REQ-SVC-02 | Service Selection via URL Canonical `?serviceId=` | S4, S5, S6 | `services/page.test.tsx`, `services/_components/ServiceCard.test.tsx`, `services/_components/SelectedBanner.test.tsx`, `tests/integration/services-route-activeOnly.test.ts`, `services/_components/ServiceSelector.tsx` | **PASS** |
| REQ-SVC-03 | Validation & Filtering (Duration, Activo) | S7 | `services/_components/SelectedBanner.test.tsx` (inactive branch), `tests/integration/services-route-activeOnly.test.ts` (ADMIN-only `includeInactive=true`), `services/page.tsx` (`includeInactive:false`) | **PASS** |
| REQ-SVC-04 | Composition & Error Mapping (No Hardcode, No Leak) | S8 | `lib/api/services.test.ts`, `tests/integration/services-route-activeOnly.test.ts`, `services/page.test.tsx` (null session → redirect), `services/error.tsx` | **PASS** |

**Coverage: 4/4 requirements, 8/8 GWT scenarios — all PASS** (per `verify-report.md` SHA256 `3b2fbea0991aa94a340685aeaeb3d514fd03ff6b533cdfe02a38a1262905daef`, verdict `pass`, blockers `0`, critical_findings `0`).

## Chain Audit (feature-branch-chain, 3 PRs + 1 docs commit)

| PR | Commit | Base | Branch tip | Code LOC | Test LOC | Scope |
|---|---|---|---|---|---|---|
| PR1 | `bd584e7` | `master@7923e15` | `feature/t040-service-selection` | 299 (455 incl. JSDoc) | 0 | RSC shell foundation: `(customer)/services/page.tsx`, `loading.tsx`, `error.tsx`, `lib/api/services.ts`, `lib/validators/service.ts`, `(customer)/layout.tsx` nav link |
| PR2 | `11e4551` | `bd584e7` | `feature/t040-service-selection-pr1` | ~295 (under 400 budget) | 0 | Compound islands: `ServiceSelector` (`.List`/`.Card`/`.SelectedBanner`), `ServiceList`, `ServiceCard`, `SelectedBanner`, `services.module.css`; URL `?serviceId=` via `useSearchParams` + `router.push` |
| PR3 tests | `832a69b` | `11e4551` | `feature/t040-service-selection-pr2` | **0 prod LOC** | 860 (8 files / 82 tests) | Test coverage + tooling: `vitest` jsdom suite, RTL, integration |
| PR3 docs | `9dd3f18` | `832a69b` | `feature/t040-service-selection-pr2` | 0 | 0 | Tracker docs committed: `design.md`, `exploration.md`, `explore.md`, `proposal.md`, `spec.md`, `specs/service/spec.md`, `specs/service-selection/spec.md` (523 insertions) |
| **Total** | | | | **~614 prod** | **860 tests** | **22 tasks, 8 test files, 82 new tests, 2547 total insertions** |

Each PR within 400 LOC code budget. PR3 shipped 0 production LOC (tests + docs only) per the orchestrator's chained-PR forecast. PR3's 860 LOC of tests exceeded the original "~300-400" estimate but stayed below T-039 PR3's 1025 LOC baseline.

## Archive Contents

```
openspec/changes/archive/2026-08-31-t040-service-selection/
├── apply-progress.md     (~15 KB — 3-PR chain 8/8 PASS per PR)
├── archive-report.md     (this file — written post-verification, additive)
├── design.md             (~4.7 KB — RSC + URL islands approach A, D1..D4)
├── explore.md            (~2.9 KB — exploration)
├── exploration.md        (~2.9 KB — duplicate of explore.md, both preserved)
├── proposal.md           (~3.0 KB — Approach A: RSC shell + URL ?serviceId= islands)
├── spec.md               (~2.4 KB — delta pointer + tasks overview)
├── specs/
│   ├── service/spec.md           (~2.5 KB — mirror alias of canonical)
│   └── service-selection/spec.md (~2.5 KB — 4 ADDED, 8 GWT scenarios)
├── tasks.md              (~2.4 KB — 22/22 ticked, 3 phases)
└── verify-report.md      (~10 KB — verdict:pass, 8/8 GWT, sha256:3b2fbea0…)
```

All 9 source files byte-identical to pre-move blob tree at `9dd3f18` — SHA256 readback PASS, see Mechanical Readback below. `verify-report.md` was untracked at the chain tip; included here in archive (git staged at source, moved by `git mv`).

## Tasks Completed (22/22, all phases)

- **Phase 1 — Foundation (PR1)** (8/8): `lib/validators/service.ts` (`serviceIdSchema`, `formatDuration`, `ApiError`, `ApiErrorBody`); `lib/api/services.ts` (`ServiceDTOJson`, thin `listServices`); `services/page.tsx` RSC `force-dynamic` + `auth()` + `listServices(db,{includeInactive:false})` + `toJson Date→ISO` + `searchParams.serviceId` `safeParse+find(active)`; `loading.tsx` skeleton; `error.tsx` boundary (401→`/login`, 403→banner, other→retry); `(customer)/layout.tsx` Services nav link; RED tests for validator + API helper.
- **Phase 2 — Islands (PR2)** (8/8): `ServiceSelector.tsx` compound namespace (`List`/`Card`/`SelectedBanner`, `createContext` + React 19 `use()`, `useSearchParams` + `router.push`); `ServiceList.tsx` iterate + Empty; `ServiceCard.tsx` presentational + `aria-pressed`; `SelectedBanner.tsx` Continue href preserves `?serviceId=` for T-041; `services.module.css` (token reuse, no Tailwind); page.tsx wiring; threat RED contract (`safeParse + find(active)` fallback).
- **Phase 3 — Integration + Verify (PR3)** (6/6): `services/page.test.tsx` mock `auth()` + `listServices`; `tests/integration/services-dto-leak.test.ts` (3-layer DTO snake/Spanish negative); `tests/integration/services-route-activeOnly.test.ts` (`includeInactive:false` only, ADMIN bypass, 401/403, tampered UUID, deep-link); regression smoke `vehicles` 6/6 PASS; `pnpm tsc --noEmit` + `pnpm vitest run` + `pnpm build` clean; `/appointments/new` alias deferred to T-041.

## Final Test State

| Command | Exit | Result |
|---------|------|--------|
| `pnpm vitest run` (8 target files for T-040) | 0 | **Test Files 8 passed (8) / Tests 82 passed (82) / Duration 2.82s** |
| `pnpm tsc --noEmit` | 0 | **clean** (no diagnostics) |
| `pnpm build` | 0 | **Compiled successfully in 1038ms / Finished TypeScript in 4.2s / 11/11 static pages / `/services` ƒ dynamic** |
| `pnpm vitest run --project node src/app/(customer)/vehicles` (regression smoke) | 0 | **Test Files 1 passed / Tests 6 passed (6)** — T-039 baseline intact |
| `pnpm vitest run` (full suite) | 0 | **Test Files 67 passed / 4 failed / 1 skipped (72) / Tests 1045 passed / 3 failed / 2 skipped (1050)** — 3 failures pre-existing on `master@7923e15`: `clientes.schema > db client singleton`, `servicios.integration > duplicate nombre UNIQUE maps to ServicioNombreTakenError`, `servicios.schema > ships no HTTP route guard`. 1 failed suite: `turnos.integration.test.ts` (DB unavailable). **No regressions.** |
| `pnpm lint` | 1 | **21 problems (2 errors, 19 warnings).** Both errors pre-existing on master @ 7923e15 (unrelated to t040): `src/app/(customer)/vehicles/_components/VehicleProvider.tsx:61` `react-hooks/set-state-in-effect` (T-039), `src/lib/http/appointmentQuery.ts:55` `prefer-const` on `piped`. 1 new harmless warning: `tests/integration/services-route-activeOnly.test.ts:37` `ForbiddenError` unused (intentional — `vi.importActual` spreads actual exports). 18 other warnings pre-existing. |

Test output hash (sha256): `3b2fbea0991aa94a340685aeaeb3d514fd03ff6b533cdfe02a38a1262905daef`.
Build output hash (sha256): `6d5e6003ae825a299343b3ffdc05402eb24c5142816c5d7caf2d8df42c0230ce`.

### Pre-existing Failures (NOT introduced by T-040, identical to `master@7923e15`)

| File | Test | Reason |
|---|---|---|
| `src/db/__tests__/clientes.schema.test.ts` | `db client singleton (REQ-CLIENTE-03)` | env config missing `AUTH_SECRET` (DB integration env) |
| `src/db/__tests__/servicios.integration.test.ts` | `duplicate nombre UNIQUE maps to ServicioNombreTakenError` | pgCode unwrap mismatch (test expects `"23505"` literal; receives `"SERVICE_ALREADY_EXISTS"` mapped code) |
| `src/db/__tests__/servicios.schema.test.ts` | `t007 negative scope guards (REQ-SRV-06) > ships no HTTP route` | guard asserts `services` route absent; t022 introduced the route, guard never updated |
| `src/db/__tests__/turnos.integration.test.ts` | (suite-level) | server-only import in test file (DB integration env unavailable) |

None introduced by t040; all DB-dependent tests require a live PostgreSQL instance which is not available in this environment. **Zero regressions.**

## Invariant Compliance (Final State)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-01** Capacity `=1`, slot step `30`, count-based `tstzrange &&` | ✅ preserved (not applicable) | T-040 is catalog-only; capacity logic untouched in `services/page.tsx`/`listServices` |
| **INV-02** States `PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO` only | ✅ preserved (not applicable) | T-040 introduces no state-machine transitions; `ServiceSelector` is read-only selection |
| **INV-03** Auth.js + JWT httpOnly + bcrypt; ownership golden rule | ✅ preserved | `(customer)/layout.tsx` re-asserts `auth()` → `redirect('/login')`; `services/page.tsx:44-47` defensive guard. Page test "null session → redirect('/login'), service never called" proves 401-before-403 precedence. `lib/api/services.ts` `listServices` is HTTP-helper only (RSC bypasses it); `/api/services` route remains public active-only by design (T-017). |
| **INV-04** Concurrency: `REPEATABLE READ` + `SELECT FOR UPDATE` + `EXCLUDE USING gist` | ✅ preserved (not applicable) | T-040 is read-only catalog; no booking flow in scope (T-041+) |
| **INV-05** Slots fixed step 30, filtered by `durationMinutes`; `fechaHoraFin <= finIntervaloOperativo` | ✅ preserved | `services/page.tsx` passes `serviceId`+`durationMinutes` (via `find(active)` on DTO) to T-041 chain — never client `fechaHoraFin` math. `formatDuration` is pure helper. |
| **INV-06** `TIMESTAMPTZ` UTC, ISO 8601 with tz, BA timezone | ✅ preserved | `services/page.tsx` `toJson()` converts `Date→ISO` BEFORE RSC→client boundary. `ServiceDTOJson.createdAt`/`updatedAt` typed as `string`. Page test asserts ISO regex `2026-08-25T13:00:00.000Z`. `services-dto-leak.test.ts:52-56` proves `.toISOString()` round-trip at mapper boundary. No naive `TIMESTAMP`. |
| **INV-07** DAG no cycles, 12+1 phases | ✅ preserved | T-040 = FASE 8 UI-02; precedes T-041→T-043 booking chain |
| **INV-08** DB `snake_case` / API `camelCase`; `nombre→name`, `descripcion→description`, `duracionMinutos→durationMinutes`, `activo→active` | ✅ preserved — three-layer coverage | Mapper unit `services-dto-leak.test.ts:27` asserts exactly 7 camelCase keys; `:33-40` `it.each` rejects every snake/Spanish key via `not.toHaveProperty` AND `JSON.stringify` negative. RSC tree `services/page.test.tsx:76` re-asserts against rendered JSX (8 forbidden strings). HTTP helper returns `ServiceDTOJson[]`. Production: `toJson()` maps `nombre→name`, etc. |
| **H-19** Single-owner `services/[id]` route untouched | ✅ preserved | `git log --oneline -5 -- src/app/api/services` shows only `55d2398` and `a22e850`. `git diff 11e4551 832a69b -- src/app/api/` is empty — PR3 did not touch any API route. The change introduces a new RSC page and client islands consuming the existing public route; API surface unchanged. |

### Composition pattern (vercel-composition-patterns, no boolean props) — D3

✅ **PASS.** `ServiceSelector.tsx:131-134` attaches `.List`, `.Card`, `.SelectedBanner` as static properties on a typed `Compound`. `page.tsx:93-96` composes `<ServiceSelector services={services}><ServiceSelector.List /><ServiceSelector.SelectedBanner /></ServiceSelector>` with zero boolean flags. `ServiceCard` derives `isSelected = service.id === selectedId` from context, not from a prop. `SelectedBanner` derives from `selected` (the resolved service object), not a prop. Selection variant is selector-driven (`.cardSelected` CSS class) and ARIA-driven (`aria-pressed` toggle pattern).

### `formatDuration` pure helper (INV-05 client-side duration math)

✅ **PASS.** `lib/validators/service.ts:41-50` is a pure function with no side effects, no `Date`, no `fechaHoraFin` calculation. Format rules: `<60 → "X min"`; `60 → "60 min"` (prefer minutes for 1-hour mark); `60<m<120 → "1 h Y min"`; `m≥120 clean → "X h"`; `m≥120 rem>0 → "X h Y min"`; non-finite → `"0 min"` (UI never renders `NaN`). 6 unit cases in `service.test.ts` (`it.each`) + 3 jsdom cases in `ServiceCard.test.tsx` + 3 jsdom cases in `SelectedBanner.test.tsx` cover the contract. The selection banner and card both call `formatDuration(service.durationMinutes)` — never client math.

### URL injection threat matrix

✅ **PASS — Applicable, mitigated.** Mitigations: `ServiceSelector.tsx:83-91` `serviceIdSchema.safeParse + services.some(active)` at island (defense-in-depth); `services/page.tsx:67-73` same check at RSC; no `findById` DB call on `?serviceId=`; no `WHERE id = $1` lookup; tampered URL falls through to `selectedId=null`, banner hidden (`SelectedBanner.tsx:23` early return), card unpressed (`aria-pressed=false`). 5 RED tests cover the contract: `service.test.ts` safeParse negative, `SelectedBanner.test.tsx` 3 hidden cases, `page.test.tsx` tampered, `services-route-activeOnly.test.ts` tampered at page boundary.

## Mechanical Readback (MANDATORY)

The Mechanical Copy Contract was satisfied with SHA256 byte-identity verification on both spec sync and archive folder move. Per the Phase Common protocol, every `cp`/`mv` was followed by a structural readback.

### A. Spec sync readback (delta → global, byte-identity)

```
DELTA_SHA256 service-selection = 7C5D3F14CDE91E527377641BE3A372373102EF1A70FA0D1073FCF4E1111EFE91
GLOBAL_SHA256 service-selection = 7C5D3F14CDE91E527377641BE3A372373102EF1A70FA0D1073FCF4E1111EFE91
DELTA_SHA256 service           = B718781FCDF664BCA7E0C4FA50368CF168FAB488D05BFAF3154C7EDDB2648E09
GLOBAL_SHA256 service           = B718781FCDF664BCA7E0C4FA50368CF168FAB488D05BFAF3154C7EDDB2648E09

=== diff -r (source vs destination, verbatim) ===
[git diff --no-index --stat service-selection] (empty, exit 0)
[git diff --no-index --stat service]           (empty, exit 0)

VERDICT=PASS_EMPTY_DIFF_BYTE_IDENTICAL
```

### B. Archive folder move readback (pre-move blob vs post-move SHA256)

```
=== diff -r (pre-move git blob vs post-move SHA256) ===

GIT_BLOB=8178952c5d0bf3df2b66993fbf49790c7a15a2fc  SHA256=DF381B43FD480688F85A83EDE64C2670E9B42CFC0C00D9D88CC655AB15BA292E  apply-progress.md
GIT_BLOB=12e8443b61683d9c570699951c2e6c9c1eab859f  SHA256=890242DD1559FD368F5182E757DB0F12CEEEDBD578653E9385842A3E5F3ABA03  design.md
GIT_BLOB=e21ff27704e3318a7af00f3e040aa5a65c7bc570  SHA256=4C1ADA687184AFA2D7A9A7912A25302FD82C352AD2655DEB17CCB66A889B1422  exploration.md
GIT_BLOB=e21ff27704e3318a7af00f3e040aa5a65c7bc570  SHA256=4C1ADA687184AFA2D7A9A7912A25302FD82C352AD2655DEB17CCB66A889B1422  explore.md
GIT_BLOB=56909dd52c8b2ab53bbc48a7db811d1e9d6972cb  SHA256=B5C08B4B5046D36379DA6BD738D41AE492327C8C4E2F7A3EF3F2D8827AB2C943  proposal.md
GIT_BLOB=cc04d0e3d3c3211692ae8abf887021dce3ed7647  SHA256=80F4D64A08C6B4053264443E7A095574020157E70336E426C7D6429D9F60CC8F  spec.md
GIT_BLOB=c32dd6aeb292e7fac5832fd53a337ed3afaadf8d  SHA256=82A9763FE062DD0114B369BF3482412ACDB5A7F48A4BF73F637822B2C38CCA8C  tasks.md
GIT_BLOB=784671bce2493606888e066502d3be411a1a8e2e  SHA256=B718781FCDF664BCA7E0C4FA50368CF168FAB488D05BFAF3154C7EDDB2648E09  specs/service/spec.md
GIT_BLOB=5344952066f5a1d85a326035373ee65db553b079  SHA256=7C5D3F14CDE91E527377641BE3A372373102EF1A70FA0D1073FCF4E1111EFE91  specs/service-selection/spec.md
GIT_BLOB=N/A(NEW)                                  SHA256=C35C6C3D36A68044064105EFE5B1672F00C7F005028906604BC9E57AC3B3C35D  verify-report.md

All 9 files moved via `git mv` preserve byte content. SHA256 of each archive file equals the SHA256 of the corresponding file at the source location (delta blob 9dd3f18 + verify-report.md added untracked). The destination guard rejected collision, and `git mv` returned 0.

VERDICT=PASS_BYTE_IDENTICAL
```

**Observation:** `explore.md` and `exploration.md` have identical SHA256 (`4C1ADA687184AFA2D7A9A7912A25302FD82C352AD2655DEB17CCB66A889B1422`). Both retained in archive for audit-trail integrity; the byte-identity confirms they are exact duplicates (likely typo/rename). Same pattern as T-039; future cleanup is optional and non-blocking.

This report (`archive-report.md`) was written post-verification and is additive (excluded from the comparison by construction — it did not exist in the source change folder).

## Engram Observation IDs (Traceability)

| Observation | ID | Sync ID | Purpose |
|-------------|-----|---------|---------|
| Explore | `#422` | `obs-31408653627db9f6` | `sdd/t040-service-selection/explore` (FASE 8 UI-02 exploration) |
| Proposal | `#423` | `obs-ba9919ed5a5b2d27` | `sdd/t040-service-selection/proposal` (Approach A: RSC + URL islands) |
| Spec | `#424` | `obs-a7272ffd549f9b19` | `sdd/t040-service-selection/spec` (4 ADDED, 8 GWT — service NEW + service-selection alias) |
| Design | `#425` | `obs-d5b7341d5b0bfbab` | `sdd/t040-service-selection/design` (RSC URL islands, D1..D4) |
| Tasks | `#426` | `obs-fc5a0ac213713cd8` | `sdd/t040-service-selection/tasks` (22 tasks, 3 phases, 3-PR chain) |
| Apply PR1 (foundation) | `#428` | `obs-f9bbbd71220b2661` | session summary — `sdd/t040-service-selection` (PR1 RSC shell, bd584e7) |
| Apply PR2 (islands) | `#427` | `obs-e3734a4bd332e6b2` | `sdd/t040-service-selection/apply` (ServiceSelector islands, 11e4551) |
| Apply PR3 (tests + docs) | `#429` | `obs-663c83759107109f` | decision — `sdd/t040-service-selection` (PR3 tests 832a69b + docs 9dd3f18) |
| Verify | `#431` | `obs-81f8a1105937afc1` | `sdd/t040-service-selection/verify-report` (PASS, 8/8 GWT, sha256:3b2fbea0…) |
| Session summary PR3 | `#430` | `obs-23b7df1d4100ec83` | session summary — `sdd/t040-service-selection` (PR3 final slice) |
| **Archive (this)** | (persisted at end) | `<persisted at end>` | `sdd/t040-service-selection/archive-report` (hybrid) |

All observation IDs above were read via `mem_search` (project `curso-01`) at archive time and confirmed against the persisted cycle artifacts. The archive observation itself is saved with `topic_key=sdd/t040-service-selection/archive-report`, `type=architecture`, `capture_prompt=false` (SDD artifact protocol).

## Risks & Caveats (Carried Forward)

1. **PR3 test LOC exceeded orchestrator forecast (~860 vs ~300-400).** All production code is in PR1+PR2 (~614 LOC); PR3 is tests + docs only. Stayed below T-039 PR3's 1025 LOC baseline. The 8-file test surface required broader coverage than the original estimate.
2. **`useSearchParams` mock statefulness.** jsdom tests use a module-level `mockServiceId` variable flipped per-test. If a future test adds an `await` between setting `mockServiceId` and rendering, the provider may re-render with stale state. Mitigation: `afterEach` clears the mock and the closure binding is local to each `it()`.
3. **`vi.importActual` in route-activeOnly.** Preserves the actual `requireAuth`/`listServices` exports so the route can still bind `ForbiddenError`/`UnauthorizedError` `instanceof` checks. The mocked functions override the named exports. The `ForbiddenError` unused-variable lint warning is intentional and harmless. If a future refactor adds new exports from those modules, the spread `{ ...actual }` keeps them visible to the route under test.
4. **Page test `JSON.stringify(tree)` brittleness.** React JSX serialization can shift across React minor versions. The test asserts on the rendered tree's JSON shape, which is robust to React internals but would break if `ServiceSelector` started rendering children eagerly (it doesn't, since the `"use client"` boundary is preserved at compile time). A verify follow-up could swap to `renderToString` + DOM-level assertions if desired.
5. **Continue route forward-reference.** `<Link href="/appointments/new?serviceId={id}">` references a route that does not exist yet (T-041). The link is semantic only — clicking it will 404 until T-041 ships. Spec scenario S4 acknowledges: "Continue preserves `?serviceId=` for T-041".
6. **PR2 deferred jsdom tests now pass.** PR2 was scoped to islands + styling only (per orchestrator). PR3 closes the PR2.8 threat contract with explicit `tampered ?serviceId=garbage does not 500` + `banner hidden on no/tampered/absent UUID selection` + `Continue href uses selected.id (defense in depth)`.
7. **Lint pre-existing errors.** `VehicleProvider.tsx:61` (T-039-introduced `useEffect → setVehicles`) and `appointmentQuery.ts:55` (prefer-const on `piped`, master baseline) are both unrelated to t040. Per task contract "allow pre-existing". The single new harmless warning (`ForbiddenError` unused in `services-route-activeOnly.test.ts`) is documented as intentional.
8. **Build side-effect on `next-env.d.ts` discarded.** During archive-prep, the working tree contained a working-copy modification to `next-env.d.ts` (Next.js auto-edit from `.next/dev/types/*` → `.next/types/*` triggered by `pnpm build` during verify). This modification was discarded via `git checkout -- next-env.d.ts` before any archive operation. The file is git-ignored and the tracked version was restored. **Not part of t040 change.**
9. **Explore/exploration duplicate files.** Both `explore.md` (2.9 KB) and `exploration.md` (2.9 KB) exist in archive with identical SHA256. Likely typo/rename; both preserved for audit. Non-blocking cleanup.
10. **RDD review (independent from SDD verify).** RDD is enabled globally per session preflight. This report is the SDD verification. RDD review will run separately after archive before delivery (per `rdd-defect-workflow`/`work-unit-commits`). Receipt/lineage requirements apply independently — **not covered by this archive verdict**.

## Chain Consolidation Decision

**Approach: fast-forward tracker to PR3 docs tip.**

- Pre-state: tracker `feature/t040-service-selection` at `bd584e7` (only PR1 merged), PR2 at `feature/t040-service-selection-pr1` (`11e4551`), PR3 tip at `feature/t040-service-selection-pr2` (`9dd3f18`).
- Action: `git checkout feature/t040-service-selection && git merge --ff-only feature/t040-service-selection-pr2`.
- Result: `Updating bd584e7..9dd3f18 / Fast-forward` — tracker advanced to `9dd3f18` content with no merge commit, all 4 commits (`bd584e7` → `11e4551` → `832a69b` → `9dd3f18`) preserved in linear history. Diff stat at the chain top: 23 files changed, 2021 insertions(+), 66 deletions(-).
- Rationale: stacked PRs have a linear ancestry (PR1 → PR2 → PR3 tests → PR3 docs); fast-forward is the correct consolidation that preserves history without adding merge artifacts.

## Master Merge Decision

Per prior archive pattern (`t036b-admin-schedule`, `t037-daily-agenda`, `t038-permission-tests`, `t039-vehicle-screen`), the merge from tracker to `master` is the orchestrator's responsibility:

- Prior pattern: `chore(archive): <change> -> archive <date>, delta <DESC> <verdict>` commit on tracker, then orchestrator merges tracker to master with `--no-ff` (e.g. `2e7d368` on tracker → master merge).
- This archive creates the `chore(archive)` commit on `feature/t040-service-selection` and **leaves the master merge to orchestrator**.
- Recommended merge command for orchestrator:
  ```
  git checkout master && git merge --no-ff feature/t040-service-selection -m "Merge branch 'feature/t040-service-selection' into master — FASE 8 UI-02 T-040 Service Selection 4 ADDED 8/8 PASS"
  ```

## Next Steps

1. **Orchestrator**: Commit archive on `feature/t040-service-selection` with message
   `chore(archive): t040-service-selection -> archive 2026-08-31, sync 4 ADDED 8/8 PASS`
   *(this archive phase performs the commit on the tracker — see git log for the archive commit SHA)*
2. **Orchestrator**: Merge `feature/t040-service-selection` to `master` with `--no-ff`.
3. **Orchestrator**: Persist this archive-report to Engram as `sdd/t040-service-selection/archive-report` (architecture type).
   *(this archive phase also persists to Engram — see Engram Observation IDs table for the new observation ID)*
4. **Future**: FASE 8 continues — T-041 availability date step, T-042 slot booking, T-043 confirmation; `/appointments/new` alias unblocks the Continue link from T-040.
5. **Future (RDD)**: Receipt/lineage review per `rdd-defect-workflow` runs independently after this archive.

## SDD Cycle Status

| Phase | Status | Engram ID |
|-------|--------|-----------|
| Explore | DONE | `#422` (129 lines exploration) |
| Propose | DONE | `#423` (Approach A: RSC shell + URL islands) |
| Spec | DONE | `#424` (NEW `service-selection` domain, 4 ADDED, 8 GWT + `service` alias) |
| Design | DONE | `#425` (RSC URL islands, D1..D4) |
| Tasks | DONE | `#426` (22 tasks, 3 phases, 3-PR chain) |
| Apply | DONE | `#428` PR1, `#427` PR2, `#429` PR3 (all 22/22 tasks PASS) |
| Verify | DONE | `#431` (verdict:pass, 4/4 reqs, 8/8 GWT) |
| **Archive** | **DONE (this report)** | persisted at end (`sdd/t040-service-selection/archive-report`) |

**Cycle complete. Ready for next change.**

---

*Generated: 2026-08-31 — sdd-archive for `t040-service-selection` — hybrid artifact (Engram + filesystem).*