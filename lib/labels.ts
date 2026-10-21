import type { FrostLabel, Light, Watering } from "./types";

export const WATERING_LABEL: Record<Watering, string> = {
  low: "niskie",
  moderate: "umiarkowane",
  high: "wysokie",
};

export const LIGHT_LABEL: Record<Light, string> = {
  sun: "słońce",
  partial: "półcień",
  shade: "cień",
};

export const FROST_CAPTION: Record<FrostLabel, string> = {
  mrozoodporna: "mrozoodporna",
  "wymaga okrycia": "wymaga okrycia",
  "nie zimuje w gruncie": "nie zimuje w gruncie",
};

export const WATERING_ITEMS = (
  Object.entries(WATERING_LABEL) as [Watering, string][]
).map(([value, label]) => ({ value, label }));

export const LIGHT_ITEMS = (Object.entries(LIGHT_LABEL) as [Light, string][]).map(
  ([value, label]) => ({ value, label }),
);

export const FROST_ITEMS = (
  Object.entries(FROST_CAPTION) as [FrostLabel, string][]
).map(([value, label]) => ({ value, label }));

export function dropsFor(watering: Watering): 1 | 2 | 3 {
  if (watering === "low") return 1;
  if (watering === "high") return 3;
  return 2;
}
