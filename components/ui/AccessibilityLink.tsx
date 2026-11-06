import Link from 'next/link';

export const ACCESSIBILITY_PATH = '/accessibility';

/** Footer link to the public accessibility statement (IS 5568); shown on every console and sign-in screen. */
export function AccessibilityLink() {
  return (
    <footer className="a11y-foot">
      <Link href={ACCESSIBILITY_PATH}>הצהרת נגישות</Link>
    </footer>
  );
}
