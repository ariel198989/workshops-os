import { Brain02Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page() {
  return (
    <>
      <PageHeader title="מודלים ודאטה" subtitle="מודלים שאומנו, מאגרי תמונות ותורי אימון." />
      <EmptyState icon={Brain02Icon} title="המסך בהכנה" text="כאן יופיעו המודלים, מאגרי הדאטה ותור האימון." />
    </>
  );
}
