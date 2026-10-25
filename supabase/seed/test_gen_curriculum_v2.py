"""Unit tests for gen_curriculum_v2.py. Run: python -m unittest test_gen_curriculum_v2 (from this folder)."""
import unittest

import gen_curriculum_v2 as g


class ParseGroupSize(unittest.TestCase):
    def test_first_integer_in_range(self):
        self.assertEqual(g.parse_group_size("4 עד 5, ארבעה תפקידים"), 4)
        self.assertEqual(g.parse_group_size("כיתה שלמה, קבוצות של 6 עד 8"), 6)
        self.assertEqual(g.parse_group_size("4"), 4)

    def test_unparseable_or_out_of_range_defaults_to_4(self):
        self.assertEqual(g.parse_group_size("שלישיות"), 4)
        self.assertEqual(g.parse_group_size("12 עד 15"), 4)
        self.assertEqual(g.parse_group_size("1"), 4)
        self.assertEqual(g.parse_group_size(None), 4)


class Mappings(unittest.TestCase):
    def test_format_mapping(self):
        self.assertEqual(g.map_format("sessions"), "sessions")
        self.assertEqual(g.map_format("hackathon"), "hackathon")
        self.assertEqual(g.map_format("custom"), "custom")
        self.assertEqual(g.map_format("club"), "custom")

    def test_unknown_format_raises(self):
        with self.assertRaises(ValueError):
            g.map_format("weird")

    def test_session_kind_mapping(self):
        for k in ("regular", "practical", "hackathon", "demo_day", "other"):
            self.assertEqual(g.map_session_kind(k), k)
        self.assertEqual(g.map_session_kind("workshop"), "other")
        self.assertEqual(g.map_session_kind(None), "other")


class Quoting(unittest.TestCase):
    def test_tag_switches_when_text_contains_default(self):
        self.assertEqual(g.pick_tag(["abc"]), "ws")
        self.assertEqual(g.pick_tag(["a $ws$ b"]), "ws2")

    def test_dq(self):
        self.assertEqual(g.dq("x", "ws"), "$ws$x$ws$")


class Rows(unittest.TestCase):
    MODULE = {
        "slug": "abc-def", "title": " T ", "summary": " S ", "module_type": "practice",
        "pipeline_stage": None, "duration_minutes": 30, "objectives": [" o1 "],
        "exercises": [{"title": "e"}], "materials": [], "facilitator_notes": " a\r\nb \n",
        "tags": [], "requires_app": False,
    }

    def test_module_row_normalizes_and_formats(self):
        row = g.module_row(self.MODULE, "ws")
        self.assertIn("$ws$abc-def$ws$", row)
        self.assertIn("$ws$T$ws$", row)
        self.assertIn("null, 30, array[$ws$o1$ws$]::text[]", row)
        self.assertIn("$ws$a\nb$ws$", row)
        self.assertIn("'{}'::text[], false)", row)
        self.assertIn("$ws$[]$ws$::jsonb", row)

    def test_module_validation_rejects_bad_enum(self):
        bad = dict(self.MODULE, module_type="nope")
        with self.assertRaises(ValueError):
            g.validate_module(bad)

    def test_module_validation_rejects_bad_slug(self):
        with self.assertRaises(ValueError):
            g.validate_module(dict(self.MODULE, slug="Bad_Slug"))

    def test_defaults_reported_for_missing_fields(self):
        m = {"slug": "abc", "title": "tt", "module_type": "demo"}
        filled, defaulted = g.apply_defaults(m)
        self.assertEqual(filled["duration_minutes"], 45)
        self.assertIn("duration_minutes", defaulted)
        self.assertEqual(filled["objectives"], [])

    def test_chunking_respects_limit(self):
        rows = ["x" * 100] * 10
        parts = g.chunk_rows(rows, header_bytes=50, footer_bytes=30, limit=450)
        self.assertTrue(all(len(p) >= 1 for p in parts))
        self.assertEqual(sum(len(p) for p in parts), 10)
        for p in parts:
            self.assertLessEqual(50 + 30 + sum(len(r) + 2 for r in p), 450)

    def test_chunking_rejects_oversized_row(self):
        with self.assertRaises(ValueError):
            g.chunk_rows(["x" * 1000], header_bytes=10, footer_bytes=10, limit=100)


class Templates(unittest.TestCase):
    PROGRAM = {
        "slug": "cv-x", "proposed_db_template_slug": "cv-x-tpl", "title_he": "כותרת",
        "format": "club", "status": "new", "group_size": "3 עד 6",
        "why_he": "למה", "calendar_he": "מתי", "hours_note_he": "שעות",
        "template": [
            {"session_no": 1, "session_title": "א", "session_kind": "regular",
             "modules": ["mod-a", "mod-b"], "optional_modules": ["mod-c"], "notes": "הערה"},
            {"session_no": 2, "session_title": "ב", "session_kind": "weird",
             "modules": ["mod-a"], "optional_modules": [], "notes": ""},
        ],
    }

    def test_template_row(self):
        slug, row = g.template_row(self.PROGRAM, "ws")
        self.assertEqual(slug, "cv-x-tpl")
        self.assertIn("$ws$למה | מתי | שעות$ws$", row)
        self.assertIn("$ws$custom$ws$, 3, false)", row)

    def test_description_trimmed(self):
        p = dict(self.PROGRAM, why_he="x" * 3000)
        self.assertEqual(len(g.template_description(p)), 2000)

    def test_template_module_rows_running_position(self):
        rows = g.template_module_rows(self.PROGRAM, "ws")
        self.assertEqual(len(rows), 3)
        self.assertIn("$ws$cv-x-tpl$ws$, $ws$mod-a$ws$, 1, 1, $ws$א$ws$, $ws$regular$ws$", rows[0])
        self.assertIn("mod-c", rows[0])  # optional modules ride on the first row notes
        self.assertIn("$ws$mod-b$ws$, 1, 2", rows[1])
        self.assertIn("$ws$mod-a$ws$, 2, 3, $ws$ב$ws$, $ws$other$ws$, null)", rows[2])


if __name__ == "__main__":
    unittest.main()
