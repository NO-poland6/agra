import { snowflakeLines } from "@/lib/scales";

export function CareGlyph({ kind, level = 5 }: { kind: "light" | "water" | "frost"; level?: number }) {
  return <svg viewBox="0 0 100 100" className="care-glyph" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {kind === "frost" ? snowflakeLines().map((line, index) => <line key={index} {...line} />) : kind === "water" ? <path d="M50 8 C43 20 23 43 23 61 A27 27 0 0 0 77 61 C77 43 57 20 50 8Z" /> : <>
      {Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return <line key={i} x1={50 + Math.cos(a) * 32} y1={50 + Math.sin(a) * 32} x2={50 + Math.cos(a) * 43} y2={50 + Math.sin(a) * 43} />; })}
      <circle cx="50" cy="50" r="20" />
      {level < 4 ? <path d="M50 30 A20 20 0 0 0 50 70Z" fill="currentColor" stroke="none" /> : null}
      {level < 2 ? <circle cx="50" cy="50" r="20" fill="currentColor" /> : null}
    </>}
  </svg>;
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
