"""Generate the curriculum v2 seed migrations for Workshops OS.

Run:  python -I gen_curriculum_v2.py
Reads knowledge/workshops/curriculum-v2.json and writes, under supabase/migrations/:
  20261025_0009a_ws_curriculum_v2_modules_<n>.sql   (68 modules, each file <= 45,000 bytes)
  20261025_0009b_ws_curriculum_v2_templates.sql     (9 new templates + their module rows)
  20261025_ws_curriculum_v2_checks_READONLY.sql
and copies the JSON to public/curriculum-v2.json. Style copied from 20261018_0005_ws_seed.sql.
Nothing is applied to any database.
"""
import json
import re
import shutil
from pathlib import Path
from typing import Any, Optional

SEED_DIR = Path(__file__).resolve().parent
OS_DIR = SEED_DIR.parent.parent
MIGRATIONS = OS_DIR / "supabase" / "migrations"
SOURCE = OS_DIR.parent / "knowledge" / "workshops" / "curriculum-v2.json"
PUBLIC_COPY = OS_DIR / "public" / "curriculum-v2.json"

MAX_FILE_BYTES = 45_000
DESC_MAX = 2000
DEFAULT_GROUP_SIZE = 4
STAMP = "20261025"

SLUG_RE = re.compile(r"^[a-z0-9-]{3,60}$")
MODULE_TYPES = {"theory", "practice", "demo", "mixed"}
PIPELINE_STAGES = {"intro", "grouping", "problem", "research", "collect", "tag", "train", "evaluate", "present", "demo"}
SESSION_KINDS = {"regular", "practical", "hackathon", "demo_day", "other"}
FORMAT_MAP = {"sessions": "sessions", "hackathon": "hackathon", "custom": "custom", "club": "custom"}
# slugs present in the baseline seed (20261018_0005): referenced by templates, never re-emitted here
BASELINE_TEMPLATE_ROWS = 16  # 6 corewise-6-sessions + 5 hackathon-day + 5 corporate-half-day
BASELINE_MODULES = 25

MODULE_DEFAULTS: dict[str, Any] = {
    "summary": None,
    "pipeline_stage": None,
    "duration_minutes": 45,
    "objectives": [],
    "exercises": [],
    "materials": [],
    "facilitator_notes": None,
    "tags": [],
    "requires_app": False,
}

MODULES_INSERT_HEAD = (
    "insert into public.ws_modules (slug, title, summary, module_type, pipeline_stage, duration_minutes,\n"
    "                               objectives, exercises, materials, facilitator_notes, tags, requires_app) values\n"
)


# ── small pure helpers ────────────────────────────────────────────────
def pick_tag(texts: list[str]) -> str:
    """Dollar-quote tag: 'ws' unless some text contains the literal $ws$ (then 'ws2')."""
    if any("$ws$" in t for t in texts):
        if any("$ws2$" in t for t in texts):
            raise ValueError("text contains both $ws$ and $ws2$")
        return "ws2"
    return "ws"


def dq(text: str, tag: str) -> str:
    return f"${tag}${text}${tag}$"


def clean(value: Optional[str]) -> Optional[str]:
    """Strip, normalise newlines to LF (inner newlines kept)."""
    if value is None:
        return None
    return value.replace("\r\n", "\n").replace("\r", "\n").strip()


def deep_clean(value: Any) -> Any:
    if isinstance(value, str):
        return clean(value)
    if isinstance(value, list):
        return [deep_clean(v) for v in value]
    if isinstance(value, dict):
        return {k: deep_clean(v) for k, v in value.items()}
    return value


def all_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [s for v in value for s in all_strings(v)]
    if isinstance(value, dict):
        return [s for v in value.values() for s in all_strings(v)]
    return []


def parse_group_size(raw: Any) -> int:
    match = re.search(r"\d+", raw) if isinstance(raw, str) else None
    if not match:
        return DEFAULT_GROUP_SIZE
    size = int(match.group())
    return size if 2 <= size <= 8 else DEFAULT_GROUP_SIZE


def map_format(fmt: str) -> str:
    if fmt not in FORMAT_MAP:
        raise ValueError(f"unknown program format: {fmt!r}")
    return FORMAT_MAP[fmt]


def map_session_kind(kind: Optional[str]) -> str:
    return kind if kind in SESSION_KINDS else "other"


# ── modules ───────────────────────────────────────────────────────────
def apply_defaults(module: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Fill missing optional fields from the seed defaults; return (module, names of defaulted fields)."""
    defaulted = [k for k in MODULE_DEFAULTS if k not in module]
    filled = {**{k: v for k, v in MODULE_DEFAULTS.items() if k in defaulted}, **module}
    return filled, defaulted


def validate_module(m: dict[str, Any]) -> None:
    slug = m.get("slug", "")
    if not SLUG_RE.match(slug):
        raise ValueError(f"bad module slug: {slug!r}")
    if not 2 <= len((m.get("title") or "").strip()) <= 120:
        raise ValueError(f"{slug}: title length out of 2..120")
    if m.get("module_type") not in MODULE_TYPES:
        raise ValueError(f"{slug}: bad module_type {m.get('module_type')!r}")
    stage = m.get("pipeline_stage")
    if stage is not None and stage not in PIPELINE_STAGES:
        raise ValueError(f"{slug}: bad pipeline_stage {stage!r}")
    duration = m.get("duration_minutes")
    if not isinstance(duration, int) or isinstance(duration, bool) or not 5 <= duration <= 720:
        raise ValueError(f"{slug}: duration out of 5..720: {duration!r}")
    for key in ("exercises", "materials"):
        if not isinstance(m.get(key), list):
            raise ValueError(f"{slug}: {key} must be a JSON array")
    if not isinstance(m.get("requires_app"), bool):
        raise ValueError(f"{slug}: requires_app must be boolean")


def sql_text(value: Optional[str], tag: str) -> str:
    return "null" if value is None else dq(value, tag)


def sql_text_array(items: list[str], tag: str) -> str:
    if not items:
        return "'{}'::text[]"
    return "array[" + ", ".join(dq(i, tag) for i in items) + "]::text[]"


def sql_jsonb(value: Any, tag: str) -> str:
    return dq(json.dumps(value, ensure_ascii=False), tag) + "::jsonb"


def module_row(module: dict[str, Any], tag: str) -> str:
    m = deep_clean(module)
    parts = [
        dq(m["slug"], tag),
        dq(m["title"], tag),
        sql_text(m.get("summary"), tag),
        dq(m["module_type"], tag),
        sql_text(m.get("pipeline_stage"), tag),
        str(m["duration_minutes"]),
        sql_text_array(m.get("objectives", []), tag),
        sql_jsonb(m.get("exercises", []), tag),
        sql_jsonb(m.get("materials", []), tag),
        sql_text(m.get("facilitator_notes"), tag),
        sql_text_array(m.get("tags", []), tag),
        "true" if m["requires_app"] else "false",
    ]
    return " (" + ", ".join(parts) + ")"


def chunk_rows(rows: list[str], header_bytes: int, footer_bytes: int, limit: int) -> list[list[str]]:
    """Greedy, order-preserving packing. Each row costs len(row)+2 bytes (',\\n'); rows are measured in UTF-8 bytes
    by the caller passing byte-length-aware strings; here len() is used for ASCII tests and bytes via encode."""
    def cost(r: str) -> int:
        return len(r.encode("utf-8")) + 2

    parts: list[list[str]] = []
    current: list[str] = []
    size = header_bytes + footer_bytes
    for row in rows:
        if header_bytes + footer_bytes + cost(row) > limit:
            raise ValueError("single row exceeds the per-file byte limit")
        if current and size + cost(row) > limit:
            parts.append(current)
            current, size = [], header_bytes + footer_bytes
        current.append(row)
        size += cost(row)
    if current:
        parts.append(current)
    return parts


def modules_file_text(part: int, total: int, rows: list[str], count_total: int) -> str:
    head = (
        f"-- 20261025_0009a_ws_curriculum_v2_modules_{part} (part {part}/{total}) - curriculum v2 modules. "
        "Requires 0001; idempotent.\n"
        f"-- Generated 2026-10-25 by supabase/seed/gen_curriculum_v2.py from knowledge/workshops/curriculum-v2.json "
        f"({count_total} modules over {total} parts; JSON order). Do not edit by hand.\n"
        "-- Additive only. `on conflict (slug) do nothing`: re-running is a no-op.\n"
    )
    return head + MODULES_INSERT_HEAD + ",\n".join(rows) + "\non conflict (slug) do nothing;\n"


# ── templates ─────────────────────────────────────────────────────────
def template_slug(program: dict[str, Any]) -> str:
    slug = program.get("proposed_db_template_slug") or program["slug"]
    if not SLUG_RE.match(slug):
        raise ValueError(f"bad template slug: {slug!r}")
    return slug


def template_description(program: dict[str, Any]) -> str:
    pieces = [program.get("why_he"), program.get("calendar_he"), program.get("hours_note_he")]
    joined = " | ".join(clean(p) for p in pieces if p and clean(p))
    return joined[:DESC_MAX]


def template_row(program: dict[str, Any], tag: str) -> tuple[str, str]:
    slug = template_slug(program)
    fmt = map_format(program["format"])
    db_fmt = program.get("db_template_format")
    if db_fmt is not None and db_fmt != fmt:
        raise ValueError(f"{slug}: format mapping {fmt!r} disagrees with db_template_format {db_fmt!r}")
    title = clean(program["title_he"])
    row = (
        " ("
        + ", ".join([
            dq(slug, tag), dq(title, tag), dq(template_description(program), tag), dq(fmt, tag),
            str(parse_group_size(program.get("group_size"))), "false",
        ])
        + ")"
    )
    return slug, row


def session_notes(session: dict[str, Any]) -> Optional[str]:
    notes = clean(session.get("notes")) or ""
    optional = [o for o in session.get("optional_modules", []) if o not in notes]
    if optional:
        extra = "אחרי המודול (אופציונלי): " + ", ".join(optional)
        notes = (notes + "\n" + extra) if notes else extra
    return notes or None


def template_module_rows(program: dict[str, Any], tag: str) -> list[str]:
    tslug = template_slug(program)
    rows: list[str] = []
    position = 0
    for session in program["template"]:
        kind = map_session_kind(session.get("session_kind"))
        title = clean(session.get("session_title"))
        for idx, mslug in enumerate(session["modules"]):
            position += 1
            notes = session_notes(session) if idx == 0 else None
            rows.append(
                " ("
                + ", ".join([
                    dq(tslug, tag), dq(mslug, tag), str(session["session_no"]), str(position),
                    sql_text(title, tag), dq(kind, tag), sql_text(notes, tag),
                ])
                + ")"
            )
    return rows


def templates_file_text(programs: list[dict[str, Any]], tag: str) -> tuple[str, int, list[tuple[str, int]]]:
    trows = [template_row(p, tag)[1] for p in programs]
    mrows: list[str] = []
    per_template: list[tuple[str, int]] = []
    for p in programs:
        rows = template_module_rows(p, tag)
        per_template.append((template_slug(p), len(rows)))
        mrows.extend(rows)
    text = (
        f"-- 20261025_0009b_ws_curriculum_v2_templates - {len(programs)} new curriculum templates + their module rows. "
        "Requires 0001, 0005 and 0009a parts; idempotent.\n"
        "-- Generated 2026-10-25 by supabase/seed/gen_curriculum_v2.py from knowledge/workshops/curriculum-v2.json. Do not edit by hand.\n"
        "-- format: JSON `club` -> 'custom'. is_default=false for all (one default per format already exists:\n"
        "-- corewise-6-sessions / hackathon-day). The 3 reference-only programs already exist in the DB and are skipped.\n"
        "-- Session notes (plus optional modules) ride on the first module row of each session.\n"
        "insert into public.ws_curriculum_templates (slug, title, description, format, default_group_size, is_default) values\n"
        + ",\n".join(trows)
        + "\non conflict (slug) do nothing;\n\n"
        "-- one row per (template, module), running position per template; idempotent per template.\n"
        "insert into public.ws_template_modules (template_id, module_id, session_no, position, session_title, session_kind, notes)\n"
        "select t.id, m.id, v.session_no, v.position, v.session_title, v.session_kind, v.notes\n"
        "from (values\n"
        + ",\n".join(mrows)
        + "\n) as v(tslug, mslug, session_no, position, session_title, session_kind, notes)\n"
        "join public.ws_curriculum_templates t on t.slug = v.tslug\n"
        "join public.ws_modules m on m.slug = v.mslug\n"
        "where not exists (select 1 from public.ws_template_modules x where x.template_id = t.id);\n"
    )
    return text, len(mrows), per_template


# ── read-only checks ──────────────────────────────────────────────────
def in_list(items: list[str]) -> str:
    return "(" + ", ".join("'" + i + "'" for i in items) + ")"


def checks_file_text(new_slugs: list[str], tpl_counts: list[tuple[str, int]], all_tpl_slugs: list[str],
                     referenced: list[str], new_rows: int) -> str:
    n_new, n_total = len(new_slugs), BASELINE_MODULES + len(new_slugs)
    values = ",\n  ".join(f"('{s}', {c})" for s, c in tpl_counts)
    return (
        "-- curriculum v2 post-migration checks - READ-ONLY. Never apply as a migration; run in the SQL editor after 0009a/b.\n"
        "-- Generated 2026-10-25 by supabase/seed/gen_curriculum_v2.py. Each query states its expected result.\n\n"
        f"select count(*) as modules_total from public.ws_modules;                       -- {n_total} ({BASELINE_MODULES} baseline + {n_new} new)\n"
        f"select count(*) as new_modules from public.ws_modules where slug in {in_list(new_slugs)};  -- {n_new}\n"
        f"select count(*) as templates_total from public.ws_curriculum_templates;       -- {3 + len(tpl_counts)}\n"
        f"select count(*) as v2_templates from public.ws_curriculum_templates where slug in {in_list([s for s, _ in tpl_counts])};  -- {len(tpl_counts)}\n"
        f"select count(*) as template_rows_total from public.ws_template_modules;       -- {BASELINE_TEMPLATE_ROWS + new_rows} ({BASELINE_TEMPLATE_ROWS} baseline + {new_rows} new)\n\n"
        "-- per new template: actual vs expected rows (ok must be true everywhere)\n"
        "select e.tslug, e.expected, count(tm.id) as actual, count(tm.id) = e.expected as ok\n"
        "from (values\n  " + values + "\n) as e(tslug, expected)\n"
        "left join public.ws_curriculum_templates t on t.slug = e.tslug\n"
        "left join public.ws_template_modules tm on tm.template_id = t.id\n"
        "group by e.tslug, e.expected order by 1;                                       -- 9 rows, ok = true\n\n"
        "-- exactly one non-archived default per format (corewise-6-sessions / hackathon-day), none for custom\n"
        "select format, count(*) filter (where is_default and not is_archived) as defaults\n"
        "from public.ws_curriculum_templates group by 1 order by 1;                    -- custom 0 / hackathon 1 / sessions 1\n\n"
        "-- every module slug used by any program (modules + optional) that is missing from ws_modules\n"
        "select r.slug as missing_slug\n"
        "from (values\n  " + ",\n  ".join(f"('{s}')" for s in referenced) + "\n) as r(slug)\n"
        "left join public.ws_modules m on m.slug = r.slug\n"
        "where m.id is null;                                                           -- 0 rows\n"
    )


# ── orchestration ─────────────────────────────────────────────────────
def is_existing_reference(program: dict[str, Any]) -> bool:
    return program.get("status") == "existing_reference" or "db_template_slug" in program


def write(path: Path, text: str) -> int:
    data = text.encode("utf-8")
    path.write_bytes(data)
    return len(data)


def referenced_slugs(programs: list[dict[str, Any]]) -> list[str]:
    seen: dict[str, None] = {}
    for p in programs:
        for s in p["template"]:
            for slug in [*s["modules"], *s.get("optional_modules", [])]:
                seen.setdefault(slug)
    return list(seen)


def main() -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    raw_modules: list[dict[str, Any]] = data["modules"]
    programs: list[dict[str, Any]] = data["programs"]

    modules, defaulted_report = [], {}
    for raw in raw_modules:
        filled, defaulted = apply_defaults(raw)
        validate_module(filled)
        modules.append(filled)
        if defaulted:
            defaulted_report[filled["slug"]] = defaulted
    slugs = [m["slug"] for m in modules]
    if len(set(slugs)) != len(slugs):
        raise ValueError("duplicate module slugs in JSON")

    # modules files
    mod_tag = pick_tag(all_strings(modules))
    rows = [module_row(m, mod_tag) for m in modules]
    overhead = len(modules_file_text(99, 99, [], len(modules)).encode("utf-8"))  # header + footer, worst-case digits
    parts = chunk_rows(rows, overhead, 0, MAX_FILE_BYTES)
    n_parts = len(parts)
    written: list[tuple[str, int]] = []
    for i, part_rows in enumerate(parts, start=1):
        name = f"{STAMP}_0009a_ws_curriculum_v2_modules_{i}.sql"
        written.append((name, write(MIGRATIONS / name, modules_file_text(i, n_parts, part_rows, len(modules)))))

    # templates
    new_programs = [p for p in programs if not is_existing_reference(p)]
    known = set(slugs) | set(data["meta"]["existing_module_slugs_referenced_not_reemitted"])
    missing = [s for s in referenced_slugs(programs) if s not in known]
    if missing:
        raise ValueError(f"programs reference unknown modules: {missing}")
    tag_texts = [clean(str(v)) or "" for p in new_programs for v in (p.get("why_he"), p.get("calendar_he"), p.get("hours_note_he"), p["title_he"])]
    tag_texts += [str(s.get(k) or "") for p in new_programs for s in p["template"] for k in ("notes", "session_title")]
    tpl_tag = pick_tag(tag_texts)
    tpl_text, new_rows, per_template = templates_file_text(new_programs, tpl_tag)
    name_b = f"{STAMP}_0009b_ws_curriculum_v2_templates.sql"
    written.append((name_b, write(MIGRATIONS / name_b, tpl_text)))

    # checks
    all_tpl = [template_slug(p) if not is_existing_reference(p) else p["db_template_slug"] for p in programs]
    name_c = f"{STAMP}_0009c_ws_curriculum_v2_checks_READONLY.sql"
    written.append((name_c, write(MIGRATIONS / name_c,
                                  checks_file_text(slugs, per_template, all_tpl, referenced_slugs(programs), new_rows))))

    PUBLIC_COPY.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, PUBLIC_COPY)

    print(f"modules: {len(modules)} in {n_parts} parts; tags: modules=${mod_tag}$ templates=${tpl_tag}$")
    for name, size in written:
        print(f"  {size:>8}  {name}")
    print(f"templates: {len(new_programs)} new, template rows: {new_rows}")
    for tslug, count in per_template:
        prog = next(p for p in new_programs if template_slug(p) == tslug)
        print(f"  {tslug}: json format={prog['format']} -> db format={map_format(prog['format'])}, rows={count}, "
              f"group={parse_group_size(prog.get('group_size'))}")
    print(f"skipped reference-only: {[p['slug'] for p in programs if is_existing_reference(p)]}")
    print(f"modules with defaulted fields: {defaulted_report or 'none'}")


if __name__ == "__main__":
    main()
