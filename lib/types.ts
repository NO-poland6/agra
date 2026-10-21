export const WATERING = ["low", "moderate", "high"] as const;
export type Watering = (typeof WATERING)[number];

export const LIGHT = ["sun", "partial", "shade"] as const;
export type Light = (typeof LIGHT)[number];

export const FROST_LABELS = [
  "mrozoodporna",
  "wymaga okrycia",
  "nie zimuje w gruncie",
] as const;
export type FrostLabel = (typeof FROST_LABELS)[number];

export type PlantInfo = {
  polishName: string;
  latinName: string;
  description: string;
  watering: Watering;
  light: Light;
  frostLabel: FrostLabel;
  frostDetail: string;
  plantType: string;
  height: string;
  /** Szerokość dorosłej rośliny, np. "40–50 cm". Pusty string, gdy nieznana. */
  width: string;
  /** Skrót mrozoodporności, np. "−20 °C". Pusty string, gdy nieznany. */
  hardinessC: string;
  /** Miesiące kwitnienia albo ozdoby, 1–12. Pusta tablica, gdy nieznane. */
  bloomMonths: number[];
  /** Krótkie cechy, np. "miododajna". */
  badges: string[];
};

export type PlantRecord = PlantInfo & {
  id: string;
  aliases?: string[];
};

export type SourceKind = "catalog" | "cache" | "ai" | "manual";

export type CardModel = PlantInfo & {
  price: number;
  photoDataUrl: string | null;
  /** Drobny podpis licencji. Pusty przy własnym zdjęciu i przy karcie bez fotografii. */
  photoCredit: string | null;
};
