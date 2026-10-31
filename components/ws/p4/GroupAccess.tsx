'use client';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { QrCode } from '@/components/ws/QrCode';
import { toast } from '@/lib/store';
import { isPin, tabletCopyText, tabletLine, takeHomeUrl } from '@/lib/ws/group-access';
import type { WsGroup } from '@/lib/ws/types';
import styles from './board.module.css';

export interface GroupAccessActions {
  /** the workshop join code students type first */
  code: string;
  /** the ws_groups row (pin, share_token); undefined while loading or for a viewer without the grant */
  row: WsGroup | undefined;
  onRotate: (groupId: string) => Promise<void>;
  onShowQr: (title: string, url: string) => void;
}

interface GroupAccessProps extends GroupAccessActions {
  groupId: string;
  number: number;
  displayName: string | null;
  canEdit: boolean;
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done, true);
  } catch {
    toast('ההעתקה נכשלה. סמנו והעתיקו ידנית');
  }
}

/** Tablet sign-in (code · group · PIN) and the public take-home link, each with a copy button; QR opens larger. */
export function GroupAccess({ groupId, number, displayName, code, row, canEdit, onRotate, onShowQr }: GroupAccessProps) {
  const pin = isPin(row?.pin) ? row.pin : null;
  const home = row?.share_token ? takeHomeUrl(row.share_token) : null;
  const title = displayName ?? `קבוצה ${number}`;
  return (
    <div className={styles.access}>
      <div className={styles.accessLine}>
        <span className={styles.accessText}>
          {tabletLine(code, number)} <span className={styles.pin} dir="ltr">{pin ?? '----'}</span>
        </span>
        <button type="button" className="sm" disabled={!pin} onClick={() => void copy(tabletCopyText(code, number, pin), 'הוראות הכניסה הועתקו')}>
          העתקה
        </button>
        {canEdit ? (
          <ConfirmButton label="PIN חדש" confirmText="להחליף את ה-PIN? הישן יפסיק לעבוד מיד" small
            onConfirm={() => onRotate(groupId)} />
        ) : null}
      </div>
      {home ? (
        <div className={styles.accessLine}>
          <a href={home} target="_blank" rel="noopener noreferrer" className={styles.homeLink}>לוקחים הביתה</a>
          <button type="button" className="sm" onClick={() => void copy(home, 'הקישור הועתק')}>העתקת קישור</button>
          <button type="button" className={styles.qrBtn} aria-label={`הגדלת קוד QR של ${title}`} onClick={() => onShowQr(title, home)}>
            <QrCode value={home} size={52} label="" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
