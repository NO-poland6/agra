export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

export function cleanName(value: string, max = 120): string {
  return value.replace(/[\u0000-\u001F]/g, "").trim().slice(0, max);
}

export function fileSlug(value: string): string {
  const slug = normalize(value).replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return slug.slice(0, 48) || "roslina";
}
