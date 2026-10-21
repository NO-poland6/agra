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
  snowflakeLines,
  wateringForRange,
} from "@/lib/scales";
import type { PlantInfo } from "@/lib/types";

function SnowflakeMark({ filled }: { filled: boolean }) {
  const lines = snowflakeLines();
  return (
    <svg viewBox="0 0 100 100" className={filled ? "flake is-on" : "flake"} aria-hidden>
      {lines.map((line, index) => (
        <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
      ))}
      <circle cx="50" cy="50" r={filled ? 5.5 : 3.2} />
    </svg>
  );
}

function DropMark({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 32" className={filled ? "drop is-on" : "drop"} aria-hidden>
      <path d="M12 2.2C12 2.2 3.2 14 3.2 20.2a8.8 8.8 0 0 0 17.6 0C20.8 14 12 2.2 12 2.2Z" />
    </svg>
  );
}

function ScaleHeading({ children }: { children: string }) {
  return <p className="scale-heading">{children}</p>;
}

export function CareScales({ info }: { info: PlantInfo }) {
  const frost = resolveFrost(info);
  const lightLabel = rangeCaption(LIGHT_STEPS, info.lightFrom, info.lightTo);
  const waterLabel = rangeCaption(WATER_STEPS, info.waterFrom, info.waterTo);
  return (
    <div className="shelf-care" data-testid="shelf-scales">
      <div className="shelf-scales">
        <section data-testid="scale-light">
          <ScaleHeading>Stanowisko</ScaleHeading>
          <div className="scale-track" aria-label={`Stanowisko: ${lightLabel}`}>
            {LIGHT_STEPS.map((step) => {
              const on = step.level >= info.lightFrom && step.level <= info.lightTo;
              return (
                <div key={step.level} className={on ? "scale-cell is-on" : "scale-cell"}>
                  <span className="scale-num">{step.level}</span>
                  <span className="scale-bar" />
                  <span className="scale-cap">{step.caption}</span>
                </div>
              );
            })}
          </div>
          <p className="scale-value">{lightLabel}</p>
        </section>
        <section data-testid="scale-water">
          <ScaleHeading>Podlewanie</ScaleHeading>
          <div className="scale-track drops" aria-label={`Podlewanie: ${waterLabel}`}>
            {WATER_STEPS.map((step) => {
              const on = step.level >= info.waterFrom && step.level <= info.waterTo;
              return (
                <div key={step.level} className={on ? "scale-cell is-on" : "scale-cell"}>
                  <DropMark filled={on} />
                  <span className="scale-cap">{step.caption}</span>
                </div>
              );
            })}
          </div>
          <p className="scale-value">{waterLabel}</p>
        </section>
        <section data-testid="scale-frost">
          <ScaleHeading>Odporność na mróz</ScaleHeading>
          <div className="scale-track flakes" aria-label={`Mróz: ${frost.value}`}>
            {FROST_STEPS.map((step) => {
              const on = frost.known && step.level <= frost.level;
              return (
                <div key={step.level} className={on ? "scale-cell is-on" : "scale-cell"}>
                  <SnowflakeMark filled={on} />
                  <span className="scale-cap">{step.caption}</span>
                </div>
              );
            })}
            <span className="scale-shop" data-testid="scale-shop" title={`${SHOP_REGION.name} ${SHOP_REGION.zone}`} />
          </div>
          <p className="scale-value">{frost.value}</p>
        </section>
      </div>
      <p className="scale-legend">{SCALE_LEGEND}</p>
      {frost.note ? <p className="scale-note">{frost.note}</p> : null}
    </div>
  );
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
