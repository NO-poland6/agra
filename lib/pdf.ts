import { fileSlug } from "./normalize";
import { formatPriceParts } from "./format";
import {
  FROST_STEPS,
  LIGHT_STEPS,
  SCALE_LEGEND,
  WATER_STEPS,
  rangeCaption,
  resolveFrost,
  snowflakeLines,
} from "./scales";
import { MONTH_ROMAN, sizeLabel } from "./shelf";
import { careSummary } from "./care-summary";
import type { LabelVariant } from "./variants";
import type { CardModel } from "./types";

const MM = 72 / 25.4;
const mm = (value: number) => value * MM;

const FONTS = {
  regular: "/fonts/SourceSans3-Regular.ttf",
  semibold: "/fonts/SourceSans3-Semibold.ttf",
  bold: "/fonts/SourceSans3-Bold.ttf",
  italic: "/fonts/SourceSans3-Italic.ttf",
  display: "/fonts/Fraunces-SemiBold.ttf",
  displayItalic: "/fonts/Fraunces-Italic.ttf",
};

const fontBytes = new Map<string, ArrayBuffer>();

async function loadFont(url: string): Promise<ArrayBuffer> {
  const cached = fontBytes.get(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error("font");
  const bytes = await response.arrayBuffer();
  fontBytes.set(url, bytes);
  return bytes;
}

function sniffImage(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  return "";
}

async function rasterToPng(src: string): Promise<Uint8Array | null> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("photo"));
  });
  image.src = src;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const png = canvas.toDataURL("image/png");
  const base64 = png.split(",")[1];
  if (!base64) return null;
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function imageBytes(src: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match?.[2]) return null;
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    return { bytes, mime: sniffImage(bytes) || match[1] };
  }
  if (!src.startsWith("/api/photo?")) return null;
  const response = await fetch(src);
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const header = (response.headers.get("content-type") || "").split(";")[0]?.trim() || "";
  return { bytes, mime: sniffImage(bytes) || header };
}

async function embedPhoto(pdf: import("pdf-lib").PDFDocument, src: string | null) {
  if (!src) return null;
  try {
    const loaded = await imageBytes(src);
    if (!loaded) return null;
    if (loaded.mime.includes("png")) return await pdf.embedPng(loaded.bytes);
    if (loaded.mime.includes("jpeg") || loaded.mime.includes("jpg")) return await pdf.embedJpg(loaded.bytes);
    const png = await rasterToPng(src);
    return png ? pdf.embedPng(png) : null;
  } catch {
    try {
      const png = await rasterToPng(src);
      return png ? pdf.embedPng(png) : null;
    } catch {
      return null;
    }
  }
}

function fitLine(text: string, font: import("pdf-lib").PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text;
  while (cut.length > 8 && font.widthOfTextAtSize(`${cut}…`, size) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Fonts = {
  regular: import("pdf-lib").PDFFont;
  semibold: import("pdf-lib").PDFFont;
  bold: import("pdf-lib").PDFFont;
  italic: import("pdf-lib").PDFFont;
  display: import("pdf-lib").PDFFont;
  displayItalic: import("pdf-lib").PDFFont;
};


function drawCard(
  page: import("pdf-lib").PDFPage, card: CardModel,
  photo: import("pdf-lib").PDFImage | null, variant: LabelVariant,
  x: number, y: number, fonts: Fonts,
) {
  const { rgb } = requireRgb();
  const ink = rgb(0.09, 0.09, 0.09);
  const left = x + mm(variant === "d" ? 10 : 7);
  const right = x + mm(variant === "d" ? 138 : 141);
  const width = right - left;
  const top = y + mm(204);
  const text = (value: string, tx: number, ty: number, size: number, font = fonts.regular, maxWidth = width) =>
    page.drawText(fitLine(value, font, size, maxWidth), { x: tx, y: ty, size, font, color: ink });
  if (variant === "a" || variant === "c") page.drawRectangle({ x: x + mm(3), y: y + mm(3), width: mm(142), height: mm(204), borderWidth: 0.8, borderColor: ink });
  text("AGRA PSK", left, top - mm(4), 11, fonts.bold);
  text("Kłodzko · od 1991 r.", variant === "b" ? right - mm(34) : left, top - mm(variant === "b" ? 4 : 8), 8, fonts.semibold);
  const rule = top - mm(11);
  page.drawLine({ start: { x: left, y: rule }, end: { x: right, y: rule }, thickness: variant === "b" ? 2.8 : 0.8, color: ink });
  const mainWidth = variant === "c" ? width - mm(40) : width;
  let cursor = rule - mm(2);
  if (photo) {
    const w = variant === "d" ? mm(30) : mainWidth;
    const h = variant === "d" ? mm(30) : variant === "b" ? mm(62) : mm(74);
    const px = variant === "d" ? right - w : left;
    const pt = variant === "d" ? rule - mm(10) : cursor;
    const scale = Math.max(w / photo.width, h / photo.height);
    const ops = requireClip();
    page.pushOperators(ops.pushGraphicsState());
    if (variant === "d") {
      const cx = px + w / 2, cy = pt - h / 2, r = w / 2, k = r * 0.55228475;
      page.pushOperators(ops.moveTo(cx + r, cy), ops.appendBezierCurve(cx+r,cy+k,cx+k,cy+r,cx,cy+r), ops.appendBezierCurve(cx-k,cy+r,cx-r,cy+k,cx-r,cy), ops.appendBezierCurve(cx-r,cy-k,cx-k,cy-r,cx,cy-r), ops.appendBezierCurve(cx+k,cy-r,cx+r,cy-k,cx+r,cy), ops.closePath());
    } else page.pushOperators(ops.rectangle(px, pt-h, w, h));
    page.pushOperators(ops.clip(), ops.endPath());
    page.drawImage(photo, { x: px + (w-photo.width*scale)/2, y: pt-h + (h-photo.height*scale)*0.62, width: photo.width*scale, height: photo.height*scale });
    page.pushOperators(ops.popGraphicsState());
    if (variant !== "d") cursor -= h;
    if (card.photoCredit) {
      const creditWidth = variant === "d" ? w : mainWidth;
      const lines = wrap(card.photoCredit, fonts.regular, variant === "d" ? 5 : 6, creditWidth).slice(0, variant === "d" ? 3 : 1);
      lines.forEach((line, i) => text(line, px, pt-h-mm(2.5)-i*6, variant === "d" ? 5 : 6, fonts.regular, creditWidth));
    }
    if (variant !== "d") cursor -= mm(2);
  }
  if (variant === "d") cursor = rule - mm(20);
  const nameWidth = variant === "d" && photo ? width-mm(36) : mainWidth;
  const nameSize = variant === "d" ? 25 : card.polishName.length > 24 ? 17 : 22;
  for (const line of wrap(card.polishName || "Nazwa rośliny", fonts.display, nameSize, nameWidth).slice(0, 2)) {
    cursor -= nameSize * 0.95;
    text(line, left, cursor, nameSize, fonts.display, nameWidth);
  }
  cursor -= mm(5);
  text(card.latinName, left, cursor, 10, fonts.displayItalic, nameWidth);
  cursor -= mm(5);
  text(card.plantType.toLocaleUpperCase("pl"), left, cursor, 7.5, fonts.bold, mainWidth);
  const dimensions = sizeLabel(card.height, card.width);
  const dimensionWidth = fonts.semibold.widthOfTextAtSize(dimensions, 7);
  const typeWidth = fonts.bold.widthOfTextAtSize(card.plantType.toLocaleUpperCase("pl"), 7.5);
  if (typeWidth + dimensionWidth + mm(3) < mainWidth) {
    text(dimensions, left + mainWidth - dimensionWidth, cursor, 7, fonts.semibold, dimensionWidth + 1);
  } else {
    cursor -= mm(4);
    text(dimensions, left, cursor, 8, fonts.semibold, mainWidth);
  }
  cursor = drawBadges(page, card, left, left+mainWidth, cursor-mm(1), fonts, ink);
  if (variant === "a") cursor = drawScales(page, card, left, mainWidth, cursor, fonts, ink);
  else if (variant === "c") drawCompactCare(page, card, left+mainWidth+mm(5), mm(35), rule-mm(8), fonts, ink, true);
  else cursor = drawCompactCare(page, card, left, width, cursor-mm(2), fonts, ink, variant === "d", variant === "d");
  cursor = drawMonths(page, card, left, mainWidth, cursor, fonts, ink, rgb);
  const floor = y + mm(variant === "d" ? 48 : 35);
  const descSize = variant === "b" ? 10.5 : 9, descLead = variant === "b" ? 13.5 : 11.5;
  const lines = wrap(card.description, fonts.regular, descSize, mainWidth);
  let lineIndex = 0;
  while (lineIndex < lines.length && cursor - descLead > floor) {
    cursor -= descLead;
    const last = cursor - descLead <= floor && lineIndex < lines.length - 1;
    text(lines[lineIndex++] + (last ? "…" : ""), left, cursor, descSize, fonts.regular, mainWidth);
  }
  const priceLeft = variant === "c" ? right-mm(60) : left;
  const priceWidth = right-priceLeft;
  const priceHeight = mm(variant === "d" ? 29 : 21);
  const priceBottom = y+mm(12);
  if (variant === "a" || variant === "c") page.drawRectangle({ x: priceLeft, y: priceBottom, width: priceWidth, height: priceHeight, borderWidth: 1.5, borderColor: ink });
  if (variant === "b") page.drawLine({ start: {x:left,y:priceBottom+priceHeight},end:{x:right,y:priceBottom+priceHeight},thickness:2.8,color:ink });
  const {amount, currency} = formatPriceParts(card.price);
  const size = amount.replace(/\s/g, "").length > 6 ? 28 : variant === "d" ? 64 : 38;
  const total = fonts.display.widthOfTextAtSize(amount,size)+mm(3)+fonts.bold.widthOfTextAtSize(currency,14);
  const priceX = variant === "d" ? left : variant === "b" ? right-total : priceLeft+(priceWidth-total)/2;
  text(amount, priceX, priceBottom+mm(5),size,fonts.display,priceWidth);
  text(currency,priceX+fonts.display.widthOfTextAtSize(amount,size)+mm(3),priceBottom+mm(6),14,fonts.bold,mm(15));
  text("AGRA PSK · Kłodzko · od 1991 r.", left, y+mm(6),7,fonts.semibold);
}

function drawCompactCare(page: import("pdf-lib").PDFPage, card: CardModel, left: number, width: number, top: number, fonts: Fonts, ink: ReturnType<typeof import("pdf-lib").rgb>, stacked: boolean, rows = false) {
  const summary = careSummary(card), frost = resolveFrost(card);
  const titles = ["STANOWISKO", "PODLEWANIE", "ODPORNOŚĆ NA MRÓZ"];
  const values = [summary.light, summary.water, frost.value];
  const col = stacked ? width : width/3;
  for (let i=0;i<3;i++) {
    const cx = left + (stacked ? 0 : i*col) + col/2;
    const cy = top - (stacked ? i*mm(rows ? 14 : 26) : 0);
    if (rows) {
      page.drawText(titles[i],{x:left+mm(13),y:cy,size:6.5,font:fonts.bold,color:ink});
      drawCareGlyph(page,i===0?"light":i===1?"water":"frost",left+mm(5),cy-mm(3),mm(9),card.lightTo,ink);
      page.drawText(values[i],{x:left+mm(13),y:cy-mm(6),size:11,font:fonts.semibold,color:ink});
    } else {
      drawCentered(page,titles[i],cx,cy,6.5,fonts.bold,ink,col);
      drawCareGlyph(page, i === 0 ? "light" : i === 1 ? "water" : "frost",cx,cy-mm(7.5),mm(9),card.lightTo,ink);
      drawCentered(page,values[i],cx,cy-mm(15.5),9,fonts.semibold,ink,col);
    }
  }
  const bottom = top-mm(rows ? 43 : stacked ? 77 : 22);
  let next = bottom;
  for (const line of wrap(frost.note,fonts.regular,6,width)) { textNote(line); }
  function textNote(line: string) { drawCentered(page,line,left+width/2,next,6,fonts.regular,ink,width); next-=mm(2.5); }
  return next-mm(2);
}

function drawCareGlyph(page: import("pdf-lib").PDFPage, kind: "light" | "water" | "frost", cx: number, cy: number, size: number, level: number, ink: ReturnType<typeof import("pdf-lib").rgb>) {
  if (kind === "frost") { drawSnowflake(page,cx,cy,size,ink); return; }
  const k=size/100;
  if(kind === "water") { page.drawSvgPath("M50 8 C43 20 23 43 23 61 A27 27 0 0 0 77 61 C77 43 57 20 50 8Z",{x:cx-size/2,y:cy+size/2,scale:k,borderColor:ink,borderWidth:4}); return; }
  page.drawCircle({x:cx,y:cy,size:20*k,borderColor:ink,borderWidth:4*k,color:level<2?ink:undefined});
  if(level>=2 && level<4) page.drawSvgPath("M50 30 A20 20 0 0 0 50 70Z",{x:cx-size/2,y:cy+size/2,scale:k,color:ink});
  for(let i=0;i<8;i++) { const a=i*Math.PI/4;page.drawLine({start:{x:cx+Math.cos(a)*32*k,y:cy+Math.sin(a)*32*k},end:{x:cx+Math.cos(a)*43*k,y:cy+Math.sin(a)*43*k},thickness:4*k,color:ink}); }
}

function drawBadges(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  left: number,
  right: number,
  cursor: number,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const badges = (card.badges ?? []).map((badge) => badge.trim()).filter(Boolean).slice(0, 3);
  if (badges.length === 0) return cursor - mm(1);
  const size = 8;
  const padX = mm(1.5);
  const height = mm(5);
  const gap = mm(1.3);
  const bottom = cursor - height - mm(0.6);
  let badgeX = left;
  for (const badge of badges) {
    const textWidth = fonts.semibold.widthOfTextAtSize(badge, size);
    const pillWidth = textWidth + padX * 2;
    if (badgeX + pillWidth > right + 1) break;
    page.drawRectangle({
      x: badgeX,
      y: bottom,
      width: pillWidth,
      height,
      borderColor: ink,
      borderWidth: 0.7,
    });
    page.drawText(badge, {
      x: badgeX + padX,
      y: bottom + mm(1.45),
      size,
      font: fonts.semibold,
      color: ink,
    });
    badgeX += pillWidth + gap;
  }
  return bottom - mm(2.2);
}

function drawCentered(
  page: import("pdf-lib").PDFPage,
  text: string,
  center: number,
  y: number,
  size: number,
  font: import("pdf-lib").PDFFont,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
  width: number,
) {
  const shown = fitLine(text, font, size, width);
  const textWidth = font.widthOfTextAtSize(shown, size);
  page.drawText(shown, { x: center - textWidth / 2, y, size, font, color: ink });
}

function drawSnowflake(
  page: import("pdf-lib").PDFPage,
  cx: number,
  cy: number,
  size: number,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const scale = size / 100;
  for (const line of snowflakeLines()) {
    page.drawLine({
      start: { x: cx + (line.x1 - 50) * scale, y: cy - (line.y1 - 50) * scale },
      end: { x: cx + (line.x2 - 50) * scale, y: cy - (line.y2 - 50) * scale },
      thickness: size * 0.04,
      color: ink,
    });
  }

}

function drawScales(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  left: number,
  contentWidth: number,
  cursor: number,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
) {
  const { rgb } = requireRgb();
  const frost = resolveFrost(card);
  const columns: { title: string; kind: "light" | "water" | "frost" }[] = [
    { title: "STANOWISKO", kind: "light" },
    { title: "PODLEWANIE", kind: "water" },
    { title: "ODPORNOŚĆ NA MRÓZ", kind: "frost" },
  ];
  const gap = mm(1.4);
  const columnWidth = (contentWidth - gap * 2) / 3;
  const widths = [columnWidth * 1.05, columnWidth * 0.9, columnWidth * 1.15];
  const widthSum = widths.reduce((sum, item) => sum + item, 0);
  const scaled = widths.map((item) => (item / widthSum) * (contentWidth - gap * 2));
  let columnX = left;
  scaled.forEach((width, index) => {
    const column = columns[index];
    const center = columnX + width / 2;
    drawCentered(page, column.title, center, cursor - mm(2.6), 6.2, fonts.bold, ink, width);
    const cellGap = mm(0.4);
    const cell = (width - cellGap * 4) / 5;
    const markY = cursor - mm(8.2);
    for (let step = 1; step <= 5; step += 1) {
      const cellX = columnX + (step - 1) * (cell + cellGap);
      const cellCenter = cellX + cell / 2;
      const on = column.kind === "light" ? step >= card.lightFrom && step <= card.lightTo : column.kind === "water" ? step >= card.waterFrom && step <= card.waterTo : frost.known && step <= frost.level;
      drawCareGlyph(page,column.kind,cellCenter,markY+mm(1.5),mm(6),step,ink);
      page.drawLine({start:{x:cellX+cell*0.12,y:cursor-mm(13)},end:{x:cellX+cell*0.88,y:cursor-mm(13)},thickness:on?1.8:0.4,color:on?ink:rgb(0.7,0.7,0.7)});
      const caption = column.kind === "light" ? LIGHT_STEPS[step - 1].caption : column.kind === "water" ? WATER_STEPS[step - 1].caption : FROST_STEPS[step - 1].caption;
      drawCentered(page, caption, cellCenter, cursor - mm(11.4), 5.2, fonts.semibold, ink, cell + cellGap);
    }
    if (column.kind === "frost") {
      const markerX = columnX + width * 0.6;
      page.drawLine({
        start: { x: markerX, y: cursor - mm(13.5) },
        end: { x: markerX, y: cursor - mm(14.5) },
        thickness: 0.5,
        color: ink,
      });

    }
    const value = column.kind === "light"
      ? rangeCaption(LIGHT_STEPS, card.lightFrom, card.lightTo)
      : column.kind === "water"
        ? rangeCaption(WATER_STEPS, card.waterFrom, card.waterTo)
        : frost.value;
    drawCentered(page, value, center, cursor - mm(16), 6.4, fonts.bold, ink, width);
    columnX += width + gap;
  });
  const legendWidth = fonts.regular.widthOfTextAtSize(SCALE_LEGEND, 6);
  const legend = legendWidth > contentWidth ? fitLine(SCALE_LEGEND, fonts.regular, 6, contentWidth) : SCALE_LEGEND;
  const legendTextWidth = fonts.regular.widthOfTextAtSize(legend, 6);
  page.drawText(legend, {
    x: left + (contentWidth - legendTextWidth) / 2,
    y: cursor - mm(19),
    size: 6,
    font: fonts.regular,
    color: ink,
  });
  let next = cursor - mm(22);
  if (frost.note) {
    const note = fitLine(frost.note, fonts.semibold, 6.5, contentWidth);
    const noteWidth = fonts.semibold.widthOfTextAtSize(note, 6.5);
    page.drawText(note, {
      x: left + (contentWidth - noteWidth) / 2,
      y: next,
      size: 6.5,
      font: fonts.semibold,
      color: ink,
    });
    next -= mm(3.2);
  }
  return next - mm(1);
}

function drawMonths(
  page: import("pdf-lib").PDFPage,
  card: CardModel,
  left: number,
  contentWidth: number,
  cursor: number,
  fonts: Fonts,
  ink: ReturnType<typeof import("pdf-lib").rgb>,
  rgb: typeof import("pdf-lib").rgb,
) {
  const active = new Set(card.bloomMonths ?? []);
  const gap = mm(0.55);
  const boxWidth = (contentWidth - gap * 11) / 12;
  const boxHeight = mm(5.6);
  const bottom = cursor - boxHeight;
  const sage = ink;
  MONTH_ROMAN.forEach((label, index) => {
    const boxX = left + index * (boxWidth + gap);
    page.drawRectangle({
      x: boxX,
      y: bottom,
      width: boxWidth,
      height: boxHeight,
      borderColor: ink,
      borderWidth: 0.6,
      color: active.has(index + 1) ? sage : rgb(1, 1, 1),
    });
    const size = label.length > 2 ? 5.4 : 6.4;
    const textWidth = fonts.bold.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: boxX + (boxWidth - textWidth) / 2,
      y: bottom + mm(1.55),
      size,
      font: fonts.bold,
      color: active.has(index + 1) ? rgb(1, 1, 1) : ink,
    });
  });
  const caption = active.size > 0 ? "kwitnienie albo główna ozdoba" : "miesiące ozdoby niepodane";
  const captionWidth = fonts.regular.widthOfTextAtSize(caption, 6.5);
  page.drawText(caption, {
    x: left + (contentWidth - captionWidth) / 2,
    y: bottom - mm(3.2),
    size: 6.5,
    font: fonts.regular,
    color: ink,
  });
  return bottom - mm(5);
}

function requireRgb() {
  // pdf-lib is loaded by the caller; rgb is passed through a lazy require-like import kept local
  // to avoid pulling the module into the type of every helper. The real import lives in downloadCardPdf.
  return rgbHolder;
}

const rgbHolder: { rgb: typeof import("pdf-lib").rgb } = {
  rgb: (r, g, b) => {
    throw new Error(`PDF nie jest gotowe (${r},${g},${b})`);
  },
};

type ClipOps = Pick<
  typeof import("pdf-lib"),
  "pushGraphicsState" | "popGraphicsState" | "rectangle" | "clip" | "endPath" | "moveTo" | "appendBezierCurve" | "closePath"
>;

const clipHolder: { ops: ClipOps | null } = { ops: null };

function requireClip(): ClipOps {
  if (!clipHolder.ops) throw new Error("PDF nie jest gotowe");
  return clipHolder.ops;
}

export async function downloadCardPdf(card: CardModel, mode: "a5" | "a4", variant: LabelVariant = "a") {
  const pdfLib = await import("pdf-lib");
  const { PDFDocument, rgb } = pdfLib;
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  rgbHolder.rgb = rgb;
  clipHolder.ops = pdfLib;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, semibold, bold, italic, display, displayItalic] = await Promise.all([
    loadFont(FONTS.regular),
    loadFont(FONTS.semibold),
    loadFont(FONTS.bold),
    loadFont(FONTS.italic),
    loadFont(FONTS.display),
    loadFont(FONTS.displayItalic),
  ]);
  const fonts: Fonts = {
    regular: await pdf.embedFont(regular, { subset: true }),
    semibold: await pdf.embedFont(semibold, { subset: true }),
    bold: await pdf.embedFont(bold, { subset: true }),
    italic: await pdf.embedFont(italic, { subset: true }),
    display: await pdf.embedFont(display, { subset: true }),
    displayItalic: await pdf.embedFont(displayItalic, { subset: true }),
  };
  const photo = await embedPhoto(pdf, card.photoDataUrl);
  if (mode === "a5") {
    const page = pdf.addPage([mm(148), mm(210)]);
    drawCard(page, card, photo, variant, 0, 0, fonts);
  } else {
    const page = pdf.addPage([mm(297), mm(210)]);
    drawCard(page, card, photo, variant, 0, 0, fonts);
    drawCard(page, card, photo, variant, mm(149), 0, fonts);
    page.drawLine({
      start: { x: mm(148.5), y: mm(6) },
      end: { x: mm(148.5), y: mm(204) },
      thickness: 0.7,
      color: rgb(0.1, 0.1, 0.1),
      dashArray: [3, 2],
    });
  }
  const bytes = await pdf.save();
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = fileSlug(card.polishName || card.latinName);
  link.download = mode === "a5" ? `etykieta-${slug}.pdf` : `etykiety-a4-${slug}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
