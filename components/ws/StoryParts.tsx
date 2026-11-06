import type { StorySession, TemplateStory } from '@/lib/ws/story';
import styles from './story.module.css';

/** Template top: who the hero is and the premise the sessions build on. */
export function StoryFrame({ story }: { story: TemplateStory }) {
  if (!story.premise_he && !story.hero_he) return null;
  return (
    <section className={`hud ${styles.frame}`} aria-label="סיפור המסגרת">
      {story.hero_he ? <h3>{story.hero_he}</h3> : null}
      {story.premise_he ? <p>{story.premise_he}</p> : null}
    </section>
  );
}

/** Session top: the opener the facilitator reads aloud, plus the materials it needs. */
export function OpenerBox({ session }: { session: StorySession }) {
  return (
    <aside className={styles.opener} aria-label="פתיח של 3 דקות">
      <b className={styles.openerTitle}>פתיח של 3 דקות</b>
      <p>{session.opener_he}</p>
      {session.materials_he ? <p className={styles.materials}>חומרים: {session.materials_he}</p> : null}
    </aside>
  );
}
