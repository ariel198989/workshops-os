'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cloneTemplate } from '@/lib/ws/curriculum';
import { toast } from '@/lib/store';
import { templateGateNote } from '@/lib/ws/template-groups';
import type { Band, CycleDepth, DeviceMode, ReleaseStatus, WsCurriculumTemplate } from '@/lib/ws/types';
import { InlineEdit } from '../InlineEdit';
import { BandPill, DepthPill, DevicePill, ReleasePill } from '../p3/BandPills';
import { BAND_OPTIONS, CYCLE_DEPTH_OPTIONS, DEVICE_OPTIONS, RELEASE_STATUS_OPTIONS } from '../p3/options';
import { Pill } from '../StatusPill';
import { templateErrorText } from './errors';
import { FORMAT_LABELS } from './labels';
import { updateTemplate, type TemplatePatch } from './template-data';
import styles from './board.module.css';

interface Props {
  template: WsCurriculumTemplate;
  /** core staff: title, description, default flag, modules */
  canEdit: boolean;
  /** admins only: band, depth, default device, release status, gate note */
  admin: boolean;
  sessions: number;
  minutes: number;
  onChanged: (next: WsCurriculumTemplate) => void;
}

const COPY_SUFFIX = ' (עותק)';

export function TemplateHeader({ template: t, canEdit, admin, sessions, minutes, onChanged }: Props) {
  const router = useRouter();

  // throws a Hebrew message so InlineEdit's toast explains a rejected value
  const patch = async (p: TemplatePatch) => {
    try {
      onChanged(await updateTemplate(t.id, p));
    } catch (err) {
      throw new Error(templateErrorText(err, 'העדכון נכשל'));
    }
  };

  const toggleDefault = async () => {
    try {
      await patch({ is_default: !t.is_default });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'העדכון נכשל');
    }
  };

  const clone = async () => {
    try {
      const id = await cloneTemplate(t.id, `${t.title}${COPY_SUFFIX}`);
      toast('התבנית שוכפלה', true);
      router.push(`/curriculum/templates/${id}`);
    } catch (err) {
      toast(templateErrorText(err, 'השכפול נכשל'));
    }
  };

  const gate = templateGateNote(t);

  return (
    <div className={styles.hdr}>
      <div className={styles.hdrRow}>
        <Link href="/curriculum#templates" className="hint">חזרה לתבניות</Link>
      </div>
      <div className={styles.hdrRow}>
        <h1 className={styles.hdrTitle}>
          <InlineEdit value={t.title} disabled={!canEdit} ariaLabel="שם התבנית"
            onSave={(v) => {
              if (typeof v !== 'string' || v.trim().length < 2) throw new Error('שם התבנית קצר מדי');
              return patch({ title: v.trim() });
            }} />
        </h1>
        <Pill label={FORMAT_LABELS[t.format]} tone="blue" />
        {t.is_default ? <Pill label="ברירת מחדל" tone="teal" /> : null}
        <BandPill band={t.band} />
        <DepthPill depth={t.cycle_depth} />
        <DevicePill device={t.default_device_mode} />
        <ReleasePill status={t.release_status} />
        <span className="hint">{sessions} מפגשים, {minutes} דקות</span>
        <span style={{ flex: 1 }} />
        {canEdit ? (
          <>
            <button type="button" className="sm" onClick={() => void toggleDefault()}>
              {t.is_default ? 'הסרת ברירת מחדל' : 'קביעה כברירת מחדל'}
            </button>
            <button type="button" className="sm" onClick={() => void clone()}>שכפול תבנית</button>
          </>
        ) : null}
      </div>
      <div className={styles.hdrDesc}>
        <InlineEdit type="textarea" value={t.description} disabled={!canEdit} placeholder="הוסיפו תיאור"
          ariaLabel="תיאור התבנית" onSave={(v) => patch({ description: typeof v === 'string' ? v.trim() : null })} />
      </div>
      {gate && !admin ? <p className={styles.gateNote}>{gate}</p> : null}
      {admin ? (
        <div className={styles.gateGrid} aria-label="הגדרות שכבה ושחרור">
          <div>
            <span className={styles.gateLabel}>שכבה</span>
            <InlineEdit type="select" value={t.band} options={BAND_OPTIONS} ariaLabel="שכבה"
              onSave={(v) => patch({ band: v === null ? null : (v as Band) })} />
          </div>
          <div>
            <span className={styles.gateLabel}>עומק מעגל</span>
            <InlineEdit type="select" value={t.cycle_depth} options={CYCLE_DEPTH_OPTIONS} ariaLabel="עומק מעגל"
              onSave={(v) => patch({ cycle_depth: v === null ? null : (v as CycleDepth) })} />
          </div>
          <div>
            <span className={styles.gateLabel}>מצב מכשיר ברירת מחדל</span>
            <InlineEdit type="select" value={t.default_device_mode} options={DEVICE_OPTIONS} ariaLabel="מצב מכשיר ברירת מחדל"
              onSave={(v) => patch({ default_device_mode: v === null ? null : (v as DeviceMode) })} />
          </div>
          <div>
            <span className={styles.gateLabel}>סטטוס שחרור</span>
            <InlineEdit type="select" value={t.release_status} options={RELEASE_STATUS_OPTIONS} ariaLabel="סטטוס שחרור"
              onSave={(v) => {
                if (v === null) throw new Error('יש לבחור סטטוס שחרור');
                return patch({ release_status: v as ReleaseStatus });
              }} />
          </div>
          <div className={styles.gateWide}>
            <span className={styles.gateLabel}>הערת שער (טיוטה / חסום)</span>
            <InlineEdit type="textarea" value={t.ai_gate_note} placeholder="מה חסר כדי לשחרר את התבנית" ariaLabel="הערת שער"
              onSave={(v) => patch({ ai_gate_note: typeof v === 'string' ? v.trim() : null })} />
          </div>
          {t.requires_product.length > 0 ? (
            <p className={`${styles.gateWide} hint`}>תלוי מוצר: {t.requires_product.join(', ')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
