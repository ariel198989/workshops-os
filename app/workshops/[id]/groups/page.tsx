'use client';
import { useMemo, useState } from 'react';
import { UserGroupIcon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { JoinInfo } from '@/components/ws/JoinInfo';
import { WorkshopJoinQr } from '@/components/ws/WorkshopJoinQr';
import { toast } from '@/lib/store';
import { STUDENT_URL } from '@/lib/student-app';
import { entryCards } from '@/lib/ws/entry-cards';
import { activateGroups, rotateGroupPin, rotateJoinToken, updateGroup } from '@/lib/ws/groups';
import { normalizePoolScope } from '@/lib/ws/pool-scope';
import type { GroupPatch } from '@/lib/ws/types';
import { CreateGroupsForm } from '@/components/ws/p4/CreateGroupsForm';
import { EntryCardsPrint } from '@/components/ws/p4/EntryCardsPrint';
import type { GroupAccessActions } from '@/components/ws/p4/GroupAccess';
import { GroupCard } from '@/components/ws/p4/GroupCard';
import { GroupQrDrawer, type QrTarget } from '@/components/ws/p4/GroupQrDrawer';
import { LiveStepBar } from '@/components/ws/p4/LiveStepBar';
import { LoadGate } from '@/components/ws/p4/LoadGate';
import { ProjectorGroups } from '@/components/ws/p4/ProjectorGroups';
import { ProjectorShell } from '@/components/ws/p4/ProjectorShell';
import { TrainingPanel } from '@/components/ws/p4/TrainingPanel';
import { UnassignedTray } from '@/components/ws/p4/UnassignedTray';
import { defaultGroupCount, hasInactiveGroups } from '@/components/ws/p4/groups-utils';
import { formatTime } from '@/components/ws/p4/format';
import { errorText, useCanEdit, useWorkshopId } from '@/components/ws/p4/hooks';
import { POLL_MS, useBoard } from '@/components/ws/p4/useBoard';
import { useLiveState } from '@/components/ws/p4/useLiveState';
import styles from '@/components/ws/p4/board.module.css';

// a page module may only export the route itself, so the projector QR size stays local
const PROJECTOR_QR_SIZE = 220;

export default function GroupsPage() {
  const id = useWorkshopId();
  const canEdit = useCanEdit(id);
  const board = useBoard(id);
  const liveHandle = useLiveState(id);
  const [projector, setProjector] = useState(false);
  const [projectorQr, setProjectorQr] = useState(false);
  const [qr, setQr] = useState<QrTarget | null>(null);
  const [printing, setPrinting] = useState(false);
  const { overview, people } = board;

  const active = useMemo(() => people.filter((p) => p.status === 'active'), [people]);
  const byGroup = useMemo(() => {
    const map = new Map<string, typeof active>();
    for (const p of active) {
      if (p.group_id) map.set(p.group_id, [...(map.get(p.group_id) ?? []), p]);
    }
    return map;
  }, [active]);
  const unassigned = useMemo(() => active.filter((p) => p.group_id === null), [active]);
  const rowById = useMemo(() => new Map(board.groupRows.map((g) => [g.id, g])), [board.groupRows]);

  const patchGroup = async (groupId: string, patch: GroupPatch) => {
    await updateGroup(groupId, patch);
    void board.refresh();
  };

  const activate = async () => {
    try {
      await activateGroups(id);
      toast('הקבוצות הופעלו באפליקציית התלמידים', true);
    } catch (err) {
      toast(errorText(err, 'הפעלת הקבוצות נכשלה'));
    }
    await board.refresh();
  };

  // ConfirmButton toasts a thrown error; a friendly message replaces the raw RPC text
  const rotate = async (groupId: string) => {
    try {
      const pin = await rotateGroupPin(groupId);
      board.patchGroupRow(groupId, { pin });
      toast('PIN חדש נשמר. הישן כבר לא עובד', true);
    } catch (err) {
      throw new Error(errorText(err, 'החלפת ה-PIN נכשלה'));
    }
  };
  const rotateToken = async (groupId: string) => {
    try {
      const join_token = await rotateJoinToken(groupId);
      board.patchGroupRow(groupId, { join_token });
      toast('קישור כניסה חדש נשמר. הישן כבר לא עובד', true);
    } catch (err) {
      throw new Error(errorText(err, 'החלפת קישור הכניסה נכשלה'));
    }
  };

  const groups = overview?.groups ?? [];
  const isLive = overview?.workshop.status === 'live';
  const stamp = formatTime(overview?.generated_at);
  const count = defaultGroupCount(board.workshop?.audience_size ?? (people.length || null), overview?.workshop.group_size ?? board.workshop?.group_size ?? 4);
  const shortCode = board.workshop?.short_code ?? null;
  // the overview RPC does not carry pool_scope; the workshop row does (DB default 'personal' until it loads)
  const poolScope = normalizePoolScope(board.workshop?.pool_scope);
  const cards = useMemo(
    () => (overview ? entryCards(groups, board.groupRows, overview.workshop.code, STUDENT_URL, shortCode) : []),
    [overview, groups, board.groupRows, shortCode],
  );

  return (
    <LoadGate loading={board.loading} error={board.error} hasData={!!overview} onRetry={() => void board.refresh()}>
      {overview && projector ? (
        <ProjectorShell title={overview.workshop.title} stamp={stamp} live={liveHandle.live} number={shortCode} onExit={() => setProjector(false)}
          tools={<button type="button" aria-pressed={projectorQr} onClick={() => setProjectorQr((v) => !v)}>{projectorQr ? 'הסתרת QR' : 'הצגת QR'}</button>}
          aside={projectorQr
            ? <WorkshopJoinQr code={overview.workshop.code} shortCode={shortCode} live={isLive} size={PROJECTOR_QR_SIZE} heading />
            : null}>
          <ProjectorGroups groups={groups} poolScope={poolScope} />
        </ProjectorShell>
      ) : null}

      {overview ? (
        <>
          <div className={styles.bar}>
            <div className={styles.barStart}>
              <h2>קבוצות</h2>
              <span className={styles.stamp}>
                {board.polling ? <><span className={styles.liveDot} aria-hidden="true" />מתעדכן כל {POLL_MS / 1000} שניות</> : 'רענון ידני'}
                {stamp ? ` · עודכן ב-${stamp}` : ''}
              </span>
              <JoinInfo code={overview.workshop.code} shortCode={shortCode} status={overview.workshop.status}
                workshopId={id} canRotate={canEdit} onRotated={(next) => board.patchWorkshop({ short_code: next })} />
            </div>
            <div className={styles.barEnd}>
              <button type="button" className="sm" onClick={() => void board.refresh()} disabled={board.refreshing}>רענון</button>
              {groups.length > 0 ? <button type="button" className="sm" onClick={() => setProjector(true)}>מצב מקרן</button> : null}
              {groups.length > 0 ? <button type="button" className="sm" onClick={() => setPrinting(true)}>הדפסת כרטיסי כניסה</button> : null}
              {canEdit && isLive && hasInactiveGroups(groups) ? (
                <ConfirmButton label="הפעל קבוצות" confirmText="להפעיל את הקבוצות באפליקציית התלמידים?" tone="primary" small
                  onConfirm={activate} />
              ) : null}
              {canEdit && groups.length > 0 ? (
                <CreateGroupsForm workshopId={id} defaultCount={count} existing={groups.length} onCreated={() => void board.refresh()} />
              ) : null}
            </div>
          </div>

          {groups.length > 0 ? <LiveStepBar workshopId={id} sessions={overview.sessions} canEdit={canEdit} handle={liveHandle} /> : null}
          {groups.length > 0 ? <TrainingPanel groups={groups} canEdit={canEdit} refreshKey={overview.generated_at} poolScope={poolScope} /> : null}

          {groups.length === 0 ? (
            <EmptyState icon={UserGroupIcon} title="עדיין אין קבוצות"
              text={canEdit ? 'בחרו כמה קבוצות ליצור. אפשר להוסיף עוד בכל שלב.' : 'המדריך עדיין לא יצר קבוצות.'}
              actions={canEdit ? <CreateGroupsForm workshopId={id} defaultCount={count} existing={0} onCreated={() => void board.refresh()} /> : undefined} />
          ) : (
            <>
              <UnassignedTray people={unassigned} groups={groups} canEdit={canEdit} onMove={(pid, gid) => void board.move(pid, gid)} />
              <div className={styles.grid}>
                {groups.map((g) => {
                  const access: GroupAccessActions = {
                    code: overview.workshop.code, row: rowById.get(g.group_id), onRotate: rotate, onRotateToken: rotateToken,
                    onShowQr: setQr,
                  };
                  return (
                    <GroupCard key={g.group_id} group={g} members={byGroup.get(g.group_id) ?? []} subproblems={board.subproblems}
                      allGroups={groups} canEdit={canEdit} access={access} poolScope={poolScope}
                      onMove={(pid, gid) => void board.move(pid, gid)} onPatch={patchGroup} />
                  );
                })}
              </div>
            </>
          )}

          <GroupQrDrawer target={qr} onClose={() => setQr(null)} />
          {printing ? <EntryCardsPrint cards={cards} onDone={() => setPrinting(false)} /> : null}
        </>
      ) : null}
    </LoadGate>
  );
}
