import { cacheKey } from "./cache-key";
import type { PlantInfo } from "./types";

export type CacheOrigin = "ai" | "edited";

export type CacheEntry = {
  key: string;
  info: PlantInfo;
  origin: CacheOrigin;
  savedAt: number;
};

export type RecentEntry = {
  key: string;
  info: PlantInfo;
  price: number;
  savedAt: number;
};

const CACHE_STORAGE = "agra-psk.opisy.v1";
const RECENT_STORAGE = "agra-psk.ostatnie.v1";
const CACHE_LIMIT = 200;
const RECENT_LIMIT = 10;

function readList<T>(storageKey: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(storageKey: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Prywatny tryb albo pełny dysk — etykieta i tak zostaje na ekranie.
  }
}

export function readCachedPlant(polishName: string, latinName: string): CacheEntry | null {
  const key = cacheKey(polishName, latinName);
  if (key === "|") return null;
  return readList<CacheEntry>(CACHE_STORAGE).find((entry) => entry.key === key) ?? null;
}

export function writeCachedPlant(info: PlantInfo, origin: CacheOrigin) {
  if (info.description.trim().length < 40) return;
  const key = cacheKey(info.polishName, info.latinName);
  if (key === "|") return;
  const next: CacheEntry = { key, info, origin, savedAt: Date.now() };
  const rest = readList<CacheEntry>(CACHE_STORAGE).filter((entry) => entry.key !== key);
  writeList(CACHE_STORAGE, [next, ...rest].slice(0, CACHE_LIMIT));
}

export function readRecent(): RecentEntry[] {
  return readList<RecentEntry>(RECENT_STORAGE)
    .filter((entry) => entry && entry.info && typeof entry.price === "number")
    .slice(0, RECENT_LIMIT);
}

export function writeRecent(info: PlantInfo, price: number) {
  if (!Number.isFinite(price) || price <= 0) return;
  const key = cacheKey(info.polishName, info.latinName);
  const next: RecentEntry = { key, info, price, savedAt: Date.now() };
  const rest = readRecent().filter((entry) => entry.key !== key);
  writeList(RECENT_STORAGE, [next, ...rest].slice(0, RECENT_LIMIT));
}

export { cacheKey };
