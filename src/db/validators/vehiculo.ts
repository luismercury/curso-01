import { z } from "zod";

/**
 * Validation mirrors DB CHECKs (vehiculos_patente_format, vehiculos_anio_range).
 * DB enforces patente regex `^[A-Z0-9]{6,7}$` and `anio BETWEEN 1900 AND extract(year from now())+1`.
 * App-level Zod mirrors those DB constraints for early feedback and dual-defense
 * normalization (RSK-04). See src/db/schema.ts vehiculos definition.
 *
 * normalizePatente is exported so repositories can apply it pre-insert as a
 * second defense layer (RSK-04): callers bypassing Zod still store
 * normalized plates, keeping the global UNIQUE constraint deterministic.
 */
export function normalizePatente(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}

const patenteSchema = z
  .string()
  .transform(normalizePatente)
  .refine((plate) => /^[A-Z0-9]{6,7}$/.test(plate), {
    message: "Patente must be 6-7 alphanumeric characters after normalization",
  });

export const vehiculoInputSchema = z.object({
  clienteId: z.uuid(),
  marca: z.string().trim().min(2).max(100),
  modelo: z.string().trim().min(2).max(100),
  anio: z
    .number()
    .int()
    .min(1900, "Year must be 1900 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be more than next year"),
  patente: patenteSchema,
});

export type VehicleInput = z.infer<typeof vehiculoInputSchema>;
