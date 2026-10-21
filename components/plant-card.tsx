"use client";

import { useEffect, useRef } from "react";
import { CareScales } from "@/components/care-scales";
import { SizeIcon } from "@/components/care-icons";
import type { LabelVariant } from "@/lib/variants";
import { formatPriceParts } from "@/lib/format";
import { MONTH_ROMAN, sizeLabel } from "@/lib/shelf";
import type { CardModel } from "@/lib/types";


export function PlantCard({
  card,
  onOverflow,
  variant = "a",
}: {
  card: CardModel;
  variant?: LabelVariant;
  onOverflow?: (clipped: boolean) => void;
}) {
  const descRef = useRef<HTMLParagraphElement>(null);
  const { amount, currency } = formatPriceParts(card.price);
  const compactPrice = amount.replace(/\s/g, "").length > 6;
  const badges = (card.badges ?? []).slice(0, 3);
  const months = new Set(card.bloomMonths ?? []);
  const size = sizeLabel(card.height ?? "", card.width ?? "");

  useEffect(() => {
    const node = descRef.current;
    if (!node || !onOverflow) return;
    onOverflow(node.scrollHeight > node.clientHeight + 2);
  }, [card.badges, card.bloomMonths, card.description, card.photoCredit, card.photoDataUrl, card.polishName, variant, onOverflow]);

  return (
    <article className={`shelf-card variant-${variant}${card.photoDataUrl ? " has-photo" : ""}`} data-variant={variant} data-testid="shelf-card">
      <div className="shelf-card-inner">
        <header className="shelf-band">
          <div>
            <p className="shelf-brand-name">AGRA PSK</p>
            <p className="shelf-brand-place">Kłodzko · od 1991 r.</p>
          </div>
        </header>

        {card.photoDataUrl ? (
          <figure className="shelf-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="shelf-photo"
              src={card.photoDataUrl}
              alt={`Zdjęcie: ${card.polishName || "roślina"}`}
              data-testid="shelf-photo"
            />
            {card.photoCredit ? (
              <figcaption className="shelf-credit" data-testid="shelf-credit">
                {card.photoCredit}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        <h2 className={card.polishName.length > 24 ? "shelf-name is-long" : "shelf-name"}>{card.polishName || "Nazwa rośliny"}</h2>
        {card.latinName ? <p className="shelf-latin">{card.latinName}</p> : <p className="shelf-latin is-empty">nazwa łacińska</p>}
        <p className="shelf-type">
          {card.plantType ? <span>{card.plantType}</span> : null}
          {variant === "b" && (card.height?.trim() || card.width?.trim()) ? (
            <span className="shelf-size-inline shelf-size-lines">
              <SizeIcon />
              <span className="size-lines">
                {card.height?.trim() ? <span>Wysokość: {card.height.trim()}</span> : null}
                {card.width?.trim() ? <span>Szerokość: {card.width.trim()}</span> : null}
              </span>
            </span>
          ) : (
            <span className="shelf-size-inline">
              <SizeIcon />
              {size}
            </span>
          )}
        </p>

        {badges.length > 0 ? (
          <ul className="shelf-badges" data-testid="shelf-badges">
            {badges.map((badge) => (
              <li key={badge}>{badge}</li>
            ))}
          </ul>
        ) : null}

        <CareScales info={card} compact={variant !== "a"} />

        <div className="shelf-months" data-testid="shelf-months" aria-label="Miesiące kwitnienia">
          {MONTH_ROMAN.map((label, index) => {
            const on = months.has(index + 1);
            return (
              <span key={label} className={on ? "shelf-month is-on" : "shelf-month"}>
                {label}
              </span>
            );
          })}
        </div>
        <p className="shelf-month-caption">{months.size > 0 ? "kwitnienie albo główna ozdoba" : "miesiące ozdoby niepodane"}</p>

        <p ref={descRef} className="shelf-desc">
          {card.description || "Krótki opis pojawi się tutaj."}
        </p>

        <div className="shelf-bottom">
          <div className="shelf-price" data-testid="shelf-price">
            <span className={compactPrice ? "shelf-price-amount is-long" : "shelf-price-amount"}>{amount}</span>
            <span className="shelf-price-currency">{currency}</span>
          </div>

        </div>
      </div>
    </article>
  );
}

export function TwoUpSheet({ card, variant = "a" }: { card: CardModel; variant?: LabelVariant }) {
  return (
    <div className="sheet-a4-row">
      <PlantCard card={card} variant={variant} />
      <div className="cut-gutter" aria-hidden />
      <PlantCard card={card} variant={variant} />
    </div>
  );
}

export function EmptyCard() {
  return (
    <article className="shelf-card" data-testid="empty-card">
      <div className="shelf-card-inner">
        <header className="shelf-band">
          <div>
            <p className="shelf-brand-name">AGRA PSK</p>
            <p className="shelf-brand-place">Kłodzko · od 1991 r.</p>
          </div>
        </header>
        <div className="shelf-empty">
          <p className="shelf-empty-title">Etykieta czeka na roślinę</p>
          <p>Wpisz nazwę i cenę. Na karcie pojawią się zdjęcie, piktogramy i kalendarz kwitnienia.</p>
        </div>
        <div className="shelf-bottom">
          <div className="shelf-price">
            <span className="shelf-price-amount">–</span>
            <span className="shelf-price-currency">zł</span>
          </div>

        </div>
      </div>
    </article>
  );
}
