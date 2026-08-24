# AGENTS.md — AutoService · Sistema de Reservas de Turnos

> Execution contract for sub-agents (gentle-orchestrator delegation).
> Index only — does not duplicate specs. Always defer to sources of truth.

## Project & Stack

- **Project:** curso-01 — AutoService appointment booking system
  (`vehiculo`, `turno`, `taller` domain terms preserved where needed).
- **Stack:** Next.js App Router + TypeScript + PostgreSQL + Auth.js (NextAuth) + Prisma/Drizzle.
- **Sources of Truth (certified, do not duplicate):**
  1. `Functional-Spec.md` (535L) — business rules, RN-01..RN-07, domain model
  2. `Technical-spec.md` (1144L) — architecture, schema, API contracts, NFRs
  3. `implementation-plan.md` (1743L) — 12 phases + sub-phase 2.5, 64 tasks (T-001..T-064), DAG

> Read all three before writing code. If this file conflicts with them, the specs win.

## Non-Negotiable Invariants (Block 1)

Violating any invariant = blocking defect. No exceptions.

- **INV-01 Capacity:** `capacityPerSlot = 1` in v1. `slotStepMinutes = 30`.
  Both via `WorkshopConfig` (parametrizable, not hardcoded).
  Overlap check is **count-based** with `tstzrange &&`, not a boolean flag.

- **INV-02 States:** Only `PENDIENTE / CONFIRMADO / RECHAZADO / CANCELADO` (UPPER_SNAKE).
  No `COMPLETADO`. All transitions gated by `canTransition(from, to, role)` per RN-07 matrix.

- **INV-03 Auth:** Auth.js/NextAuth with JWT in httpOnly cookie + bcrypt.
  `User { id, email, passwordHash, role }`.
  Endpoints `POST /api/auth/register` and `POST /api/auth/login` only.
  Middleware protects routes. Ownership rule: `vehiculo.clienteId == authUser.id`.

- **INV-04 Concurrency:** Atomic transaction `REPEATABLE READ` +
  `SELECT FOR UPDATE WHERE tstzrange(startDateTime, endDateTime) && tstzrange($1,$2)`
  `AND estado IN ('PENDIENTE','CONFIRMADO')` + PostgreSQL `EXCLUDE USING gist`.
  Verified with 2-worker concurrent test.

- **INV-05 Slots vs Duration:** Slot generation uses fixed step 30,
  filtered by `durationMinutes` of the selected service.
  Validation: `fechaHoraFin <= finIntervaloOperativo`
  (e.g., `11:30 + 90min` against `12:00` close → reject).

- **INV-06 Timezone:** DB stores `TIMESTAMPTZ` in UTC.
  API accepts ISO 8601 with timezone and converts to UTC.
  `WorkshopConfig.timezone = America/Argentina/Buenos_Aires`.
  Never use naive `TIMESTAMP`.

- **INV-07 Phases:** 12 phases + sub-phase 2.5 = 13 execution blocks.
  **FASE 2.5 Auth (T-050..T-051, T-035) is blocking before FASE 3**.
  DAG has no cycles.

- **INV-08 Naming:** DB `snake_case` / API `camelCase` (English).
  Mapping required: `marca→brand`, `patente→plate`,
  `fechaHoraInicio→startDateTime`, `fechaHoraFin→endDateTime`.
  DTO mappers are mandatory; no raw DB names leak to API.

## Execution Order (DAG Summary)

```
T-001 → T-004           Setup & Tooling
T-005 → T-010           Domain Model & WorkshopConfig
T-050 → T-051 → T-035   FASE 2.5 Auth (BLOCKING before FASE 3)
T-011 → T-019b          FASE 3 Vehicles
T-020 → T-026 (+T-022b)  FASE 4 Services
T-027 → T-034           FASE 5 Slots & Booking (T-028 + T-029 atomic)
T-036 → T-038           FASE 6 Dashboard
T-039 → T-049           FASE 7-8 Policies & UX
T-052 → T-056b          FASE 9 Observability
T-057 → T-060           FASE 10 Hardening
T-061 → T-064           FASE 11-12 QA & Release
```

- Do not start a phase if its predecessor is incomplete.
- Respect `T-028 + T-029` atomicity (slots + booking together).
- DAG has no cycles; `implementation-plan.md` is authoritative for task dependencies.

## Commit Convention

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
- Messages in English. No `Co-Authored-By` or AI attribution.
- Work-unit commits: one logical unit per commit (code + tests + docs together).
- No bundling unrelated changes. One commit = one reviewable unit.

## Agent Rules

1. Do not hallucinate capacity, states, or timezone rules — read the 3 sources of truth first.
2. Validate every state change against the RN-07 `canTransition` matrix.
3. Treat `WorkshopConfig` values (`09:00-12:00 / 14:00-18:00`, capacity, slot step) as
   configuration, never hardcode the example.
4. Enforce DTO mapping (INV-08) and UTC conversion (INV-06) at every boundary.
5. Respect capacity count-based check (INV-01) and concurrency guards (INV-04).
6. Keep changes minimal and reversible; prefer config over code for business parameters.

---

*This file is an index, not a duplicate — for detail see `Functional-Spec.md`, `Technical-spec.md`, and `implementation-plan.md`.*
