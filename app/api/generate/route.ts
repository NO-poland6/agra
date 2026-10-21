import { generatePlantInfo, readLlmEnv, resolveLlmConfig } from "@/lib/llm";
import { plantQueryFromBody } from "@/lib/plant-query";

const hits = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 20) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0]?.trim() || "local";
  if (tooMany(ip)) {
    return Response.json(
      { error: "Za dużo zapytań. Odczekaj chwilę i spróbuj ponownie." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Niepoprawne żądanie." }, { status: 400 });
  }

  // Świadomie bierzemy tylko nazwy. Cena, zdjęcie i inne pola są ignorowane.
  const query = plantQueryFromBody(body);
  if (!query) {
    return Response.json({ error: "Podaj polską albo łacińską nazwę rośliny." }, { status: 400 });
  }

  const config = resolveLlmConfig(readLlmEnv(process.env));
  if (!config) {
    return Response.json(
      { error: "Brak klucza API. Użyj katalogu albo wpisz opis ręcznie." },
      { status: 503 },
    );
  }

  const result = await generatePlantInfo(config, query);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json(
    { plant: result.parsed.plant, warnings: result.parsed.warnings },
    { headers: { "Cache-Control": "no-store" } },
  );
}
