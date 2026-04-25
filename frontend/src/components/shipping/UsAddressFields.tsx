"use client";

import { Globe2, Hash, MapPin, MapPinned, Phone, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import { InputWithLeadingIcon, SelectWithLeadingIcon } from "@/components/ui/input";
import type { AddressDetails } from "@/lib/types";

/** `code` = 2-letter value submitted to the API; `name` = label shown in the UI. */
export type UsStateOption = { code: string; name: string };

export type CityRow = { name: string; zips: string[] };

const DEFAULT_SELECT =
  "mt-1.5 w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-sm text-text-primary transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)]";

const DEFAULT_LABEL =
  "block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted";

type StatesFile = { states: UsStateOption[] };
type CitiesFile = { cities: CityRow[] };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json() as Promise<T>;
}

/** Same two-column rhythm as address rows on new shipment (Sender / Receiver). */
export const US_ADDRESS_FORM_GRID =
  "grid w-full min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4";

export function UsAddressFields({
  value,
  onChange,
  idPrefix,
  selectClassName = DEFAULT_SELECT,
  labelClassName = DEFAULT_LABEL,
  inputClassName = "mt-1.5 w-full",
  /** When set, name + state render in one row; the separate state field is omitted. */
  combineNameStateRow,
  /** Renders in the same row as Country (two columns on `sm+`). */
  phoneField,
}: {
  value: AddressDetails;
  onChange: (next: AddressDetails) => void;
  idPrefix: string;
  selectClassName?: string;
  labelClassName?: string;
  /** Applied to postal and country inputs (e.g. profile white input style). */
  inputClassName?: string;
  combineNameStateRow?: {
    name: string;
    onNameChange: (v: string) => void;
  };
  phoneField?: {
    value: string;
    onChange: (v: string) => void;
    maxLength?: number;
    inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
    autoComplete?: string;
  };
}) {
  const [states, setStates] = useState<UsStateOption[] | null>(null);
  const [citiesPayload, setCitiesPayload] = useState<CitiesFile | null>(null);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [citiesLoading, setCitiesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchJson<StatesFile>("/data/us/states.json");
        if (!cancelled) setStates(data.states);
      } catch {
        if (!cancelled) setStates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (value.country !== "US") {
      onChange({ ...value, country: "US" });
    }
    // Only react to country changes from outside (e.g. address validation); avoid onChange in deps (may be inline).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.country]);

  const stateCode = (value.state || "").trim().toUpperCase();

  useEffect(() => {
    if (!stateCode) {
      setCitiesPayload(null);
      setCitiesError(null);
      setCitiesLoading(false);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    setCitiesError(null);
    void (async () => {
      try {
        const data = await fetchJson<CitiesFile>(`/data/us/cities/${stateCode}.json`);
        if (!cancelled) {
          setCitiesPayload(data);
          setCitiesLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setCitiesPayload(null);
          setCitiesError(e instanceof Error ? e.message : "Could not load cities.");
          setCitiesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  const cities = useMemo(() => citiesPayload?.cities ?? [], [citiesPayload]);

  const trimmedCity = value.city.trim();

  const cityEntry = useMemo(
    () => cities.find((c) => c.name === trimmedCity),
    [cities, trimmedCity],
  );

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (citiesLoading || cities.length === 0) return;
    if (!trimmedCity) return;
    if (cityEntry) return;
    onChangeRef.current({ ...value, city: "", postalCode: "", country: "US" });
  }, [citiesLoading, cities.length, trimmedCity, cityEntry, value]);

  const zipsForCity = cityEntry?.zips ?? [];
  const showZipSelect = zipsForCity.length > 1;
  const showPostalInput =
    zipsForCity.length === 0 && Boolean(trimmedCity) && Boolean(stateCode) && !citiesLoading && !citiesError;

  const patch = useCallback(
    (partial: Partial<AddressDetails>) => {
      onChange({ ...value, ...partial, country: "US" });
    },
    [onChange, value],
  );

  const onStateChange = (code: string) => {
    patch({
      state: code,
      city: "",
      postalCode: "",
    });
  };

  const onCityChange = (cityName: string) => {
    if (!cityName) {
      patch({ city: "", postalCode: "" });
      return;
    }
    const row = cities.find((c) => c.name === cityName);
    if (!row) {
      return;
    }
    if (row.zips.length === 1) {
      patch({ city: row.name, postalCode: row.zips[0] });
    } else if (row.zips.length > 1) {
      patch({ city: row.name, postalCode: row.zips[0] });
    } else {
      patch({ city: row.name, postalCode: "" });
    }
  };

  const onPostalChange = (zip: string) => {
    const cleaned = zip.replace(/[^\d-]/g, "").slice(0, 10);
    patch({ postalCode: cleaned });
  };

  const stateField = (
    <div className="min-w-0 flex flex-col gap-2">
      <label className={labelClassName} htmlFor={`${idPrefix}-state`}>
        State
      </label>
      <SelectWithLeadingIcon
        icon={MapPinned}
        id={`${idPrefix}-state`}
        className={selectClassName}
        value={stateCode}
        onChange={(e) => onStateChange(e.target.value)}
      >
        <option value="">Select state…</option>
        {(states ?? []).map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </SelectWithLeadingIcon>
    </div>
  );

  const inputDisabled = `${inputClassName} !cursor-not-allowed !bg-slate-50 !text-text-primary !opacity-100`;

  return (
    <div className={US_ADDRESS_FORM_GRID}>
      {combineNameStateRow ? (
        <>
          <div className="flex min-w-0 flex-col gap-2">
            <label className={labelClassName} htmlFor={`${idPrefix}-recipient-name`}>
              Name <span className="text-accent-red">*</span>
            </label>
            <InputWithLeadingIcon
              id={`${idPrefix}-recipient-name`}
              icon={User}
              className={inputClassName}
              value={combineNameStateRow.name}
              onChange={(e) => combineNameStateRow.onNameChange(e.target.value)}
              required
              autoComplete="name"
              placeholder="Full name"
            />
          </div>
          {stateField}
        </>
      ) : (
        <div className="min-w-0 sm:col-span-2">{stateField}</div>
      )}

      <div className="min-w-0 sm:col-span-1">
        <div className="flex min-w-0 flex-col gap-2">
          <label className={labelClassName} htmlFor={`${idPrefix}-city`}>
            City
          </label>
          {!stateCode ? (
            <InputWithLeadingIcon
              id={`${idPrefix}-city`}
              icon={MapPin}
              className={inputDisabled}
              disabled
              readOnly
              value=""
              placeholder="Choose a state first"
            />
          ) : citiesLoading ? (
            <InputWithLeadingIcon
              id={`${idPrefix}-city`}
              icon={MapPin}
              className={inputDisabled}
              disabled
              readOnly
              value=""
              placeholder="Loading cities…"
            />
          ) : citiesError ? (
            <>
              <InputWithLeadingIcon
                id={`${idPrefix}-city`}
                icon={MapPin}
                className={inputDisabled}
                disabled
                readOnly
                value=""
                placeholder="City list unavailable"
              />
              <p className="text-xs text-accent-red" role="alert">
                {citiesError}
              </p>
            </>
          ) : (
            <select
              id={`${idPrefix}-city`}
              className={selectClassName}
              value={cityEntry ? trimmedCity : ""}
              onChange={(e) => {
                onCityChange(e.target.value);
              }}
            >
              <option value="">Select city…</option>
              {cities.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="min-w-0 flex flex-col gap-2">
        <label className={labelClassName} htmlFor={`${idPrefix}-postal`}>
          Postal code
        </label>
        {showZipSelect ? (
          <SelectWithLeadingIcon
            icon={Hash}
            id={`${idPrefix}-postal`}
            className={selectClassName}
            value={value.postalCode}
            onChange={(e) => onPostalChange(e.target.value)}
          >
            {zipsForCity.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </SelectWithLeadingIcon>
        ) : (
          <InputWithLeadingIcon
            id={`${idPrefix}-postal`}
            icon={Hash}
            className={inputClassName}
            value={value.postalCode}
            onChange={(e) => onPostalChange(e.target.value)}
            readOnly={zipsForCity.length === 1 && !showPostalInput}
            placeholder={showPostalInput ? "e.g. 10001" : undefined}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={10}
          />
        )}
        {showPostalInput ? (
          <p className="mt-1 text-[10px] text-text-muted">
            Enter ZIP for this city, or pick a city from the list.
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-2">
          <label className={labelClassName} htmlFor={`${idPrefix}-country`}>
            Country
          </label>
          <InputWithLeadingIcon
            id={`${idPrefix}-country`}
            icon={Globe2}
            className={inputClassName}
            value="United States (US)"
            readOnly
            aria-readonly="true"
          />
        </div>
      </div>
      {phoneField ? (
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-2">
            <label className={labelClassName} htmlFor={`${idPrefix}-phone`}>
              Phone (digits only)
            </label>
            <InputWithLeadingIcon
              id={`${idPrefix}-phone`}
              icon={Phone}
              className={inputClassName}
              value={phoneField.value}
              onChange={(e) => phoneField.onChange(e.target.value)}
              maxLength={phoneField.maxLength}
              inputMode={phoneField.inputMode}
              autoComplete={phoneField.autoComplete}
              placeholder="10-digit number"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
