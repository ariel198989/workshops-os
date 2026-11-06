import { Pill } from '@/components/ws/StatusPill';
import { modelScopeLabel, normalizeModelScope } from '@/lib/ws/model-scope';

/** "מודל קבוצתי" / "מודל אישי של תלמיד/ה" next to a model or a training job. */
export function ModelScopePill({ scope }: { scope: unknown }) {
  return <Pill label={modelScopeLabel(scope)} tone={normalizeModelScope(scope) === 'group' ? 'navy' : 'outline'} />;
}
