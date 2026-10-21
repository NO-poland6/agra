import { cleanName } from "./normalize";
import { FROST_LABELS, LIGHT, WATERING, type FrostLabel, type Light, type PlantInfo, type Watering } from "./types";

const WATERING_WORDS: Record<string, Watering> = {
  low: "low",
  niska: "low",
  niskie: "low",
  male: "low",
  małe: "low",
  moderate: "moderate",
  medium: "moderate",
  umiarkowane: "moderate",
  umiarkowana: "moderate",
  srednie: "moderate",
  średnie: "moderate",
  high: "high",
  wysokie: "high",
  wysoka: "high",
  duze: "high",
  duże: "high",
};

const LIGHT_WORDS: Record<string, Light> = {
  sun: "sun",
  "full sun": "sun",
  slonce: "sun",
  słońce: "sun",
  "pelne slonce": "sun",
  "pełne słońce": "sun",
  partial: "partial",
  "partial shade": "partial",
  polcien: "partial",
  półcień: "partial",
  "polcień": "partial",
  shade: "shade",
  cien: "shade",
  cień: "shade",
};

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("brak JSON");
  }
  return JSON.parse(body.slice(start, end + 1));
}

function mapWatering(value: unknown): Watering | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if ((WATERING as readonly string[]).includes(key)) return key as Watering;
  return WATERING_WORDS[key] ?? null;
}

function mapLight(value: unknown): Light | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if ((LIGHT as readonly string[]).includes(key)) return key as Light;
  return LIGHT_WORDS[key] ?? null;
}

function mapFrost(value: unknown): FrostLabel | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if ((FROST_LABELS as readonly string[]).includes(key)) return key as FrostLabel;
  if (key.includes("nie zimuje")) return "nie zimuje w gruncie";
  if (key.includes("okry")) return "wymaga okrycia";
  if (key.includes("mrozoodporn") || key === "hardy") return "mrozoodporna";
  return null;
}

export type ParsedPlant = {
  plant: PlantInfo;
  warnings: string[];
};

export function parsePlantResponse(data: unknown, fallback: { polishName: string; latinName: string }): ParsedPlant | null {
  const record = asRecord(data);
  if (!record) return null;
  const description = text(record.description, 700);
  if (description.length < 40) return null;

  const warnings: string[] = [];
  const watering = mapWatering(record.watering);
  const light = mapLight(record.light);
  const frostLabel = mapFrost(record.frostLabel);
  if (!watering) warnings.push("Sprawdź podlewanie.");
  if (!light) warnings.push("Sprawdź stanowisko.");
  if (!frostLabel) warnings.push("Sprawdź mrozoodporność.");

  const polishName = cleanName(text(record.polishName, 120) || fallback.polishName);
  const latinName = cleanName(text(record.latinName, 120) || fallback.latinName);
  if (!polishName && !latinName) return null;

  return {
    plant: {
      polishName: polishName || fallback.polishName,
      latinName,
      description,
      watering: watering ?? "moderate",
      light: light ?? "partial",
      frostLabel: frostLabel ?? "wymaga okrycia",
      frostDetail: text(record.frostDetail, 160),
      plantType: text(record.plantType, 60),
      height: text(record.height, 40),
    },
    warnings,
  };
}
