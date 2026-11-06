'use client';
import { useState } from 'react';
import { ModelScopePill } from '@/components/ws/ModelScopePill';
import { Pill } from '@/components/ws/StatusPill';
import { COLAB } from '@/lib/config';
import { toast } from '@/lib/store';
import { jobScope, type ScopeMember } from '@/lib/ws/model-scope';
import { DEFAULT_POOL_SCOPE, trainingPanelTitle } from '@/lib/ws/pool-scope';
import { failTrainingJob, listOpenTrainingJobs, type TrainingJob } from '@/lib/ws/training';
import type { OverviewGroup, PoolScope } from '@/lib/ws/types';
import { formatDateTime } from './format';
import { errorText, useLoader } from './hooks';
import {
  FAIL_REASON_PROMPT, FAIL_REASON_REQUIRED, JOB_STATUS_LABELS, cleanFailReason, groupNumberForJob, jobGroupIds,
} from './training-utils';
import styles from './board.module.css';

interface TrainingPanelProps {
  groups: readonly OverviewGroup[];
  /** workshop staff only: shows "סימון כנכשל" */
  canEdit: boolean;
  /** changes whenever the board refreshes (overview.generated_at), so the panel reloads with it */
  refreshKey: string;
  /** workshop pool scope (0016): a personal pool titles the panel "אימונים אישיים"; the job list is the same */
  poolScope?: PoolScope;
  /** board participants: a job requested by an active member of its group trains a personal model */
  members: readonly ScopeMember[];
}

const TONE: Record<TrainingJob['status'], 'amber' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'amber', running: 'blue', done: 'green', failed: 'red', cancelled: 'gray',
};

/** Live-session view of the trainer: open jobs of this workshop's groups, Colab link, fail action. */
export function TrainingPanel({ groups, canEdit, refreshKey, poolScope = DEFAULT_POOL_SCOPE, members }: TrainingPanelProps) {
  const ids = jobGroupIds(groups);
  const { data: jobs, error, loading, reload } = useLoader(() => listOpenTrainingJobs(ids), `${ids.join('|')}#${refreshKey}`);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fail = async (job: TrainingJob) => {
    const reason = cleanFailReason(window.prompt(FAIL_REASON_PROMPT, ''));
    if (reason === null) {
      toast(FAIL_REASON_REQUIRED);
      return;
    }
    setBusyId(job.id);
    try {
      await failTrainingJob(job.id, reason);
      toast('האימון סומן כנכשל', true);
      await reload();
    } catch (err) {
      toast(errorText(err, 'הסימון נכשל'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={`hud ${styles.training}`} aria-label="אימונים">
      <header className={styles.trainingHead}>
        <h3>{trainingPanelTitle(poolScope)}</h3>
        <div className={styles.trainingTools}>
          <button type="button" className="sm" onClick={() => void reload()} disabled={loading}>רענון</button>
          <a href={COLAB} target="_blank" rel="noopener noreferrer" className={styles.colab}>פתיחת המאמן (Colab)</a>
        </div>
      </header>
      {error ? <p className="err" role="alert">{error}</p> : null}
      {jobs && jobs.length === 0 ? <p className="hint">אין אימונים ממתינים או רצים כרגע.</p> : null}
      {jobs && jobs.length > 0 ? (
        <ul className={styles.jobs}>
          {jobs.map((j) => {
            const no = groupNumberForJob(groups, j.group_id);
            return (
              <li key={j.id} className={styles.job}>
                <span className={styles.jobTeam}>
                  {no !== null ? <b>קבוצה {no}</b> : null}
                  <span className={styles.teamChip} title={j.team_name}>{j.team_name}</span>
                </span>
                <Pill label={JOB_STATUS_LABELS[j.status]} tone={TONE[j.status]} />
                <ModelScopePill scope={jobScope(j, poolScope, members)} />
                <span className={styles.jobMeta}>
                  {`${j.image_count} תמונות · `}
                  {j.status === 'running' && j.started_at ? `התחיל ${formatDateTime(j.started_at)}` : `נוצר ${formatDateTime(j.created_at)}`}
                </span>
                {canEdit ? (
                  <button type="button" className="danger sm" disabled={busyId === j.id} onClick={() => void fail(j)}>
                    סימון כנכשל
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
