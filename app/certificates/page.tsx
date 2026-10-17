import { Certificate01Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page() {
  return (
    <>
      <PageHeader title="תעודות" subtitle="הפקה ומעקב של תעודות למשתתפים." />
      <EmptyState icon={Certificate01Icon} title="המסך בהכנה" text="כאן יופקו תעודות סיום ויישמרו לכל משתתף." />
    </>
  );
}
