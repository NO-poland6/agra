import type { FrostLabel, Light, Watering } from "./types";

/** Strefa sklepu. Miasto bywa kartowane jako 7a, przedgórze i zastoiska jako 6a — na karcie ostrożnie 6a. */
export const SHOP_REGION = {
  name: "Kłodzko",
  zone: "6a",
  celsius: -23.3,
  short: "ok. −23 °C",
} as const;

export const SCALE_LEGEND =
  "Podkreślone: zakres rośliny.";

export const WATER_STEPS = [
  { level: 1, caption: "susza" },
  { level: 2, caption: "rzadko" },
  { level: 3, caption: "średnio" },
  { level: 4, caption: "wilgotno" },
  { level: 5, caption: "bagno" },
] as const;

export const LIGHT_STEPS = [
  { level: 1, caption: "cień" },
  { level: 2, caption: "jasny" },
  { level: 3, caption: "półcień" },
  { level: 4, caption: "słońce" },
  { level: 5, caption: "pełne" },
] as const;

export const FROST_STEPS = [
  { level: 1, caption: "> −5", zone: "9+", name: "nie zimuje na dworze" },
  { level: 2, caption: "−12", zone: "8", name: "słaba" },
  { level: 3, caption: "−23", zone: "7–6b", name: "umiarkowana" },
  { level: 4, caption: "−30", zone: "6a–5", name: "odporna" },
  { level: 5, caption: "< −30", zone: "≤ 4", name: "bardzo odporna" },
] as const;

/** Dolna granica strefy należy do niej, górna do następnej. Źródło: definicja USDA (pasma 5 °F). */
const USDA_BANDS: { zone: string; min: number; max: number }[] = [
  { zone: "4a", min: -34.4, max: -31.7 },
  { zone: "4b", min: -31.7, max: -28.9 },
  { zone: "5a", min: -28.9, max: -26.1 },
  { zone: "5b", min: -26.1, max: -23.3 },
  { zone: "6a", min: -23.3, max: -20.6 },
  { zone: "6b", min: -20.6, max: -17.8 },
  { zone: "7a", min: -17.8, max: -15 },
  { zone: "7b", min: -15, max: -12.2 },
  { zone: "8a", min: -12.2, max: -9.4 },
  { zone: "8b", min: -9.4, max: -6.7 },
  { zone: "9a", min: -6.7, max: -3.9 },
  { zone: "9b", min: -3.9, max: -1.1 },
  { zone: "10a", min: -1.1, max: 1.7 },
  { zone: "10b", min: 1.7, max: 4.4 },
  { zone: "11a", min: 4.4, max: 7.2 },
  { zone: "11b", min: 7.2, max: 10 },
];

export type SnowflakeLine = { x1: number; y1: number; x2: number; y2: number };

/** Sześć ramion co 60°, z bocznymi gałązkami. Układ 0–100, środek w 50,50. */
export function snowflakeLines(): SnowflakeLine[] {
  const lines: SnowflakeLine[] = [];
  const cx = 50;
  const cy = 50;
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = -Math.PI / 2 + (arm * Math.PI) / 3;
    const point = (radius: number) => ({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
    const root = point(0);
    const tip = point(42);
    lines.push({ x1: root.x, y1: root.y, x2: tip.x, y2: tip.y });
    for (const branch of [
      { radius: 27, length: 12 },
    ]) {
      const base = point(branch.radius);
      for (const sign of [1, -1]) {
        const dir = angle + sign * (Math.PI / 3);
        lines.push({
          x1: base.x,
          y1: base.y,
          x2: base.x + Math.cos(dir) * branch.length,
          y2: base.y + Math.sin(dir) * branch.length,
        });
      }
    }
  }
  return lines;
}

export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function clampPair(from: number, to: number): [number, number] | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < 1 || from > 5 || to > 5) return null;
  const left = Math.round(from);
  const right = Math.round(to);
  return left <= right ? [left, right] : [right, left];
}

export function adjustRange(from: number, to: number, clicked: number): [number, number] {
  const step = clampLevel(clicked);
  if (!step) return [1, 1];
  const pair = clampPair(from, to);
  if (!pair) return [step, step];
  const [left, right] = pair;
  if (step < left) return [step, right];
  if (step > right) return [left, step];
  if (step === left && left < right) return [left + 1, right];
  if (step === right && right > left) return [left, right - 1];
  return [step, step];
}

export function waterRangeFor(watering: Watering): [number, number] {
  if (watering === "low") return [1, 2];
  if (watering === "high") return [4, 5];
  return [2, 4];
}

export function lightRangeFor(light: Light): [number, number] {
  if (light === "shade") return [1, 2];
  if (light === "sun") return [4, 5];
  return [2, 4];
}

export function wateringForRange(from: number, to: number): Watering {
  const mid = (from + to) / 2;
  if (mid <= 2) return "low";
  if (mid >= 4) return "high";
  return "moderate";
}

export function lightForRange(from: number, to: number): Light {
  if (to <= 2) return "shade";
  if (from >= 4) return "sun";
  return "partial";
}

export function rangeCaption(steps: readonly { level: number; caption: string }[], from: number, to: number): string {
  const left = steps.find((step) => step.level === from)?.caption ?? "";
  const right = steps.find((step) => step.level === to)?.caption ?? "";
  if (!left) return "niepodane";
  return from === to ? left : `${left}–${right}`;
}

export function formatCelsius(value: number): string {
  const rounded = Math.round(value);
  const digits = rounded < 0 ? `−${Math.abs(rounded)}` : String(rounded);
  return `${digits} °C`;
}

export function parseMinCelsius(value: string): number | null {
  const matches = value.match(/[−–-]?\d+(?:[.,]\d+)?/g);
  if (!matches) return null;
  const numbers = matches.map((item) => Number(item.replace("−", "-").replace("–", "-").replace(",", ".")));
  const finite = numbers.filter((item) => Number.isFinite(item));
  if (finite.length === 0) return null;
  return Math.min(...finite);
}

export function zoneForCelsius(value: number): string {
  if (value < USDA_BANDS[0].min) return "3 i mniej";
  if (value >= USDA_BANDS[USDA_BANDS.length - 1].max) return "12+";
  const band = USDA_BANDS.find((item) => value >= item.min && value < item.max);
  return band?.zone ?? "";
}

export function parseZoneToken(value: string): { zone: string; min: number } | null {
  const matches = [...value.toLowerCase().matchAll(/(?:^|[^0-9])((?:1[0-3]|[1-9])\s*([ab])?)/g)];
  if (matches.length === 0) return null;
  let coldest: { zone: string; min: number } | null = null;
  for (const match of matches) {
    const number = match[1].replace(/\s+/g, "");
    const half = match[2] || "a";
    const zone = `${number.replace(/[ab]$/, "")}${half}`;
    const band = USDA_BANDS.find((item) => item.zone === zone);
    if (!band) continue;
    if (!coldest || band.min < coldest.min) coldest = { zone: band.zone, min: band.min };
  }
  return coldest;
}

export function frostLevelForCelsius(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value <= -30) return 5;
  if (value <= -23) return 4;
  if (value <= -12) return 3;
  if (value <= -5) return 2;
  return 1;
}

export function frostLabelForLevel(level: number): FrostLabel {
  if (level <= 1) return "nie zimuje w gruncie";
  if (level <= 3) return "wymaga okrycia";
  return "mrozoodporna";
}

export const FROST_ANCHORS: { level: 1 | 2 | 3 | 4 | 5; hardinessC: string; usdaZone: string }[] = [
  { level: 1, hardinessC: "5 °C", usdaZone: "10a" },
  { level: 2, hardinessC: "−12 °C", usdaZone: "8a" },
  { level: 3, hardinessC: "−18 °C", usdaZone: "7a" },
  { level: 4, hardinessC: "−25 °C", usdaZone: "5b" },
  { level: 5, hardinessC: "−32 °C", usdaZone: "4b" },
];

export type FrostView = {
  known: boolean;
  level: number;
  minC: number | null;
  zone: string;
  value: string;
  clearsShop: boolean;
  note: string;
};

export function winterNote(detail: string): string {
  const text = detail.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const stripped = text
    .replace(/^do ok\.?\s*[−–-]?\d+[^,;.]*(?:strefa\s*[0-9]{1,2}\s*[ab]?)?[^,;.]*[,;.]?\s*/i, "")
    .trim();
  if (!stripped || stripped.length < 6) return "";
  if (/^do ok/i.test(stripped)) return "";
  return stripped;
}

export function resolveFrost(input: {
  hardinessC?: string;
  usdaZone?: string;
  frostLabel?: FrostLabel;
  frostDetail?: string;
}): FrostView {
  const note = winterNote(input.frostDetail ?? "");
  const fromTemp = parseMinCelsius(input.hardinessC ?? "");
  const fromZone = parseZoneToken(input.usdaZone ?? "");
  const minC = fromTemp ?? fromZone?.min ?? null;
  if (minC === null) {
    if (input.frostLabel === "nie zimuje w gruncie") {
      return {
        known: true,
        level: 1,
        minC: null,
        zone: "9+",
        value: "nie zimuje na dworze",
        clearsShop: false,
        note,
      };
    }
    return { known: false, level: 0, minC: null, zone: "", value: "niepodane", clearsShop: false, note };
  }
  const level = frostLevelForCelsius(minC);
  const zone = fromZone && fromTemp === null ? fromZone.zone : zoneForCelsius(minC);
  return {
    known: true,
    level,
    minC,
    zone,
    value: formatCelsius(minC),
    clearsShop: minC <= SHOP_REGION.celsius,
    note,
  };
}

export function applyScaleDefaults<
  T extends {
    watering: Watering;
    light: Light;
    waterFrom?: number;
    waterTo?: number;
    lightFrom?: number;
    lightTo?: number;
    usdaZone?: string;
  },
>(info: T): T & { waterFrom: number; waterTo: number; lightFrom: number; lightTo: number; usdaZone: string } {
  const water = clampPair(info.waterFrom ?? 0, info.waterTo ?? 0) ?? waterRangeFor(info.watering);
  const light = clampPair(info.lightFrom ?? 0, info.lightTo ?? 0) ?? lightRangeFor(info.light);
  return {
    ...info,
    waterFrom: water[0],
    waterTo: water[1],
    lightFrom: light[0],
    lightTo: light[1],
    usdaZone: (info.usdaZone ?? "").trim(),
  };
}
