import { connection } from "next/server";
import { isAllowedPhotoUrl, PHOTO_USER_AGENT } from "@/lib/photos";

const hits = new Map<string, number[]>();
const MAX_BYTES = 8 * 1024 * 1024;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 80) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function sniff(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return "";
}

async function fetchAllowed(start: string): Promise<Response> {
  let current = start;
  for (let hop = 0; hop < 3; hop += 1) {
    if (!isAllowedPhotoUrl(current)) throw new Error("blocked");
    const response = await fetch(current, {
      headers: { Accept: "image/jpeg,image/png,image/webp", "User-Agent": PHOTO_USER_AGENT },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect");
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new Error("status");
    return response;
  }
  throw new Error("redirects");
}

export async function GET(request: Request) {
  await connection();
  const ip = (request.headers.get("x-forwarded-for") || "local").split(",")[0]?.trim() || "local";
  if (tooMany(ip)) {
    return new Response("Za dużo pobrań zdjęć.", { status: 429 });
  }

  const remote = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!remote || remote.length > 2000 || !isAllowedPhotoUrl(remote)) {
    return new Response("Niedozwolony adres zdjęcia.", { status: 400 });
  }

  try {
    const upstream = await fetchAllowed(remote);
    const declared = Number(upstream.headers.get("content-length") || "0");
    if (declared > MAX_BYTES) return new Response("Zdjęcie jest za duże.", { status: 413 });
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return new Response("Zdjęcie jest za duże.", { status: 413 });
    }
    const mime = sniff(bytes);
    if (!mime) return new Response("To nie jest plik graficzny.", { status: 415 });
    return new Response(bytes, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Nie udało się pobrać zdjęcia.", { status: 502 });
  }
}
