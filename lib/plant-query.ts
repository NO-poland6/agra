import { cleanName } from "./normalize";

export type PlantQuery = {
  polishName: string;
  latinName: string;
};

/** Zostawia wyłącznie nazwy. Cena i inne pola żądania są odrzucane. */
export function plantQueryFromBody(body: unknown): PlantQuery | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const polishName = typeof record.polishName === "string" ? cleanName(record.polishName) : "";
  const latinName = typeof record.latinName === "string" ? cleanName(record.latinName) : "";
  if (!polishName && !latinName) return null;
  return { polishName, latinName };
}

export function buildGeneratePayload(input: { polishName: string; latinName: string }): PlantQuery {
  return {
    polishName: cleanName(input.polishName),
    latinName: cleanName(input.latinName),
  };
}

export function buildUserPrompt(query: PlantQuery): string {
  return [
    "Przygotuj etykietę dla rośliny.",
    query.polishName ? `Nazwa polska: ${query.polishName}` : "Nazwa polska: nie podano",
    query.latinName ? `Nazwa łacińska: ${query.latinName}` : "Nazwa łacińska: nie podano",
  ].join("\n");
}
