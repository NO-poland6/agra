import {
  PRICE_CONTENT,
  PRICE_HEIGHT,
  PRICE_LEFT,
  PRICE_MM,
  PRICE_WIDTH,
} from "./price-card";

export type InfoCardModel = {
  title: string;
  text: string;
  align: "left" | "center";
};
export type InfoLine = {
  text: string;
  size: number;
  x: number;
  baseline: number;
  title: boolean;
};
export const INFO_TOP = 26 * PRICE_MM;
export const INFO_BOTTOM = PRICE_HEIGHT - 8 * PRICE_MM;
export const infoSheetSize = (mode: "a5" | "a4") =>
  [PRICE_WIDTH, mode === "a4" ? 297 * PRICE_MM : PRICE_HEIGHT] as const;

// Explicit newlines (including empty lines) survive wrapping; long words split.
function wrap(
  text: string,
  size: number,
  title: boolean,
  measure: Measure,
): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((paragraph) => {
      const lines: string[] = [];
      let line = "";
      for (const word of paragraph.split(/[^\S\n]+/u).filter(Boolean)) {
        const joined = line ? `${line} ${word}` : word;
        if (measure(joined, size, title) <= PRICE_CONTENT) {
          line = joined;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        for (const char of word) {
          if (line && measure(line + char, size, title) > PRICE_CONTENT) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      }
      lines.push(line);
      return lines;
    });
}
type Measure = (text: string, size: number, title: boolean) => number;

export function infoCardLayout(
  card: InfoCardModel,
  rawMeasure: Measure,
): InfoLine[] {
  // Font advances scale linearly; cache unit widths during the binary search.
  const widths = new Map<string, number>();
  const measure: Measure = (text, size, title) => {
    const key = `${title}:${text}`;
    let width = widths.get(key);
    if (width === undefined) {
      width = rawMeasure(text, 1, title);
      widths.set(key, width);
    }
    return width * size;
  };
  function layout(size: number) {
    const titleSize = Math.min(40, size * 1.15);
    const title = card.title.trim()
      ? wrap(card.title.trim(), titleSize, true, measure)
      : [];
    const body = wrap(card.text, size, false, measure);
    const gap = title.length ? size * 0.45 : 0;
    const height =
      title.length * titleSize * 1.2 + gap + body.length * size * 1.2;
    return { title, body, titleSize, gap, height };
  }
  // No minimum type size: even unusually long notices must remain within the card.
  let low = 0;
  let high = 64;
  for (let i = 0; i < 32; i++) {
    const size = (low + high) / 2;
    const result = layout(size);
    const widthsFit = [
      ...result.title.map((t) => measure(t, result.titleSize, true)),
      ...result.body.map((t) => measure(t, size, false)),
    ].every((width) => width <= PRICE_CONTENT);
    if (widthsFit && result.height <= INFO_BOTTOM - INFO_TOP) low = size;
    else high = size;
  }
  const result = layout(low);
  let top = INFO_TOP + (INFO_BOTTOM - INFO_TOP - result.height) / 2;
  const lines: InfoLine[] = [];
  function add(text: string, size: number, title: boolean) {
    lines.push({
      text,
      size,
      title,
      baseline: top + size * 0.95,
      x:
        card.align === "left"
          ? PRICE_LEFT
          : (PRICE_WIDTH - measure(text, size, title)) / 2,
    });
    top += size * 1.2;
  }
  result.title.forEach((text) => add(text, result.titleSize, true));
  top += result.gap;
  result.body.forEach((text) => add(text, low, false));
  return lines;
}
