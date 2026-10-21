"use client";

import { useEffect, useState } from "react";

export function PlantQr({ url }: { url: string | null }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    import("qrcode")
      .then((qr) =>
        qr.toDataURL(url, {
          margin: 0,
          width: 180,
          errorCorrectionLevel: "M",
          color: { dark: "#1b2418", light: "#ffffff" },
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;
  return src ? (
    // Kod powstaje lokalnie z adresu Wikipedii. Nie wysyłamy danych sklepu.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="shelf-qr" src={src} alt="" data-testid="shelf-qr" />
  ) : (
    <span className="shelf-qr" data-testid="shelf-qr" />
  );
}
