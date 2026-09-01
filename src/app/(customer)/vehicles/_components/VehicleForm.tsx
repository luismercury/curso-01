"use client";
/**
 * VehicleForm — controlled create-vehicle form for `/vehicles` (T-039 PR2).
 *
 * Pipeline: client Zod → Provider.createVehicle → server. Error mapping:
 *   400 → field error per `issues[0].path`
 *   409 → plate field error, KEEP brand/model/year (spec scenario)
 *   401 → handled by Provider (push /login)
 *   403 → handled by Provider (banner)
 * `maxYear` arrives as a server prop — never `new Date()` in the client.
 */
import { useCallback, useState } from "react";
import {
  ApiError,
  MAX_BRAND,
  MAX_MODEL,
  MIN_YEAR,
  normalizePatente,
  vehicleCreateInputSchema,
  type VehicleCreatePayload,
} from "@/lib/validators/vehicle";
import { useVehicleContext } from "./VehicleProvider";
import styles from "../vehicles.module.css";

type FieldKey = "brand" | "model" | "year" | "plate";
type FieldErrors = Partial<Record<FieldKey, string>>;

const PLATE_MAX_INPUT = 12;
const isField = (k: unknown): k is FieldKey =>
  k === "brand" || k === "model" || k === "year" || k === "plate";

function fieldErrorsFrom(issues: ReadonlyArray<{ path: ReadonlyArray<unknown>; message: string }>): FieldErrors {
  const next: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (isField(key) && !next[key]) next[key] = issue.message;
  }
  return next;
}

export function VehicleForm() {
  const { maxYear, isPending, createVehicle } = useVehicleContext();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [plate, setPlate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const platePreview = plate.trim() === "" ? "" : normalizePatente(plate);
  const showPlateHint =
    platePreview.length > 0 && platePreview !== plate.trim() && !fieldErrors.plate;

  const reset = useCallback(() => {
    setBrand(""); setModel(""); setYearInput(""); setPlate(""); setFieldErrors({});
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    const payload: VehicleCreatePayload = {
      brand,
      model,
      year: yearInput.trim() === "" ? Number.NaN : Number(yearInput),
      plate,
    };

    const parsed = vehicleCreateInputSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error.issues));
      return;
    }

    try {
      await createVehicle(parsed.data);
      reset();
    } catch (err) {
      if (!(err instanceof ApiError)) return;
      if (err.status === 409) {
        // 409: KEEP brand/model/year; only flag the plate (spec).
        setFieldErrors({ plate: err.message || "Plate already exists" });
        return;
      }
      if (err.status === 400 && err.issues && err.issues.length > 0) {
        setFieldErrors(fieldErrorsFrom(err.issues));
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className={styles.form} aria-busy={isPending} data-testid="vehicle-form" noValidate>
      <h2 className={styles.formHeading}>Add a vehicle</h2>

      <Field label="Brand" htmlFor="brand" error={fieldErrors.brand}>
        <input id="brand" name="brand" type="text" value={brand}
          onChange={(e) => setBrand(e.target.value)}
          disabled={isPending} maxLength={MAX_BRAND} required
          aria-invalid={Boolean(fieldErrors.brand)}
          className={`${styles.fieldInput} ${fieldErrors.brand ? styles.invalid : ""}`}
          data-testid="vehicle-form-brand" />
      </Field>

      <Field label="Model" htmlFor="model" error={fieldErrors.model}>
        <input id="model" name="model" type="text" value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={isPending} maxLength={MAX_MODEL} required
          aria-invalid={Boolean(fieldErrors.model)}
          className={`${styles.fieldInput} ${fieldErrors.model ? styles.invalid : ""}`}
          data-testid="vehicle-form-model" />
      </Field>

      <Field label="Year" htmlFor="year" error={fieldErrors.year}>
        <input id="year" name="year" type="number" inputMode="numeric" value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          disabled={isPending} min={MIN_YEAR} max={maxYear} required
          aria-invalid={Boolean(fieldErrors.year)}
          className={`${styles.fieldInput} ${fieldErrors.year ? styles.invalid : ""}`}
          data-testid="vehicle-form-year" />
      </Field>

      <Field label="Plate" htmlFor="plate" error={fieldErrors.plate}
        hint={showPlateHint ? `Will be saved as: ${platePreview}` : `Format: 6-7 alphanumeric characters (auto-normalized).`}>
        <input id="plate" name="plate" type="text" value={plate}
          onChange={(e) => setPlate(e.target.value)}
          disabled={isPending} maxLength={PLATE_MAX_INPUT} required
          aria-invalid={Boolean(fieldErrors.plate)}
          aria-describedby="plate-hint" placeholder="ABC123"
          className={`${styles.fieldInput} ${fieldErrors.plate ? styles.invalid : ""}`}
          data-testid="vehicle-form-plate" />
      </Field>

      <button type="submit" className={styles.submit} disabled={isPending} data-testid="vehicle-form-submit">
        {isPending ? "Saving…" : "Add vehicle"}
      </button>
    </form>
  );
}

function Field({
  label, htmlFor, error, hint, children,
}: {
  label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.fieldLabel}>{label}</label>
      {children}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
      {error ? <span role="alert" className={styles.fieldError}>{error}</span> : null}
    </div>
  );
}