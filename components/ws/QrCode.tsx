import { qrSvg } from '@/lib/qr';

interface QrCodeProps {
  value: string;
  /** CSS size (px number or any unit, e.g. "22mm") */
  size: number | string;
  label: string;
  className?: string;
}

/** Inline SVG QR: crisp at any zoom, prints without image loading, no hooks so it renders anywhere. */
export function QrCode({ value, size, label, className }: QrCodeProps) {
  const { size: n, path } = qrSvg(value);
  return (
    <svg className={className} role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} width={size} height={size}
      shapeRendering="crispEdges" style={{ display: 'block' }}>
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#0F1C2E" />
    </svg>
  );
}
