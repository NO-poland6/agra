"use client";

import { useEffect, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScaledFrame } from "@/components/scaled-frame";
import { PriceCardHeader } from "@/components/big-price-module";
import { PRICE_WIDTH, PRICE_HEIGHT, type PriceFonts } from "@/lib/price-card";
import { infoCardLayout, type InfoCardModel } from "@/lib/info-card";
import { downloadInfoCardPdf } from "@/lib/pdf";

const SANS = "AgraInfoSans";
const DISPLAY = "AgraInfoDisplay";

function InfoCard({ card, ready }: { card: InfoCardModel; ready: boolean }) {
  const context =
    typeof document !== "undefined" && ready
      ? document.createElement("canvas").getContext("2d")
      : null;
  const lines = infoCardLayout(card, (text, size, title) => {
    if (!context) return text.length * size * 0.6;
    context.font = `${size}px ${title ? DISPLAY : SANS}`;
    return context.measureText(text).width;
  });
  return (
    <article
      className="big-price-card"
      data-testid="info-card"
      aria-label="Tablica informacyjna A5"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${PRICE_WIDTH} ${PRICE_HEIGHT}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={card.text || "Wpisz treść informacji"}
      >
        <rect width={PRICE_WIDTH} height={PRICE_HEIGHT} fill="white" />
        <g fontFamily={SANS} fill="#181818">
          <PriceCardHeader />
          {lines.map((line, index) => (
            <text
              key={index}
              x={line.x}
              y={line.baseline}
              fontSize={line.size}
              fontFamily={line.title ? DISPLAY : SANS}
            >
              {line.text}
            </text>
          ))}
        </g>
      </svg>
    </article>
  );
}

function InfoSheet({
  card,
  ready,
  twoUp,
}: {
  card: InfoCardModel;
  ready: boolean;
  twoUp: boolean;
}) {
  return twoUp ? (
    <div className="big-price-sheet-a4">
      <InfoCard card={card} ready={ready} />
      <div className="big-price-cut-gutter" aria-hidden />
      <InfoCard card={card} ready={ready} />
    </div>
  ) : (
    <InfoCard card={card} ready={ready} />
  );
}

export function InfoModule({
  fonts,
  preview,
  setPreview,
}: {
  fonts: PriceFonts;
  preview: "a5" | "a4";
  setPreview: (mode: "a5" | "a4") => void;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [align, setAlign] = useState<"left" | "center">("center");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const faces = [
      new FontFace(SANS, `url(data:font/ttf;base64,${fonts.bold})`),
      new FontFace(DISPLAY, `url(data:font/ttf;base64,${fonts.display})`),
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
  const card: InfoCardModel = { title, text, align };
  const valid = Boolean(text.trim()) && ready;
  async function savePdf() {
    setExporting(true);
    setError(null);
    try {
      await downloadInfoCardPdf(card, preview, fonts);
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
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div>
              <h2 className="font-display text-xl">Informacja</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Wpisz komunikat. Wielkość tekstu dopasuje się automatycznie do
                karty.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="info-title">Tytuł (opcjonalnie)</Label>
              <Input
                id="info-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="np. Godziny otwarcia"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="info-text">Treść informacji</Label>
              <textarea
                id="info-text"
                rows={9}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-ring"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  "np. Zapraszamy po świeżą dostawę roślin!\nSzczegóły u obsługi."
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter tworzy nowy wiersz. Długi tekst automatycznie się
                zmniejsza.
              </p>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">
                Wyrównanie tekstu
              </legend>
              <div className="flex gap-2">
                {(
                  [
                    ["center", "Do środka"],
                    ["left", "Do lewej"],
                  ] as const
                ).map(([mode, label]) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={align === mode ? "default" : "outline"}
                    aria-pressed={align === mode}
                    onClick={() => setAlign(mode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="h-11"
                disabled={!valid}
                onClick={() => window.print()}
              >
                <Printer />
                Drukuj
              </Button>
              <Button
                variant="outline"
                className="h-11"
                disabled={!valid || exporting}
                onClick={() => void savePdf()}
              >
                <FileDown />
                {exporting ? "Tworzę PDF…" : "Pobierz PDF"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Druk i PDF w wybranym formacie, na jednej stronie. W oknie
              drukowania ustaw skalę 100%, marginesy: brak, bez nagłówków i
              stopek.
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
            <ScaledFrame widthMm={210} heightMm={preview === "a5" ? 148 : 297}>
              <div className="shadow-[0_12px_28px_rgba(40,32,20,0.18)]">
                <InfoSheet card={card} ready={ready} twoUp={preview === "a4"} />
              </div>
            </ScaledFrame>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {preview === "a5"
              ? "Karta A5 poziomo · 210 × 148 mm."
              : "A4 pionowo · dwie karty i linia cięcia pośrodku."}
          </p>
        </section>
      </main>
      <div className="print-only sheet-a5">
        <InfoSheet card={card} ready={ready} twoUp={false} />
      </div>
      <div className="print-only sheet-a4">
        <InfoSheet card={card} ready={ready} twoUp />
      </div>
    </>
  );
}
