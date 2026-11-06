// ws_curriculum_templates.story (migration 0022): the template's story frame and a 3-minute opener per
// session, generated from curriculum-v2.json. Read-only in the console. Pure parsing, unit tested.

export interface StorySession { session_no: number; beat_he: string; opener_he: string; materials_he?: string }
export interface TemplateStory { premise_he: string; hero_he: string; sessions: StorySession[] }

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function parseSession(raw: unknown): StorySession | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const no = Number(r.session_no);
  const opener = str(r.opener_he);
  if (!Number.isInteger(no) || no < 1 || !opener) return null;
  const materials = str(r.materials_he);
  return { session_no: no, beat_he: str(r.beat_he), opener_he: opener, ...(materials ? { materials_he: materials } : {}) };
}

/** A missing or malformed story (older rows, a half-filled column) reads as null; bad sessions are dropped. */
export function normalizeStory(raw: unknown): TemplateStory | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sessions = (Array.isArray(r.sessions) ? r.sessions : [])
    .map(parseSession).filter((s): s is StorySession => s !== null);
  const premise = str(r.premise_he);
  const hero = str(r.hero_he);
  if (!premise && !hero && sessions.length === 0) return null;
  return { premise_he: premise, hero_he: hero, sessions };
}

export const openerFor = (story: TemplateStory | null, sessionNo: number): StorySession | null =>
  story?.sessions.find((s) => s.session_no === sessionNo) ?? null;
