import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  /** The URL (or text) to encode. */
  value: string;
  /** Rendered pixel size. */
  size?: number;
  className?: string;
  /** Called with the generated PNG data URL (e.g. for a "Save QR" download). */
  onReady?: (dataUrl: string) => void;
}

/**
 * Client-side QR generation — no server cost. Encodes the permanent sale-page URL.
 * The physical flyer → QR → FlyerBoard is the distribution wedge Facebook/Gumtree
 * can't reach.
 */
export function QrCode({ value, size = 160, className = "", onReady }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2, // 2x for crisp rendering / print
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#242428", light: "#ffffff" },
    })
      .then((url) => {
        if (cancelled) return;
        setDataUrl(url);
        onReady?.(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, onReady]);

  if (!dataUrl) {
    return (
      <div
        className={`shimmer bg-muted rounded-lg ${className}`}
        style={{ width: size, height: size }}
        aria-label="Generating QR code"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="QR code linking to the sale page"
      className={`rounded-lg bg-white ${className}`}
    />
  );
}
