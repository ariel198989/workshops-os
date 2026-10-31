import type { OverviewGroup } from '@/lib/ws/types';
import styles from './board.module.css';

interface ProjectorGroupsProps {
  /** board order as the overview returns it; never re-sorted here, the class must not read it as a ranking */
  groups: readonly OverviewGroup[];
}

/** Projector tiles: group, photo count, tagged count. Counts only, no bars, no percentages, no ordering by size. */
export function ProjectorGroups({ groups }: ProjectorGroupsProps) {
  return (
    <ul className={styles.projTiles} aria-label="קבוצות">
      {groups.map((g) => (
        <li key={g.group_id} className={styles.projTile}>
          <div className={styles.projTileHead}>
            <span className={styles.no}>{g.number}</span>
            <span className={styles.projTileName}>{g.display_name ?? `קבוצה ${g.number}`}</span>
          </div>
          <dl className={styles.projFacts}>
            <div><dt>תמונות</dt><dd>{g.photos}</dd></div>
            <div><dt>מתויגות</dt><dd>{g.tagged}</dd></div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
