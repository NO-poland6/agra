"use client";

import { useEffect, useRef } from "react";
import { FrostIcon, LightIcon, WaterIcon } from "@/components/care-icons";
import { formatPriceParts } from "@/lib/format";
import { FROST_CAPTION, LIGHT_LABEL, WATERING_LABEL } from "@/lib/labels";
import type { CardModel } from "@/lib/types";

const BRAND = "AGRA PSK Kłodzko – od 1991 r.";

export function PlantCard({
  card,
  onOverflow,
}: {
  card: CardModel;
  onOverflow?: (clipped: boolean) => void;
}) {
  const descRef = useRef<HTMLParagraphElement>(null);
  const { amount, currency } = formatPriceParts(card.price);
  const meta = [card.plantType, card.height].filter(Boolean).join(" · ");
  const compactPrice = amount.replace(/\s/g, "").length > 6;

  useEffect(() => {
    const node = descRef.current;
    if (!node || !onOverflow) return;
    onOverflow(node.scrollHeight > node.clientHeight + 2);
  }, [card.description, card.photoDataUrl, card.polishName, onOverflow]);

  return (
    <article className={card.photoDataUrl ? "shelf-card has-photo" : "shelf-card"} data-testid="shelf-card">
      <div className="shelf-card-inner">
        <header className="shelf-brand">
          <span>AGRA PSK</span>
          <span>Kłodzko</span>
        </header>
        <hr className="shelf-rule" />
        {card.photoDataUrl ? (
          // Zdjęcie jest lokalnym plikiem pracownika, nie zasobem z optymalizatora.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="shelf-photo" src={card.photoDataUrl} alt={`Zdjęcie: ${card.polishName || "roślina"}`} />
        ) : null}
        <h2 className="shelf-name">{card.polishName || "Nazwa rośliny"}</h2>
        {card.latinName ? <p className="shelf-latin">{card.latinName}</p> : null}
        <p ref={descRef} className="shelf-desc">
          {card.description || "Tu pojawi się krótki opis rośliny."}
        </p>
        {meta ? <p className="shelf-meta">{meta}</p> : null}
        <div className="shelf-icons">
          <div className="shelf-icon-col">
            <WaterIcon watering={card.watering} />
            <p className="shelf-icon-value">{WATERING_LABEL[card.watering]}</p>
            <p className="shelf-icon-label">Podlewanie</p>
          </div>
          <div className="shelf-icon-col">
            <LightIcon light={card.light} />
            <p className="shelf-icon-value">{LIGHT_LABEL[card.light]}</p>
            <p className="shelf-icon-label">Stanowisko</p>
          </div>
          <div className="shelf-icon-col">
            <FrostIcon frost={card.frostLabel} />
            <p className="shelf-icon-value">{FROST_CAPTION[card.frostLabel]}</p>
            <p className="shelf-icon-label">Zima</p>
          </div>
        </div>
        {card.frostDetail ? <p className="shelf-frost-detail">{card.frostDetail}</p> : null}
        <div className="shelf-bottom">
          <div className="shelf-price" data-testid="shelf-price">
            <span className={compactPrice ? "shelf-price-amount is-long" : "shelf-price-amount"}>{amount}</span>
            <span className="shelf-price-currency">{currency}</span>
          </div>
          <p className="shelf-footer">{BRAND}</p>
        </div>
      </div>
    </article>
  );
}

export function TwoUpSheet({ card }: { card: CardModel }) {
  return (
    <div className="sheet-a4-row">
      <PlantCard card={card} />
      <div className="cut-gutter" aria-hidden />
      <PlantCard card={card} />
    </div>
  );
}

export function EmptyCard() {
  return (
    <article className="shelf-card" data-testid="empty-card">
      <div className="shelf-card-inner">
        <header className="shelf-brand">
          <span>AGRA PSK</span>
          <span>Kłodzko</span>
        </header>
        <hr className="shelf-rule" />
        <div className="shelf-empty">
          <p className="shelf-empty-title">Etykieta czeka na roślinę</p>
          <p>Wpisz nazwę i cenę. Opis weźmiemy z katalogu szkółki albo, jeśli jest klucz, z opisu AI.</p>
        </div>
        <div className="shelf-bottom">
          <div className="shelf-price">
            <span className="shelf-price-amount">–</span>
            <span className="shelf-price-currency">zł</span>
          </div>
          <p className="shelf-footer">{BRAND}</p>
        </div>
      </div>
    </article>
  );
}
