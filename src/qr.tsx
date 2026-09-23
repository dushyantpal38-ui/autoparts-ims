import { useEffect, useRef } from 'react';

// The qrcode library is small but only needed when a QR is actually displayed,
// so it is imported on demand and kept in its own chunk.
export function QrImage({ value, size = 160 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!ref.current) return;
    import('qrcode').then((QRCode) => {
      if (cancelled || !ref.current) return;
      QRCode.toCanvas(ref.current, value, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#111827', light: '#ffffff' },
      }).catch(() => {
        // extremely long values could fail; fall back to text render
        QRCode.toCanvas(ref.current!, value || ' ', { width: size }).catch(() => {});
      });
    });
    return () => { cancelled = true; };
  }, [value, size]);

  return <canvas ref={ref} className="qr-canvas" width={size} height={size} aria-label={`QR code for ${value}`} />;
}
