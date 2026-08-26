import { z } from "zod";

/**
 * App-level validation only (REQ-SRV-02): no DB CHECK constraints.
 * CHECKs for duracionMinutos %5 and length bounds are deferred to T-009.
 */
export const servicioInputSchema = z.object({
  nombre: z.string().trim().min(1, "Name must not be empty").max(100),
  descripcion: z.string().trim().max(500).optional().nullable(),
  duracionMinutos: z
    .number()
    .int()
    .min(30, "Duration must be at least 30 minutes")
    .max(120, "Duration must be at most 120 minutes")
    .refine((v) => v % 5 === 0, {
      message: "Duration must be a multiple of 5",
    }),
  activo: z.boolean().optional().default(true),
});

export type ServicioInput = z.infer<typeof servicioInputSchema>;
