# Exploration: t039-vehicle-screen (FASE 8 UI-01 T-039 — Crear pantalla de vehículos)

## Current State

- **App Router shell is minimal:** `src/app/layout.tsx` is bare RootLayout (Geist fonts, `<html lang="es">`), `src/app/page.tsx` is placeholder Home. No `src/components/`, no route groups (`(customer)`), no vehicle UI, no dashboard, no nav, no design system (no Tailwind, bare `globals.css`). First UI in FASE 8 establishes project-wide UI patterns.
- **API dependency T-014 VERIFIED DONE:** `src/app/api/customers/[customerId]/vehicles/route.ts` exists and is thin-handler compliant:
  - `POST`/`GET /api/customers/{customerId}/vehicles` both enforce `requireAuth` → uuid check → `assertOwnership(customerId, authUser)` (`ADMINISTRADOR` bypass) → service → DTO. Errors mapped via `lib/http/errors.ts` envelope `{error:{code,message,issues?}}` with codes `VALIDATION_ERROR 400`, `UNAUTHORIZED 401`, `FORBIDDEN 403`, `CUSTOMER_NOT_FOUND 404`, `PLATE_ALREADY_EXISTS 409`.
  - Delegates to `src/services/vehicleService.ts` (`vehicleCreateInputSchema` strict English camelCase, `normalizePatente` + `regex /^[A-Z0-9]{6,7}$/`) → `src/db/repositories/vehiculos.ts` (`vehiculoInputSchema`, unique `patente`, FK restrict). Contract `VehiculoDTO {id,customerId,brand,model,year,plate,createdAt,updatedAt}` in `src/db/mappers/vehiculo.ts` satisfies INV-08.
  - `docs/openapi.md` documents same 201/200 envelopes; DB schema `src/db/schema.ts` has `vehiculos` with CHECKs `patente_format`/`anio_range` and index `idx_vehiculo_cliente_id`.
- **Auth (INV-03) is JWT httpOnly cookie + middleware + helper:** `middleware.ts` (`jose` verify on `/api/:path*`, whitelist `POST /api/auth/*` and `GET /api/services`) + `src/lib/auth/requireAuth.ts` (`getTokenFromRequest` from `authjs.session-token`/`__Secure-authjs.session-token`, `requireAuth`/`assertOwnership`/`assertRole`) + `src/lib/auth/auth.ts` (NextAuth 5 Credentials, `session.strategy jwt`, `token.role`). Ownership rule `vehiculo.clienteId == authUser.id` enforced at HTTP edge.
- **Validation duality (RSK-04):** Zod transformsplate (`trim+toUpper`+strip `[\s-]`) then regex; DB CHECK mirrors it; repo re-normalizes pre-insert. Year `1900..now+1`, brand/model `2..100` trimmed. Plate uniqueness is **global** (`UNIQUE patente`), 409 on collision.
- **No frontend fetch/auth integration yet:** No `src/lib/api` client, no session hook (`auth()` not exposed to client), no way for UI to know `customerId`. Vitest is `environment: node` only (no jsdom/RTL installed), `next@16.3.2`, `react@19.2.8`, `zod@4.4.3`.

## Affected Areas

- `src/app/vehicles/page.tsx` (or `src/app/(customer)/vehicles/page.tsx`) — **new** App Router route for /vehicles; placement decision affects auth guard grouping and future booking flow T-042/T-044. Recommended `(customer)/vehicles` group to co-locate `layout.tsx` with session guard and share with later T-040/T-042.
- `src/app/(customer)/vehicles/VehicleList.tsx` — **new** client or server component to render `VehiculoDTO[]`, empty-state, loading skeleton, error mapping (401 redirect, 403 forbidden message).
- `src/app/(customer)/vehicles/VehicleForm.tsx` — **new** client component: controlled inputs `brand,model,year,plate`, Zod client validation mirrored from `vehicleCreateInputSchema`, optimistic update vs revalidation, `normalizePatente` preview, `PLATE_ALREADY_EXISTS` inline error.
- `src/app/(customer)/vehicles/vehicles.client.tsx` or `src/lib/api/vehicles.ts` — **new** fetch helper (`credentials: include`, ISO 8601 handling, `ErrorBody` parsing); could reuse `lib/http/errors` shape. Avoids raw `fetch` duplication.
- `src/lib/auth/*` + `src/middleware.ts` — **read-only but constraining**; UI must send httpOnly cookie automatically, handle 401→`/login`, never expose `customerId` via URL without ownership check. `ADMINISTRADOR` bypass means list endpoint could return others' vehicles if UI leaks id — must not allow id spoofing.
- `src/app/layout.tsx` / `src/app/globals.css` — minimal changes (nav link to /vehicles, basic styling; no Tailwind installed — decide CSS Modules vs adding Tailwind).
- `vitest.config.ts` / `package.json` — if UI tests added, must add `jsdom` + `@testing-library/react` OR keep UI logic unit-tested via validator/mapper tests only (current node env insufficient for component tests).
- `src/db/validators/vehiculo.ts` + `src/services/vehicleService.ts` — **reuse** client-side (shared Zod) — no DB import in client bundle; extract pure schemas to `src/lib/validators` or import with `"use client"` guard.

## Approaches

1. **A — Server Component shell + Client Form islands (hybrid, RECOMMENDED baseline)**
   - `page.tsx` is **Server Component** (async) that calls `auth()` server-side to get `authUser.id` → `listVehiclesByCustomer(db, id)` directly OR `fetch` via internal handler; `VehicleForm` is `"use client"` with `useState` + `fetch POST` to `/api/customers/{customerId}/vehicles` (credentials include). List revalidates via `router.refresh()` / `revalidatePath`.
   - Pros: Fastest FCP/SSR (Vercel `server-cache-react`, `server-parallel-fetching`), auth resolved server-side — no client `customerId` discovery problem (Technical-spec §9 API boundary preserved, INV-03 enforced before render), DTO serialized minimally (`server-serialization`/`server-dedup-props`), Suspense streams list while form is interactive, no hydration mismatch on dates (serialize ISO).
   - Cons: Requires `customerId` availability server-side (`auth()` in RSC) — NextAuth `auth()` in App Router RSC needs careful `headers()`/`cookies()` wiring; mixing DB direct vs HTTP fetch in same page needs clean architecture decision (Handler → service → DB vs API JSON).
   - Effort: Medium (establishes FASE 8 pattern, reusable for T-040/T-042; needs `after()` consideration if audit log added later).

2. **B — Full client SPA (`useEffect` + `fetch` in `"use client"` page)**
   - Entire `page.tsx` is `"use client"`, `useEffect` fetches `GET /api/customers/{customerId}/vehicles`, form posts same endpoint, local state holds `VehiculoDTO[]`.
   - Pros: Simplest to implement (no RSC auth wiring, no server/client boundary thinking), matches team's current zero-RSC experience, easy loading/error states with `useState`.
   - Cons: **Anti-pattern per `vercel-react-best-practices`** (`client-swr-dedup` missing, waterfalls, no SSR SEO/perf, extra round-trip before first paint, dedup loss, bundle bloat if validators pulled client-side). `customerId` still unknown — needs client `useSession()`/`fetch /api/auth/session` or new `GET /api/me` endpoint; exposes id inference race. Violates `async-suspense-boundaries`/`server-parallel-fetching` guidance; worse UX on slow networks.
   - Effort: Low initial, High debt (replaces phase-8 foundation with throwaway; hard to migrate T-042 booking flow).

3. **C — Server Actions (`"use server"` form action)**
   - Form posts to Server Action that calls `createVehicle(db, parsed)` directly, then `revalidatePath("/vehicles")`; list is RSC reading DB.
   - Pros: Eliminates API JSON round-trip for create path, progressive enhancement without JS, atomic from UI to DB, cleanest INV-08 mapping server-side, leverages Next 16 React 19 `useActionState`/`useFormStatus`.
   - Cons: **Bypasses HTTP contract T-014** (spec mandates `POST /api/customers/{customerId}/vehicles` as source of truth for future mobile clients — DT-03 API as boundary). Auth still via `auth()` inside action (same wiring as A). Harder to surface `PLATE_ALREADY_EXISTS 409` as field error without custom mapping; couples UI and service (breaks thin handler rule §8). Testing Server Actions requires Next experimental test utils, not covered by current vitest node setup.
   - Effort: Medium (cleaner but diverges from DAG — needs dual path if API must stay canonical).

## Recommendation

**Approach A (Server Component shell + Client Form islands) with a thin API client helper — with a prerequisite `GET /api/me` or `useSession` resolver.**

- Aligns with Technical-spec §2/§9 (DT-02/DT-03 API as boundary) and AGENTS.md INV-03/INV-08: UI **always** talks JSON camelCase via `POST/GET /api/customers/{customerId}/vehicles`, DTO mapping stays in `toVehiculoDTO`, `normalizePatente` reused client-side for live feedback, `customerId` resolved server-side via NextAuth `auth()` — no URL spoofing (if URL contains `customerId`, assert it equals `authUser.id`; better: canonical route `/vehicles` without param that injects `authUser.id` server-side).
- **Route placement:** `src/app/(customer)/vehicles/page.tsx` (route group `(customer)` with optional `layout.tsx` that guards `requireAuth` server-side and redirects 401 → `/login`). Avoids polluting root `src/app/vehicles` if later admin routes split. If group naming is contentious, `src/app/vehicles/page.tsx` is acceptable but isolates guard per-page.
- **Component decomposition (vercel-composition-patterns):** Avoid boolean-prop bloated `<VehicleCard editable removable ...>`; instead use **compound components + composition**:
  - `VehicleProvider` (state lift) exposing `{vehicles, status, createVehicle}` via context interface `{state, actions, meta}` (`state-context-interface`, `state-lift-state`).
  - `VehicleList`, `VehicleForm`, `VehicleEmptyState`, `VehicleErrorBanner` as children composition (`patterns-children-over-render-props`, `architecture-compound-components`), explicit variants `VehicleForm.Create` vs future `VehicleForm.Edit` (`patterns-explicit-variants`).
- **Data-fetching pattern (vercel-react-best-practices):** List as RSC with `Suspense` boundary (`async-suspense-boundaries`), `server-serialization` (pass only JSON-serializable `VehiculoDTO`), `server-no-shared-module-state`, helper `src/lib/api/vehicles.ts` with `fetch(url,{credentials:"include", cache:"no-store"})` for client mutations, Zod parse on response (`client-swr-dedup` if later adding SWR/React Query — defer until T-042).
- **Validation:** Reuse `vehicleCreateInputSchema` shape client-side extracted to `src/lib/validators/vehicle.ts` (pure Zod, no `normalizePatente` DB import) for inline errors; keep server as source of truth for `PLATE_ALREADY_EXISTS` and `CUSTOMER_NOT_FOUND`.
- **Why not B/C:** B sacrifices performance and introduces `customerId` discovery debt; C violates API-boundary invariant that FASE 8 UI-01 is specified to depend on T-014 HTTP contract (implementation-plan T-039 Depends:T-014). A is the only option that is both spec-compliant and future-proof for T-040..T-049 chain.

## Risks

- **Plate regex strict + normalization UX:** `/^[A-Z0-9]{6,7}$/` after `normalizePatente` (strip spaces/dashes, upper) means `abc-123` becomes valid `ABC123` but `AB C 12-3` error until sanitized — form must show normalized preview and explain rule or users hit 400 `VALIDATION_ERROR` with `issues`.
- **Year edge `now+1`:** `max(new Date().getFullYear()+1)` is time-sensitive; Dec 31 → Jan 1 rolls boundary; SSR year vs client year mismatch can cause hydration warning if validated at different seconds; fix by computing max server-side and passing as prop, not `new Date()` in client render.
- **Auth 401 vs 403 handling divergence:** `middleware` returns JSON 401 on API but RSC/Server Component redirect must be HTML redirect to `/login` (`FORBIDDEN` 403 needs "Not owner" UI, not redirect). Client must map `UNAUTHORIZED` → `router.push("/login")` and `FORBIDDEN` → error banner, not infinite loop.
- **`customerId` discovery gap:** No `GET /api/me` exists and `src/lib/auth/auth.ts` `auth()` not yet exposed to App Router RSC without `auth-helpers`; UI cannot know `customerId` without new endpoint/hook — **blocking sub-task** if not resolved, forces id-in-URL spoofable design.
- **No test harness for UI:** `vitest` is `node` env with no `jsdom`/`@testing-library/react`; adding component tests without upgrading env will fail compilation (`document is not defined`). Proposal must decide: keep T-039 tests as pure validator/mapper + API integration, defer UI unit tests, or add `vitest.config.ts` `environment: jsdom` conditional.
- **Hydration/date serialization:** `VehiculoDTO.createdAt/updatedAt` are `Date` in service but `NextResponse.json` serializes ISO strings; client typing must accept `string` and parse, avoid passing raw `Date` via RSC props (`server-serialization` rule).
- **Global plate UNIQUE race:** Two customers submitting same plate concurrently hit `EXCLUDE/UNIQUE 23505` → 409; UI must handle non-field `PLATE_ALREADY_EXISTS` after optimistic success.
- **Empty-state and overfetch:** List returns `[]` not 404 — UI must distinguish empty vs loading; no pagination in T-014 so >50 vehicles will stretch without `content-visibility` (`rendering-content-visibility`).
- **Styling debt:** No Tailwind/design tokens; ad-hoc `globals.css` will create inconsistency for FASE 8 chain (T-040/T-042) if not establishing `src/components/ui/*` primitive this phase.

## Ready for Proposal

Yes — **blocked on one open decision** that proposal must lock: **`customerId` resolution strategy** (new `GET /api/me` returning `{id}` via `requireAuth` vs reuse `GET /api/auth/session` NextAuth session vs URL param `customers/{id}/vehicles` with guard). Once locked, T-039 can proceed to proposal/spec with pattern A, route `/(customer)/vehicles`, composition layout, API client helper, Zod reuse, Suspense+skeleton+empty state.

Ready for Proposal: **Yes** — surface `customerId` decision to orchestrator as proposal input; remainder is well-scoped.

## Skill Resolution

- `vercel-react-best-practices` — **loaded, APPLICABLE** — rules applied: `server-auth-actions`, `server-serialization`, `server-no-shared-module-state`, `async-suspense-boundaries`, `server-parallel-fetching`, `client-swr-dedup` (deferred), `rendering-content-visibility`, `rendering-hydration-no-flicker`; anti-pattern flagged for Approach B.
- `vercel-composition-patterns` — **loaded, APPLICABLE** — patterns applied: `architecture-compound-components`, `architecture-avoid-boolean-props`, `state-lift-state`, `state-context-interface`, `patterns-explicit-variants`, `patterns-children-over-render-props`, `state-decouple-implementation`; avoid prop-bloat in Vehicle cards/forms.
- `cognitive-doc-design` — **not loaded** — T-039 is UI implementation, not doc/RFC; no doc API needed. Load at T-052 (Observability docs) if needed.

---
*Evidence: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/customers/[customerId]/vehicles/route.ts:1-142`, `src/db/mappers/vehiculo.ts`, `src/db/validators/vehiculo.ts`, `src/services/vehicleService.ts`, `src/db/repositories/vehiculos.ts`, `src/db/schema.ts:vehiculos`, `src/lib/auth/requireAuth.ts`, `src/lib/http/errors.ts`, `middleware.ts`, `package.json`, `vitest.config.ts`, `implementation-plan.md:T-039`, `docs/openapi.md:T-014`, `Technical-spec.md §2/§9`.*
