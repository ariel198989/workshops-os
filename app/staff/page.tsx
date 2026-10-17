'use client';
import { useEffect, useState } from 'react';
import { LockIcon, UserMultiple02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { DataTable, type Column } from '@/components/ws/DataTable';
import { Pill } from '@/components/ws/StatusPill';
import styles from '@/components/ws/ws.module.css';
import { toast, useStore } from '@/lib/store';
import { STAFF_ROLE_PILLS } from '@/lib/ws/labels';
import { isAdmin, listStaff, wsAuthStore } from '@/lib/ws/staff';
import { STAFF_ROLES, type WsStaff } from '@/lib/ws/types';

const INVITE_DISABLED_HINT = 'יופעל אחרי חיבור מפתח שירות';

const COLUMNS: readonly Column<WsStaff>[] = [
  { key: 'name', header: 'שם', sortValue: (s) => s.full_name, render: (s) => <span className="ink">{s.full_name}</span> },
  { key: 'email', header: 'אימייל', sortValue: (s) => s.email, render: (s) => <span dir="ltr">{s.email}</span> },
  {
    key: 'role', header: 'תפקיד', sortValue: (s) => STAFF_ROLES.indexOf(s.role),
    render: (s) => <Pill {...STAFF_ROLE_PILLS[s.role]} />,
  },
  {
    key: 'active', header: 'מצב', sortValue: (s) => (s.active ? 0 : 1),
    render: (s) => <Pill label={s.active ? 'פעיל' : 'מושבת'} tone={s.active ? 'green' : 'outline'} />,
  },
];

/** Invite row stays visible but inert until the service key is wired (P3 owns /api/staff/invite). */
function InviteRow() {
  return (
    <section className={`hud ${styles.inviteRow}`} aria-label="הזמנת איש צוות">
      <span title={INVITE_DISABLED_HINT} className="row">
        <input type="email" dir="ltr" placeholder="name@example.com" disabled aria-label="אימייל להזמנה" />
        <select disabled aria-label="תפקיד להזמנה" defaultValue="instructor">
          <option value="admin">{STAFF_ROLE_PILLS.admin.label}</option>
          <option value="instructor">{STAFF_ROLE_PILLS.instructor.label}</option>
          <option value="guest">{STAFF_ROLE_PILLS.guest.label}</option>
        </select>
        <button type="button" className="primary" disabled>הזמנת איש צוות</button>
      </span>
      <span className="hint">{INVITE_DISABLED_HINT}</span>
    </section>
  );
}

export default function Page() {
  const { whoami, loaded } = useStore(wsAuthStore);
  const admin = isAdmin(whoami);
  const [rows, setRows] = useState<WsStaff[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!admin) return;
    let live = true;
    listStaff()
      .then((data) => { if (live) setRows(data); })
      .catch(() => { if (live) { setFailed(true); toast('טעינת רשימת הצוות נכשלה'); } });
    return () => { live = false; };
  }, [admin]);

  if (!loaded) return <Spinner large />;
  if (!admin) {
    return <EmptyState icon={LockIcon} title="הדף זמין למנהלים בלבד" text="פנו לבעלים או למנהל כדי לנהל את צוות הפלטפורמה." />;
  }
  return (
    <>
      <PageHeader title="צוות" subtitle="אנשי הצוות של הפלטפורמה והתפקידים שלהם." />
      <div className="stack">
        <InviteRow />
        {failed ? (
          <EmptyState icon={UserMultiple02Icon} title="הרשימה לא נטענה" text="רעננו את הדף ונסו שוב." />
        ) : rows === null ? (
          <Spinner large />
        ) : (
          <DataTable columns={COLUMNS} rows={rows} rowKey={(s) => s.user_id}
            empty={<EmptyState icon={UserMultiple02Icon} title="אין אנשי צוות" />} />
        )}
      </div>
    </>
  );
}
