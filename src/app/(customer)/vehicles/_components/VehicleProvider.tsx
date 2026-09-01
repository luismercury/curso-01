"use client";
/**
 * VehicleProvider — compound context owner for `/vehicles` (T-039 PR2).
 * Owns mutation state. List is server-rendered and reconciled via the
 * `initialVehicles` prop + `router.refresh()` after a successful create.
 *
 * Error mapping in `createVehicle`:
 *   201  → optimistic local append + `router.refresh()`
 *   401  → `router.push('/login')`
 *   403  → banner (kind: 'forbidden')
 *   400  → re-throw `ApiError` so `VehicleForm` maps issues → field
 *   409  → re-throw `ApiError` so `VehicleForm` maps to plate field
 *   other→ banner (kind: 'other' | 'network')
 *
 * Composition: `VehicleProvider.List` / `VehicleProvider.Form` consume via
 * `use(VehicleContext)` (React 19). No boolean props anywhere.
 * INV-03: `customerId` always server-derived. INV-08: camelCase + ISO only.
 */
import { createContext, use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, type VehicleCreatePayload } from "@/lib/validators/vehicle";
import { createVehicle as createVehicleRequest, type VehicleDTOJson } from "@/lib/api/vehicles";
import { VehicleList } from "./VehicleList";
import { VehicleForm } from "./VehicleForm";

export type BannerErrorKind = "forbidden" | "other" | "network";
export interface BannerError { kind: BannerErrorKind; message: string; }

export interface VehicleContextValue {
  customerId: string;
  maxYear: number;
  vehicles: VehicleDTOJson[];
  isPending: boolean;
  error: BannerError | null;
  createVehicle: (payload: VehicleCreatePayload) => Promise<void>;
  resetError: () => void;
}

const VehicleContext = createContext<VehicleContextValue | null>(null);

export function useVehicleContext(): VehicleContextValue {
  const ctx = use(VehicleContext);
  if (!ctx) throw new Error("useVehicleContext must be used inside <VehicleProvider>");
  return ctx;
}

interface VehicleProviderProps {
  customerId: string;
  maxYear: number;
  initialVehicles: VehicleDTOJson[];
  children: React.ReactNode;
}

export function VehicleProviderImpl({ customerId, maxYear, initialVehicles, children }: VehicleProviderProps) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleDTOJson[]>(initialVehicles);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<BannerError | null>(null);

  // Reconcile when RSC shell refetches (after router.refresh()).
  useEffect(() => { setVehicles(initialVehicles); }, [initialVehicles]);

  const resetError = useCallback(() => setError(null), []);

  const createVehicle = useCallback(async (payload: VehicleCreatePayload): Promise<void> => {
    setIsPending(true);
    setError(null);
    try {
      const dto = await createVehicleRequest({ customerId, payload });
      setVehicles((curr) => [...curr, dto]);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) { router.push("/login"); return; }
        if (err.status === 403) { setError({ kind: "forbidden", message: err.message }); return; }
        if (err.status === 400 || err.status === 409) throw err; // form handles field-level
        setError({ kind: "other", message: err.message });
        return;
      }
      setError({ kind: "network", message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setIsPending(false);
    }
  }, [customerId, router]);

  const value: VehicleContextValue = {
    customerId, maxYear, vehicles, isPending, error, createVehicle, resetError,
  };
  return <VehicleContext value={value}>{children}</VehicleContext>;
}

type Compound = typeof VehicleProviderImpl & {
  List: typeof VehicleList;
  Form: typeof VehicleForm;
};

/** Compound namespace — `<VehicleProvider>` + `<VehicleProvider.List>` + `<VehicleProvider.Form>`. */
export const VehicleProvider = VehicleProviderImpl as Compound;
VehicleProvider.List = VehicleList as typeof VehicleList;
VehicleProvider.Form = VehicleForm as typeof VehicleForm;