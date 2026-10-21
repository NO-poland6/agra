"use client";

import { useRef } from "react";
import { ImagePlus, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { photoProxyUrl, type PhotoCandidate } from "@/lib/photos";

export type PhotoSearchStatus = "idle" | "loading" | "ready" | "empty" | "error";

export function PhotoPicker({
  status,
  candidates,
  selectedId,
  credit,
  onSelect,
  onClear,
  onUpload,
  onRetry,
}: {
  status: PhotoSearchStatus;
  candidates: PhotoCandidate[];
  selectedId: string | null;
  credit: string | null;
  onSelect: (photo: PhotoCandidate) => void;
  onClear: () => void;
  onUpload: (file: File | undefined) => void;
  onRetry: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-2" data-testid="photo-picker">
      <p className="text-sm font-medium" id="zdjecie-etykieta">
        Zdjęcie rośliny
      </p>
      <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="photo-status">
        {status === "loading"
          ? "Szukam zdjęcia na wolnej licencji…"
          : status === "empty"
            ? "Nie znaleziono zdjęcia na wolnej licencji. Wgraj własne albo zostaw kartę bez fotografii."
            : status === "error"
              ? "Nie udało się pobrać zdjęć. Karta działa dalej — wgraj własne albo spróbuj ponownie."
              : candidates.length > 0
                ? "Wybierz kadr. Na karcie zostanie drobny podpis autora i licencji."
                : "Po przygotowaniu etykiety program sam poszuka zdjęcia. Możesz też wgrać własne."}
      </p>
      {candidates.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5" role="listbox" aria-labelledby="zdjecie-etykieta">
          {candidates.map((photo) => {
            const selected = selectedId === photo.id;
            return (
              <button
                key={photo.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-testid="photo-candidate"
                title={photo.credit}
                className={
                  selected
                    ? "overflow-hidden rounded-md ring-2 ring-primary ring-offset-2 ring-offset-card"
                    : "overflow-hidden rounded-md ring-1 ring-border hover:ring-primary/60"
                }
                onClick={() => onSelect(photo)}
              >
                {/* Podgląd idzie przez /api/photo, żeby miniatura była z tego samego źródła co druk. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoProxyUrl(photo.thumbUrl)}
                  alt=""
                  className="aspect-[4/3] w-full bg-[#efeae0] object-cover"
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.dataset.fallback === "1") return;
                    image.dataset.fallback = "1";
                    image.src = photoProxyUrl(photo.printUrl);
                  }}
                />
              </button>
            );
          })}
        </div>
      ) : null}
      {credit ? (
        <p className="text-xs text-muted-foreground" data-testid="photo-credit-preview">
          Podpis na karcie: {credit}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={selectedId === "none" ? "default" : "outline"} className="h-10" onClick={onClear}>
          <ImageOff />
          Bez zdjęcia
        </Button>
        <Button type="button" variant={selectedId === "upload" ? "default" : "outline"} className="h-10" onClick={() => fileRef.current?.click()}>
          <ImagePlus />
          Własne zdjęcie
        </Button>
        {status === "error" || status === "empty" ? (
          <Button type="button" variant="ghost" className="h-10" onClick={onRetry}>
            Szukaj ponownie
          </Button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        id="zdjecie"
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          onUpload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
