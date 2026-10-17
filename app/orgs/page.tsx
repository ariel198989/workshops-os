import { Building02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page() {
  return (
    <>
      <PageHeader title="ארגונים" subtitle="בתי ספר, רשויות וארגונים שמקבלים סדנאות." />
      <EmptyState icon={Building02Icon} title="המסך בהכנה" text="כאן יופיעו הארגונים, אנשי הקשר והסדנאות שנקשרו אליהם." />
    </>
  );
}
