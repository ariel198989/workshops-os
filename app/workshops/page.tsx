import { Calendar01Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page() {
  return (
    <>
      <PageHeader title="סדנאות" subtitle="ניהול סדנאות, מועדים, קבוצות ומשתתפים." />
      <EmptyState icon={Calendar01Icon} title="המסך בהכנה" text="כאן יופיע לוח הסדנאות עם הקבוצות והמשתתפים של כל סדנה." />
    </>
  );
}
