import { formatPriceParts } from "./format";

export type PriceCardModel = { name: string; price: number };
export type PriceFonts = { bold: string; display: string };
export type PriceLayout = {
  lines: string[];
  nameSize: number;
  priceSize: number;
  amount: string;
  priceX: number;
  currencyX: number;
};

export const PRICE_MM = 72 / 25.4;
export const PRICE_WIDTH = 148 * PRICE_MM;
export const PRICE_HEIGHT = 210 * PRICE_MM;
export const PRICE_LEFT = 7 * PRICE_MM;
export const PRICE_CONTENT = 134 * PRICE_MM;
export const PRICE_NAME_TOP = 30 * PRICE_MM;

// Shared by SVG preview, browser print and PDF; all measurements are in points.
export function priceCardLayout(
  card: PriceCardModel,
  measure: (text: string, size: number, display: boolean) => number,
): PriceLayout {
  const name = card.name.replace(/\s+/g, " ").trim() || "Nazwa rośliny";
  let nameSize = 40;
  let lines: string[] = [];
  for (; nameSize >= 1; nameSize -= 0.5) {
    lines = [];
    let line = "";
    for (const word of name.split(" ")) {
      if (
        measure(line ? `${line} ${word}` : word, nameSize, true) <=
        PRICE_CONTENT
      ) {
        line = line ? `${line} ${word}` : word;
      } else {
        if (line) lines.push(line);
        line = "";
        for (const char of word) {
          if (line && measure(line + char, nameSize, true) > PRICE_CONTENT) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 3 && lines.length * nameSize * 1.12 <= 60 * PRICE_MM)
      break;
  }
  const amount = formatPriceParts(card.price).amount;
  const gap = 3 * PRICE_MM;
  const priceSize = Math.min(
    145,
    (PRICE_CONTENT - gap) /
      (measure(amount, 1, true) + measure("zł", 0.24, false)),
  );
  const width =
    measure(amount, priceSize, true) +
    gap +
    measure("zł", priceSize * 0.24, false);
  const priceX = PRICE_LEFT + (PRICE_CONTENT - width) / 2;
  return {
    lines,
    nameSize,
    priceSize,
    amount,
    priceX,
    currencyX: priceX + measure(amount, priceSize, true) + gap,
  };
}

export const priceBaseline = (
  size: number,
  nameSize: number,
  lineCount: number,
) => {
  const nameBottom =
    PRICE_NAME_TOP + nameSize * (0.9 + (lineCount - 1) * 1.12 + 0.25);
  return (
    (nameBottom + 10 * PRICE_MM + PRICE_HEIGHT - 7 * PRICE_MM) / 2 + size * 0.34
  );
};
