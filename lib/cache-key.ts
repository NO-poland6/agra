import { normalize } from "./normalize";

export function cacheKey(polishName: string, latinName: string): string {
  return `${normalize(polishName)}|${normalize(latinName)}`;
}
