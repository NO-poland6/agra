import type { PlantInfo } from "./types";

export const MONTH_ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;

export const BADGE_SUGGESTIONS = [
  "miododajna",
  "zimozielona",
  "do pojemników",
  "jadalna",
  "przyciąga motyle",
  "trująca dla zwierząt",
  "pachnąca",
  "okrywowa",
  "na żywopłot",
  "na kwiat cięty",
  "odporna na suszę",
  "do wnętrz",
] as const;

export function normalizeMonths(value: unknown): number[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[^\d]+/)
      : [];
  const months = source
    .map((item) => Number(item))
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
  return [...new Set(months)].sort((left, right) => left - right);
}

export function parseBadges(value: string): string[] {
  const seen = new Set<string>();
  const badges: string[] = [];
  for (const part of value.split(/[,;]/)) {
    const badge = part.replace(/\s+/g, " ").trim().slice(0, 32);
    const key = badge.toLocaleLowerCase("pl");
    if (!badge || seen.has(key)) continue;
    seen.add(key);
    badges.push(badge);
    if (badges.length >= 6) break;
  }
  return badges;
}

/** Adres Wikipedii zawiera tylko nazwę rośliny. Ceny i danych sklepu tu nie ma. */
export function plantInfoUrl(latinName: string, polishName: string): string | null {
  const query = (latinName || polishName).replace(/\s+/g, " ").trim();
  if (!query) return null;
  const params = new URLSearchParams({ search: query });
  return `https://pl.wikipedia.org/w/index.php?${params.toString()}`;
}

export function withPlantDefaults(info: PlantInfo): PlantInfo {
  return {
    polishName: info.polishName ?? "",
    latinName: info.latinName ?? "",
    description: info.description ?? "",
    watering: info.watering ?? "moderate",
    light: info.light ?? "partial",
    frostLabel: info.frostLabel ?? "wymaga okrycia",
    frostDetail: info.frostDetail ?? "",
    plantType: info.plantType ?? "",
    height: info.height ?? "",
    width: info.width ?? "",
    hardinessC: info.hardinessC ?? "",
    bloomMonths: normalizeMonths(info.bloomMonths),
    badges: Array.isArray(info.badges)
      ? info.badges.filter((badge) => typeof badge === "string" && badge.trim()).slice(0, 6)
      : [],
  };
}

export function sizeLabel(height: string, width: string): string {
  const high = height.trim();
  const wide = width.trim();
  if (high && wide) return `${high} × ${wide}`;
  return high || wide || "niepodane";
}
