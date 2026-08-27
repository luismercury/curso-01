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
