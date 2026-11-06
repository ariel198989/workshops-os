'use client';
import { ModelScopePill } from '../ModelScopePill';
import { DataTable, type Column } from '../DataTable';
import { Pill } from '../StatusPill';
import { formatDateHe } from '@/lib/ws/certificate-templates';
import { groupModelsFirst } from '@/lib/ws/model-scope';
import type { WsModel } from '@/lib/ws/types';
import { formatAccuracy } from './snapshot';

interface ModelPickerProps {
  models: readonly WsModel[];
  selectedId: string | null;
  disabled: boolean;
  onPick: (model: WsModel) => void;
}

/** Models trained by the group (ws_models): the group's own models first, then newest first. */
export function ModelPicker({ models, selectedId, disabled, onPick }: ModelPickerProps) {
  const columns: Column<WsModel>[] = [
    { key: 'name', header: 'מודל', render: (m) => <span className="ink" dir="auto">{m.name}</span> },
    { key: 'scope', header: 'סוג', render: (m) => <ModelScopePill scope={m.scope} /> },
    { key: 'accuracy', header: 'דיוק', num: true, sortValue: (m) => m.accuracy, render: (m) => formatAccuracy(m.accuracy) },
    { key: 'flags', header: 'מצב', render: (m) => (
      m.approved ? <Pill label="מאושר" tone="teal" /> : <Pill label="לא מאושר" tone="outline" />
    ) },
    { key: 'created', header: 'נוצר', sortValue: (m) => m.created_at, render: (m) => formatDateHe(m.created_at) },
    { key: 'pick', header: '', render: (m) => (
      <button type="button" className={m.id === selectedId ? 'primary sm' : 'sm'}
        disabled={disabled || m.id === selectedId} onClick={() => onPick(m)}>
        {m.id === selectedId ? 'נבחר' : 'בחירה'}
      </button>
    ) },
  ];

  return (
    <DataTable columns={columns} rows={groupModelsFirst(models)} rowKey={(m) => m.id} dense
      empty={<p className="hint">אין עדיין מודלים לקבוצה הזו.</p>} />
  );
}
