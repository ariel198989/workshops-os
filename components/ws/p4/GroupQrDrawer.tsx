'use client';
import { Drawer } from '@/components/ws/Drawer';
import { QrCode } from '@/components/ws/QrCode';
import { toast } from '@/lib/store';
import { SCAN_INSTRUCTION, SCAN_TITLE } from '@/lib/ws/group-access';
import styles from './board.module.css';

export type QrKind = 'join' | 'home';
export interface QrTarget {
  kind: QrKind;
  /** group label (display name or "קבוצה N") */
  title: string;
  url: string;
}

interface GroupQrDrawerProps {
  target: QrTarget | null;
  onClose: () => void;
}

export const JOIN_QR_SIZE = 320;
export const HOME_QR_SIZE = 260;

/** Large QR for one group: the one-scan join link (group label in big type + instruction) or the take-home page (url under it). */
export function GroupQrDrawer({ target, onClose }: GroupQrDrawerProps) {
  const copy = async () => {
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.url);
      toast('הקישור הועתק', true);
    } catch {
      toast('ההעתקה נכשלה. סמנו והעתיקו ידנית');
    }
  };
  const join = target?.kind === 'join';
  const title = target ? (join ? SCAN_TITLE : `לוקחים הביתה: ${target.title}`) : '';
  return (
    <Drawer open={target !== null} title={title} onClose={onClose}>
      {target ? (
        <div className={styles.qrBig}>
          {join ? <p className={styles.qrGroup}>{target.title}</p> : null}
          <QrCode value={target.url} size={join ? JOIN_QR_SIZE : HOME_QR_SIZE}
            label={join ? `קוד QR לכניסת ${target.title}` : `קוד QR לדף המודל של ${target.title}`} />
          {join ? <p className={styles.qrInstruction}>{SCAN_INSTRUCTION}</p> : <code dir="ltr">{target.url}</code>}
          <button type="button" onClick={() => void copy()}>העתקת קישור</button>
        </div>
      ) : null}
    </Drawer>
  );
}
