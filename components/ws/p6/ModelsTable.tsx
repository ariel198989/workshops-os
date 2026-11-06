'use client';
import { useEffect, useMemo, useState } from 'react';
import { Brain02Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/lib/store';
import {
  accuracyPercent, listGroupRefs, listModels, matchModels, type GroupWithWorkshop, type MatchedModel,
} from '@/lib/ws/dashboard';
import { DataTable, type Column } from '../DataTable';
import { Pill } from '../StatusPill';
import { errText } from './errors';
import { formatDay } from './format';
import styles from './dash.module.css';

type Row = MatchedModel<GroupWithWorkshop>;

const groupLabel = (g: GroupWithWorkshop): string => g.display_name?.trim() || `קבוצה ${g.number}`;

const COLUMNS: readonly Column<Row>[] = [
  { key: 'workshop', header: 'סדנה', render: (r) => r.group.workshop?.title ?? '', sortValue: (r) => r.group.workshop?.title ?? '' },
  { key: 'group', header: 'קבוצה', render: (r) => groupLabel(r.group), sortValue: (r) => r.group.number },
  { key: 'name', header: 'מודל', render: (r) => <span className="ink">{r.model.name}</span>, sortValue: (r) => r.model.name },
  {
    key: 'accuracy', header: 'דיוק', num: true, sortValue: (r) => r.model.accuracy,
    render: (r) => r.model.accuracy === null
      ? <span className={styles.accNone}>-</span>
      : <span className={styles.acc}>{accuracyPercent(r.model.accuracy)}</span>,
  },
  { key: 'images', header: 'תמונות', num: true, render: (r) => r.model.image_count ?? '-', sortValue: (r) => r.model.image_count },
  {
    key: 'approved', header: 'סטטוס', sortValue: (r) => r.model.approved,
    render: (r) => <Pill label={r.model.approved ? 'מאושר' : 'לא מאושר'} tone={r.model.approved ? 'teal' : 'gray'} />,
  },
  { key: 'created', header: 'נוצר', render: (r) => formatDay(r.model.created_at), sortValue: (r) => r.model.created_at },
];

/** Read-only list of ws_models with the group and workshop each model belongs to. */
export function ModelsTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [groups, models] = await Promise.all([listGroupRefs(), listModels()]);
      if (alive) setRows(matchModels(models, groups));
    })().catch((err: unknown) => {
      if (!alive) return;
      setRows([]);
      toast(errText('הטעינה נכשלה', err));
    });
    return () => { alive = false; };
  }, []);

  const empty = useMemo(() => (
    <EmptyState icon={Brain02Icon} title="עדיין אין מודלים"
      text="מודלים של קבוצות הסדנה יופיעו כאן אחרי שהתלמידים יאמנו אותם באפליקציית התלמידים." />
  ), []);

  if (rows === null) return <div className="row"><Spinner /></div>;
  // DataTable (and the EmptyState it falls back to) already paint their own .hud surface
  return <DataTable columns={COLUMNS} rows={rows} rowKey={(r) => r.model.id} empty={empty} dense />;
}
