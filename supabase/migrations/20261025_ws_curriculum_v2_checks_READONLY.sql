-- curriculum v2 post-migration checks - READ-ONLY. Never apply as a migration; run in the SQL editor after 0009a/b.
-- Generated 2026-10-25 by supabase/seed/gen_curriculum_v2.py. Each query states its expected result.

select count(*) as modules_total from public.ws_modules;                       -- 93 (25 baseline + 68 new)
select count(*) as new_modules from public.ws_modules where slug in ('assess-concept-check-ab', 'ab-camera-and-pixels', 'ab-human-classifier', 'ab-variety-and-album', 'ab-facilitator-live-demo', 'ab-mistake-and-bias', 'ab-yarn-box', 'ab-expo-robots', 'assess-concept-check-cd', 'x-failed-model-opener', 'cd-resolution-reveal', 'cd-capture-variety-walk', 'cd-pocket-three-objects', 'cd-break-the-model-game', 'cd-confidence-line', 'cd-labels-are-opinions', 'cd-monkey-tree', 'cd-class-fair', 'assess-concept-check-ef', 'ef-count-ready-model', 'ef-scoping-and-task-card', 'ef-photo-sprint', 'ef-click-a-point-tagging', 'ef-labeling-guide-race', 'bridge-hidden-envelope', 'bridge-human-knn', 'ef-read-results-and-gallery', 'ef-two-teams-bias-experiment', 'ef-detect-to-action', 'ef-fair-booths', 'ehd-scope-capture-tag', 'ehd-train-bridge-retest', 'ehd-fair-and-certificates', 'gi-hard-negatives-and-flip', 'gi-confusion-matrix-and-error-cost', 'assess-concept-check-jl', 'jl-client-kpi-brief', 'jl-datasheet-and-split', 'jl-annotation-guideline-and-iou', 'jl-confusion-matrix-by-hand', 'jl-augmentation-experiment', 'jl-threshold-pr-curve', 'jl-sliced-error-analysis', 'jl-proportionality-court', 'jl-model-card-and-limits', 'jl-pilot-pitch', 'jl-client-readout-demo', 'jl-bagrut-proposal-workshop', 'jhd-iterate-sprint', 'rc-experiment-design', 'rc-controlled-experiments', 'rc-model-comparison-and-loss', 'rc-export-edge-deploy', 'rc-poster-session', 'assess-concept-check-teachers', 't-rules-consent-privacy-lab', 't-adapting-for-populations-udl', 't-run-the-photo-sprint', 't-local-client-and-demo-production', 't-teacher-run-training-and-queue', 't-metrics-ladder-for-kids', 't-assessment-evidence-pack', 't-micro-teaching-practicum', 't-portfolio-showcase', 't-bagrut-final-project-advising', 'mun-city-kickoff', 'mun-shared-dataset-and-qa', 'mun-city-demo-day');  -- 68
select count(*) as templates_total from public.ws_curriculum_templates;       -- 12
select count(*) as v2_templates from public.ws_curriculum_templates where slug in ('cv-ab-i-am-the-model', 'cv-cd-teach-the-class-tablet', 'cv-ef-vision-lab', 'cv-ef-hackathon-halfday', 'cv-jl-client-track-8x90', 'cv-jl-hackathon-2day', 'cv-teachers-pd-30h', 'cv-municipal-10-classes', 'cv-gi-research-club');  -- 9
select count(*) as template_rows_total from public.ws_template_modules;       -- 123 (16 baseline + 107 new)

-- per new template: actual vs expected rows (ok must be true everywhere)
select e.tslug, e.expected, count(tm.id) as actual, count(tm.id) = e.expected as ok
from (values
  ('cv-ab-i-am-the-model', 8),
  ('cv-cd-teach-the-class-tablet', 9),
  ('cv-ef-vision-lab', 14),
  ('cv-ef-hackathon-halfday', 3),
  ('cv-jl-client-track-8x90', 14),
  ('cv-jl-hackathon-2day', 10),
  ('cv-teachers-pd-30h', 22),
  ('cv-municipal-10-classes', 8),
  ('cv-gi-research-club', 19)
) as e(tslug, expected)
left join public.ws_curriculum_templates t on t.slug = e.tslug
left join public.ws_template_modules tm on tm.template_id = t.id
group by e.tslug, e.expected order by 1;                                       -- 9 rows, ok = true

-- exactly one non-archived default per format (corewise-6-sessions / hackathon-day), none for custom
select format, count(*) filter (where is_default and not is_archived) as defaults
from public.ws_curriculum_templates group by 1 order by 1;                    -- custom 0 / hackathon 1 / sessions 1

-- every module slug used by any program (modules + optional) that is missing from ws_modules
select r.slug as missing_slug
from (values
  ('assess-concept-check-ab'),
  ('ab-camera-and-pixels'),
  ('ab-human-classifier'),
  ('ab-variety-and-album'),
  ('ab-facilitator-live-demo'),
  ('ab-yarn-box'),
  ('ab-mistake-and-bias'),
  ('ab-expo-robots'),
  ('assess-concept-check-cd'),
  ('x-failed-model-opener'),
  ('cd-resolution-reveal'),
  ('cd-monkey-tree'),
  ('cd-capture-variety-walk'),
  ('cd-pocket-three-objects'),
  ('cd-break-the-model-game'),
  ('cd-confidence-line'),
  ('cd-labels-are-opinions'),
  ('cd-class-fair'),
  ('assess-concept-check-ef'),
  ('ef-count-ready-model'),
  ('ef-scoping-and-task-card'),
  ('ef-photo-sprint'),
  ('ef-click-a-point-tagging'),
  ('ef-labeling-guide-race'),
  ('bridge-hidden-envelope'),
  ('ef-read-results-and-gallery'),
  ('bridge-human-knn'),
  ('ef-two-teams-bias-experiment'),
  ('ef-detect-to-action'),
  ('ef-fair-booths'),
  ('core-s1-machine-vision-intro'),
  ('opt-pocket-trainer-warmup'),
  ('core-s2-mega-problem'),
  ('opt-client-interview'),
  ('core-s3-research-theory'),
  ('opt-dataset-variety-lab'),
  ('opt-data-ethics-bias'),
  ('core-s4-data-collection'),
  ('gi-hard-negatives-and-flip'),
  ('opt-city-map-mission'),
  ('core-s5-train-and-hunt'),
  ('gi-confusion-matrix-and-error-cost'),
  ('opt-failure-case-lab'),
  ('opt-pitch-training'),
  ('core-s6-demo-day'),
  ('opt-arduino-bridge'),
  ('hd-kickoff'),
  ('hd-data-sprint'),
  ('hd-train-and-hunt'),
  ('hd-pitch-sprint'),
  ('hd-demo-ceremony'),
  ('ehd-scope-capture-tag'),
  ('ehd-train-bridge-retest'),
  ('ehd-fair-and-certificates'),
  ('assess-concept-check-jl'),
  ('jl-client-kpi-brief'),
  ('jl-datasheet-and-split'),
  ('jl-annotation-guideline-and-iou'),
  ('jl-bagrut-proposal-workshop'),
  ('jl-confusion-matrix-by-hand'),
  ('jl-augmentation-experiment'),
  ('jl-threshold-pr-curve'),
  ('jl-sliced-error-analysis'),
  ('jl-proportionality-court'),
  ('jl-model-card-and-limits'),
  ('jl-pilot-pitch'),
  ('jl-client-readout-demo'),
  ('jhd-iterate-sprint'),
  ('assess-concept-check-teachers'),
  ('t-rules-consent-privacy-lab'),
  ('t-adapting-for-populations-udl'),
  ('t-run-the-photo-sprint'),
  ('t-local-client-and-demo-production'),
  ('t-teacher-run-training-and-queue'),
  ('t-metrics-ladder-for-kids'),
  ('t-assessment-evidence-pack'),
  ('t-micro-teaching-practicum'),
  ('t-portfolio-showcase'),
  ('mun-city-kickoff'),
  ('mun-shared-dataset-and-qa'),
  ('mun-city-demo-day'),
  ('corp-kickoff-usecase'),
  ('adult-governance-privacy'),
  ('corp-data-sprint'),
  ('corp-train-failure-review'),
  ('corp-readout-roi'),
  ('assess-concept-check'),
  ('rc-experiment-design'),
  ('rc-controlled-experiments'),
  ('rc-model-comparison-and-loss'),
  ('rc-export-edge-deploy'),
  ('rc-poster-session')
) as r(slug)
left join public.ws_modules m on m.slug = r.slug
where m.id is null;                                                           -- 0 rows
