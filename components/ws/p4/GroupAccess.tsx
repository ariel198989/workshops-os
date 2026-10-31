'use client';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { QrCode } from '@/components/ws/QrCode';
import { toast } from '@/lib/store';
import { STUDENT_URL } from '@/lib/student-app';
import { SCAN_TITLE, fallbackLine, isJoinToken, isPin, joinUrl, tabletCopyText, takeHomeUrl } from '@/lib/ws/group-access';
import type { WsGroup } from '@/lib/ws/types';
import type { QrTarget } from './GroupQrDrawer';
import styles from './board.module.css';

export const CARD_QR_SIZE = 96;

export interface GroupAccessActions {
  /** the workshop join code students type first */
  code: string;
  /** the ws_groups row (join_token, pin, share_token); undefined while loading or for a viewer without the grant */
  row: WsGroup | undefined;
  onRotate: (groupId: string) => Promise<void>;
  onRotateToken: (groupId: string) => Promise<void>;
  onShowQr: (target: QrTarget) => void;
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

/** First: the one-scan join QR. Below: the no-camera fallback (code, group, PIN) and the public take-home link. */
export function GroupAccess({ groupId, number, displayName, code, row, canEdit, onRotate, onRotateToken, onShowQr }: GroupAccessProps) {
  const pin = isPin(row?.pin) ? row.pin : null;
  const join = isJoinToken(row?.join_token) ? joinUrl(STUDENT_URL, row.join_token) : null;
  const home = row?.share_token ? takeHomeUrl(row.share_token) : null;
  const title = displayName ?? `קבוצה ${number}`;
  return (
    <div className={styles.access}>
      <div className={styles.scan}>
        {join ? (
          <button type="button" className={styles.qrBtn} aria-label={`הגדלת קוד הכניסה של ${title}`}
            onClick={() => onShowQr({ kind: 'join', title, url: join })}>
            <QrCode value={join} size={CARD_QR_SIZE} label="" />
          </button>
        ) : (
          <span className={styles.scanEmpty} aria-hidden="true" />
        )}
        <div className={styles.scanBody}>
          <b className={styles.scanTitle}>{SCAN_TITLE}</b>
          {join ? null : <span className={styles.muted}>{row ? 'עדיין אין קישור סריקה לקבוצה' : 'קישור הסריקה זמין לצוות הסדנה בלבד'}</span>}
          <div className={styles.scanBtns}>
            <button type="button" className="sm" disabled={!join} onClick={() => join && void copy(join, 'קישור הכניסה הועתק')}>
              העתקת קישור
            </button>
            <button type="button" className="sm" disabled={!join} onClick={() => join && onShowQr({ kind: 'join', title, url: join })}>
              פתיחה גדולה
            </button>
            {canEdit && row ? (
              <ConfirmButton label="קישור חדש" small
                confirmText="להחליף את קישור הכניסה? הישן יפסיק לעבוד מיד וכרטיסים שהודפסו יתיישנו"
                onConfirm={() => onRotateToken(groupId)} />
            ) : null}
          </div>
        </div>
      </div>
      <div className={styles.accessLine}>
        <span className={styles.accessText}>
          {fallbackLine(code, number)} <span className={styles.pin} dir="ltr">{pin ?? '----'}</span>
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
          <button type="button" className={`${styles.qrBtn} ${styles.qrBtnEnd}`} aria-label={`הגדלת קוד QR של ${title}`}
            onClick={() => onShowQr({ kind: 'home', title, url: home })}>
            <QrCode value={home} size={52} label="" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
