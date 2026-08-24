# Functional Specification — Sistema de Reservas de Turnos

## 1. Contexto

El taller mecánico **AutoService** actualmente gestiona los turnos de sus clientes mediante llamadas telefónicas y mensajes de WhatsApp.

Este proceso presenta dificultades para conocer la disponibilidad real del taller, evitar superposición de turnos y permitir que los clientes consulten o modifiquen sus reservas.

Se requiere crear un sistema que permita gestionar digitalmente la reserva de turnos para los servicios ofrecidos por el taller.

---

## 2. Problema a resolver

Actualmente, la asignación manual de turnos puede provocar:

- Superposición de reservas.
- Errores en la disponibilidad informada a los clientes.
- Dificultad para consultar rápidamente los turnos programados.
- Pérdida de tiempo administrativo.
- Falta de una forma sencilla para que el cliente consulte o cancele su turno.

El sistema deberá centralizar la gestión de los turnos y mantener actualizada la disponibilidad.

---

## 3. Objetivo

Permitir que los clientes puedan consultar la disponibilidad del taller y solicitar un turno para un servicio determinado.

El personal del taller deberá poder administrar los turnos, confirmar solicitudes, cancelar reservas y consultar la agenda diaria.

---

## 4. Alcance

La primera versión del sistema deberá permitir:

- Registrar clientes.
- Registrar vehículos asociados a cada cliente.
- Consultar los servicios disponibles.
- Consultar fechas y horarios disponibles.
- Solicitar un turno.
- Confirmar o rechazar una solicitud de turno.
- Consultar los próximos turnos.
- Cancelar un turno.
- Consultar la agenda diaria del taller.
- Evitar que dos clientes tengan reservado el mismo horario cuando la capacidad disponible no lo permita.

> **Nota — Horario operativo:** Horario operativo a confirmar con stakeholders; ejemplo `09:00-12:00 / 14:00-18:00` configurable, parametrizable vía `WorkshopConfig`, no hardcodeado. Validar con negocio. Ejemplo configurable, validar con negocio, parametrizable vía WorkshopConfig, no hardcodeado.

---

## 5. Fuera de alcance

La primera versión **no incluirá**:

- Pagos en línea.
- Facturación.
- Integración con compañías de seguros.
- Compra de repuestos.
- Seguimiento de reparaciones.
- Comunicación automática mediante WhatsApp.
- Gestión de inventario.
- Aplicación móvil nativa.

Estas funcionalidades podrán ser consideradas en futuras versiones.

---

## 6. Usuarios o actores

### 6.1 Cliente

El cliente podrá:

- Consultar los servicios disponibles.
- Consultar fechas y horarios disponibles.
- Solicitar un turno.
- Consultar sus próximos turnos.
- Cancelar un turno.

### 6.2 Administrador del taller

El administrador podrá:

- Consultar todas las solicitudes de turno.
- Confirmar o rechazar una solicitud.
- Cancelar un turno.
- Consultar la agenda diaria.
- Modificar la disponibilidad general del taller.

> **Nota H-05 — Modificar disponibilidad general:** esta funcionalidad se implementa vía `PATCH /api/admin/schedule` (solo rol `ADMINISTRADOR`) y está cubierta por `WorkshopConfig` / horario operativo. Permite actualizar intervalos por `dayOfWeek` con `openIntervals` (ej. `09:00-12:00 / 14:00-18:00` como ejemplo configurable, no hardcodeado). No se mueve a Fuera de alcance; se formaliza como capacidad administrativa. Ver `technical-spec.md §8.9` y `implementation-plan.md T-036b`.

---

### 6.3 Autenticación y autorización

El sistema deberá implementar autenticación para identificar al usuario que realiza cada operación.

Roles definidos:

- `CLIENTE`: puede gestionar únicamente sus propios recursos (vehículos, turnos).
- `ADMINISTRADOR`: puede gestionar todos los turnos y la agenda del taller.

Funcionalidades de autenticación:

- Registro de usuario (`POST /api/auth/register`).
- Inicio de sesión (`POST /api/auth/login`) con sesión basada en JWT en cookie `httpOnly`.

Reglas:

- Todo endpoint requiere autenticación, salvo `GET /api/services` que puede ser público para consulta de catálogo (si aplica); el resto exige usuario autenticado.
- Un cliente solo puede acceder y operar sobre recursos donde `recurso.clienteId == authUser.id` (vehículos y turnos propios). El backend debe validar esta propiedad en cada operación.
- Un administrador accede a todos los turnos y puede ejecutar confirmación/rechazo y consulta de agenda.

---

## 7. Features

### F-00 — Autenticación

El sistema deberá permitir el registro y el inicio de sesión de usuarios con roles `CLIENTE` y `ADMINISTRADOR`. Todas las operaciones de turnos, vehículos y agenda requieren usuario autenticado; el cliente solo accede a sus propios recursos y el administrador a todos.

---

### F-01 — Consulta de servicios

El sistema deberá mostrar los servicios disponibles para reservar.

Cada servicio deberá incluir:

- Nombre.
- Descripción.
- Duración estimada.

---

### F-02 — Registro de vehículo

El cliente deberá poder registrar uno o más vehículos.

Para cada vehículo se deberá registrar, como mínimo:

- Marca.
- Modelo.
- Año.
- Patente.

Un cliente podrá tener varios vehículos asociados.

---

### F-03 — Consulta de disponibilidad

El cliente deberá poder seleccionar una fecha y consultar los horarios disponibles.

El sistema solo deberá mostrar horarios que puedan ser reservados.

Los horarios no disponibles no deberán poder ser seleccionados.

---

### F-04 — Solicitud de turno

El cliente deberá poder solicitar un turno seleccionando:

- Un vehículo.
- Un servicio.
- Una fecha.
- Un horario disponible.

Una vez enviada la solicitud, el sistema deberá informar al cliente que la reserva fue registrada.

---

### F-05 — Confirmación de turno

El administrador deberá poder revisar las solicitudes pendientes.

Para cada solicitud podrá:

- Confirmarla.
- Rechazarla.

El estado final deberá quedar disponible para su consulta por parte del cliente.

---

### F-06 — Consulta de próximos turnos

El cliente deberá poder consultar sus próximos turnos.

Para cada turno deberá visualizar:

- Fecha.
- Horario.
- Servicio solicitado.
- Vehículo.
- Estado del turno.

---

### F-07 — Cancelación de turno

El cliente podrá cancelar un turno que todavía no haya comenzado.

Una vez cancelado, el horario deberá volver a estar disponible, siempre que no exista otra restricción que impida su reserva.

---

### F-08 — Agenda diaria

El administrador deberá poder consultar los turnos correspondientes a una fecha determinada.

La agenda deberá mostrar los turnos ordenados cronológicamente.

Para cada turno deberá ser posible identificar:

- Horario.
- Cliente.
- Vehículo.
- Servicio.
- Estado.

---

### F-09 — Registro de cliente (H-23)

El sistema deberá permitir el registro de un cliente vía `POST /api/customers` con payload `{ nombre, apellido, email, telefono, password }`.

Campos y validaciones:

- `nombre, apellido` requeridos (2..100 chars, trim no vacío).
- `email` requerido, formato email válido, **único** (colisión → error `EMAIL_ALREADY_EXISTS` / `VALIDATION_ERROR` 409).
- `telefono` requerido, formato validado `^\+?[0-9\s\-]{7,20}$`.
- `password` requerido, mínimo 8 caracteres (hasheado con `bcrypt`, nunca expuesto).

Notas:

- `POST /api/customers` es el contrato funcional para crear cliente; `POST /api/auth/register` (F-00) es alias compatible que reutiliza mismas validaciones y crea `User` con `role=CLIENTE` (ADMIN por seed). No queda gap: ambos endpoints cubren registro.
- Respuesta `201` expone solo `{ id, nombre, apellido, email, telefono }`.
- Ver `technical-spec.md §8.1b` para contrato técnico y `implementation-plan.md T-011/T-013`.

---

## 8. Flujos funcionales

### FL-01 — Reserva de un turno

1. El cliente accede al sistema.
2. El cliente selecciona un vehículo.
3. El cliente selecciona el servicio requerido.
4. El cliente selecciona una fecha.
5. El sistema muestra los horarios disponibles.
6. El cliente selecciona un horario.
7. El cliente confirma la solicitud.
8. El sistema registra el turno con estado `PENDIENTE`.
9. El sistema informa al cliente que la solicitud fue registrada.

> Nota (H-29): estados en `UPPER_SNAKE` (`PENDIENTE`, `CONFIRMADO`, `RECHAZADO`, `CANCELADO`), enum TypeScript `AppointmentStatus`. No usar capitalizado `Pendiente`.

---

### FL-01b — Reserva con conflicto EC-01 (race) (H-26)

Flujo alternativo de FL-01 cuando dos clientes compiten por el último slot con `capacityPerSlot=1`:

1. Cliente A y B consultan disponibilidad para mismo `date/serviceId` y ven slot `10:00` libre.
2. Ambos envían `POST /api/appointments { vehicleId, serviceId, startDateTime: 10:00 }` casi simultáneo.
3. Backend ejecuta transacción atómica con `SELECT ... FOR UPDATE` / `EXCLUDE` (ver `technical-spec.md §10`).
4. Solo la primera transacción hace `count < capacity` → `INSERT PENDIENTE` → `201`.
5. La segunda ve `count >= capacity` → `409 APPOINTMENT_NOT_AVAILABLE` con mensaje "El horario seleccionado ya no se encuentra disponible".
6. Estado final: un turno `PENDIENTE`, el otro cliente debe reintentar otro horario.

---

### FL-02 — Confirmación de una solicitud

1. El administrador consulta las solicitudes pendientes.
2. El administrador selecciona una solicitud.
3. El administrador revisa los datos.
4. El administrador confirma la solicitud.
5. El sistema actualiza el estado del turno a `CONFIRMADO`.
6. El turno pasa a formar parte de la agenda confirmada.

---

### FL-02b — Rechazo de una solicitud (H-26)

Flujo alternativo de FL-02:

1. El administrador consulta solicitudes `PENDIENTE`.
2. Selecciona una solicitud y revisa datos.
3. Ejecuta `PATCH /api/appointments/{id}/reject` (solo `ADMINISTRADOR`, valida `canTransition(PENDIENTE, RECHAZADO)`).
4. El sistema actualiza estado a `RECHAZADO` (terminal).
5. El cliente consulta sus turnos: el turno rechazado no aparece como activo (filtrado RN-04); con `?includeRejected=true` lo ve como `RECHAZADO`.

---

### FL-03 — Cancelación de un turno

1. El cliente consulta sus próximos turnos.
2. El cliente selecciona un turno.
3. El cliente solicita su cancelación.
4. El sistema solicita confirmación.
5. El cliente confirma la cancelación.
6. El sistema actualiza el estado del turno a `CANCELADO`.
7. El horario vuelve a estar disponible cuando corresponda.

---

### FL-03b — Cancelación por administrador (H-26)

Flujo alternativo de FL-03 ejecutado por `ADMINISTRADOR`:

1. El administrador consulta la agenda del día (`GET /api/admin/appointments?date=YYYY-MM-DD`).
2. Selecciona un turno `PENDIENTE` o `CONFIRMADO` con `fechaHoraInicio > now`.
3. Ejecuta `PATCH /api/appointments/{id}/cancel` con rol `ADMINISTRADOR` (valida `canTransition(estadoActual, CANCELADO, ADMINISTRADOR)` y `now < fechaHoraInicio`).
4. El sistema actualiza a `CANCELADO` (terminal) y libera el slot (`count < capacity`).
5. Si `now >= fechaHoraInicio` → rechaza con `INVALID_APPOINTMENT_STATE` "El turno ya comenzó".

---

## 9. Casos de uso

### CU-01 — Cliente solicita un turno

**Actor principal:** Cliente.

**Precondiciones:**

- El cliente debe tener al menos un vehículo registrado.
- Debe existir disponibilidad para el servicio solicitado.

**Resultado esperado:**

- El sistema registra una nueva solicitud de turno.

---

### CU-02 — Administrador confirma un turno

**Actor principal:** Administrador.

**Precondiciones:**

- Debe existir una solicitud pendiente.

**Resultado esperado:**

- El turno cambia a estado `CONFIRMADO`.

---

### CU-03 — Cliente cancela un turno

**Actor principal:** Cliente.

**Precondiciones:**

- Debe existir un turno futuro asociado al cliente.

**Resultado esperado:**

- El turno cambia a estado `CANCELADO`.

---

## 10. Reglas de negocio

### RN-01 — Un turno corresponde a un vehículo

Cada turno deberá estar asociado a un único vehículo.

---

### RN-02 — Un turno corresponde a un servicio

Cada turno deberá corresponder a un servicio determinado.

---

### RN-03 — No se deben producir superposiciones no permitidas (capacidad cuantificada)

Capacidad v1 = 1 turno simultáneo por slot horario. Futuro: configurable vía `WorkshopConfig.capacityPerSlot`.

El sistema no deberá permitir reservas que excedan `capacityPerSlot` para un horario determinado. En v1, si un turno activo (`PENDIENTE` o `CONFIRMADO`) ya ocupa el slot, cualquier intento adicional en el mismo slot debe ser rechazado. La capacidad se evalúa contando turnos activos cuyo intervalo `[fechaHoraInicio, fechaHoraFin)` se solapa con el slot solicitado.

---

### RN-04 — Un turno cancelado no debe considerarse activo (filtrado F-06/F-08)

Un turno cuyo estado sea `CANCELADO` no deberá aparecer como turno activo del cliente.

Próximos turnos (F-06) = solo `PENDIENTE` | `CONFIRMADO` con `fechaHoraInicio > now` (zona `America/Argentina/Buenos_Aires`, comparación en UTC `TIMESTAMPTZ`). `CANCELADO` y `RECHAZADO` no se listan como activos.

Agenda diaria (F-08) por defecto solo activos (`PENDIENTE` | `CONFIRMADO`), con flags `?includeCancelled=false` y `?includeRejected=false`. Para incluirlos, el cliente/admin debe solicitar explícitamente `includeCancelled=true` / `includeRejected=true`.

---

### RN-05 — Los turnos pasados no pueden ser cancelados (definición unificada con timezone)

Un turno solo puede cancelarse si `now < fechaHoraInicio` (zona `America/Argentina/Buenos_Aires`, comparando `TIMESTAMPTZ` en UTC). Si `now >= fechaHoraInicio`, rechazar con `INVALID_APPOINTMENT_STATE` y mensaje "El turno ya comenzó".

Casos borde: `now == 09:00:00` para turno `09:00` → rechazar; `09:00:01` → rechazar; `08:59` → permitir. La validación usa `WorkshopConfig.timezone` y `fechaHoraInicio` en UTC.

---

### RN-06 — Los horarios deben respetar la duración del servicio

La disponibilidad deberá considerar la duración estimada del servicio solicitado. Un slot de inicio solo es válido si `fechaHoraFin = fechaHoraInicio + durationMinutes` cumple `fechaHoraFin <= finIntervaloOperativo` y no cruza el cierre (ej.: servicio de 90 min iniciado a 11:30 con cierre 12:00 debe rechazarse).

---

### RN-07 — Transiciones de estado permitidas (matriz)

Estados: `PENDIENTE`, `CONFIRMADO`, `RECHAZADO`, `CANCELADO` (no existe `COMPLETADO` en v1).

| Estado origen | Estado destino | Quién puede ejecutar | Condición |
|---|---|---|---|
| `PENDIENTE` | `CONFIRMADO` | ADMINISTRADOR | Solicitud pendiente válida |
| `PENDIENTE` | `RECHAZADO` | ADMINISTRADOR | Solicitud pendiente válida |
| `PENDIENTE` | `CANCELADO` | CLIENTE (dueño) o ADMINISTRADOR | Turno futuro (`fechaHoraInicio > now`) |
| `CONFIRMADO` | `CANCELADO` | CLIENTE (dueño) o ADMINISTRADOR | Turno futuro (`fechaHoraInicio > now`) |
| `RECHAZADO` | — | — | Terminal, sin transiciones |
| `CANCELADO` | — | — | Terminal, sin transiciones |

Toda transición debe validarse con `canTransition(from, to, role)` y respetar autorización sobre el recurso (`turno.clienteId == authUser.id` para cliente). Transiciones no listadas son inválidas y deben responder `INVALID_APPOINTMENT_STATE`.

---

## 11. Criterios de aceptación

### CA-01 — Consulta de disponibilidad

**Dado** que un cliente selecciona una fecha y un servicio,

**cuando** existen horarios disponibles,

**entonces** el sistema deberá mostrar únicamente los horarios que puedan ser reservados.

---

### CA-02 — Prevención de superposición (capacidad = 1 en v1)

**Dado** que un horario ya tiene 1 turno activo (`PENDIENTE` o `CONFIRMADO`) y `capacityPerSlot = 1`,

**cuando** otro cliente intenta reservar ese mismo slot horario,

**entonces** el sistema no deberá permitir completar la reserva y deberá responder con error `APPOINTMENT_NOT_AVAILABLE`.

---

### CA-03 — Confirmación de turno

**Dado** que existe una solicitud pendiente,

**cuando** el administrador la confirma,

**entonces** el estado del turno deberá cambiar a `CONFIRMADO`.

---

### CA-04 — Cancelación

**Dado** que un cliente tiene un turno futuro,

**cuando** solicita y confirma su cancelación,

**entonces** el estado del turno deberá cambiar a `CANCELADO`.

---

### CA-05 — Consulta de agenda

**Dado** que el administrador selecciona una fecha,

**cuando** existen turnos programados para ese día,

**entonces** el sistema deberá mostrarlos ordenados por horario.

---

## 12. Edge Cases

### EC-01 — El horario deja de estar disponible durante la reserva (capacidad = 1)

Si dos clientes intentan reservar el último lugar disponible para un mismo horario y `capacityPerSlot = 1`, solamente una de las reservas podrá ser aceptada (la que complete primero la transacción atómica).

El otro cliente deberá ser informado de que el horario ya no se encuentra disponible (`APPOINTMENT_NOT_AVAILABLE`).

---

### EC-02 — No existen horarios disponibles

Si no existen horarios disponibles para la fecha seleccionada, el sistema deberá informar claramente que no hay disponibilidad.

---

### EC-03 — El cliente intenta cancelar un turno pasado

El sistema no deberá permitir la cancelación.

El cliente deberá recibir un mensaje indicando que el turno ya no puede ser cancelado.

---

### EC-04 — El administrador rechaza una solicitud

Cuando una solicitud sea rechazada, el cliente deberá poder identificar que el turno no fue confirmado.

---

## 13. Resultado esperado de la primera versión

Al finalizar la primera versión, el sistema deberá permitir gestionar el ciclo completo de una reserva:

```text
Consulta
   ↓
Selección de servicio
   ↓
Selección de fecha y horario
   ↓
Solicitud
   ↓
Confirmación o rechazo
   ↓
Turno confirmado
   ↓
Atención o cancelación
```

La funcionalidad deberá permitir al cliente reservar y gestionar sus turnos, mientras que el administrador deberá poder controlar la disponibilidad y consultar la agenda del taller.