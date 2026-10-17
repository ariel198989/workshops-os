import { Settings02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page() {
  return (
    <>
      <PageHeader title="הגדרות" subtitle="הרשאות צוות והגדרות מערכת." />
      <EmptyState icon={Settings02Icon} title="המסך בהכנה" text="כאן יוגדרו הרשאות מדריכים והגדרות כלליות." />
    </>
  );
}
