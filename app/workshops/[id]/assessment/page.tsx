'use client';
import { Analytics01Icon } from '@hugeicons/core-free-icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadGate } from '@/components/ws/p4/LoadGate';
import { useLoader, useWorkshopId } from '@/components/ws/p4/hooks';
import styles from '@/components/ws/p4/flow.module.css';
import {
  PHASE_LABELS, SMALL_SAMPLE_NOTE, correctLabel, fetchConceptSummary, isSmallSample, sortConceptRows,
  type ConceptSummaryRow, optionLabels, questionLabel,
} from '@/lib/ws/assessment';

function ModuleTable({ row }: { row: ConceptSummaryRow }) {
  const small = isSmallSample(row.n);
  return (
    <section className={styles.section}>
      <h3>{row.module_title} · {PHASE_LABELS[row.phase]} · {row.n} משיבים</h3>
      {small ? <p className="hint">{SMALL_SAMPLE_NOTE}</p> : null}
      <div className="table-wrap hud">
        <table className="tbl">
          <thead>
            <tr><th>שאלה</th><th className="num">נכון</th><th>תשובות</th></tr>
          </thead>
          <tbody>
            {row.items.map((it) => (
              <tr key={it.id}>
                <td>{questionLabel(it)}{it.core ? <span className="muted"> · core</span> : null}</td>
                <td className="num">{correctLabel(it.correct_pct)}</td>
                <td>{optionLabels(it, row.n).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Anonymous pre/post concept checks, aggregated by ws_concept_summary (percentages only from 15 respondents). */
export default function AssessmentPage() {
  const id = useWorkshopId();
  const { data, error, loading, reload } = useLoader(() => fetchConceptSummary(id), id);

  return (
    <LoadGate loading={loading} error={error} hasData={data !== null} onRetry={() => void reload()}>
      {data === null ? null : data.length === 0 ? (
        <EmptyState icon={Analytics01Icon} title="עדיין אין תשובות."
          text="הדף מתמלא כשהתלמידים ממלאים את בדיקת המושגים באפליקציה." />
      ) : (
        <>
          <div className={styles.bar}>
            <h2>הערכה</h2>
            <div className={styles.barEnd}>
              <button type="button" className="sm" onClick={() => void reload()}>רענון</button>
            </div>
          </div>
          {sortConceptRows(data).map((row) => <ModuleTable key={`${row.session_module_id}:${row.phase}`} row={row} />)}
        </>
      )}
    </LoadGate>
  );
}
