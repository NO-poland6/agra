"use client";

import { useEffect, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScaledFrame } from "@/components/scaled-frame";
import { formatPrice, parsePrice } from "@/lib/format";
import { downloadPriceCardPdf } from "@/lib/pdf";
import {
  PRICE_CONTENT,
  PRICE_HEIGHT,
  PRICE_LEFT,
  PRICE_MM,
  PRICE_NAME_TOP,
  PRICE_WIDTH,
  priceBaseline,
  priceCardLayout,
  type PriceCardModel,
  type PriceFonts,
} from "@/lib/price-card";

const FONT_DISPLAY = "AgraPriceDisplay";
const FONT_SANS = "AgraPriceSans";

function PriceCard({ card, ready }: { card: PriceCardModel; ready: boolean }) {
  const context =
    typeof document !== "undefined" && ready
      ? document.createElement("canvas").getContext("2d")
      : null;
  const measure = (text: string, size: number, display: boolean) => {
    if (!context) return text.length * size * 0.55;
    context.font = `${size}px ${display ? FONT_DISPLAY : FONT_SANS}`;
    return context.measureText(text).width;
  };
  const layout = priceCardLayout(card, measure);
  return (
    <article
      className="big-price-card"
      data-testid="big-price-card"
      aria-label={`${card.name || "Nazwa rośliny"}, ${formatPrice(card.price)}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${PRICE_WIDTH} ${PRICE_HEIGHT}`}
        width="100%"
        height="100%"
        role="img"
        aria-label="Cenówka A5"
      >
        <rect width={PRICE_WIDTH} height={PRICE_HEIGHT} fill="white" />
        <g fontFamily={FONT_SANS} fill="#181818">
          <rect
            x={PRICE_LEFT}
            y={6 * PRICE_MM}
            width={PRICE_CONTENT}
            height={10 * PRICE_MM}
            fill="#181818"
          />
          <text
            x={11 * PRICE_MM}
            y={12.7 * PRICE_MM}
            fill="white"
            fontSize="12"
            letterSpacing="1.5"
          >
            AGRA PSK
          </text>
          <text
            x={137 * PRICE_MM}
            y={12.7 * PRICE_MM}
            fill="white"
            fontSize="8"
            textAnchor="end"
          >
            Kłodzko · od 1991 r.
          </text>
          <path
            d={`M ${PRICE_LEFT} ${19 * PRICE_MM} h ${PRICE_CONTENT}`}
            stroke="#181818"
            strokeWidth={PRICE_MM}
          />
          <g fontFamily={FONT_DISPLAY}>
            {layout.lines.map((line, index) => (
              <text
                key={index}
                x={PRICE_LEFT}
                y={PRICE_NAME_TOP + layout.nameSize * (0.9 + index * 1.12)}
                fontSize={layout.nameSize}
              >
                {line}
              </text>
            ))}
            <text
              x={layout.priceX}
              y={priceBaseline(
                layout.priceSize,
                layout.nameSize,
                layout.lines.length,
              )}
              fontSize={layout.priceSize}
            >
              {layout.amount}
            </text>
          </g>
          <text
            x={layout.currencyX}
            y={priceBaseline(
              layout.priceSize,
              layout.nameSize,
              layout.lines.length,
            )}
            fontSize={layout.priceSize * 0.24}
          >
            zł
          </text>
        </g>
      </svg>
    </article>
  );
}

function PriceSheet({
  card,
  ready,
  twoUp,
}: {
  card: PriceCardModel;
  ready: boolean;
  twoUp: boolean;
}) {
  return twoUp ? (
    <div className="sheet-a4-row">
      <PriceCard card={card} ready={ready} />
      <div className="cut-gutter" aria-hidden />
      <PriceCard card={card} ready={ready} />
    </div>
  ) : (
    <PriceCard card={card} ready={ready} />
  );
}

export function BigPriceModule({ fonts }: { fonts: PriceFonts }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [preview, setPreview] = useState<"a5" | "a4">("a5");
  const [saved, setSaved] = useState<PriceCardModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const faces = [
      new FontFace(FONT_DISPLAY, `url(data:font/ttf;base64,${fonts.display})`),
      new FontFace(FONT_SANS, `url(data:font/ttf;base64,${fonts.bold})`),
    ];
    Promise.all(faces.map((face) => face.load()))
      .then((loaded) => {
        if (cancelled) return;
        loaded.forEach((face) => document.fonts.add(face));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled)
          setError("Nie udało się wczytać kroju pisma. Odśwież stronę.");
      });
    return () => {
      cancelled = true;
      faces.forEach((face) => document.fonts.delete(face));
    };
  }, [fonts]);
  const value = parsePrice(price);
  const valid = Boolean(name.trim() && value !== null);
  const card = { name: name.trim(), price: value ?? 0 };
  function print() {
    const style =
      document.getElementById("print-page-size") ??
      document.createElement("style");
    style.id = "print-page-size";
    style.textContent =
      preview === "a4"
        ? "@page { size: 297mm 210mm; margin: 0; }"
        : "@page { size: 148mm 210mm; margin: 0; }";
    document.head.appendChild(style);
    document.documentElement.dataset.print = preview;
    window.print();
  }
  async function savePdf() {
    setError(null);
    setExporting(true);
    try {
      await downloadPriceCardPdf(card, preview, fonts);
    } catch {
      setError(
        "Nie udało się zbudować PDF. Spróbuj ponownie lub użyj przycisku „Drukuj”.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <main className="screen-ui mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section className="grid content-start gap-5">
          <form
            className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (!valid) {
                setError("Wpisz nazwę i poprawną cenę, na przykład 19,99.");
                return;
              }
              setSaved((current) => [...current, card]);
              setError(null);
            }}
          >
            <div>
              <h2 className="font-display text-xl">Duża cena</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nazwa i cena. Gotowe do wydruku na dużej karcie A5.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="big-price-name">Nazwa</Label>
              <Input
                id="big-price-name"
                className="h-10 bg-background"
                value={name}
                maxLength={300}
                autoComplete="off"
                placeholder="np. Lawenda wąskolistna"
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="big-price-value">Cena</Label>
              <div className="relative">
                <Input
                  id="big-price-value"
                  className="h-10 bg-background pr-10"
                  inputMode="decimal"
                  value={price}
                  placeholder="19,99"
                  autoComplete="off"
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
                <span className="pointer-events-none absolute top-2 right-3 text-muted-foreground">
                  zł
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Wpisz kwotę z przecinkiem lub kropką.
              </p>
            </div>
            <Button type="submit" size="lg" className="h-11 w-full text-base">
              Dodaj cenówkę
            </Button>
          </form>
          {saved.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Dodane cenówki</h3>
              <div className="flex flex-wrap gap-2">
                {saved.map((item, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setName(item.name);
                      setPrice(formatPrice(item.price).replace(/\s*zł$/, ""));
                    }}
                  >
                    {item.name} · {formatPrice(item.price)}
                  </Button>
                ))}
              </div>
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                Dodano cenówkę. Wybierz ją ponownie, aby wydrukować lub pobrać
                PDF.
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11"
                disabled={!valid || !ready}
                onClick={print}
              >
                <Printer />
                Drukuj
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={!valid || !ready || exporting}
                onClick={() => void savePdf()}
              >
                <FileDown />
                {exporting ? "Tworzę PDF…" : "Pobierz PDF"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Druk i PDF w wybranym formacie. W oknie drukowania ustaw skalę
              100%, marginesy: brak, bez nagłówków i stopek.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </section>
        <section className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">Podgląd wydruku</h2>
            <div className="flex gap-2">
              {(
                [
                  ["a5", "A5"],
                  ["a4", "2 na A4"],
                ] as const
              ).map(([mode, label]) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={preview === mode ? "default" : "outline"}
                  aria-pressed={preview === mode}
                  onClick={() => setPreview(mode)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[#d5cec1] p-3 sm:p-5">
            <ScaledFrame widthMm={preview === "a5" ? 148 : 297} heightMm={210}>
              <div className="shadow-[0_12px_28px_rgba(40,32,20,0.18)]">
                <PriceSheet
                  card={card}
                  ready={ready}
                  twoUp={preview === "a4"}
                />
              </div>
            </ScaledFrame>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {preview === "a5"
              ? "Karta A5 · 148 × 210 mm. Podgląd aktualizuje się podczas pisania."
              : "A4 poziomo · dwie kopie cenówki i linia cięcia pośrodku."}
          </p>
        </section>
      </main>
      <div className="print-only sheet-a5">
        <PriceSheet card={card} ready={ready} twoUp={false} />
      </div>
      <div className="print-only sheet-a4">
        <PriceSheet card={card} ready={ready} twoUp />
      </div>
    </>
  );
}
