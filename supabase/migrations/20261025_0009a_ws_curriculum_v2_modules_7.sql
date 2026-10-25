-- 20261025_0009a_ws_curriculum_v2_modules_7 (part 7/7) - curriculum v2 modules. Requires 0001; idempotent.
-- Generated 2026-10-25 by supabase/seed/gen_curriculum_v2.py from knowledge/workshops/curriculum-v2.json (68 modules over 7 parts; JSON order). Do not edit by hand.
-- Additive only. `on conflict (slug) do nothing`: re-running is a no-op.
insert into public.ws_modules (slug, title, summary, module_type, pipeline_stage, duration_minutes,
                               objectives, exercises, materials, facilitator_notes, tags, requires_app) values
 ($ws$mun-city-demo-day$ws$, $ws$Demo Day עירוני: עשר כיתות, לקוח וראש עיר$ws$, $ws$סדר יום: הקמת תחנות (30 ד׳) · יריד (60 ד׳) · הרכבה (30 ד׳) · החלטת הרשות (30 ד׳) · תעודות (30 ד׳)$ws$, $ws$demo$ws$, $ws$demo$ws$, 180, array[$ws$להציג עשרה מודלים מול הלקוח העירוני ומקבלי החלטות.$ws$, $ws$להרכיב את המודלים למפת עיר אחת.$ws$, $ws$למסור את המודלים לרשות ולקבל החלטת המשך.$ws$]::text[], $ws$[{"title": "יריד התחנות", "instructions": "1. כל כיתה מכינה תחנה: מודל חי, ספר טעויות, שקף מגבלות.\n2. אורחים מנסים להפיל את המודל בעזרת חפצים שהביאו.\n3. הלקוח ממלא כרטיס לכל כיתה: ממשיכים / מתקנים / עוצרים.", "kind": "group", "tool_hook": "live_cam"}, {"title": "מפת העיר", "instructions": "1. כל כיתה מוסיפה את התוצאות שלה למפה על מסך (פחים שזוהו, בורות).\n2. הלקוח שואל איפה המפה ריקה ומי צריך להשלים.\n3. מסכמים 3 פעולות לרשות לפני הפיילוט.", "kind": "group", "tool_hook": "map"}, {"title": "מסירה", "instructions": "1. הרשות מקבלת קבצי מודל ומפה, לא תמונות גולמיות.\n2. חותמים על דף מסירה: מה נמסר, ממה נמחק.\n3. מקבלים תעודות.", "kind": "class", "tool_hook": "none"}]$ws$::jsonb, $ws$[{"label": "10 שולחנות תחנה", "kind": "supply"}, {"label": "מסך גדול למפה", "kind": "supply"}, {"label": "דף מסירה", "kind": "supply"}, {"label": "תעודות", "kind": "supply"}, {"label": "אורחים ודוברים", "kind": "supply"}, {"label": "הקלטת גיבוי לכל כיתה", "kind": "supply"}]$ws$::jsonb, $ws$מקורות: [09 §5 מסלול רשות], [10 §8], [03 §4]. הגשה לתקשורת רק באישור. בכל תחנה מבוגר. אין השוואת כיתות. מומלץ גם להזמין הורים ומנהלים. שמרו אחרי האירוע דוח נתונים לרשות (ממוצעים בלבד) [06 §9].

── סדר יום ──
• 30 ד׳ · הקמת תחנות - כל כיתה מקימה תחנה עם מודל, פוסטר ושקף כשלים.
• 60 ד׳ · יריד - אורחים מסתובבים בתחנות; כל כיתה מציגה שלוש פעמים.
• 30 ד׳ · הרכבה - הצגת המפה העירונית עם התוצאות של 10 הכיתות.
• 30 ד׳ · החלטת הרשות - הלקוח מגיב: פיילוט? המשך? עצירה? הרשות מקבלת את המודלים.
• 30 ד׳ · תעודות - תעודות לכיתות, מורים ושותפים; תמונה באישור.

── הערכה ──
ראיות: דף מסירה, כרטיסי הלקוח ומפה עירונית.
הושלם כאשר: כל הכיתות הציגו ואישרו את מסירת המודלים, והרשות הצהירה על המשך.

── התאמות ──
קל יותר: הלקוח נשאל שלוש שאלות מוכנות בלבד.
מאתגר יותר: הרשות מגדירה פיילוט של 4 שבועות עם KPI.$ws$, array[$ws$band:municipal$ws$, $ws$audience:municipal$ws$, $ws$level:L3$ws$, $ws$ai-mode:independent$ws$, $ws$demo_day$ws$, $ws$city$ws$, $ws$handover$ws$]::text[], true)
on conflict (slug) do nothing;
