"use client";

import {
  FROST_ANCHORS,
  FROST_STEPS,
  LIGHT_STEPS,
  SCALE_LEGEND,
  SHOP_REGION,
  WATER_STEPS,
  adjustRange,
  frostLabelForLevel,
  lightForRange,
  rangeCaption,
  resolveFrost,
  wateringForRange,
} from "@/lib/scales";
import type { PlantInfo } from "@/lib/types";

import { CareGlyph } from "@/components/care-icons";
import { careSummary } from "@/lib/care-summary";

export function CareScales({ info, compact = false }: { info: PlantInfo; compact?: boolean }) {
  const frost = resolveFrost(info);
  const summary = careSummary(info);
  const columns = [
    { kind: "light" as const, title: "Stanowisko", steps: LIGHT_STEPS, value: summary.light, detail: rangeCaption(LIGHT_STEPS, info.lightFrom, info.lightTo) },
    { kind: "water" as const, title: "Podlewanie", steps: WATER_STEPS, value: summary.water, detail: rangeCaption(WATER_STEPS, info.waterFrom, info.waterTo) },
    { kind: "frost" as const, title: "Odporność na mróz", steps: FROST_STEPS, value: frost.value, detail: frost.value },
  ];
  return <div className={`shelf-care${compact ? " care-compact" : ""}`} data-testid="shelf-scales">
    <div className="shelf-scales">
      {columns.map(({ kind, title, steps, value, detail }) => <section key={kind} data-testid={`scale-${kind}`} aria-label={`${title}: ${detail}`}>
        <p className="scale-heading">{title}</p>
        {compact ? <div className="care-single"><CareGlyph kind={kind} level={info.lightTo} /></div> : <div className="scale-track">
          {steps.map((step) => {
            const on = kind === "light" ? step.level >= info.lightFrom && step.level <= info.lightTo : kind === "water" ? step.level >= info.waterFrom && step.level <= info.waterTo : frost.known && step.level <= frost.level;
            return <div key={step.level} className={`scale-cell${on ? " is-on" : ""}`}>
              <CareGlyph kind={kind} level={step.level} /><span className="scale-cap">{step.caption}</span><span className="scale-selection" />
            </div>;
          })}
          {kind === "frost" ? <span className="scale-shop" data-testid="scale-shop" title="Kłodzko · 6a · ok. −23 °C" /> : null}
        </div>}
        <p className="scale-value">{compact ? value : detail}</p>
      </section>)}
    </div>
    <p className="scale-legend">{compact ? "Kłodzko · strefa 6a · ok. −23 °C" : SCALE_LEGEND}</p>
    {frost.note ? <p className="scale-note">{frost.note}</p> : null}
  </div>;
}

export function CareScaleEditor({
  info,
  onChange,
}: {
  info: PlantInfo;
  onChange: (partial: Partial<PlantInfo>) => void;
}) {
  const frost = resolveFrost(info);
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium">Stanowisko</p>
        <p className="mb-1 text-xs text-muted-foreground">Od cienia do pełnego słońca. Kliknij skraj, żeby rozszerzyć albo zwęzić zakres.</p>
        <div className="flex flex-wrap gap-1">
          {LIGHT_STEPS.map((step) => {
            const on = step.level >= info.lightFrom && step.level <= info.lightTo;
            return (
              <button
                key={step.level}
                type="button"
                aria-pressed={on}
                className={on ? "h-9 rounded-md bg-primary px-2 text-xs text-primary-foreground" : "h-9 rounded-md border border-border bg-background px-2 text-xs"}
                onClick={() => {
                  const [lightFrom, lightTo] = adjustRange(info.lightFrom, info.lightTo, step.level);
                  onChange({ lightFrom, lightTo, light: lightForRange(lightFrom, lightTo) });
                }}
              >
                {step.level} {step.caption}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Podlewanie</p>
        <p className="mb-1 text-xs text-muted-foreground">1 to susza, 5 to stale mokre podłoże.</p>
        <div className="flex flex-wrap gap-1">
          {WATER_STEPS.map((step) => {
            const on = step.level >= info.waterFrom && step.level <= info.waterTo;
            return (
              <button
                key={step.level}
                type="button"
                aria-pressed={on}
                className={on ? "h-9 rounded-md bg-primary px-2 text-xs text-primary-foreground" : "h-9 rounded-md border border-border bg-background px-2 text-xs"}
                onClick={() => {
                  const [waterFrom, waterTo] = adjustRange(info.waterFrom, info.waterTo, step.level);
                  onChange({ waterFrom, waterTo, watering: wateringForRange(waterFrom, waterTo) });
                }}
              >
                {step.level} {step.caption}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Odporność na mróz</p>
        <p className="mb-1 text-xs text-muted-foreground">
          Pięć płatków, od braku zimowania na dworze do mrozu poniżej −30 °C. Kreska na karcie to {SHOP_REGION.name}, strefa {SHOP_REGION.zone}.
        </p>
        <div className="flex flex-wrap gap-1">
          {FROST_STEPS.map((step) => {
            const on = frost.known && step.level <= frost.level;
            const anchor = FROST_ANCHORS.find((item) => item.level === step.level);
            return (
              <button
                key={step.level}
                type="button"
                aria-pressed={on}
                className={on ? "h-9 rounded-md bg-primary px-2 text-xs text-primary-foreground" : "h-9 rounded-md border border-border bg-background px-2 text-xs"}
                onClick={() => {
                  if (!anchor) return;
                  onChange({
                    hardinessC: anchor.hardinessC,
                    usdaZone: anchor.usdaZone,
                    frostLabel: frostLabelForLevel(anchor.level),
                  });
                }}
              >
                {step.level} {step.caption} · {step.zone}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Na karcie: {frost.value}{frost.clearsShop ? " — sięga zimy w Kłodzku." : frost.known ? " — nie sięga kreski Kłodzka." : ""}</p>
      </div>
    </div>
  );
}
