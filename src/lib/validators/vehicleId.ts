/**
 * Client-safe Zod schemas + pure helpers for the vehicle selection UI
 * (T-043 PR1).
 *
 * - Pure: no `server-only`, no DB imports. Safe to ship to the browser bundle.
 * - English camelCase — mirrors `db/validators/vehiculo` (which uses Spanish
 *   DB keys) but is independent so the UI never pulls server-only modules.
 * - INV-08: snake_case/Spanish DB names (`marca`, `patente`, `cliente_id`)
 *   never appear on the wire — only camelCase English.
 *
 * `vehicleIdSchema` is the URL-state guard for `?vehicleId=`. Tampered or
 * non-UUID input fails `safeParse` and the caller MUST fall back to
 * "no selection" instead of throwing or 500-ing (spec scenario: "Tampered
 * / foreign vehicle").
 *
 * `isOwner` mirrors the server-side ownership rule (INV-03): the UI must
 * never trust a `?vehicleId=` that does not belong to the signed-in user.
 * Defense in depth — the RSC already filtered the list, but the island
 * re-runs the check so client navigation never desyncs.
 */
import { z } from "zod";

/**
 * UUID guard for `?vehicleId=` search params. Mirrors `serviceIdSchema`
 * (T-040/T-041) and `slotSchema` (T-042) — same pattern, same intent.
 */
export const vehicleIdSchema = z.string().uuid();

/**
 * Minimal shape required to evaluate the ownership rule. We accept a
 * structural type (not the full `VehicleDTOJson`) so this module has no
 * import on `lib/api/vehicles` and ships to the client bundle free of
 * cross-layer coupling.
 */
export interface OwnedVehicleLike {
  id: string;
  customerId: string;
}

/**
 * Returns `true` when the vehicle belongs to the signed-in user.
 *
 * INV-03 ownership golden rule: `vehiculo.clienteId === authUser.id`.
 * The page already filters with `listVehiclesByCustomer(db, session.user.id)`,
 * but the client island re-runs the same check so a tampered URL like
 * `?vehicleId=<uuid-of-someone-elses-car>` collapses to `null` instead of
 * highlighting the wrong card.
 */
export function isOwner(
  vehicle: OwnedVehicleLike,
  userId: string,
): boolean {
  return vehicle.customerId === userId;
}
