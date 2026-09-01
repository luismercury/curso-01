# Booking Result Specification — t044-booking-result (New Capability)

> New capability. FL-01 step 9 after `POST /api/appointments` 201 → `/appointments?confirmed=<id>` (T-043) but target 404. Owns `/appointments/page.tsx` RSC + `BookingConfirmation` compound: validates `?confirmed=`, fetches owned turno, renders success or neutral, co-renders upcoming list. 409 stays in `BookingForm`.

## Purpose

Show booking result (success banner with details + dismiss or neutral) and always show upcoming turnos. Single RSC, no new API/migration.

[Cite F-04, FL-01, T-028 atomic, T-043 handoff, INV-02/03/06/08, RN-04/07.]

## Requirements

### Requirement: RSC Confirmed Param Parsing and Ownership-Scoped Fetch

The system SHALL use `force-dynamic revalidate=0` with `searchParams: Promise<{confirmed?:string}>` (Next 15 async). SHALL validate `confirmed` via `z.string().uuid().safeParse` (`parse-use-safeparse`, `parse-validate-early`). If valid, SHALL call `auth()` + `getWorkshopConfig(db)` per-request + `getAppointmentById({db,config},id,authUser)` in `try/catch`. SHALL map `ForbiddenError`/`AppointmentNotFoundError` to generic neutral (no `customerId`/existence leak, INV-03). SHALL pass only `TurnoDTOJson` camelCase ISO across RSC→client (INV-08).

#### Scenario: Valid owned UUID fetches turno
- GIVEN `auth` ok, `?confirmed=<own-uuid>` valid, turno `PENDIENTE` owned
- WHEN `await searchParams` + `safeParse` ok + `getAppointmentById` returns DTO
- THEN `TurnoDTOJson` camelCase/ISO available; no `estado`/`fecha_hora_inicio` leak

#### Scenario: Invalid UUID skips fetch
- GIVEN `?confirmed=not-a-uuid` or XSS payload
- WHEN `safeParse` fails
- THEN no DB call, no banner, no throw, plain text only

#### Scenario: Foreign UUID maps 403→404 generic
- GIVEN `?confirmed=<other-user-uuid>` valid but `assertOwnership` throws `ForbiddenError`
- WHEN caught
- THEN neutral "Turno no disponible", no 403 body, no `customerId` echo

#### Scenario: Unknown UUID maps 404 generic
- GIVEN `?confirmed=<unknown-uuid>` valid but `findTurnoById` null
- WHEN `AppointmentNotFoundError` caught
- THEN same neutral outcome, no leak

### Requirement: Success Banner Rendering and Dismiss

The system SHALL render `<section role="status" aria-live="polite">` only when turno exists and `status` in `PENDIENTE|CONFIRMADO` (INV-02). SHALL display `startDateTime`/`endDateTime` ISO formatted via `Intl.DateTimeFormat({timeZone: config.timezone})` (INV-06, `America/Argentina/Buenos_Aires`), plus vehicle/service/status. SHALL provide client dismiss island (`"use client"` + `useRouter`/`useSearchParams` in `<Suspense fallback={null}>`) doing `router.replace` stripping only `confirmed` via `URLSearchParams(searchParams.toString())` preserving siblings. Unauthenticated SHALL `redirect("/login")` before fetch (INV-03).

#### Scenario: PENDIENTE/CONFIRMADO shows success with TZ
- GIVEN owned `PENDIENTE` (or `CONFIRMADO` post-admin) `startDateTime="2026-09-10T12:30:00.000Z"` UTC
- WHEN banner renders with `config.timezone`
- THEN shows `09:30` BA via `Intl`, `role="status"` `aria-live="polite"` present

#### Scenario: Dismiss strips only confirmed
- GIVEN `/appointments?confirmed=<uuid>&page=2&limit=20`
- WHEN dismiss clicked
- THEN `router.replace("/appointments?page=2&limit=20",{scroll:false})`, siblings intact

#### Scenario: Unauthenticated redirects
- GIVEN `auth()` null
- WHEN RSC resolves `/appointments?confirmed=<uuid>`
- THEN `redirect("/login")`, no service call

### Requirement: Fallback Neutral State and List Coexistence

The system SHALL NOT render success for invalid/foreign/not-found/`CANCELADO`/`RECHAZADO` (stale link). SHALL render no banner or neutral "Turno no disponible" plain text only (no `dangerouslySetInnerHTML`). SHALL always co-render upcoming list via `listAppointments({db,config,now},{page,limit},authUser)` with RN-04 defaults: only `PENDIENTE|CONFIRMADO` where `startDateTime>now` UTC, `limit` 1..100 default 20, `page` 1 default, `sort asc` default, envelope `{data:TurnoDTOJson[], pagination:{page,limit,total,totalPages}}` camelCase/ISO (INV-08). `?confirmed=` SHALL coexist with `?page=`; dismiss SHALL NOT clear pagination.

#### Scenario: CANCELADO/RECHAZADO shows neutral
- GIVEN owned turno `status=CANCELADO` (or `RECHAZADO`) with `?confirmed=<uuid>`
- WHEN guard evaluates
- THEN no success banner, neutral or no banner, no success leak

#### Scenario: Invalid still renders list RN-04 defaults
- GIVEN `?confirmed=garbage` + 25 future `PENDIENTE|CONFIRMADO`, 3 past, 2 `CANCELADO` future
- WHEN `listAppointments` with `now` UTC, no flags
- THEN `data` max 20 future `PENDIENTE|CONFIRMADO` only, `pagination` correct, no `CANCELADO`/past

#### Scenario: Coexistence preserves both params
- GIVEN `/appointments?confirmed=<own-uuid>&page=2`
- WHEN banner + list page 2 (`offset=20`) visible, then dismiss
- THEN after dismiss URL `?page=2` list remains, XSS never executed

#### Scenario: DTO shape camelCase ISO
- GIVEN row `fecha_hora_inicio` TIMESTAMPTZ `estado=PENDIENTE`
- WHEN `toTurnoDTO` maps
- THEN JSON has `startDateTime`/`endDateTime`/`status`, no `fecha_hora_inicio`/`estado`/`cliente_id`

## File Changes (informative)

| File | Action |
|---|---|
| `openspec/specs/booking-result/spec.md` | Create canonical |
| `openspec/changes/t044-booking-result/spec.md` | Byte-identical pointer |

## Testing Strategy

Unit `safeParse`, RSC `auth`+403→404+`Intl`, jsdom `BookingConfirmation` PENDIENTE/CONFIRMADO vs CANCELADO/RECHAZADO + dismiss, integration RN-04, E2E 201→banner→dismiss→redirect.

## Threat Matrix

UUID enumeration→404 generic; XSS→`safeParse`+plain text; stale terminal→guard `PENDIENTE|CONFIRMADO` only.

## Migration

No migration. Rollback: delete `page.tsx`+`_components/`+CSS; `/appointments`→404.
