import type { PlantQuery } from "./plant-query";

/** Tylko nazwa rośliny idzie do Commons i iNaturalist. Cena tu nie dociera. */
export const PHOTO_USER_AGENT =
  "AGRA-PSK-Etykiety/1.0 (etykiety polkowe AGRA PSK Klodzko; zapytanie zawiera wylacznie nazwe rosliny)";

export type PhotoSource = "wikimedia" | "inaturalist";

export type PhotoCandidate = {
  id: string;
  source: PhotoSource;
  title: string;
  pageUrl: string;
  printUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  author: string;
  license: string;
  credit: string;
};

export type ParsedPhoto = {
  source: PhotoSource;
  title: string;
  pageUrl: string;
  printUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  mime: string;
  author: string;
  license: string;
};

const SOURCE_LABEL: Record<PhotoSource, string> = {
  wikimedia: "Wikimedia Commons",
  inaturalist: "iNaturalist",
};

const THUMB_STEPS = [120, 250, 330, 500, 960, 1280, 1920, 3840];

export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function plainAuthor(value: string): string {
  const text = stripHtml(value)
    .replace(/^\(c\)\s*/i, "")
    .replace(/,?\s*some rights reserved.*$/i, "")
    .replace(/\((?:CC[^)]*|public domain[^)]*)\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^unknown(?: author)?$/i.test(text)) return "autor nieznany";
  return text;
}

export function isFreeLicense(value: string): boolean {
  const name = value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  if (!name) return false;
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv|all rights reserved|copyright/.test(name)) return false;
  if (name.includes("gfdl") && !name.includes("cc")) return false;
  if (/^cc ?0\b/.test(name) || name === "cc zero") return true;
  if (/^cc[- ]by[- ]sa\b/.test(name)) return true;
  if (/^cc[- ]by\b/.test(name)) return true;
  if (name === "public domain" || name.startsWith("public domain") || name === "pd" || name === "pdm") return true;
  return false;
}

export function licenseLabel(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (/^public domain|^pdm?$/i.test(name)) return "domena publiczna";
  if (/^cc ?0/i.test(name)) return "CC0";
  if (/^cc[- ]by[- ]sa/i.test(name)) {
    const version = name.match(/\d+(?:\.\d+)?/);
    return version ? `CC BY-SA ${version[0]}` : "CC BY-SA";
  }
  if (/^cc[- ]by\b/i.test(name)) {
    const version = name.match(/\d+(?:\.\d+)?/);
    return version ? `CC BY ${version[0]}` : "CC BY";
  }
  return name;
}

export function formatCredit(author: string, license: string, source: PhotoSource): string {
  const who = plainAuthor(author);
  const short = who.length > 40 ? `${who.slice(0, 38).trimEnd()}…` : who;
  return `fot. ${short}, ${licenseLabel(license)}, ${SOURCE_LABEL[source]}`;
}

export function photoId(source: string, stableKey: string): string {
  const text = `${source}:${stableKey}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function cleanRemoteUrl(value: string): string {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function isAllowedPhotoUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const path = url.pathname.toLowerCase();
  const image = /\.(jpe?g|png|webp)$/.test(path);
  if (!image) return false;
  if (url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org") {
    return path.includes("/wikipedia/");
  }
  if (
    url.hostname === "inaturalist-open-data.s3.amazonaws.com" ||
    url.hostname === "static.inaturalist.org"
  ) {
    return path.includes("/photos/");
  }
  return false;
}

export function photoProxyUrl(remoteUrl: string): string {
  return `/api/photo?url=${encodeURIComponent(remoteUrl)}`;
}

/** Szerokości, które Wikimedia serwuje bezpośrednio. Inne zwracają błąd 400. */
export function commonsThumbAt(url: string, width: number): string {
  const step = THUMB_STEPS.find((size) => size >= width) ?? 1920;
  const clean = cleanRemoteUrl(url);
  if (!clean) return "";
  if (/\/\d+px-[^/]+$/i.test(clean)) {
    return clean.replace(/\/\d+px-([^/]+)$/i, `/${step}px-$1`);
  }
  const original = clean.match(
    /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i,
  );
  if (!original) return clean;
  return `${original[1]}/thumb/${original[2]}/${original[3]}/${original[4]}/${step}px-${original[4]}`;
}

export function inatVariant(squareUrl: string, variant: "medium" | "large"): string {
  const clean = cleanRemoteUrl(squareUrl);
  return clean.replace(/\/(?:square|thumb|small|medium|large|original)\.(jpe?g|png|webp)$/i, `/${variant}.$1`);
}

export function latinBinomial(latin: string): string | null {
  const cleaned = latin
    .replace(/[‘’']/g, " ")
    .replace(/×/g, " ")
    .replace(/\b(subsp|ssp|var|cv|f)\.?\b/gi, " ")
    .replace(/[^A-Za-z -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length >= 2 && /^[A-Z][a-z]+$/.test(parts[0]) && /^[a-z][a-z-]+$/.test(parts[1])) {
    return `${parts[0]} ${parts[1]}`;
  }
  if (parts.length === 1 && /^[A-Z][a-z]{3,}$/.test(parts[0])) return parts[0];
  return null;
}

export function photoSearchTerms(query: PlantQuery): string[] {
  const terms: string[] = [];
  const latin = query.latinName.trim();
  const polish = query.polishName.trim();
  if (latin) terms.push(latin.slice(0, 80));
  if (polish && polish.toLowerCase() !== latin.toLowerCase()) terms.push(polish.slice(0, 80));
  return terms.slice(0, 2);
}

function allowedMime(mime: string, url: string): boolean {
  if (/^image\/(jpeg|jpg|png|webp)$/i.test(mime)) return true;
  if (!mime && /\.(jpe?g|png|webp)$/i.test(url)) return true;
  return false;
}

function titleKey(title: string): string {
  return title
    .replace(/^file:/i, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scorePhoto(photo: ParsedPhoto, query: PlantQuery): number {
  const title = titleKey(photo.title);
  const latin = titleKey(query.latinName);
  const polish = titleKey(query.polishName);
  let score = 0;
  if (latin && title.includes(latin)) score += 40;
  if (latin && (title === latin || title.startsWith(`${latin} `))) score += 22;
  if (polish && polish.length > 3 && title.includes(polish)) score += 28;
  if (/\b(bombus|apis|graffiti|locator|barcode|microscope|coin|stamp)\b/.test(title)) score -= 24;
  if (/kohler|kohler|illustration|botanical plate|drawing|icon|logo|distribution|range map/.test(title)) {
    score -= 30;
  }
  if (photo.width > 0 && photo.height > 0) {
    const longSide = Math.max(photo.width, photo.height);
    const shortSide = Math.min(photo.width, photo.height);
    if (longSide < 960 || shortSide < 500) return Number.NEGATIVE_INFINITY;
    if (shortSide >= 800) score += 12;
    if (longSide >= 1600) score += 8;
    const ratio = photo.width / photo.height;
    if (ratio >= 1.1 && ratio <= 2.4) score += 16;
  } else if (photo.source === "inaturalist") {
    score += 6;
  } else {
    return Number.NEGATIVE_INFINITY;
  }
  if (photo.source === "inaturalist") score += 8;
  return score;
}

export function toCandidate(photo: ParsedPhoto): PhotoCandidate {
  const license = licenseLabel(photo.license);
  return {
    id: photoId(photo.source, photo.title || photo.printUrl),
    source: photo.source,
    title: photo.title,
    pageUrl: photo.pageUrl,
    printUrl: photo.printUrl,
    thumbUrl: photo.thumbUrl,
    width: photo.width,
    height: photo.height,
    author: plainAuthor(photo.author),
    license,
    credit: formatCredit(photo.author, photo.license, photo.source),
  };
}

export function rankPhotos(photos: ParsedPhoto[], query: PlantQuery, limit = 8): PhotoCandidate[] {
  const seen = new Set<string>();
  const ranked = photos
    .map((photo, index) => ({ photo, index, score: scorePhoto(photo, query) }))
    .filter((item) => Number.isFinite(item.score))
    .filter((item) => isFreeLicense(item.photo.license))
    .filter((item) => allowedMime(item.photo.mime, item.photo.printUrl))
    .filter((item) => isAllowedPhotoUrl(item.photo.printUrl) && isAllowedPhotoUrl(item.photo.thumbUrl))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const chosen: PhotoCandidate[] = [];
  for (const item of ranked) {
    const key = `${item.photo.source}:${titleKey(item.photo.title)}:${item.photo.printUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(toCandidate(item.photo));
    if (chosen.length >= limit) break;
  }
  return chosen;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function metaValue(info: Record<string, unknown>, key: string): string {
  const ext = asRecord(info.extmetadata);
  const entry = ext ? asRecord(ext[key]) : null;
  return entry && typeof entry.value === "string" ? entry.value : "";
}

export function readCommonsPayload(payload: unknown): ParsedPhoto[] {
  const query = asRecord(asRecord(payload)?.query);
  const pages = asRecord(query?.pages);
  if (!pages) return [];
  const photos: ParsedPhoto[] = [];
  for (const page of Object.values(pages)) {
    const record = asRecord(page);
    if (!record) continue;
    const info = Array.isArray(record.imageinfo) ? asRecord(record.imageinfo[0]) : null;
    if (!info) continue;
    const title = typeof record.title === "string" ? record.title : "";
    const mime = typeof info.mime === "string" ? info.mime : "";
    const width = typeof info.width === "number" ? info.width : 0;
    const height = typeof info.height === "number" ? info.height : 0;
    const rawPrint = typeof info.thumburl === "string" && info.thumburl ? info.thumburl : info.url;
    const printUrl = typeof rawPrint === "string" ? cleanRemoteUrl(rawPrint) : "";
    if (!printUrl || !isAllowedPhotoUrl(printUrl)) continue;
    const thumbUrl = commonsThumbAt(printUrl, 500);
    if (!isAllowedPhotoUrl(thumbUrl)) continue;
    const license = metaValue(info, "LicenseShortName");
    photos.push({
      source: "wikimedia",
      title,
      pageUrl: typeof info.descriptionurl === "string" ? cleanRemoteUrl(info.descriptionurl) : "",
      printUrl,
      thumbUrl,
      width,
      height,
      mime,
      author: metaValue(info, "Artist"),
      license,
    });
  }
  return photos;
}

export function readInatPayload(payload: unknown): ParsedPhoto[] {
  const results = asRecord(payload)?.results;
  if (!Array.isArray(results)) return [];
  const photos: ParsedPhoto[] = [];
  for (const observation of results) {
    const record = asRecord(observation);
    const list = record && Array.isArray(record.photos) ? record.photos : [];
    const photo = asRecord(list[0]);
    if (!photo) continue;
    const square = typeof photo.url === "string" ? photo.url : "";
    const printUrl = inatVariant(square, "large");
    const thumbUrl = inatVariant(square, "medium");
    if (!isAllowedPhotoUrl(printUrl) || !isAllowedPhotoUrl(thumbUrl)) continue;
    const code = typeof photo.license_code === "string" ? photo.license_code : "";
    const id = typeof photo.id === "number" || typeof photo.id === "string" ? String(photo.id) : printUrl;
    photos.push({
      source: "inaturalist",
      title: id,
      pageUrl: "",
      printUrl,
      thumbUrl,
      width: 0,
      height: 0,
      mime: "",
      author: typeof photo.attribution === "string" ? photo.attribution : "",
      license: code,
    });
  }
  return photos;
}

export function isPhotoCandidate(value: unknown): value is PhotoCandidate {
  const record = asRecord(value);
  if (!record) return false;
  if (record.source !== "wikimedia" && record.source !== "inaturalist") return false;
  if (typeof record.id !== "string" || typeof record.credit !== "string") return false;
  if (typeof record.printUrl !== "string" || typeof record.thumbUrl !== "string") return false;
  return isAllowedPhotoUrl(record.printUrl) && isAllowedPhotoUrl(record.thumbUrl);
}
