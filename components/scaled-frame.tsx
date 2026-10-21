"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const PX_PER_MM = 96 / 25.4;

export function ScaledFrame({
  widthMm,
  heightMm,
  children,
}: {
  widthMm: number;
  heightMm: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const natural = widthMm * PX_PER_MM;
      const next = node.clientWidth / natural;
      setScale(Number.isFinite(next) && next > 0 ? Math.min(next, 1) : 0.5);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [widthMm]);

  const width = widthMm * PX_PER_MM;
  const height = heightMm * PX_PER_MM;

  return (
    <div ref={ref} className="w-full" style={{ height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
