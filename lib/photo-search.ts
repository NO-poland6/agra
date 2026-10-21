import type { PlantQuery } from "./plant-query";
import {
  PHOTO_USER_AGENT,
  latinBinomial,
  photoSearchTerms,
  rankPhotos,
  readCommonsPayload,
  readInatPayload,
  type ParsedPhoto,
  type PhotoCandidate,
} from "./photos";

export function commonsSearchUrl(term: string): string {
  const safe = term.replace(/["<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `"${safe}" filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1920",
  });
  return `https://commons.wikimedia.org/w/api.php?${params}`;
}

export function inatSearchUrl(binomial: string): string {
  const params = new URLSearchParams({
    taxon_name: binomial,
    photos: "true",
    quality_grade: "research",
    per_page: "6",
    photo_license: "cc-by,cc-by-sa,cc0",
    order_by: "votes",
    order: "desc",
  });
  return `https://api.inaturalist.org/v1/observations?${params}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": PHOTO_USER_AGENT,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`photo-search ${response.status}`);
  return response.json();
}

export async function searchPlantPhotos(query: PlantQuery): Promise<{ photos: PhotoCandidate[]; failed: boolean }> {
  const jobs: Promise<ParsedPhoto[]>[] = photoSearchTerms(query).map(async (term) => {
    const payload = await fetchJson(commonsSearchUrl(term));
    return readCommonsPayload(payload);
  });
  const binomial = latinBinomial(query.latinName);
  if (binomial) {
    jobs.push(
      fetchJson(inatSearchUrl(binomial)).then((payload) => readInatPayload(payload)),
    );
  }
  const settled = await Promise.allSettled(jobs);
  const parsed = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return {
    photos: rankPhotos(parsed, query, 8),
    failed: settled.length > 0 && settled.every((result) => result.status === "rejected"),
  };
}
