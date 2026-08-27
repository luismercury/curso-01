# OpenAPI Delta — t013-t014 API Layer (FASE 3)

Thin layer over T-011/T-012 services. INV-03 `requireAuth`+`assertOwnership` (ADMIN bypass), INV-08 DTO (Spanish customers, English vehicles), §12 `{error:{code,message,issues?}}`.

## Error Catalog §12

| Code | HTTP | When |
|------|------|------|
| VALIDATION_ERROR | 400 | Zod, invalid uuid, malformed JSON |
| UNAUTHORIZED | 401 | Missing/invalid JWT |
| FORBIDDEN | 403 | Ownership mismatch |
| CUSTOMER_NOT_FOUND | 404 | cliente id not in DB |
| EMAIL_ALREADY_EXISTS | 409 | 23505 clientes/users email |
| PLATE_ALREADY_EXISTS | 409 | 23505 vehiculos patente |

## Endpoints

### POST /api/customers (alias of POST /api/auth/register, unauthenticated)
- Body `customerCreateInputSchema` `{nombre,apellido 2..100, email normalized, telefono /^\+?[0-9\s\-]{7,20}$/, password 8..72}` strict → `createCustomer` 23505→409
- 201 `ClienteDTO` `{id,nombre,apellido,email,telefono}` Spanish 5-field; 400/409 §12; alias invariant both POST routes same 201/409

### GET /api/customers/{id}
- Auth `requireAuth`401 → uuid400 → `assertOwnership`403 ADMIN bypass → `getCustomerById`
- 200 `ClienteDTO` 7-field `{...,createdAt,updatedAt}`; 400/401/403/404 §12

### POST /api/customers/{customerId}/vehicles
- Auth `requireAuth`401 → uuid400 → `assertOwnership`403 → body `{brand,model 2..100, year 1900..nextYear+1, plate /^[A-Z0-9]{6,7}$/}` + injected `customerId` via `vehicleCreateInputSchema` → `createVehicle` 409/404
- 201 `VehiculoDTO` `{id,customerId,brand,model,year,plate,createdAt,updatedAt}` English; 400/401/403/404/409 §12

### GET /api/customers/{customerId}/vehicles
- Auth same as POST → `listVehiclesByCustomer` → 200 `VehiculoDTO[]` (empty `[]` ok); 400/401/403/404 §12

### GET /api/services — t017-services-api (FASE 4)
- Public by default: `GET /api/services` → 200 `ServicioDTO[]` active-only (`activo=true`), empty `[]` valid, no auth required
- Query `includeInactive?: enum "true" | "false"` default `"false"` — strict `z.enum(["true","false"]).optional().default("false")` → 400 `VALIDATION_ERROR` with `issues` on garbage (`1`/`yes`/`True`/`TRUE`), bare `?includeInactive` or `?includeInactive=`, or empty value; `toValidationError` envelope
- Conditional auth: `includeInactive=true` → `requireAuth` → `assertRole ADMINISTRADOR` → 401 `UNAUTHORIZED` / 403 `FORBIDDEN` via `toErrorBody` §12; otherwise public path skips auth (middleware `PUBLIC_GET_SERVICES` whitelist retained, no change)
- Delegates to `servicioService.listServices(db, {includeInactive})` via `DbOrTx` → `listServicios({activeOnly:!includeInactive})` → `toServicioDTO` (INV-08 English `ServicioDTO {id,name,description,durationMinutes,active,createdAt,updatedAt}`, no snake_case)
- 200 `ServicioDTO[]` (active-only or all), 400/401/403 §12; never 404 for list; `NextResponse.json` ISO 8601 UTC Date serialization; thin handler ~45 LOC, `import "server-only"`, no transaction

### POST /api/services — t016b-service-crud (FASE 4)
- Auth: `requireAuth` 401 → `assertRole ADMINISTRADOR` 403 before JSON parse/DB (`§12` envelope via `toErrorBody`); no DB write on auth fail (verified by route test mock)
- Body strict `serviceCreateSchema` `{name 1..100 trim, description 0..500 optional nullable, durationMinutes int 30..120 %5==0, active boolean optional default true}.strict()` → 400 `VALIDATION_ERROR` with `issues` on empty name, >100, bad duration, unknown field, missing fields, invalid JSON
- Delegates to `servicioService.createService(db, parsed)` → `createServicio` (English→Spanish remap `name→nombre` etc.) → 23505 `nombre UNIQUE` → `ServicioNombreTakenError` → 409 `SERVICE_ALREADY_EXISTS`
- 201 `ServicioDTO` `{id,name,description,durationMinutes,active,createdAt,updatedAt}` INV-08 English camelCase, `TIMESTAMPTZ` UTC ISO 8601; 400/401/403/409 §12; `server-only`, `DbOrTx` injectable, no transaction

### PATCH /api/services/{id} — t016b-service-crud (FASE 4)
- Auth: `requireAuth` 401 → `assertRole ADMINISTRADOR` 403 before parse/DB; no DB on 401/403
- Params: `id` `z.string().uuid()` → 400 `VALIDATION_ERROR` on non-UUID/empty before DB; body `servicePatchSchema` `z.object({active:z.boolean()}).strict()` → 400 on non-boolean/empty/extra/missing; `Invalid JSON` → 400
- Delegates to `servicioService.updateServiceActive(db,id,active)` → `updateServicio` (`update servicios set activo, updatedAt where id returning`) → null → `ServiceNotFoundError` → 404 `SERVICE_NOT_FOUND`; success 200 `ServicioDTO` with `active` toggled
- Visibility contract: `GET /api/services` hides `activo=false`; `GET ?includeInactive=true` as admin shows it; appointment consumer `POST /api/appointments {serviceId: inactive}` → 400 `INVALID_SERVICE` (contract documented, enforced in FASE 5 T-028)
- Error codes §12 extension: `SERVICE_ALREADY_EXISTS 409`, `SERVICE_NOT_FOUND 404` in `ERROR_CODES`/`STATUS_BY_CODE`
