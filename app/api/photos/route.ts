import { connection } from "next/server";
import { searchPlantPhotos } from "@/lib/photo-search";
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
  await connection();
  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0]?.trim() || "local";
  if (tooMany(ip)) {
    return Response.json({ error: "Za dużo zapytań o zdjęcia. Odczekaj chwilę.", photos: [] }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Niepoprawne żądanie.", photos: [] }, { status: 400 });
  }

  // Świadomie zostawiamy tylko nazwy. Cena, zdjęcie i dane sklepu nie idą do Commons ani iNaturalist.
  const query = plantQueryFromBody(body);
  if (!query) {
    return Response.json({ error: "Podaj polską albo łacińską nazwę rośliny.", photos: [] }, { status: 400 });
  }

  try {
    const result = await searchPlantPhotos(query);
    if (result.failed) {
      return Response.json(
        { error: "Nie udało się wyszukać zdjęć. Karta może powstać bez fotografii.", photos: [] },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json({ photos: result.photos }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Nie udało się wyszukać zdjęć. Karta może powstać bez fotografii.", photos: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
