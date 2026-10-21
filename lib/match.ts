import { normalize, tokens } from "./normalize";
import { PLANTS } from "./plants";
import type { PlantRecord } from "./types";

export type MatchHit = {
  plant: PlantRecord;
  score: number;
};

function scoreField(query: string, field: string): number {
  const q = normalize(query);
  const name = normalize(field);
  if (!q || !name) return 0;
  if (name === q) return 100;
  if (q.length >= 3 && (name.startsWith(q) || q.startsWith(name))) return 86;
  if (q.length >= 4 && (name.includes(q) || q.includes(name))) return 74;

  const qt = tokens(q);
  const nt = tokens(name);
  if (!qt.length || !nt.length) return 0;
  const hits = qt.filter((token) =>
    nt.some(
      (nameToken) =>
        nameToken === token ||
        nameToken.startsWith(token) ||
        (token.length >= 4 && nameToken.includes(token)),
    ),
  );
  if (!hits.length) return 0;
  const ratio = hits.length / qt.length;
  if (ratio === 1 && qt.length >= 2) return 90;
  return Math.round(36 + 40 * ratio);
}

export function scorePlant(queryPolish: string, queryLatin: string, plant: PlantRecord): number {
  const fields = [plant.polishName, plant.latinName, ...(plant.aliases ?? [])];
  let best = 0;
  const queries = [queryPolish, queryLatin].map((item) => item.trim()).filter(Boolean);
  if (!queries.length) return 0;
  for (const query of queries) {
    if (normalize(query).length < 2) continue;
    for (const field of fields) {
      best = Math.max(best, scoreField(query, field));
    }
  }
  if (queries.length === 2) {
    const polishHit = fields.some((field) => scoreField(queryPolish, field) >= 86);
    const latinHit = fields.some((field) => scoreField(queryLatin, field) >= 86);
    if (polishHit && latinHit) best = Math.max(best, 98);
  }
  return best;
}

export function searchPlants(queryPolish: string, queryLatin = ""): MatchHit[] {
  return PLANTS.map((plant) => ({
    plant,
    score: scorePlant(queryPolish, queryLatin, plant),
  }))
    .filter((hit) => hit.score >= 70)
    .sort((a, b) => b.score - a.score || a.plant.polishName.localeCompare(b.plant.polishName, "pl"));
}

export function interpretMatches(matches: MatchHit[]):
  | { type: "none" }
  | { type: "one"; plant: PlantRecord }
  | { type: "many"; plants: MatchHit[] } {
  if (!matches.length) return { type: "none" };
  const [top, second] = matches;
  if (!second || top.score - second.score >= 16) {
    return { type: "one", plant: top.plant };
  }
  return { type: "many", plants: matches.slice(0, 6) };
}

export function findPlantById(id: string): PlantRecord | undefined {
  return PLANTS.find((plant) => plant.id === id);
}
