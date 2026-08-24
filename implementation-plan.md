# Implementation Plan — Sistema de Reservas de Turnos para Taller Mecánico

## 1. Propósito

Este documento transforma las decisiones definidas en:

- `functional-spec.md`
- `technical-spec.md`

en un plan concreto de implementación.

El objetivo es dividir el desarrollo del sistema en fases, features y tareas atómicas que puedan implementarse, verificarse y revisarse de forma progresiva.

Cada tarea deberá producir un resultado verificable antes de avanzar a la siguiente fase.

---

## 2. Principios de implementación

El desarrollo seguirá los siguientes principios:

1. Implementar primero las bases técnicas necesarias.
2. Construir las entidades y relaciones fundamentales antes de desarrollar funcionalidades.
3. Implementar las reglas de negocio en el backend.
4. Implementar la interfaz después de contar con contratos funcionales y técnicos definidos.
5. Probar las reglas críticas durante la implementación.
6. Implementar las funcionalidades en incrementos pequeños.
7. Validar cada feature antes de considerarla terminada.

El orden general será:

```text
Fundaciones
    ↓
Modelo de datos
    ↓
Servicios de negocio
    ↓
API
    ↓
Interfaz
    ↓
Integración
    ↓
Testing
    ↓
Validación final
```

---

## 3. Breakdown general

El proyecto estará dividido en 12 fases + 1 sub-fase transversal FASE 2.5 (13 bloques etiquetados en total, FASE 2.5 incluida en el conteo de FASE 2):

```text
FASE 1 — Inicialización del proyecto
        ↓
FASE 2 — Modelo de datos
        ↓
FASE 2.5 — Autenticación y autorización
        ↓
FASE 3 — Clientes y vehículos
        ↓
FASE 4 — Servicios del taller
        ↓
FASE 5 — Disponibilidad
        ↓
FASE 6 — Gestión de turnos
        ↓
FASE 7 — Administración
        ↓
FASE 8 — Interfaz de usuario
        ↓
FASE 9 — Seguridad y manejo de errores
        ↓
FASE 10 — Observabilidad
        ↓
FASE 11 — Testing end-to-end
        ↓
FASE 12 — Validación final
```

---

## 4. FASE 1 — Inicialización del proyecto

## Objetivo

Crear la estructura base del proyecto y preparar el entorno necesario para comenzar la implementación.

---

### T-001 — Inicializar el proyecto

**Descripción**

Crear el proyecto base utilizando la arquitectura definida en `technical-spec.md`.

**Resultado esperado**

El proyecto deberá poder ejecutarse localmente.

**Criterio de finalización**

- El proyecto inicia correctamente.
- Existe una estructura inicial de directorios.
- La aplicación puede mostrar una página inicial.

**Dependencias**

Ninguna.

---

### T-002 — Configurar TypeScript

**Descripción**

Configurar el proyecto para utilizar TypeScript.

**Resultado esperado**

El código del proyecto deberá contar con validación de tipos.

**Criterio de finalización**

- TypeScript está correctamente configurado.
- El proyecto puede compilar.
- No existen errores de configuración.

**Dependencias**

T-001.

---

### T-003 — Configurar variables de entorno

**Descripción**

Definir el mecanismo para gestionar la configuración del entorno.

Ejemplos:

```text
DATABASE_URL
AUTH_SECRET
APP_URL
```

**Resultado esperado**

Las configuraciones sensibles no deberán estar escritas directamente en el código.

**Dependencias**

T-001.

---

### T-004 — Configurar testing inicial

**Descripción**

Preparar la infraestructura para ejecutar tests.

**Resultado esperado**

El proyecto deberá poder ejecutar tests automatizados.

**Criterio de finalización**

- Existe un comando de ejecución de tests.
- Existe al menos un test de ejemplo funcionando.

**Dependencias**

T-001.

---

## 5. FASE 2 — Modelo de datos

## Objetivo

Implementar las entidades principales y sus relaciones.

Las entidades definidas en esta fase serán:

```text
Cliente
Vehículo
Servicio
Turno
```

---

### T-005 — Crear modelo Cliente

**Feature relacionada**

Gestión de clientes.

**Descripción**

Crear la entidad que representa a un cliente del taller.

**Campos principales**

```text
id
nombre
apellido
telefono
email
createdAt
updatedAt
```

**Resultado esperado**

Será posible almacenar y consultar clientes.

**Dependencias**

T-003.

---

### T-006 — Crear modelo Vehículo

**Feature relacionada**

Registro de vehículos.

**Descripción**

Crear la entidad que representa un vehículo perteneciente a un cliente.

**Campos principales**

```text
id
clienteId
marca
modelo
año
patente
createdAt
updatedAt
```

**Resultado esperado**

Un cliente podrá tener uno o varios vehículos.

**Dependencias**

T-005.

---

### T-007 — Crear modelo Servicio

**Feature relacionada**

Consulta de servicios.

**Descripción**

Crear la entidad que representa un servicio ofrecido por el taller.

**Campos principales**

```text
id
nombre
descripcion
duracionMinutos
activo
createdAt
updatedAt
```

**Resultado esperado**

Será posible definir servicios activos e inactivos.

**Dependencias**

T-003.

---

### T-008 — Crear modelo Turno

**Feature relacionada**

Gestión de turnos.

**Descripción**

Crear la entidad que representa una solicitud o reserva.

**Campos principales**

```text
id
clienteId
vehiculoId
servicioId
fechaHoraInicio
fechaHoraFin
estado
createdAt
updatedAt
```

**Estados permitidos (v1, sin COMPLETADO)**

```text
PENDIENTE
CONFIRMADO
RECHAZADO
CANCELADO
```

**Dependencias**

T-005, T-006 y T-007.

---

### T-009 — Implementar relaciones e integridad de datos (H-20)

**Descripción**

Definir las relaciones entre:

```text
Cliente
   ↓
Vehículo

Cliente
   ↓
Turno
   ↓
Servicio
```

Constraints a migrar (H-20):

- `Cliente.email UNIQUE NOT NULL`, `telefono` regex `^\+?[0-9\s\-]{7,20}$` (app-level), FKs `onDelete RESTRICT`.
- `Vehículo.patente UNIQUE + CHECK (patente ~ '^[A-Z0-9]{6,7}$')`, `clienteId FK RESTRICT NOT NULL`, `año CHECK (1900..now+1)`.
- `Servicio.nombre UNIQUE NOT NULL`, `activo boolean NOT NULL DEFAULT true`, `duracionMinutos CHECK (>0 AND %5=0)`.
- `Turno CHECK (estado IN ('PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'))`, `CHECK (fechaHoraFin > fechaHoraInicio)`, `FKs clienteId/vehiculoId/servicioId RESTRICT NOT NULL`, `EXCLUDE USING gist (tstzrange(fechaHoraInicio,fechaHoraFin) WITH &&) WHERE (estado IN ('PENDIENTE','CONFIRMADO'))` para capacity=1.
- Índices: `idx_turno_fechaHoraInicio`, `idx_turno_clienteId`, `idx_vehiculo_clienteId`.

Ver `technical-spec.md §6.1-6.4` para constraints completos.

**Resultado esperado**

No deberán existir referencias inválidas entre entidades; constraints validados por migración + tests de colisión UNIQUE/CHECK/FK.

**Dependencias**

T-005 a T-008.

---

### T-009b — Definir naming convention y DTO mappers (H-10)

**Descripción**

Establecer convención: DB `snake_case` consistente, API JSON `camelCase` en inglés. Definir tabla de mapeo (`marca→brand`, `modelo→model`, `año→year`, `patente→plate`, `clienteId→customerId`, `fechaHoraInicio→startDateTime`, `duracionMinutos→durationMinutes`, `estado→status`) e implementar DTO mappers `toDTO`/`fromDTO` con tests. Ver `technical-spec.md §6.0`.

**Resultado esperado**

Toda API expone nombres en inglés camelCase; DB interna no se filtra. Mappers testeados.

**Dependencias**

T-009.

---

### T-010 — Crear migración inicial

**Descripción**

Crear la migración necesaria para generar la estructura inicial de la base de datos.

**Criterio de finalización**

La base de datos deberá contener todas las entidades y relaciones definidas.

**Dependencias**

T-009.

---

## 5.5 FASE 2.5 — Autenticación y autorización

## Objetivo

Implementar autenticación y autorización antes de cualquier módulo que maneje recursos de clientes/turnos, para que todos los endpoints subsiguientes nazcan protegidos.

---

### T-050 — Implementar autenticación (H-25)

**Descripción**

Implementar stack concreto: Auth.js/NextAuth con JWT en cookie `httpOnly`, modelo `User { id, email, passwordHash, role: CLIENTE|ADMINISTRADOR }`, endpoints `POST /api/auth/register` y `POST /api/auth/login`, hashing con `bcrypt`, y middleware de autenticación.

**Resultado esperado**

El sistema identifica al usuario en cada request; passwords nunca se almacenan en claro.

**Dependencias**

T-003 (variables de entorno `DATABASE_URL`, `AUTH_SECRET` requeridas antes de auth). Esta tarea es fundacional para todo el dominio.

---

### T-051 — Implementar autorización de recursos (H-25)

**Descripción**

Verificar propiedad de recursos en backend: `vehiculo.clienteId == authUser.id` al crear turno, `turno.clienteId == authUser.id` al consultar/cancelar, y filtrado por rol en listados. Admin accede a todo.

**Resultado esperado**

Un CLIENTE no puede acceder a recursos de otro cliente (FORBIDDEN).

**Dependencias**

T-050.

---

### T-035 — Implementar autorización por roles

**Roles**

```text
CLIENTE
ADMINISTRADOR
```

**Descripción**

Middleware/guard por rol para endpoints administrativos (`/confirm`, `/reject`, agenda). `GET /api/services` puede ser público; el resto exige auth.

**Dependencias**

T-050 (antes: "Sistema de autenticación" genérico — ahora explícito).

---

## 6. FASE 3 — Gestión de clientes y vehículos

## Objetivo

Implementar las funcionalidades necesarias para registrar y consultar clientes y vehículos.

---

### T-011 — Implementar Customer Service (H-23)

**Descripción**

Crear el servicio responsable de las operaciones relacionadas con clientes. Validaciones (H-23): `nombre/apellido` 2..100 trim, `email` formato + `UNIQUE` (409 si duplica), `telefono` regex `^\+?[0-9\s\-]{7,20}$`, `password` min 8 hasheado `bcrypt`. Crea `Cliente` + `User` con `role=CLIENTE`. Ver `technical-spec.md §8.1b` y `functional-spec.md F-09`.

**Responsabilidades**

- Crear clientes (`POST /api/customers` payload `{nombre, apellido, email, telefono, password}`).
- Consultar clientes.
- Actualizar información.

**Dependencias**

T-010.

---

### T-012 — Implementar Vehicle Service

**Descripción**

Crear el servicio responsable de las operaciones relacionadas con vehículos.

**Responsabilidades**

- Registrar vehículos.
- Asociar vehículos a un cliente.
- Consultar vehículos de un cliente.

**Dependencias**

T-010.

---

### T-013 — Implementar API de clientes (H-23)

**Endpoints iniciales**

```text
POST /api/customers  { nombre, apellido, email, telefono, password } → 201 { id, nombre, apellido, email, telefono }
GET /api/customers/{id}
```

Contrato (H-23): `POST /api/customers` documentado en `technical-spec.md §8.1b` y `functional-spec.md F-09`. Validaciones: email único (409), teléfono regex, password min 8 + bcrypt. `POST /api/auth/register` es alias compatible. OpenAPI validado (lint sin errores).

**Dependencias**

T-011 y T-051 (autorización: solo propietario o ADMIN; requiere auth).

**Nota de seguridad**

Validar `authUser` y `vehiculo.clienteId == authUser.id` donde aplique.

---

### T-014 — Implementar API de vehículos

**Endpoints iniciales**

```text
POST /api/customers/{customerId}/vehicles
GET /api/customers/{customerId}/vehicles
```

**Dependencias**

T-012 y T-051 (autorización de recursos).

**Nota de seguridad**

Backend verifica `vehiculo.clienteId == authUser.id`.

---

### T-015 — Crear tests de clientes y vehículos

**Escenarios mínimos**

- Crear cliente.
- Crear vehículo.
- Asociar vehículo a cliente.
- Consultar vehículos.
- Intentar acceder a un vehículo inexistente.
- [H-13] Intentar crear turno con vehículo ajeno (`vehiculo.clienteId != authUser.id`) → `FORBIDDEN` (prepara validación de T-028, verificación cruzada en T-034).
- [H-13] Intentar crear turno con servicio inactivo (`activo=false`) → `400 VALIDATION_ERROR / INVALID_SERVICE` (cubierto en T-034, smoke aquí si se crea servicio inactivo).

**Dependencias**

T-011 a T-014.

---

## 7. FASE 4 — Gestión de servicios

## Objetivo

Implementar la gestión de los servicios ofrecidos por el taller.

---

### T-016 — Implementar Service Service (H-24)

**Responsabilidades**

- Consultar servicios (filtra `activo=true` por defecto).
- Filtrar servicios activos / inactivos.
- Obtener duración de un servicio.

**Nota (H-24):** flag `activo` reservado para futuro; en v1 seed vía `T-018` con `activo=true`. Gestión completa en `T-016b` (CRUD admin). No borrar servicios, solo activar/desactivar.

**Dependencias**

T-010.

---

### T-017 — Implementar API de servicios

**Endpoint**

```text
GET /api/services
```

**Resultado esperado**

La aplicación deberá poder obtener los servicios disponibles.

**Dependencias**

T-016.

---

### T-018 — Crear datos iniciales de servicios

**Descripción**

Crear servicios de ejemplo.

Ejemplo:

```text
Cambio de aceite
60 minutos

Revisión general
120 minutos

Alineación y balanceo
90 minutos
```

**Dependencias**

T-010.

---

### T-016b — CRUD de servicios para admin (activar/desactivar) (H-24)

**Descripción**

Implementar `POST /api/services` y `PATCH /api/services/{id} {activo}` solo `ADMINISTRADOR` (ver `technical-spec.md §8.10`). Validar `nombre UNIQUE` (409), `duracionMinutos` múltiplo de 5 >0. Si `activo=false`, `GET /api/services` lo oculta y `POST /api/appointments` rechaza con `INVALID_SERVICE`.

**Dependencias**

T-016 y T-035 (rol ADMIN).

---

### T-019 — Crear tests del módulo de servicios

**Escenarios mínimos**

- Consultar servicios activos.
- No mostrar servicios inactivos.
- Obtener duración correctamente.
- Admin `PATCH /api/services/{id} {activo:false}` → `GET /api/services` no lo lista; reserva con servicio inactivo → `INVALID_SERVICE` (H-24/T-016b).

**Dependencias**

T-016, T-016b y T-017.

---

## 8. FASE 5 — Gestión de disponibilidad

## Objetivo

Implementar la lógica necesaria para calcular qué horarios pueden ser reservados.

Esta fase contiene una de las reglas críticas del sistema.

---

### T-019b — Definir WorkshopConfig y capacidad

**Descripción**

Definir `WorkshopConfig { capacityPerSlot: int = 1, slotStepMinutes: int = 30, timezone: string = "America/Argentina/Buenos_Aires" }` como constante documentada (futura tabla). Capacidad v1 = 1 turno simultáneo por slot; futuro configurable. Horario operativo ejemplo `09:00-12:00 / 14:00-18:00` — ejemplo configurable, validar con negocio, parametrizable vía WorkshopConfig, no hardcodeado.

**Resultado esperado**

`capacityPerSlot`, `slotStepMinutes` y `timezone` disponibles como parámetro de AvailabilityService y creación de turnos.

**Dependencias**

T-010.

---

### T-020 — Definir configuración de horarios del taller

**Descripción**

Implementar la configuración de horarios de apertura y cierre.

Ejemplo configurable, validar con negocio, parametrizable vía WorkshopConfig, no hardcodeado. Ejemplo (configurable, validar con negocio):

```text
Lunes a viernes

09:00 a 12:00
14:00 a 18:00
```

**Resultado esperado**

El sistema deberá poder determinar el horario operativo de una fecha. Los intervalos son parametrizables vía `WorkshopConfig`.

**Dependencias**

T-019b.

---

### T-021 — Implementar generación de slots parametrizada por duración

**Descripción**

Generar inicios candidatos con `step = WorkshopConfig.slotStepMinutes (30 min)` dentro de intervalos operativos (ej. 09:00-12:00 / 14:00-18:00) y filtrar por duración del servicio: solo se mantiene el slot si `fechaHoraFin = inicio + service.durationMinutes` cumple `fechaHoraFin <= finIntervaloOperativo` (no cruzar cierre). Ejemplo servicio 90 min a 09:00 → 10:30 válido (ocupa dos pasos); 11:30 + 90 cruza 12:00 → descartado.

Slots ejemplo para servicio 60 min con step 30 (filtrados por fin <= cierre):

```text
09:00, 09:30, 10:00, 10:30, 11:00  // 11:00+60=12:00 límite válido
14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00
```

**Dependencias**

T-020 y T-019b. Recibe `service.durationMinutes` y `capacity` no afecta generación pero sí filtrado posterior.

---

### T-022 — Implementar cálculo de duración con validación de cierre y zona horaria

**Descripción**

Determinar `fechaHoraFin = fechaHoraInicio + durationMinutes` a partir de ISO 8601 con timezone convertido a UTC (`TIMESTAMPTZ`). Validar `fechaHoraFin > fechaHoraInicio` y `fechaHoraFin <= finIntervaloOperativo` (rechazar si cruza cierre; manejo DST vía `WorkshopConfig.timezone`). Horario operativo 09:00-12:00 / 14:00-18:00 es ejemplo configurable.

**Ejemplo**

```text
Inicio: 09:00 (America/Argentina/Buenos_Aires)
Duración: 90 minutos

Fin: 10:30 (mismo día, UTC convertido)
```

**Validación crítica**

Servicio 90 min a 11:30 con cierre 12:00 → `11:30+90=13:00 > 12:00` → rechazar con `VALIDATION_ERROR` / `APPOINTMENT_NOT_AVAILABLE`.

**Dependencias**

T-007 y T-019b (timezone).

---

### T-022b — Validación de cruce de cierre (edge case)

**Descripción**

Agregar test y validación explícita: cualquier slot donde `inicio + duration` exceda el fin del intervalo operativo debe ser excluido de disponibilidad y rechazado en creación.

**Dependencias**

T-022.

---

### T-023 — Implementar detección de solapamientos con capacidad

**Descripción**

Crear la lógica capaz de determinar si dos turnos ocupan períodos incompatibles, recibiendo `capacityPerSlot` como parámetro. No es booleano: contar turnos activos (`PENDIENTE` o `CONFIRMADO`) cuyo intervalo `tstzrange(fechaHoraInicio, fechaHoraFin)` se solapa (`&&`) con el solicitado y comparar `count < capacityPerSlot` (v1 = 1). Futuro: `capacityPerSlot` > 1 permite N solapamientos.

**Escenarios**

```text
Turno A 09:00 ───────── 10:00 (PENDIENTE)
Turno B 09:30 ───────── 10:30 (intento)
capacity=1 → SOLAPAMIENTO → rechazar
capacity=2 → aún hay lugar → permitir (futuro)
```

**Dependencias**

T-008, T-022 y T-019b (capacityPerSlot).

---

### T-024 — Implementar Availability Service

**Responsabilidades**

- Obtener horarios operativos (WorkshopConfig + intervalos).
- Generar slots parametrizados (pasar `service.durationMinutes` y `slotStepMinutes=30` a generación, filtrar `fin <= cierre`).
- Consultar turnos existentes activos.
- Detectar horarios ocupados contando solapamientos vs. `capacityPerSlot` (T-023).
- Devolver horarios disponibles.

**Dependencias**

T-020 a T-023 y T-019b. Debe recibir `service.durationMinutes` como input obligatorio.

---

### T-025 — Implementar API de disponibilidad

**Endpoint**

```text
GET /api/availability
```

**Parámetros**

```text
date
serviceId
```

**Dependencias**

T-024 y T-051 (autorización; si público para catálogo, documentar excepción, pero preferentemente requiere auth).

**Nota**

Debe pasar `serviceId → durationMinutes` a AvailabilityService para filtrado por duración.

---

### T-026 — Crear tests críticos de disponibilidad [EC-02]

**Trazabilidad:** `EC-02` — Sin disponibilidad → este test debe informar claramente "no hay disponibilidad" cuando no existen slots.

**Escenarios mínimos**

- Día sin turnos.
- Un turno existente (capacity 1 → slot ocupado).
- Turnos superpuestos con conteo vs. capacity.
- Servicio de una hora y de varias horas (filtrado por duración y cruce cierre).
- Horario fuera de apertura.
- Sin disponibilidad (`EC-02`).
- Slot que cruza cierre 11:30+90 → debe rechazarse (T-022b).

**Dependencias**

T-024 y T-025.

---

## 9. FASE 6 — Gestión de turnos

## Objetivo

Implementar el ciclo completo de vida de un turno.

---

### T-027 — Implementar Appointment Service

**Responsabilidades**

- Crear solicitudes.
- Consultar turnos.
- Confirmar turnos.
- Rechazar turnos.
- Cancelar turnos.

> Nota: No incluye completar turnos (`COMPLETADO` no existe en v1; estados terminales son `RECHAZADO`/`CANCELADO`).

**Dependencias**

T-024.

---

### T-028 — Implementar creación de turnos (transacción atómica bloqueante) [H-13]

**Flujo atómico (BEGIN; SELECT FOR UPDATE; validar; INSERT; COMMIT)**

```text
BEGIN ISOLATION REPEATABLE READ
  Validar datos + auth (authUser requerido)
  Validar vehículo pertenece a authUser (vehiculo.clienteId == authUser.id) → si no, FORBIDDEN
  Validar servicio.activo == true → si false, 400 VALIDATION_ERROR / INVALID_SERVICE [H-13]
  Validar servicio y calcular fechaHoraFin = fechaHoraInicio + durationMinutes
  Validar fechaHoraFin <= finIntervaloOperativo (no cruzar cierre)
  SELECT FOR UPDATE sobre turnos del slot (tstzrange && WHERE estado IN ('PENDIENTE','CONFIRMADO'))
  Contar solapamientos vs. capacityPerSlot (v1=1)
  Si count >= capacity → ROLLBACK + APPOINTMENT_NOT_AVAILABLE
  Sino INSERT turno PENDIENTE (TIMESTAMPTZ UTC)
COMMIT
```

Checklist H-13:

- [ ] `vehiculo pertenece a authUser` validado antes de disponibilidad.
- [ ] `servicio.activo == true` validado; test: reservar servicio inactivo → `VALIDATION_ERROR`.
- [ ] `vehículo ajeno` → `FORBIDDEN` (test en T-015/T-034).

Alternativa: `EXCLUDE USING gist (tstzrange(...) WITH &&) WHERE estado IN (...)` para capacity=1.

**Dependencias**

T-027 y T-051 (autorización) y T-019b (capacity, timezone).

---

### T-029 — Implementar control de concurrencia (parte de T-028, atómico)

**Problema**

Dos clientes pueden intentar reservar simultáneamente el último horario disponible (capacity=1).

**Objetivo**

Garantizar que validación y creación sean atómicas dentro de la misma transacción de T-028 (no separado). T-029 es bloqueante y no opcional: implementa `SELECT FOR UPDATE` / `SERIALIZABLE` o `EXCLUDE` constraint documentado en technical-spec.md §10.

**Test de concurrencia**

Agregar test con 2 workers paralelos intentando mismo slot: solo 1 debe succeed, el otro `APPOINTMENT_NOT_AVAILABLE`. Ver T-060.

**Dependencias**

T-028 (misma transacción, no tarea aislada posterior).

---

### T-030 — Implementar confirmación de turnos (matriz RN-07)

**Endpoint**

```text
PATCH /api/appointments/{id}/confirm
```

**Resultado esperado**

```text
PENDIENTE
    ↓
CONFIRMADO
```

Validar `AppointmentStateMachine.canTransition(PENDIENTE, CONFIRMADO, ADMINISTRADOR)` y rol ADMINISTRADOR. Transición inválida → `INVALID_APPOINTMENT_STATE`.

**Dependencias**

T-027 y T-035 (rol).

---

### T-031 — Implementar rechazo de turnos (matriz RN-07)

**Endpoint**

```text
PATCH /api/appointments/{id}/reject
```

**Resultado esperado**

```text
PENDIENTE
    ↓
RECHAZADO
```

Validar `canTransition(PENDIENTE, RECHAZADO, ADMINISTRADOR)` y rol ADMINISTRADOR. Transición inválida → `INVALID_APPOINTMENT_STATE`.

**Dependencias**

T-027 y T-035.

---

### T-032 — Implementar cancelación de turnos (matriz RN-07) [H-12]

**Endpoint**

```text
PATCH /api/appointments/{id}/cancel
```

**Validaciones (matriz) [RN-05 unificada]**

- `canTransition(estadoActual, CANCELADO, role)` según RN-07: `PENDIENTE→CANCELADO` y `CONFIRMADO→CANCELADO` permitidos; `RECHAZADO/CANCELADO` terminal.
- El turno debe pertenecer al usuario (`turno.clienteId == authUser.id`) o ser ADMINISTRADOR.
- `now < fechaHoraInicio` (zona `America/Argentina/Buenos_Aires`, comparando `TIMESTAMPTZ` en UTC). Si `now >= fechaHoraInicio`, rechazar con `INVALID_APPOINTMENT_STATE` y mensaje "El turno ya comenzó" [H-12].
- Casos borde UTC: turno `09:00` con `now==09:00:00` → rechazar; `09:00:01` → rechazar; `08:59` → permitir. Tests borde en T-034.
- Transición inválida → `INVALID_APPOINTMENT_STATE`.

**Dependencias**

T-027 y T-051 (propiedad del recurso).

---

### T-033 — Implementar consulta de turnos [H-11 / RN-04 / H-28]

**Endpoint**

```text
GET /api/appointments?status=&includeCancelled=false&includeRejected=false&from=&to=&date=&page=&limit=&sort=startAt:asc
GET /api/admin/appointments?date=YYYY-MM-DD&includeCancelled=false&includeRejected=false&page=&limit=&sort=startAt:asc
```

**Comportamiento**

- Un cliente consulta sus propios turnos (filtra por `authUser.id`).
- Un administrador puede consultar todos los turnos.
- Filtrado RN-04: Próximos turnos = solo `PENDIENTE|CONFIRMADO` con `fechaHoraInicio > now`; `CANCELADO`/`RECHAZADO` excluidos por defecto (`includeCancelled=false`, `includeRejected=false`).
- Validación: cliente ve solo activos; admin puede pedir `includeCancelled=true` para auditoría.
- Paginación (H-28): `?page=1&limit=20&sort=startAt:asc` (o `?limit=20&offset=0`), helper `paginate()` con validación `limit<=100`, envoltorio `{ data, pagination }`, orden `sort=startAt:asc` por defecto.

**Tests [H-11]**

- Cliente sin `includeCancelled` no ve `CANCELADO` ni `RECHAZADO`.
- `GET /api/appointments?includeCancelled=true` (dueño/admin) sí devuelve cancelados.
- `GET /api/appointments?status=CANCELADO&includeCancelled=true` filtra correctamente.
- Paginación `limit/offset/sort` con helper paginado (ver `technical-spec.md §8.5`).

**Dependencias**

T-027.

---

### T-034 — Crear tests del ciclo de vida del turno (matriz RN-07) [H-12, H-13, EC-03, EC-04]

**Trazabilidad:** `EC-03` cancelar pasado → aquí; `EC-04` rechazo visible → aquí.

**Escenarios (referencian matriz)**

```text
Crear → PENDIENTE → CONFIRMAR (ADMIN) → CONFIRMADO
Crear → PENDIENTE → CANCELAR (dueño) → CANCELADO
PENDIENTE → RECHAZADO (ADMIN)
CONFIRMADO → CANCELADO (dueño/ADMIN)
```

**Transiciones inválidas a probar**

- `CONFIRMADO → CONFIRMADO`, `RECHAZADO → CONFIRMADO`, `CANCELADO → CONFIRMADO`, `PENDIENTE → PENDIENTE` → `INVALID_APPOINTMENT_STATE`
- Cancelar turno pasado → `INVALID_APPOINTMENT_STATE` "El turno ya comenzó" [EC-03]
- `canTransition(from,to,role)` unit tests para cada celda de la matriz RN-07

**Tests borde H-12 (now < fechaHoraInicio UTC, America/Argentina/Buenos_Aires)**

- Turno `09:00` con `now=08:59:00-03:00` → permitir cancelación.
- `now=09:00:00-03:00` exacto → rechazar `INVALID_APPOINTMENT_STATE`.
- `now=09:00:01-03:00` → rechazar.

**Tests H-13**

- Reservar con `servicio.activo=false` → `400 VALIDATION_ERROR / INVALID_SERVICE`.
- Reservar con `vehiculo.clienteId != authUser.id` → `FORBIDDEN`.

**Tests H-11 / EC-04**

- Cliente consulta sin flags no ve `CANCELADO`/`RECHAZADO`; con `includeCancelled=true` sí (admin/dueño).
- `RECHAZADO` visible como no activo (EC-04).

**Dependencias**

T-028 a T-033.

---

## 10. FASE 7 — Administración

## Objetivo

Implementar las funcionalidades exclusivas del administrador (asume FASE 2.5 ya completada).

> Nota: T-035 (autorización por roles) ya fue implementado en FASE 2.5. No se duplica aquí; las tareas siguientes dependen de T-035 existente.
> Nota ownership (H-19): `T-036/T-037 delegan a AppointmentService; no duplican lógica de transición`. `AppointmentService` es el único dueño de `confirm/reject/cancel` + `canTransition`.

---

### T-036 — Implementar consulta de solicitudes pendientes (H-19)

El administrador deberá poder consultar todos los turnos con estado:

```text
PENDIENTE
```

**Detalle (H-19):** si `T-036` es solo query con filtro, reutiliza `T-033` con `param role=ADMIN` (`GET /api/appointments?status=PENDIENTE` vs `GET /api/admin/appointments?status=PENDIENTE`). No duplica lógica; delega lectura a `AppointmentQueryService` / `AppointmentService.query`.

**Dependencias**

T-033 y T-035.

---

### T-036b — Implementar modificación de disponibilidad (H-05)

**Descripción**

Implementar `PATCH /api/admin/schedule { dayOfWeek, openIntervals }` solo `ADMINISTRADOR`, persistiendo en `WorkshopConfig.horarioOperativo` (parametrizable, ejemplo `09:00-12:00 / 14:00-18:00` no hardcodeado). Validar intervalos no solapados, `start < end`, y que no rompan generación de slots. Ver `technical-spec.md §8.9`.

**Validación y tests**

- Intentar `PATCH` sin rol `ADMIN` → `FORBIDDEN` (`403`).
- Intervalos inválidos (solapados, `start >= end`) → `400 VALIDATION_ERROR`.
- Tras actualizar, `GET /api/availability` refleja nuevo horario; creación fuera de intervalo → `VALIDATION_ERROR`.
- Modificación afecta `finIntervaloOperativo` en T-022.

**Dependencias**

T-035 y T-019b.

---

### T-037 — Implementar agenda diaria [H-11 / H-27 / H-19 / H-28]

**Descripción**

Implementar agenda dedicada (delega lectura a `AppointmentService`; no duplica transición — H-19):

- Cliente: `GET /api/appointments?date=YYYY-MM-DD&page=&limit=&sort=startAt:asc` (filtra propios, `turno.clienteId == authUser.id`).
- Admin: `GET /api/admin/appointments?date=YYYY-MM-DD&includeCancelled=false&includeRejected=false&page=&limit=&sort=startAt:asc` o alias `GET /api/admin/agenda?date=` (todos, orden `sort=startAt:asc`).
- Por defecto solo activos (`PENDIENTE|CONFIRMADO`); flags `includeCancelled`/`includeRejected` permiten incluir.
- Paginación (H-28): `?page=1&limit=20&sort=startAt:asc` (o `?limit=&offset=`), helper paginado `paginate()` con `limit<=100`, sort whitelisteado, respuesta `{ data, pagination: { page, limit, total, totalPages } }`.

El administrador deberá poder consultar los turnos correspondientes a una fecha ordenados cronológicamente.

**Tests [H-11]**

- Cliente `?date=` no ve cancelados sin flag; con `includeCancelled=true` (admin) sí.
- Orden `startAt:asc` verificado.
- Paginación `limit/offset/sort` funciona (helper `paginate`).

**Dependencias**

T-033 y T-035.

---

### T-038 — Crear tests de permisos

**Escenarios**

- Un cliente no puede confirmar turnos.
- Un cliente no puede consultar todos los turnos.
- Un administrador puede confirmar.
- Un administrador puede consultar la agenda.

**Dependencias**

T-035.

---

## 11. FASE 8 — Interfaz de usuario

## Objetivo

Implementar la interfaz para clientes y administradores.

---

## Feature UI-01 — Gestión de vehículos

### T-039 — Crear pantalla de vehículos

El cliente deberá poder:

- Consultar sus vehículos.
- Registrar un vehículo.

**Dependencias**

T-014.

---

## Feature UI-02 — Consulta de servicios

### T-040 — Crear interfaz de selección de servicios

El cliente deberá poder visualizar y seleccionar un servicio.

**Dependencias**

T-017.

---

## Feature UI-03 — Reserva de turnos

### T-041 — Crear flujo de selección de fecha (H-25)

El cliente deberá poder seleccionar una fecha.

**Dependencias**

T-025 y T-040.

---

### T-042 — Mostrar disponibilidad

La interfaz deberá solicitar la disponibilidad al backend y mostrar únicamente los horarios disponibles.

**Dependencias**

T-025.

---

### T-043 — Crear formulario de reserva

El usuario deberá seleccionar:

```text
Vehículo
Servicio
Fecha
Horario
```

**Dependencias**

T-039, T-040 y T-042.

---

### T-044 — Mostrar resultado de la reserva

La interfaz deberá informar si:

```text
La solicitud fue creada
```

o si:

```text
El horario dejó de estar disponible
```

**Dependencias**

T-028 y T-043.

---

## Feature UI-04 — Próximos turnos

### T-045 — Crear pantalla de turnos

El cliente deberá poder visualizar:

- Fecha.
- Horario.
- Servicio.
- Vehículo.
- Estado.

**Dependencias**

T-033.

---

### T-046 — Implementar cancelación desde la interfaz

El cliente deberá poder cancelar un turno válido.

La interfaz deberá solicitar confirmación antes de realizar la operación.

**Dependencias**

T-032.

---

## Feature UI-05 — Panel administrativo

### T-047 — Crear vista de solicitudes pendientes

**Dependencias**

T-036.

---

### T-048 — Crear acciones de confirmación y rechazo

El administrador deberá poder:

- Confirmar.
- Rechazar.

**Dependencias**

T-030 y T-031.

---

### T-049 — Crear vista de agenda diaria

**Dependencias**

T-037.

---

## 12. FASE 9 — Seguridad y manejo de errores

## Objetivo

Garantizar que el sistema maneje correctamente los permisos y errores.

> Nota: T-050 y T-051 (autenticación y autorización de recursos) ya fueron implementados en FASE 2.5. Esta fase conserva solo el manejo de errores y tests de seguridad; no se duplica T-050/T-051.

---

### T-052 — Implementar estructura estándar de errores

Todos los errores deberán seguir una estructura consistente (validado por `T-013` y `T-028`).

Ejemplo:

```json
{
  "error": {
    "code": "APPOINTMENT_NOT_AVAILABLE",
    "message": "El horario seleccionado ya no se encuentra disponible."
  }
}
```

**Dependencias**

T-027 (usa catálogo `§12` de AppointmentService).

---

### T-053 — Crear tests de seguridad

**Escenarios**

- Usuario no autenticado.
- Usuario sin permisos.
- Acceso a recursos de otro usuario.
- Operación administrativa realizada por cliente.

**Dependencias**

T-051 y T-052.

---

## 13. FASE 10 — Observabilidad

## Objetivo

Registrar eventos relevantes para facilitar el diagnóstico del sistema.

---

### T-054 — Registrar eventos de turnos (H-21)

Registrar con `pino/winston` + `OpenTelemetry` (correlationId `x-correlation-id`):

- Creación / confirmación / rechazo / cancelación (`appointmentId, estado, actor`).

**Dependencias**

T-027.

---

### T-055 — Registrar conflictos de disponibilidad (H-21)

Registrar intentos fallidos de reserva por falta de disponibilidad (`APPOINTMENT_NOT_AVAILABLE`, `serviceId, date, slot`, `conflict rate` counter `appointments.conflicts_total`).

**Dependencias**

T-028.

---

### T-055b — Log auth/authorization failures (H-21)

Registrar `UNAUTHORIZED` (401) y `FORBIDDEN` (403) sin loguear `password`/`JWT raw`; incluir `correlationId, path, role`. Ver `technical-spec.md §13`.

**Dependencias**

T-050.

---

### T-056 — Registrar errores internos (H-21)

Registrar errores inesperados (5xx, stack, correlationId) sin exponer información sensible al usuario. Logs JSON estructurados.

**Dependencias**

T-052.

---

### T-056b — Métricas: availability latency, conflict rate (H-21)

Exponer métricas con `OpenTelemetry`: histogram `http_request_duration` para `GET /api/availability` (availability latency) y counter `appointments.conflicts_total` (conflict rate). Validar en tests de observabilidad.

**Dependencias**

T-024 y T-055.

---

## 14. FASE 11 — Testing end-to-end

## Objetivo

Validar los principales flujos completos.

---

### T-057 — Test E2E de reserva (H-25)

```text
Cliente
  ↓
Registra vehículo
  ↓
Selecciona servicio
  ↓
Selecciona fecha
  ↓
Consulta disponibilidad
  ↓
Selecciona horario
  ↓
Crea solicitud
```

**Dependencias**

T-027 y T-039.

---

### T-058 — Test E2E de confirmación (H-25)

```text
Solicitud pendiente
       ↓
Administrador consulta
       ↓
Administrador confirma
       ↓
Estado confirmado
```

**Dependencias**

T-030.

---

### T-059 — Test E2E de cancelación

```text
Cliente
  ↓
Consulta turno futuro
  ↓
Solicita cancelación
  ↓
Confirma
  ↓
Estado CANCELADO
```

**Dependencias**

T-032.

---

### T-060 — Test E2E de concurrencia (2 workers, capacity=1) [EC-01]

**Trazabilidad:** `EC-01` — race con `capacity=1` → este test es cobertura obligatoria de concurrencia real (no simulada secuencial).

Simular dos solicitudes simultáneas (2 workers paralelos) para el mismo slot horario con `capacityPerSlot=1`, ejercitando la transacción atómica de T-028/T-029 (`SELECT FOR UPDATE` / `SERIALIZABLE` o `EXCLUDE`).

**Resultado esperado**

Solo una reserva incompatible deberá completarse correctamente; la otra debe recibir `APPOINTMENT_NOT_AVAILABLE`. Ver también validación de T-029.

**Dependencias**

T-029.

---

## 15. FASE 12 — Validación final

## Objetivo

Verificar que la implementación cumple con las especificaciones funcionales y técnicas.

---

### T-061 — Validación contra functional-spec.md

Para cada requisito funcional deberá comprobarse que existe una implementación correspondiente.

Ejemplo:

```text
F-04 Solicitud de turno
        ↓
T-028 Creación de turnos
        ↓
T-043 Formulario de reserva
        ↓
T-057 Test E2E
```

**Dependencias**

T-057 a T-060.

---

### T-062 — Validación contra technical-spec.md

Verificar:

- Arquitectura.
- Separación de responsabilidades.
- Modelo de datos.
- APIs.
- Seguridad.
- Manejo de errores.
- Testing.

**Dependencias**

T-061.

---

### T-063 — Revisión de código

Revisar:

- Calidad.
- Mantenibilidad.
- Duplicación.
- Complejidad.
- Cumplimiento de convenciones.

**Dependencias**

T-062.

---

### T-064 — Validación de criterios de aceptación

Cada criterio definido en `functional-spec.md` deberá tener evidencia de validación.

**Dependencias**

T-063.

---

## 16. Orden de implementación (12 fases, auth temprano)

El orden recomendado será:

```text
T-001 → T-004          // FASE 1 Inicialización
        ↓
T-005 → T-010          // FASE 2 Modelo de datos
        ↓
T-050 → T-051 → T-035  // FASE 2.5 Autenticación y autorización (bloqueante para todo lo demás)
        ↓
T-011 → T-019 + T-019b // FASE 3-4 Clientes/Vehículos/Servicios + WorkshopConfig
        ↓
T-020 → T-026 (+ T-022b) // FASE 5 Disponibilidad (slots parametrizados, cruce cierre)
        ↓
T-027 → T-034 (T-028+T-029 atómicos) // FASE 6 Turnos con matriz y concurrencia
        ↓
T-036 → T-038          // FASE 7 Administración (depende de T-035 ya hecho)
        ↓
T-039 → T-049          // FASE 8 Interfaz
        ↓
T-052 → T-053 (+ T-054→T-056) // FASE 9-10 Seguridad (errores) y Observabilidad
        ↓
T-057 → T-060          // FASE 11 Testing E2E (incluye concurrencia 2 workers en T-060/T-029)
        ↓
T-061 → T-064          // FASE 12 Validación final
```

---

## 17. Dependencias críticas (12 fases)

Las siguientes tareas representan puntos importantes de dependencia:

```text
Modelo de datos (T-005→T-010)
       ↓
Autenticación y autorización (T-050→T-051→T-035) — bloquea todo acceso a recursos
       ↓
Servicios de negocio (T-011→T-019b)
       ↓
Disponibilidad (T-020→T-026, incluye T-019b capacity/step/timezone y T-022b cruce cierre)
       ↓
Creación de turnos atómica (T-027→T-029, SELECT FOR UPDATE / EXCLUDE, capacityPerSlot)
       ↓
Administración (T-036→T-038, matriz canTransition)
       ↓
Interfaz de reserva (T-039→T-049)
       ↓
Seguridad/Errores + Observabilidad (T-052→T-056)
       ↓
Testing E2E (T-057→T-060, concurrencia 2 workers)
       ↓
Validación final (T-061→T-064)
```

En particular, la funcionalidad de disponibilidad deberá estar validada antes de considerar terminada la creación de turnos, y la autenticación (FASE 2.5) debe completarse antes de FASE 3.

---

## 18. Definición de Done (SMART — checklist auditable) (H-22)

Una feature será considerada terminada únicamente cuando (evidencia medible):

- [ ] Funcionalidad implementada y deployable localmente (`npm run dev` + `npm run build` verde).
- [ ] `coverage >=80%` en reglas críticas (`AvailabilityService`, `AppointmentStateMachine`, `canTransition`, validación `now < fechaHoraInicio`) — reporte `npm run test:coverage`.
- [ ] Tests de integración verdes para la feature (`npm run test:integration`).
- [ ] OpenAPI validado (`npm run openapi:lint` sin errores) y contrato `§8` actualizado si aplica.
- [ ] Lint sin errores (`npm run lint` / `markdownlint` para docs).
- [ ] Manejo de errores con catálogo `§12` (`VALIDATION_ERROR`, `APPOINTMENT_NOT_AVAILABLE`, `INVALID_APPOINTMENT_STATE`, etc.) y respuesta `{ error: { code, message } }`.
- [ ] Logs verificados con `correlationId` (ver `§13` + `T-054→T-056b`, no PII sensible).
- [ ] Criterios de aceptación con evidencia (tabla `CA` + captura/test E2E que los cubre).
- [ ] Review de 1 senior (PR aprobado, checklist de convenciones y no duplicación `AppointmentService`).
- [ ] Documentación actualizada (`functional-spec.md` / `technical-spec.md` / `implementation-plan.md` si cambia contrato).

---

## 19. Trazabilidad completa

La trazabilidad del desarrollo deberá seguir esta cadena:

```text
REQUISITO FUNCIONAL
        ↓
DECISIÓN TÉCNICA
        ↓
FEATURE
        ↓
TAREA DE IMPLEMENTACIÓN
        ↓
CÓDIGO
        ↓
TEST
        ↓
VALIDACIÓN
```

Ejemplo:

```text
functional-spec.md
──────────────────
F-03 Consulta de disponibilidad

        ↓

technical-spec.md
─────────────────
Availability Service
+
API de disponibilidad
+
Detección de solapamientos

        ↓

implementation-plan.md
──────────────────────
T-020 Configurar horarios
T-021 Generar slots
T-022 Calcular duración
T-023 Detectar solapamientos
T-024 Availability Service
T-025 API
T-026 Tests

        ↓

IMPLEMENTACIÓN

        ↓

VALIDACIÓN
```

---

## 20. Resultado esperado

Al finalizar este plan, el sistema deberá permitir:

```text
CLIENTE
   │
   ├── Registrar vehículo
   │
   ├── Consultar servicios
   │
   ├── Consultar disponibilidad
   │
   ├── Solicitar turno
   │
   ├── Consultar turnos
   │
   └── Cancelar turno

ADMINISTRADOR
   │
   ├── Consultar solicitudes
   │
   ├── Confirmar turnos
   │
   ├── Rechazar turnos
   │
   └── Consultar agenda diaria
```

El sistema se considerará listo para la primera versión cuando todas las tareas críticas estén completadas y los criterios de aceptación definidos en `functional-spec.md` hayan sido validados.