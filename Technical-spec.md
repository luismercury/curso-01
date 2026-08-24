# Technical Specification — Sistema de Reservas de Turnos para Taller Mecánico

## 1. Propósito del documento

Este documento define la solución técnica para implementar las funcionalidades especificadas en `functional-spec.md`.

El sistema deberá permitir la gestión de clientes, vehículos, servicios y turnos para un taller mecánico.

Las decisiones técnicas descritas en este documento deberán permitir implementar los requisitos funcionales definidos previamente.

---

## 2. Arquitectura propuesta

El sistema se implementará utilizando una arquitectura cliente-servidor.

La solución estará dividida en tres capas principales:

```text
┌─────────────────────────────┐
│         Cliente Web         │
│                             │
│  Cliente / Administrador    │
└──────────────┬──────────────┘
               │
               │ HTTP / JSON
               ▼
┌─────────────────────────────┐
│          Backend            │
│                             │
│  API + Reglas de negocio    │
└──────────────┬──────────────┘
               │
               │
               ▼
┌─────────────────────────────┐
│       Base de Datos         │
│                             │
│ Clientes                   │
│ Vehículos                  │
│ Servicios                  │
│ Turnos                     │
└─────────────────────────────┘
```

La interfaz de usuario no accederá directamente a la base de datos.

Todas las operaciones relacionadas con reglas de negocio deberán ser procesadas por el backend.

---

## 3. Stack tecnológico

Para esta implementación se propone utilizar:

### Frontend

- Next.js
- TypeScript
- React

### Backend

- Next.js App Router Route Handlers (`app/api/*/route.ts`) para Next.js 14+ (decisión concreta; no `pages/api`)
- TypeScript

### Base de datos

- PostgreSQL

### Acceso a datos

- ORM para gestionar las entidades y consultas a la base de datos.

### Testing

- Tests unitarios.
- Tests de integración.
- Tests end-to-end para los flujos críticos.

> La selección definitiva de librerías concretas podrá ajustarse durante la implementación, siempre que no modifique los contratos definidos en esta especificación.

---

## 4. Componentes del sistema

El sistema estará dividido en los siguientes módulos funcionales.

### 4.1 Módulo de clientes

Responsabilidades:

- Crear clientes.
- Consultar clientes.
- Actualizar información de clientes.
- Asociar vehículos a clientes.

---

### 4.2 Módulo de vehículos

Responsabilidades:

- Registrar vehículos.
- Asociar vehículos a un cliente.
- Consultar los vehículos pertenecientes a un cliente.

---

### 4.3 Módulo de servicios

Responsabilidades:

- Consultar los servicios disponibles.
- Consultar la duración estimada de cada servicio.

Cada servicio deberá definir la información necesaria para calcular la disponibilidad.

---

### 4.4 Módulo de disponibilidad

Responsabilidades:

- Calcular los horarios disponibles.
- Considerar los turnos existentes.
- Considerar la duración del servicio solicitado.
- Evitar que se exceda la capacidad disponible.

Parámetros del servicio:

- `capacityPerSlot: number` — capacidad máxima de turnos simultáneos por slot (v1 = 1). Futuro: configurable vía `WorkshopConfig`.
- `slotStepMinutes: number` — paso entre inicios candidatos (v1 = 30).
- `timezone: string` — zona horaria operativa (ej.: `America/Argentina/Buenos_Aires`).

La generación de slots no es fija cada 60 min: se generan inicios candidatos con `step = slotStepMinutes` (30 min) y se filtra por `durationMinutes` del servicio, exigiendo `fechaHoraFin <= finIntervaloOperativo`. Ejemplo: servicio 90 min iniciado a 09:00 → `fechaHoraFin = 10:30` ocupa dos pasos y solo es válido si no cruza el cierre (11:30 + 90 cruza 12:00 → rechazado).

Este módulo será responsable de determinar si un horario puede ser reservado contando turnos activos en el slot vs. `capacityPerSlot` (no booleano).

---

### 4.5 Módulo de turnos

Responsabilidades (único dueño de transiciones):

- Crear solicitudes de turno (`PENDIENTE`).
- Consultar turnos (query paginada con filtros RN-04).
- Confirmar / rechazar / cancelar turnos — **único dueño de transiciones** vía `AppointmentService` + `AppointmentStateMachine.canTransition(from, to, role)`.
- Consultar la agenda diaria.

> **Ownership (H-19):** `AppointmentService` es el único dueño de transiciones (crear/confirmar/rechazar/cancelar). Centraliza validación de matriz RN-07, `now < fechaHoraInicio` (RN-05) y autorización por recurso. Otros módulos no duplican esta lógica.

---

### 4.6 Módulo de administración

Responsabilidades (orquestación lectura admin + autorización; **delega transiciones a AppointmentService**):

- Consultar solicitudes pendientes (filtra `PENDIENTE`; delega lectura a `AppointmentQueryService` / `AppointmentService.query` con `status=PENDIENTE`).
- Orquestar confirmación / rechazo / cancelación delegando a `AppointmentService.confirm / reject / cancel` — no duplica lógica de transición (nota: delega a AppointmentService).
- Consultar la agenda del taller (lectura paginada `GET /api/admin/appointments?date=&page=&limit=&sort=startAt:asc`).
- Modificar disponibilidad general vía `WorkshopConfig` (`PATCH /api/admin/schedule`).

---

## 5. Responsabilidades y separación de capas

La aplicación utilizará una separación entre:

```text
Presentación
     ↓
API / Controladores
     ↓
Servicios de negocio
     ↓
Persistencia
     ↓
Base de datos
```

### Presentación

Responsable de:

- Mostrar información.
- Capturar acciones del usuario.
- Enviar solicitudes al backend.
- Mostrar respuestas y errores.

La capa de presentación no deberá contener reglas críticas relacionadas con la reserva de turnos.

---

### API

Responsable de:

- Recibir solicitudes.
- Validar la estructura de los datos recibidos.
- Autenticar al usuario cuando corresponda.
- Delegar la lógica de negocio al servicio correspondiente.
- Devolver respuestas HTTP.

---

### Servicios de negocio

Responsables de implementar las reglas definidas en `functional-spec.md`.

Ejemplos:

- Determinar si un horario está disponible.
- Evitar reservas duplicadas.
- Validar transiciones de estado.
- Cancelar un turno.
- Confirmar un turno.

---

### Persistencia

Responsable de:

- Consultar datos.
- Crear registros.
- Actualizar registros.
- Ejecutar operaciones transaccionales cuando corresponda.

---

## 6. Modelo de datos

### 6.0 Convención de naming

**Decisión:** DB `snake_case` consistente (inglés preferente, o español consistente si ya existe), API JSON `camelCase` en inglés (estándar). Mapeo explícito vía DTO mappers; no se exponen nombres de columna internos.

| Dominio (ES / DB) | API JSON (EN) | DTO mapper |
|---|---|---|
| `marca` | `brand` | `marca → brand` |
| `modelo` | `model` | `modelo → model` |
| `año` | `year` | `año → year` |
| `patente` | `plate` | `patente → plate` |
| `clienteId` | `customerId` | `clienteId → customerId` |
| `vehiculoId` | `vehicleId` | `vehiculoId → vehicleId` |
| `servicioId` | `serviceId` | `servicioId → serviceId` |
| `fechaHoraInicio` | `startDateTime` | `fechaHoraInicio → startDateTime` |
| `fechaHoraFin` | `endDateTime` | `fechaHoraFin → endDateTime` |
| `duracionMinutos` | `durationMinutes` | `duracionMinutos → durationMinutes` |
| `estado` | `status` | `estado → status` |

Notas:
- API en inglés es estándar; toda respuesta/request usa `camelCase` en inglés.
- DB usa `snake_case`; los mappers (`toDTO` / `fromDTO`) son obligatorios y se testean.
- Ver `implementation-plan.md T-009b`.

### 6.1 Cliente

Representa a una persona que solicita servicios al taller.

```text
Cliente
──────────────
id
nombre
apellido
telefono
email
createdAt
updatedAt
```

Constraints (H-20):

- `email UNIQUE NOT NULL` (índice único, validación formato email RFC 5321 simplificado).
- `telefono formato validado` (regex validado en app: `^\+?[0-9\s\-]{7,20}$`, no nulo si se provee; normalizado).
- FKs que referencian a Cliente usan `onDelete RESTRICT` (no borrar cliente con vehículos/turnos activos).
- `createdAt/updatedAt` `TIMESTAMPTZ NOT NULL DEFAULT now()`.

Relación:

```text
Cliente
   │
   │ 1 : N
   ▼
Vehículo
```

Un cliente podrá tener uno o varios vehículos.

---

### 6.2 Vehículo

Representa un vehículo perteneciente a un cliente.

```text
Vehículo
──────────────
id
clienteId
marca
modelo
año
patente
createdAt
updatedAt
```

Constraints (H-20):

- `patente UNIQUE` + regex `^[A-Z0-9]{6,7}$` (normalizada a mayúsculas sin espacios/guiones; validada en app y `CHECK (patente ~ '^[A-Z0-9]{6,7}$')`).
- `clienteId FK → Cliente.id onDelete RESTRICT NOT NULL` (índice `idx_vehiculo_clienteId`).
- `marca, modelo, año NOT NULL`; `año CHECK (año BETWEEN 1900 AND extract(year from now())+1)`.

Cada vehículo deberá pertenecer a un único cliente.

---

### 6.3 Servicio

Representa un servicio que puede ser solicitado.

```text
Servicio
──────────────
id
nombre
descripcion
duracionMinutos
activo
createdAt
updatedAt
```

Constraints (H-20):

- `nombre UNIQUE NOT NULL`.
- `activo boolean NOT NULL DEFAULT true`.
- `duracionMinutos CHECK (duracionMinutos > 0 AND duracionMinutos % 5 = 0)` (múltiplo de 5, p.ej. 30/60/90).
- `createdAt/updatedAt TIMESTAMPTZ NOT NULL`.

Gestión de `activo` (H-24): `PATCH /api/services/{id} {activo}` solo `ADMINISTRADOR` (CRUD admin `POST /api/services` y `PATCH /api/services/{id}` solo ADMIN). En v1 el flag se usa para ocultar servicios inactivos en `GET /api/services` y bloquear reservas (`servicio.activo==true` en `POST /api/appointments`); seed inicial vía `T-018` crea servicios con `activo=true`. El flag queda reservado para activación/desactivación sin borrar datos.

Ejemplo:

```text
Cambio de aceite
Duración: 60 minutos
```

---

### 6.3.1 Configuración del taller (WorkshopConfig)

Constante/configuración documentada para v1 (futura tabla parametrizable):

```text
WorkshopConfig
──────────────
capacityPerSlot: int = 1        // v1: 1 turno simultáneo por slot
slotStepMinutes: int = 30       // paso entre inicios candidatos
timezone: string = "America/Argentina/Buenos_Aires"
horarioOperativo: intervalos configurables, ej. 09:00-12:00 / 14:00-18:00 (validar con negocio)
```

Notas:
- `capacityPerSlot` se pasa como parámetro a `AvailabilityService` y a validación de concurrencia (conteo de activos vs. booleano).
- `slotStepMinutes` y `timezone` alimentan generación de slots y conversión UTC.
- El horario operativo `09:00-12:00 / 14:00-18:00` es ejemplo configurable, validar con negocio, parametrizable vía WorkshopConfig, no hardcodeado. No inventar horarios nuevos y validar con negocio.

---

### 6.4 Turno

Representa una reserva o solicitud de atención.

```text
Turno
──────────────
id
clienteId
vehiculoId
servicioId
fechaHoraInicio  TIMESTAMPTZ (UTC)
fechaHoraFin     TIMESTAMPTZ (UTC)
estado           PENDIENTE | CONFIRMADO | RECHAZADO | CANCELADO
createdAt
updatedAt
```

Constraints (H-20):

- `CHECK (estado IN ('PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'))` — enum `AppointmentStatus` UPPER_SNAKE.
- `CHECK (fechaHoraFin > fechaHoraInicio)`.
- `clienteId FK → Cliente.id onDelete RESTRICT NOT NULL`, `vehiculoId FK → Vehículo.id onDelete RESTRICT NOT NULL`, `servicioId FK → Servicio.id onDelete RESTRICT NOT NULL` (índices `idx_turno_clienteId`, `idx_turno_vehiculoId`, `idx_turno_servicioId`, `idx_turno_fechaHoraInicio`).
- `EXCLUDE USING gist (tstzrange(fechaHoraInicio, fechaHoraFin) WITH &&) WHERE (estado IN ('PENDIENTE','CONFIRMADO'))` para `capacity=1` (ver §10); para `capacity>1` se mantiene conteo transaccional.
- `TIMESTAMPTZ NOT NULL` para `fechaHoraInicio/Fin/createdAt/updatedAt`.

Reglas temporales:

- La API recibe `startDateTime` como ISO 8601 con timezone y lo convierte a UTC para persistencia.
- Validaciones: `fechaHoraFin = fechaHoraInicio + servicio.duracionMinutos`, `fechaHoraFin > fechaHoraInicio` y `fechaHoraFin <= finIntervaloOperativo` (no cruzar cierre; DST contemplado vía zona `WorkshopConfig.timezone`).

Los estados posibles serán (v1, sin `COMPLETADO`):

```text
PENDIENTE
CONFIRMADO
RECHAZADO
CANCELADO
```

Matriz de transiciones permitidas (implementada por `AppointmentStateMachine.canTransition(from, to, role)`):

| Origen | Destino | Rol permitido | Condición |
|---|---|---|---|
| PENDIENTE | CONFIRMADO | ADMINISTRADOR | — |
| PENDIENTE | RECHAZADO | ADMINISTRADOR | — |
| PENDIENTE | CANCELADO | CLIENTE (dueño) / ADMINISTRADOR | `fechaHoraInicio > now` |
| CONFIRMADO | CANCELADO | CLIENTE (dueño) / ADMINISTRADOR | `fechaHoraInicio > now` |
| RECHAZADO | — | — | Terminal |
| CANCELADO | — | — | Terminal |

Transiciones no listadas → `INVALID_APPOINTMENT_STATE`.

---

## 7. Relaciones entre entidades

```text
Cliente
   │
   ├───────────────┐
   │               │
   ▼               ▼
Vehículo         Turno
                    │
                    │
                    ▼
                 Servicio
```

Un turno deberá estar asociado con:

- Un cliente.
- Un vehículo.
- Un servicio.

---

## 8. API e interfaces

La comunicación entre el frontend y el backend se realizará mediante HTTP utilizando JSON.

---

### 8.1 Consultar servicios

```text
GET /api/services
```

Respuesta esperada:

```json
[
  {
    "id": "service_001",
    "name": "Cambio de aceite",
    "durationMinutes": 60
  }
]
```

---

### 8.2 Consultar vehículos de un cliente

```text
GET /api/customers/{customerId}/vehicles
```

Respuesta esperada:

```json
[
  {
    "id": "vehicle_001",
    "brand": "Peugeot",
    "model": "207",
    "year": 2011,
    "plate": "ABC123"
  }
]
```

---

### 8.3 Consultar disponibilidad

```text
GET /api/availability
```

Parámetros:

```text
date
serviceId
```

Ejemplo conceptual:

```text
/api/availability?date=2026-09-10&serviceId=service_001
```

Respuesta (ejemplo derivado de config `09:00-12:00 / 14:00-18:00`, `slotStepMinutes=30`, servicio 60 min — unificado con `implementation-plan.md T-021`):

```json
{
  "date": "2026-09-10",
  "availableSlots": [
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "14:00",
    "14:30",
    "15:00"
  ]
}
```

> Nota (H-32): ejemplo horario es configurable; el listado real se genera con `step=30` y filtro `fechaHoraFin <= finIntervalo` según duración del servicio. Ver T-021 para slots completos `09:00,09:30,10:00,10:30,11:00 / 14:00,14:30,15:00,15:30,16:00,16:30,17:00` (60 min).

---

### 8.1b Registro de cliente — POST /api/customers (H-23)

```text
POST /api/customers
Content-Type: application/json

{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@example.com",
  "telefono": "+54 11 5555-1234",
  "password": "••••••••"
}
```

Validaciones (H-23):

- `nombre, apellido` requeridos, `string` 2..100, trim no vacío.
- `email` requerido, formato email, `UNIQUE` (colisión → `409 VALIDATION_ERROR` / `EMAIL_ALREADY_EXISTS`).
- `telefono` requerido, regex `^\+?[0-9\s\-]{7,20}$` (validado en app; ver constraints §6.1).
- `password` requerido, `min 8` chars, hasheado con `bcrypt` (nunca logueado).
- Crea `Cliente` + `User` asociado (o `User` con `role=CLIENTE` si modelo unificado); ver `functional-spec.md F-09`.
- Respuesta `201 { id, nombre, apellido, email, telefono }` (sin `passwordHash`). Si ya existía `User` vía `POST /api/auth/register`, `POST /api/customers` es alias compatible que reutiliza misma validación.

---

### 8.4 Crear una solicitud de turno

```text
POST /api/appointments
```

Solicitud (ISO 8601 con timezone, se convierte a UTC `TIMESTAMPTZ`):

```json
{
  "vehicleId": "vehicle_001",
  "serviceId": "service_001",
  "startDateTime": "2026-09-10T09:00:00-03:00"
}
```

El backend deberá (dentro de transacción atómica ver §10):

1. Validar los datos y autenticación (`authUser` requerido).
2. Verificar que el vehículo pertenezca al cliente (`vehiculo.clienteId == authUser.id`); si no, `FORBIDDEN`.
2a. Verificar `servicio.activo == true`; si `false`, retornar `400 VALIDATION_ERROR` / `INVALID_SERVICE` con mensaje "Servicio no disponible". No se permite reservar servicios inactivos.
3. Calcular `fechaHoraFin = fechaHoraInicio + servicio.duracionMinutos`.
4. Validar `fechaHoraFin > fechaHoraInicio` y `fechaHoraFin <= finIntervaloOperativo` (rechazar si cruza cierre, ej. 11:30 + 90 cruza 12:00).
5. Verificar disponibilidad contando turnos activos vs. `capacityPerSlot` (v1 = 1) con bloqueo de concurrencia.
6. Crear el turno con estado inicial `PENDIENTE` y persistir `TIMESTAMPTZ` en UTC (manejo DST vía `WorkshopConfig.timezone`).

---

### 8.5 Consultar turnos y agenda diaria

```text
GET /api/appointments
GET /api/appointments?status=PENDIENTE&includeCancelled=false&includeRejected=false&from=...&to=...&date=YYYY-MM-DD&page=&limit=&sort=startAt:asc
GET /api/admin/appointments?date=YYYY-MM-DD&includeCancelled=false&includeRejected=false&page=&limit=&sort=startAt:asc
```

Query params:

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `status` | `PENDIENTE \| CONFIRMADO \| RECHAZADO \| CANCELADO` | — | Filtra por estado exacto |
| `includeCancelled` | `boolean` | `false` | Si `false` (default), excluye `CANCELADO` |
| `includeRejected` | `boolean` | `false` | Si `false` (default), excluye `RECHAZADO` |
| `from` / `to` | `ISO 8601 TIMESTAMPTZ` | — | Rango `fechaHoraInicio` |
| `date` | `YYYY-MM-DD` | — | Agenda diaria: filtra `fechaHoraInicio` en ese día (zona `WorkshopConfig.timezone`), orden `sort=startAt:asc` |
| `page` | `int >=1` | `1` | Página (1-indexed); se convierte a `offset = (page-1)*limit` |
| `limit` | `int 1..100` | `20` | Tamaño de página |
| `offset` | `int >=0` | `0` | Alternativa a `page`; si se envía `page` tiene precedencia |
| `sort` | `startAt:asc \| startAt:desc` | `startAt:asc` | Orden cronológico por `fechaHoraInicio` |

Helper paginado (H-28): `paginate(query, { page, limit, offset, sort }) → { data, page, limit, total, totalPages }` con validación `limit<=100`, `sort` whitelisteado. Respuesta envuelve lista en `{ data: [...], pagination: { page, limit, total, totalPages } }` cuando se usa paginación.

Reglas de filtrado (RN-04):

- **Próximos turnos (F-06)** = solo `PENDIENTE` | `CONFIRMADO` con `fechaHoraInicio > now` (comparación UTC `TIMESTAMPTZ`, zona `America/Argentina/Buenos_Aires`). Cancelados y rechazados no se listan como activos por defecto.
- **Agenda diaria (F-08)** por defecto solo activos; con `?includeCancelled=false&includeRejected=false`. Admin puede pedir `includeCancelled=true` para auditoría.
- Cliente: `GET /api/appointments?date=YYYY-MM-DD` filtra propios (`turno.clienteId == authUser.id`).
- Admin: `GET /api/admin/appointments?date=YYYY-MM-DD&includeCancelled=false` ve todos, orden `sort=startAt:asc`. Alternativa `GET /api/admin/agenda?date=` es alias documentado (implementar uno y documentar el otro como alias).
- Paginación: `?page=1&limit=20&sort=startAt:asc` (o `?limit=20&offset=0`); orden cronológico ascendente por defecto.
- El resultado depende del rol: cliente solo sus turnos; administrador todos.

Ejemplos:
- `GET /api/appointments` → próximos activos del cliente.
- `GET /api/appointments?includeCancelled=true` → incluye cancelados (admin o cliente dueño).
- `GET /api/admin/appointments?date=2026-09-10` → agenda del día ordenada.

---

### 8.6 Confirmar un turno

```text
PATCH /api/appointments/{appointmentId}/confirm
```

Solo podrá ser ejecutado por un administrador.

---

### 8.7 Rechazar un turno

```text
PATCH /api/appointments/{appointmentId}/reject
```

Solo podrá ser ejecutado por un administrador.

---

### 8.8 Cancelar un turno

```text
PATCH /api/appointments/{appointmentId}/cancel
```

El sistema deberá validar que:

- El turno pertenezca al usuario que intenta cancelarlo (`turno.clienteId == authUser.id` o rol `ADMINISTRADOR`).
- `now < fechaHoraInicio` (zona `America/Argentina/Buenos_Aires`, comparando `TIMESTAMPTZ` en UTC). Si `now >= fechaHoraInicio`, rechazar con `INVALID_APPOINTMENT_STATE` y mensaje "El turno ya comenzó".
- Casos borde: turno `09:00` con `now == 09:00:00` → rechazar; `09:00:01` → rechazar; `08:59` → permitir.
- El estado actual permita la cancelación vía `canTransition(estadoActual, CANCELADO, role)` (RN-07); fuera de matriz → `INVALID_APPOINTMENT_STATE`.

Notas timezone: `now` y `fechaHoraInicio` se comparan en UTC (`TIMESTAMPTZ`); la zona `WorkshopConfig.timezone` rige conversión de `date` a UTC.

---

### 8.9 Modificar disponibilidad general (H-05)

```text
PATCH /api/admin/schedule
Authorization: ADMINISTRADOR
Content-Type: application/json

{
  "dayOfWeek": 1,
  "openIntervals": [
    { "start": "09:00", "end": "12:00" },
    { "start": "14:00", "end": "18:00" }
  ]
}
```

Comportamiento:

- Solo rol `ADMINISTRADOR`; sin rol → `FORBIDDEN` (`403`).
- Valida `dayOfWeek` 0-6, `openIntervals` no solapados, `start < end`, dentro de `00:00-24:00`.
- Persiste en `WorkshopConfig.horarioOperativo` (futura tabla `workshop_schedule` parametrizable). Ejemplo `09:00-12:00 / 14:00-18:00` es configurable, validar con negocio, no hardcodeado.
- Al modificar, invalida caché de disponibilidad y afecta `GET /api/availability` y validación de creación (`fechaHoraFin <= finIntervaloOperativo`).
- Respuesta `200 { dayOfWeek, openIntervals }` o `400 VALIDATION_ERROR` si intervalos inválidos.

Relación: cubre `Functional §6.2` "Modificar la disponibilidad general del taller" y `WorkshopConfig`.

---

### 8.10 Gestión de servicios — CRUD admin (H-24)

```text
POST /api/services          Authorization: ADMINISTRADOR
PATCH /api/services/{id}    Authorization: ADMINISTRADOR
```

- `POST /api/services { nombre, descripcion, duracionMinutos, activo=true }` → `201 { id, name, durationMinutes, active }`; `nombre UNIQUE` (409 si duplica), `duracionMinutos` múltiplo de 5 >0.
- `PATCH /api/services/{id} { nombre?, descripcion?, duracionMinutos?, activo? }` → `200`; solo ADMIN; si `activo=false` el servicio deja de aparecer en `GET /api/services` y bloquea `POST /api/appointments` (`INVALID_SERVICE`).
- `GET /api/services` filtra `activo=true` por defecto (público); admin puede `?includeInactive=true` para auditoría.
- Validación rol: sin `ADMINISTRADOR` → `403 FORBIDDEN`.

---

## 9. Flujos técnicos

### 9.1 Flujo de consulta de disponibilidad (slots parametrizados por duración)

```text
Cliente
   │
   ▼
Frontend
   │
   │ GET /api/availability?date=...&serviceId=...
   ▼
Availability Controller
   │
   ▼
Availability Service (capacityPerSlot, slotStepMinutes=30, timezone)
   │
   ├── Consulta servicio.durationMinutes
   │
   ├── Genera inicios candidatos con step 30 min dentro de intervalos operativos (ej. 09:00-12:00 / 14:00-18:00)
   │
   ├── Filtra candidatos donde fechaHoraFin = inicio + durationMinutes cumpla fechaHoraFin <= finIntervalo
   │     ej. 09:00 + 90 = 10:30 válido; 11:30 + 90 = 13:00 cruza 12:00 → descartado
   │
   ├── Consulta turnos existentes activos (PENDIENTE, CONFIRMADO)
   │
   ├── Cuenta solapamientos por slot vs. capacityPerSlot (v1=1) usando tstzrange OVERLAPS
   │
   └── Calcula horarios disponibles (conteo < capacity)
           │
           ▼
        Respuesta
```

---

### 9.2 Flujo de creación de turno

```text
Cliente
   │
   ▼
Frontend
   │
   │ POST /api/appointments
   ▼
Appointment Controller
   │
   ▼
Appointment Service
   │
   ├── Valida datos
   │
   ├── Valida vehículo
   │
   ├── Calcula horario final
   │
   ├── Verifica disponibilidad
   │
   └── Crea turno
           │
           ▼
       Base de datos
           │
           ▼
     Turno PENDIENTE
```

---

## 10. Manejo de concurrencia (transaccional atómico)

Existe un riesgo funcional importante:

Dos clientes podrían intentar reservar simultáneamente el último horario disponible (capacityPerSlot = 1 en v1).

Ejemplo:

```text
Cliente A ──────┐
                │
                ▼
           Horario 10:00 (slot)
                ▲
                │
Cliente B ──────┘
```

El sistema deberá garantizar validación y creación atómicas dentro de una transacción:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ; -- o SERIALIZABLE
-- Bloquear turnos del slot / rango solapable
SELECT 1 FROM "Turno"
 WHERE tstzrange("fechaHoraInicio","fechaHoraFin") && tstzrange($1,$2)
   AND estado IN ('PENDIENTE','CONFIRMADO')
 FOR UPDATE;
-- Contar activos vs. capacityPerSlot
-- Si count < capacityPerSlot → INSERT turno PENDIENTE
COMMIT;
-- En caso de conflicto SERIALIZABLE → retry o retornar APPOINTMENT_NOT_AVAILABLE
```

Alternativa declarativa (PostgreSQL):

```sql
ALTER TABLE "Turno" ADD CONSTRAINT no_overlap_per_capacity
 EXCLUDE USING gist (tstzrange("fechaHoraInicio","fechaHoraFin") WITH &&)
 WHERE (estado IN ('PENDIENTE','CONFIRMADO'));
-- Para capacity=1; para capacity>1 se mantiene conteo transaccional.
```

No es suficiente confiar en la disponibilidad mostrada en la UI. Toda creación revalida disponibilidad dentro de la transacción bloqueante.

---

## 11. Seguridad (stack concreto)

Stack: **Auth.js / NextAuth con JWT en cookie `httpOnly` (secure, sameSite=strict), passwords hasheados con `bcrypt`**.

Modelo `User`:

```text
User
──────────────
id
email          UNIQUE NOT NULL
passwordHash   NOT NULL (bcrypt)
role           CLIENTE | ADMINISTRADOR
createdAt
updatedAt
```

Endpoints:

```text
POST /api/auth/register  { email, password, nombre, apellido } → crea User CLIENTE (ADMIN por seed)
POST /api/auth/login     { email, password } → set cookie JWT httpOnly
POST /api/auth/logout    → clear cookie
```

Middleware de autenticación y autorización:

- Middleware Next.js verifica JWT en cada request; rutas protegidas exigen sesión válida (`UNAUTHORIZED` si falta).
- Autorización por rol: `CLIENTE` vs `ADMINISTRADOR`; endpoints admin (`/confirm`, `/reject`, agenda) exigen `role == ADMINISTRADOR` (`FORBIDDEN` si no).
- Autorización por recurso: el backend verifica `vehiculo.clienteId == authUser.id` al crear turno y `turno.clienteId == authUser.id` al consultar/cancelar; `GET /api/customers/{id}/vehicles` y `GET /api/appointments` filtran por `authUser.id` si rol CLIENTE.
- `GET /api/services` puede ser público; el resto requiere auth.

### Cliente

Un cliente solamente podrá:

- Consultar su propia información.
- Consultar sus propios vehículos.
- Consultar sus propios turnos.
- Crear turnos para sus propios vehículos (verificando `vehiculo.clienteId == authUser.id`).
- Cancelar sus propios turnos.

---

### Administrador

Un administrador podrá:

- Consultar todos los turnos.
- Confirmar solicitudes.
- Rechazar solicitudes.
- Consultar la agenda general.

---

### Protección de datos

La API no deberá permitir que un usuario acceda a un recurso perteneciente a otro usuario únicamente modificando un identificador.

Por ejemplo:

```text
/api/appointments/123
```

El backend deberá verificar que el usuario autenticado tenga autorización para acceder al turno solicitado (comparando `turno.clienteId` con `authUser.id` o rol ADMINISTRADOR).

---

## 12. Manejo de errores

Las respuestas de error deberán utilizar una estructura consistente.

Ejemplo:

```json
{
  "error": {
    "code": "APPOINTMENT_NOT_AVAILABLE",
    "message": "El horario seleccionado ya no se encuentra disponible."
  }
}
```

Ejemplos de errores:

| Código | Descripción |
|---|---|
| `VALIDATION_ERROR` | Los datos enviados no son válidos |
| `UNAUTHORIZED` | El usuario no está autenticado |
| `FORBIDDEN` | El usuario no tiene permisos |
| `NOT_FOUND` | El recurso no existe |
| `APPOINTMENT_NOT_AVAILABLE` | El horario ya no está disponible |
| `INVALID_APPOINTMENT_STATE` | La operación no es válida para el estado actual |

> Nota (H-33): No existe `COMPLETADO` en v1; `INVALID_APPOINTMENT_STATE` cubre todos los estados restantes (transiciones no listadas en RN-07). No agregar `COMPLETADO` al catálogo.

---

## 13. Observabilidad

El sistema deberá registrar eventos relevantes para facilitar la detección de errores.

Stack (H-21): `pino` o `winston` para logs estructurados JSON + `OpenTelemetry` para traces/métricas (correlationId propagado en headers `x-correlation-id`).

Se deberán registrar, como mínimo:

- Errores internos (5xx, stack, correlationId).
- Intentos fallidos de reserva (`APPOINTMENT_NOT_AVAILABLE`).
- Conflictos de disponibilidad (con `serviceId, date, slot`).
- Creación / cancelación / confirmación / rechazo de turnos (con `appointmentId, estado, actor`).
- Auth failures (`UNAUTHORIZED` 401, `FORBIDDEN` 403 — sin loguear passwords/tokens).
- Validation errors (`VALIDATION_ERROR` 400 con `field` y `code`).
- Métricas: `availability latency` (histogram `http_request_duration` para `GET /api/availability`), `conflict rate` (`appointments.conflicts_total` counter), `correlationId` en cada log line.

Los registros no deberán almacenar información sensible innecesaria (no `password`, no `JWT` raw, `email`/`telefono` con máscara si aplica). Cada request genera `correlationId` (UUID) propagado a logs y traces.

---

## 14. Testing técnico

### 14.1 Tests unitarios

Se deberán probar individualmente las reglas críticas.

Ejemplos:

- Cálculo de duración de un servicio.
- Validación de disponibilidad.
- Validación de transiciones de estado.
- Validación de cancelación.

---

### 14.2 Tests de integración

Se deberán probar las operaciones entre módulos.

Ejemplos:

- Crear un turno.
- Consultar disponibilidad.
- Confirmar un turno.
- Cancelar un turno.

---

### 14.3 Tests end-to-end

Se deberán probar los flujos completos.

Flujos mínimos:

```text
Cliente registra vehículo
        ↓
Selecciona servicio
        ↓
Consulta disponibilidad
        ↓
Solicita turno
        ↓
Administrador confirma turno
```

Y:

```text
Cliente consulta turno
        ↓
Solicita cancelación
        ↓
Confirma cancelación
        ↓
Horario vuelve a estar disponible
```

### 14.4 Trazabilidad Edge Cases → Tests (H-18)

| Edge Case | Descripción | Cobertura test |
|---|---|---|
| `EC-01` | Race: 2 clientes mismo slot, `capacity=1` | `T-060` (E2E 2 workers) + `T-029` (transacción `SELECT FOR UPDATE` / `EXCLUDE`) |
| `EC-02` | Sin disponibilidad | `T-026` (tests disponibilidad vacío) |
| `EC-03` | Cancelar turno pasado / ya comenzado (`now >= startAt`) | `T-032` (validación `now < startAt` UTC) + `T-034` (casos borde 09:00 exacto/09:00:01/08:59) |
| `EC-04` | Rechazo visible para cliente | `T-031` (rechazo admin) + `T-034` (cliente ve `RECHAZADO` no activo) |

Nota: `EC-01` exige test de concurrencia real con 2 workers paralelos (ver `T-060`); no basta test secuencial.

---

## 15. Decisiones técnicas

### DT-01 — Base de datos relacional

Se utilizará una base de datos relacional porque el sistema contiene relaciones claras entre:

- Clientes.
- Vehículos.
- Servicios.
- Turnos.

Además, la consistencia de las reservas es un requisito crítico.

---

### DT-02 — Backend centralizado para reglas de negocio

Las reglas de disponibilidad no deberán depender exclusivamente del frontend.

El backend será la fuente de verdad para:

- Validar horarios.
- Crear turnos.
- Cambiar estados.
- Aplicar permisos.

---

### DT-03 — API como límite entre frontend y negocio

La interfaz de usuario se comunicará con el sistema mediante una API.

Esto permitirá que, en el futuro, otros clientes puedan utilizar las mismas funcionalidades sin duplicar la lógica de negocio.

Ejemplos futuros:

- Aplicación móvil.
- Panel administrativo independiente.
- Integración con sistemas externos.

---

## 16. Riesgos y trade-offs

### Riesgo 1 — Complejidad del cálculo de disponibilidad

El cálculo de horarios puede aumentar su complejidad cuando se incorporen:

- Varios mecánicos.
- Diferentes puestos de trabajo.
- Servicios simultáneos.
- Duraciones variables.

La primera versión deberá implementar una solución simple, pero el diseño deberá evitar impedir una futura evolución.

---

### Riesgo 2 — Reservas simultáneas

Dos usuarios pueden intentar reservar el mismo horario.

Mitigación:

- Validación de disponibilidad en el backend.
- Control de concurrencia durante la creación de la reserva.

---

### Trade-off — Arquitectura simple frente a microservicios

No se utilizarán microservicios en la primera versión.

El sistema se implementará como una aplicación modular.

Motivos:

- Menor complejidad operativa.
- Menor costo inicial.
- Mayor velocidad de desarrollo.
- Menor necesidad de infraestructura.

Si el sistema crece significativamente, determinados módulos podrán separarse en el futuro.

---

## 17. Trazabilidad con la especificación funcional

| Requisito funcional | Solución técnica |
|---|---|
| Consulta de servicios | Endpoint y módulo de servicios |
| Registro de vehículos | Entidad y módulo de vehículos |
| Consulta de disponibilidad | Availability Service |
| Solicitud de turno | Appointment Service |
| Confirmación | Endpoint administrativo |
| Cancelación | Endpoint de cancelación |
| Agenda diaria | Consulta de turnos por fecha |
| Evitar superposición | Validación de disponibilidad y concurrencia |

---

## 18. Resultado técnico esperado

Al finalizar la implementación, el sistema deberá contar con:

```text
Cliente Web
     │
     ▼
API
     │
     ▼
Servicios de negocio
     │
     ├── Clientes
     ├── Vehículos
     ├── Servicios
     ├── Disponibilidad
     └── Turnos
              │
              ▼
        Base de datos
```

La arquitectura deberá garantizar que las reglas funcionales definidas en `functional-spec.md` se implementen de forma consistente, verificable y mantenible.