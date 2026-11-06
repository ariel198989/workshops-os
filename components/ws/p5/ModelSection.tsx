'use client';
import { useState } from 'react';
import { Drawer } from '../Drawer';
import { Spinner } from '@/components/ui/Spinner';
import { fetchGroupModels } from '@/lib/ws/deliverables';
import { toast } from '@/lib/store';
import type { WsDeliverable, WsModel } from '@/lib/ws/types';
import { patchDeliverable } from './api';
import { ModelPicker } from './ModelPicker';
import { PhotoGallery } from './PhotoGallery';
import { formatAccuracy } from './snapshot';
import { useLoad } from './useLoad';
import styles from './p5.module.css';

interface ModelSectionProps {
  row: Pick<WsDeliverable, 'id' | 'group_id' | 'model_id' | 'locked_at'>;
  disabled: boolean;
  onChanged: () => void;
}

/** Final model choice plus the group's photo gallery; both open in drawers. */
export function ModelSection({ row, disabled, onChanged }: ModelSectionProps) {
  const [drawer, setDrawer] = useState<'models' | 'photos' | null>(null);
  const { data: models, error, loading } = useLoad(() => fetchGroupModels(row.group_id), [row.group_id]);
  const current = models?.find((m) => m.id === row.model_id) ?? null;

  const pick = async (m: WsModel) => {
    try {
      await patchDeliverable(row.id, { model_id: m.id });
      setDrawer(null);
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'בחירת המודל נכשלה');
    }
  };

  return (
    <div className="stack">
      {loading && !models ? <Spinner /> : null}
      {error ? <p className="err" role="alert">{error}</p> : null}
      {current ? (
        <p dir="auto">
          <span className="ink">{current.name}</span>{' '}
          <span className="hint">
            דיוק {formatAccuracy(current.accuracy)}{current.approved ? ', מאושר' : ''}
          </span>
        </p>
      ) : (
        <p className="hint">{row.model_id ? 'המודל שנבחר לא נמצא ברשימה.' : 'לא נבחר מודל. בנעילה ייבחר המודל הטוב ביותר.'}</p>
      )}
      <div className={styles.metaRow}>
        <button type="button" className="sm" onClick={() => setDrawer('models')}>
          {disabled ? 'מודלים של הקבוצה' : 'בחירת מודל'} {models ? `(${models.length})` : ''}
        </button>
        <button type="button" className="sm" onClick={() => setDrawer('photos')}>גלריית תמונות</button>
      </div>
      <Drawer open={drawer === 'models'} title="מודלים של הקבוצה" width="680px" onClose={() => setDrawer(null)}>
        <ModelPicker models={models ?? []} selectedId={row.model_id} disabled={disabled} onPick={(m) => void pick(m)} />
      </Drawer>
      <Drawer open={drawer === 'photos'} title="תמונות הקבוצה" width="680px" onClose={() => setDrawer(null)}>
        <PhotoGallery groupId={row.group_id} />
      </Drawer>
    </div>
  );
}
