export function parsePrice(input: string): number | null {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/zł|pln/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 99999.99) return null;
  return Math.round(value * 100) / 100;
}

export function formatPriceParts(value: number): { amount: string; currency: "zł" } {
  const amount = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return { amount, currency: "zł" };
}

export function formatPrice(value: number): string {
  const { amount, currency } = formatPriceParts(value);
  return `${amount} ${currency}`;
}
