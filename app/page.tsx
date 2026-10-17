import { Layers01Icon } from '@hugeicons/core-free-icons';
import { DashboardKpis } from '@/components/DashboardKpis';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="לוח בקרה" subtitle="תמונת מצב כללית של הסדנאות, המודלים והאימונים." />
      <DashboardKpis />
      <EmptyState
        icon={Layers01Icon}
        title="סדנאות קרובות ופעילות אחרונה"
        text="האזור הזה יתמלא כשמודל הנתונים של הסדנאות יחובר."
      />
    </>
  );
}
