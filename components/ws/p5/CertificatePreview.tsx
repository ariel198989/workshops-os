import type { CSSProperties } from 'react';
import { QrCode } from '@/components/ws/QrCode';
import type { CertificateModel } from '@/lib/ws/certificate-templates';
import styles from './certificate.module.css';

export const TAKE_HOME_CAPTION = 'סרקו: המודל של הקבוצה רץ בטלפון שלכם';

interface CertificatePreviewProps {
  model: CertificateModel;
  /** screen preview scale; print always renders at 1 */
  zoom?: number;
}

interface Detail { label: string; value: string }

function detailsOf(m: CertificateModel): Detail[] {
  const items: Array<Detail | null> = [
    m.datesRange ? { label: 'תאריכי הסדנה', value: m.datesRange } : null,
    m.hours ? { label: 'שעות לימוד', value: String(m.hours) } : null,
    m.groupName ? { label: 'קבוצה', value: m.groupName } : null,
    m.subproblem ? { label: 'משימה', value: m.subproblem } : null,
  ];
  return items.filter((d): d is Detail => d !== null);
}

/** A4 landscape, print-ready certificate. Verify URL as text; the group's take-home page as a 22 mm QR in the bottom corner. */
export function CertificatePreview({ model, zoom = 1 }: CertificatePreviewProps) {
  const style: CSSProperties | undefined = zoom === 1 ? undefined : { zoom };
  const details = detailsOf(model);
  return (
    <div className={styles.sheet} style={style} dir="rtl" lang="he">
      <span className={styles.brand}>Corewise</span>
      <h1 className={styles.title}>{model.title}</h1>
      <p className={styles.intro}>{model.intro}</p>
      <p className={styles.student} dir="auto">{model.student}</p>
      <p className={styles.summary}>{model.summary}</p>
      <p className={styles.description}>{model.description}</p>
      {model.learned ? <p className={styles.learned}>{model.learned}</p> : null}
      {details.length > 0 ? (
        <div className={styles.details}>
          {details.map((d) => <span key={d.label}><b>{d.label}</b>{d.value}</span>)}
        </div>
      ) : null}
      <span className={styles.date}>{model.dateText}</span>
      <div className={styles.sigs}>
        {model.signatures.map((s) => <div key={s} className={styles.sig}>{s}</div>)}
      </div>
      <div className={styles.verify}>
        <span>מספר תעודה <span className={styles.no} dir="ltr">{model.certificateNo}</span></span>
        <span>אימות: <code dir="ltr">{model.verifyUrl}</code></span>
      </div>
      {model.takeHomeUrl ? (
        <div className={styles.homeQr}>
          <QrCode value={model.takeHomeUrl} size="22mm" label="קוד QR לדף המודל של הקבוצה" />
          <span className={styles.homeQrCap}>{TAKE_HOME_CAPTION}</span>
        </div>
      ) : null}
      {model.revoked ? <div className={styles.revoked} aria-hidden="true">בוטלה</div> : null}
    </div>
  );
}
