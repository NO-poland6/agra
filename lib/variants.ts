export const LABEL_VARIANTS = { a: "Klasyczna", b: "Pasek ikon", c: "Kolumna boczna", d: "Minimalistyczna" } as const;
export type LabelVariant = keyof typeof LABEL_VARIANTS;
export const VARIANT_STORAGE_KEY = "agra-label-variant";
export function labelVariant(value: string | null): LabelVariant | null {
  return value && Object.hasOwn(LABEL_VARIANTS, value) ? value as LabelVariant : null;
}
