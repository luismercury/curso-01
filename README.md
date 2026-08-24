# curso-01 — AutoService · Sistema de Reservas de Turnos

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)

Sistema de reservas para taller mecánico. Permite a clientes registrar vehículos, consultar disponibilidad en tiempo real y reservar turnos evitando superposiciones por capacidad y duración del servicio.

> Repositorio privado: [github.com/luismercury/curso-01](https://github.com/luismercury/curso-01) · Baseline `44b09fd` en `master` · Specs certificados APTO.

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js App Router + TypeScript |
| Backend | Next.js API Routes / Server Actions + TypeScript |
| Base de datos | PostgreSQL (`TIMESTAMPTZ` en UTC) |
| Auth | Auth.js (NextAuth) + JWT en httpOnly cookie + bcrypt |
| ORM | Prisma / Drizzle |
| Validación | Zod (DTOs con mapeo `snake_case` ↔ `camelCase`) |

## Estructura del repositorio

| Archivo | Descripción |
|---------|-------------|
| `Functional-Spec.md` (535L) | Reglas de negocio, RN-01..RN-07 y modelo de dominio |
| `Technical-spec.md` (1144L) | Arquitectura, esquema de BD, contratos de API y NFRs |
| `implementation-plan.md` (1743L) | Plan en 12 fases + sub-fase 2.5, 64 tareas (T-001..T-064) y DAG |
| `AGENTS.md` (97L) | Contrato de ejecución para agentes — invariantes y orden |
| `README.md` | Este archivo — índice liviano, no duplica los specs |

## Invariantes críticas

> Resumen en una línea. El detalle normativo está en `AGENTS.md` y los specs.

- **INV-01 Capacity:** `capacityPerSlot = 1` y `slotStepMinutes = 30` vía `WorkshopConfig`; solapamiento con `tstzrange &&` (count-based).
- **INV-02 States:** Solo `PENDIENTE / CONFIRMADO / RECHAZADO / CANCELADO`; transiciones por `canTransition(from, to, role)` (RN-07).
- **INV-03 Auth:** Auth.js con JWT + bcrypt; endpoints `POST /api/auth/register` y `POST /api/auth/login`; ownership `vehiculo.clienteId == authUser.id`.
- **INV-04 Concurrency:** Transacción `REPEATABLE READ` + `SELECT FOR UPDATE` con `tstzrange &&` + `EXCLUDE USING gist`.
- **INV-05 Slots vs Duration:** Slots cada 30 min filtrados por `durationMinutes`; valida `fechaHoraFin <= finIntervaloOperativo`.
- **INV-06 Timezone:** BD en `TIMESTAMPTZ` UTC; API recibe ISO 8601 con timezone y convierte; `timezone = America/Argentina/Buenos_Aires`.
- **INV-07 Phases:** 12 fases + sub-fase 2.5 = 13 bloques; DAG sin ciclos.
- **INV-08 Naming:** BD `snake_case` / API `camelCase` en inglés (`marca→brand`, `patente→plate`, `fechaHoraInicio→startDateTime`); mappers obligatorios.

## Orden de implementación

```
T-001 → T-004           Setup & Tooling
T-005 → T-010           Domain Model & WorkshopConfig
T-050 → T-051 → T-035   FASE 2.5 Auth — BLOQUEANTE antes de FASE 3
T-011 → T-019b          FASE 3 Vehículos
T-020 → T-026 (+T-022b)  FASE 4 Servicios
T-027 → T-034           FASE 5 Slots & Booking (T-028 + T-029 atómicos)
T-036 → T-038           FASE 6 Dashboard
T-039 → T-049           FASE 7-8 Políticas & UX
T-052 → T-056b          FASE 9 Observability
T-057 → T-060           FASE 10 Hardening
T-061 → T-064           FASE 11-12 QA & Release
```

No iniciar una fase si su predecesora está incompleta. `implementation-plan.md` es autoridad del DAG.

## Setup rápido

```bash
# 1. Clonar (repo privado)
git clone https://github.com/luismercury/curso-01.git
cd curso-01

# 2. Dependencias
npm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env:
# DATABASE_URL="postgresql://user:password@localhost:5432/autoservice?schema=public"
# AUTH_SECRET="generar con: openssl rand -base64 32"

# 4. Base de datos
npx prisma migrate dev
# o: npx drizzle-kit push

# 5. Desarrollo
npm run dev      # http://localhost:3000

# 6. Tests
npm test
```

Requiere Node.js 20+ y PostgreSQL 16+.

## Scripts esperados

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo (Next.js) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm test` | Tests unitarios y de integración |
| `npm run test:e2e` | Tests end-to-end (Playwright) |
| `npm run lint` | Linter + typecheck |

> Los scripts se consolidan en FASE 1 (T-001..T-004). Esta tabla define el contrato esperado.

## Convenciones

- **Commits:** Conventional Commits en inglés (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`). Un commit = una unidad lógica (código + tests + docs).
- **Contrato:** `AGENTS.md` es el contrato de ejecución. Si hay conflicto con este README, prevalecen los specs y `AGENTS.md`.
- **Idioma:** Código, API y commits en inglés; documentación del dominio puede preservar términos `vehículo`, `turno`, `taller` donde aporte claridad.

## Trazabilidad

Las fuentes de verdad certificadas son:

1. `Functional-Spec.md` — reglas de negocio
2. `Technical-spec.md` — arquitectura y contratos
3. `implementation-plan.md` — plan y DAG

Este README es solo un índice liviano y no duplica su contenido. Cualquier cambio en invariantes, estados o capacidad debe reflejarse primero en los specs.

## Licencia

MIT — ver `LICENSE` si aplica.

> Detalle de invariantes y orden de ejecución: [AGENTS.md](./AGENTS.md)
