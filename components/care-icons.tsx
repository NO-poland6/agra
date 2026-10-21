"use client";

import { useId } from "react";
import type { FrostLabel, Light, Watering } from "@/lib/types";
import { dropsFor } from "@/lib/labels";

function Drop({ filled, x }: { filled: boolean; x: number }) {
  return (
    <path
      d={`M${x} 3 C${x} 3 ${x - 8} 16 ${x - 8} 22 a8 8 0 0 0 16 0 C${x + 8} 16 ${x} 3 ${x} 3 Z`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  );
}

export function WaterIcon({ watering }: { watering: Watering }) {
  const level = dropsFor(watering);
  return (
    <svg viewBox="0 0 72 34" className="shelf-pictogram" aria-hidden>
      {[0, 1, 2].map((index) => (
        <Drop key={index} x={12 + index * 24} filled={index < level} />
      ))}
    </svg>
  );
}

export function LightIcon({ light }: { light: Light }) {
  const rawId = useId().replace(/:/g, "");
  const halfId = `half-${rawId}`;
  if (light === "shade") {
    return (
      <svg viewBox="0 0 48 48" className="shelf-pictogram" aria-hidden>
        <path
          d="M14 34h22a8 8 0 0 0 1.2-15.9A10 10 0 0 0 18 16a8 8 0 0 0-4 18Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="shelf-pictogram" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M24 6 v5 M24 37 v5 M6 24 h5 M37 24 h5 M11 11 l3.5 3.5 M33.5 33.5 L37 37 M37 11 l-3.5 3.5 M14.5 33.5 L11 37" />
      </g>
      <circle cx="24" cy="24" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {light === "sun" ? <circle cx="24" cy="24" r="3.2" fill="currentColor" /> : null}
      {light === "partial" ? (
        <>
          <clipPath id={halfId}>
            <rect x="0" y="0" width="24" height="48" />
          </clipPath>
          <circle cx="24" cy="24" r="6.2" fill="currentColor" clipPath={`url(#${halfId})`} />
        </>
      ) : null}
    </svg>
  );
}

export function FrostIcon({ frost }: { frost: FrostLabel }) {
  if (frost === "wymaga okrycia") {
    return (
      <svg viewBox="0 0 48 48" className="shelf-pictogram" aria-hidden>
        <path
          d="M24 6 v24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <rect
          x="20"
          y="8"
          width="8"
          height="22"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="24" cy="36" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M22 30 v8 a2 2 0 0 0 4 0 v-8" fill="currentColor" />
      </svg>
    );
  }
  if (frost === "nie zimuje w gruncie") {
    return (
      <svg viewBox="0 0 48 48" className="shelf-pictogram" aria-hidden>
        <path
          d="M16 22 h16 l-2 16 H18 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M14 22 h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M24 22 c0-8 8-8 8-14 M24 20 c-6-2-4-10 2-12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className="shelf-pictogram" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M24 6 v36 M10 14 l28 20 M38 14 L10 34" />
        <path d="M24 12 l-4-2 M24 12 l4-2 M24 36 l-4 2 M24 36 l4 2 M16 20 l-4-3 M16 20 l-1 5 M32 28 l4 3 M32 28 l1-5" />
      </g>
    </svg>
  );
}

export function SizeIcon() {
  return (
    <svg viewBox="0 0 48 48" className="shelf-pictogram" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 6 v28 M24 6 l-4 5 M24 6 l4 5 M24 34 l-4-5 M24 34 l4-5" />
        <path d="M8 40 h32 M8 40 l5-4 M8 40 l5 4 M40 40 l-5-4 M40 40 l-5 4" />
      </g>
    </svg>
  );
}
