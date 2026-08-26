import { z } from "zod";

/**
 * App-level validation only (R3,R4): no DB CHECK constraints.
 * CHECKs for estado and interval coherence are deferred to T-009.
 * estado is varchar(20) with strict UPPER_SNAKE enum (INV-02).
 */
export const turnoInputSchema = z
  .object({
    clienteId: z.string().uuid(),
    vehiculoId: z.string().uuid(),
    servicioId: z.string().uuid(),
    fechaHoraInicio: z.coerce.date(),
    fechaHoraFin: z.coerce.date(),
    estado: z.enum(["PENDIENTE", "CONFIRMADO", "RECHAZADO", "CANCELADO"]),
  })
  .refine((data) => data.fechaHoraFin > data.fechaHoraInicio, {
    message: "fechaHoraFin must be after fechaHoraInicio",
    path: ["fechaHoraFin"],
  });

export type TurnoInput = z.infer<typeof turnoInputSchema>;
