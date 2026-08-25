import { z } from "zod";

/**
 * App-level validation only (REQ-CLIENTE-10): no DB CHECK constraints.
 * CHECKs for telefono/nombre are deferred to T-009 hardening.
 */
export const clienteInputSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  apellido: z.string().trim().min(2).max(100),
  telefono: z.string().regex(/^\+?[0-9\s\-]{7,20}$/),
  email: z.email(),
});

export type ClienteInput = z.infer<typeof clienteInputSchema>;
