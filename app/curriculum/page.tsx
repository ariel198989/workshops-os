import { Layers01Icon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page() {
  return (
    <>
      <PageHeader title="תבניות וקוריקולום" subtitle="תבניות סדנה, מערכי שיעור ושלבי הפעילות." />
      <EmptyState icon={Layers01Icon} title="המסך בהכנה" text="כאן ינוהלו תבניות הסדנאות ומערכי השיעור." />
    </>
  );
}
