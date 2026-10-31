// QR code as an SVG path, computed synchronously from the `qrcode` package (no canvas, prints crisply). Unit tested.
import QRCode from 'qrcode';

export interface QrSvg {
  /** modules per side; use as the viewBox size */
  size: number;
  /** one rectangle per dark module, in module units */
  path: string;
}

/** Error correction M balances density with tolerance for a slightly bent certificate. */
const LEVEL = 'M';

export function qrSvg(text: string): QrSvg {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: LEVEL });
  const size = modules.size;
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= size; col += 1) {
      const dark = col < size && modules.get(row, col) === 1;
      if (dark && runStart === -1) runStart = col;
      if (!dark && runStart !== -1) {
        parts.push(`M${runStart} ${row}h${col - runStart}v1h-${col - runStart}z`);
        runStart = -1;
      }
    }
  }
  return { size, path: parts.join('') };
}
