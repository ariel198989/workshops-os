'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { QrCode } from '@/components/ws/QrCode';
import { SCAN_INSTRUCTION, SCAN_TITLE } from '@/lib/ws/group-access';
import { cardFallbackLine, paginate, type EntryCard } from '@/lib/ws/entry-cards';

export const CARD_QR_MM = 45;

// Everything except the print root is hidden while printing; six cards per A4 portrait page, dashed cut lines between them.
const PRINT_CSS = `
.p4-cards-root{display:none}
@media print{
  @page{size:A4 portrait;margin:0}
  html,body{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  body > *:not(.p4-cards-root){display:none!important}
  .p4-cards-root{display:block;color:#000;background:#fff;font-family:"Rubik",-apple-system,"Segoe UI","Heebo",Arial,sans-serif}
  .p4-cards-page{width:210mm;height:297mm;padding:10mm;box-sizing:border-box;overflow:hidden;break-after:page;page-break-after:always;
    display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:92mm;align-content:start;
    border-top:.3mm dashed #777;border-inline-start:.3mm dashed #777}
  .p4-cards-page:last-child{break-after:auto;page-break-after:auto}
  .p4-card{border-inline-end:.3mm dashed #777;border-bottom:.3mm dashed #777;padding:5mm 6mm;box-sizing:border-box;
    display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;gap:2mm}
  .p4-card-label{font-size:22pt;font-weight:700;line-height:1.15;overflow-wrap:anywhere}
  .p4-card-scan{font-size:11pt;font-weight:600}
  .p4-card-noqr{width:${CARD_QR_MM}mm;height:${CARD_QR_MM}mm;display:grid;place-items:center;border:.3mm dashed #777;font-size:9pt;padding:3mm;box-sizing:border-box}
  .p4-card-line{font-size:11pt;margin:0}
  .p4-card-fallback{font-size:9.5pt;margin:0;color:#000}
  .p4-card-pin{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:700;letter-spacing:.1em;unicode-bidi:isolate}
}`;

interface EntryCardsPrintProps {
  cards: readonly EntryCard[];
  onDone: () => void;
}

function Card({ card }: { card: EntryCard }) {
  return (
    <div className="p4-card">
      <div className="p4-card-label">{card.label}</div>
      <div className="p4-card-scan">{SCAN_TITLE}</div>
      {card.joinUrl
        ? <QrCode value={card.joinUrl} size={`${CARD_QR_MM}mm`} label={`קוד QR לכניסת ${card.label}`} />
        : <div className="p4-card-noqr">אין עדיין קישור סריקה. לחצו &quot;קישור חדש&quot; בלוח הקבוצות</div>}
      <p className="p4-card-line">{SCAN_INSTRUCTION}</p>
      <p className="p4-card-fallback">
        {cardFallbackLine(card)} <span className="p4-card-pin" dir="ltr">{card.pin ?? '----'}</span>
      </p>
    </div>
  );
}

/** Mount to print: renders the entry cards into document.body, opens the print dialog, unmounts after (PrintHost pattern). */
export function EntryCardsPrint({ cards, onDone }: EntryCardsPrintProps) {
  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) onDone(); };
    window.addEventListener('afterprint', finish);
    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    void ready.then(() => {
      if (!cancelled) requestAnimationFrame(() => { if (!cancelled) window.print(); });
    });
    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="p4-cards-root" dir="rtl" lang="he">
      <style>{PRINT_CSS}</style>
      {paginate(cards).map((page, i) => (
        <div key={i} className="p4-cards-page">
          {page.map((card) => <Card key={card.groupId} card={card} />)}
        </div>
      ))}
    </div>,
    document.body,
  );
}
