import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image
import fitz


SPEC = importlib.util.spec_from_file_location(
    "verona_journal", Path(__file__).resolve().parents[1] / "build_journal.py")
journal = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(journal)


class JournalTests(unittest.TestCase):
    def test_native_qualification_accepts_wrapped_section_titles(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            (output / "review").mkdir()
            name = "Wrapped.pdf"
            title = "What exists, and what remains a review"
            with fitz.open() as doc:
                page = doc.new_page()
                page.insert_text((48, 100), "Source notebook\nCommit register\n"
                                 "What exists, and what remains a\nreview")
                doc.set_toc([[1, f"Section {i}", 1] for i in range(10)])
                doc.save(output / name)
            journal.write(output / "expected-text.json", [[]])
            journal.write(output / "journal.json", {"entries": []})
            journal.write(output / "edition.json", {
                "pdfName": name, "pages": [{}], "assets": [], "acceptanceTitle": title,
                "outputs": {name: {"sha256": journal.sha(output / name)}},
                "expectedTextSha256": journal.sha(output / "expected-text.json")})
            self.assertEqual(journal.qualify(output)["nativePages"], 1)

    def test_freeze_returns_the_custom_pdf_hash_and_preserves_existing_edition(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "candidate"
            output.mkdir()
            name = "Continuation.pdf"
            for filename in (name, "reading.html", "journal.json", "manifest-input.json",
                             "expected-text.json", "prepared.json", "qualification.json"):
                (output / filename).write_bytes(filename.encode())
            (output / "assets").mkdir()
            journal.write(output / "edition.json", {
                "pdfName": name, "editionId": "Continuation", "pages": [{}], "assets": []})
            journal.write(output / "review.json", {
                "pdfSha256": journal.sha(output / name), "layoutReviewedPages": [1],
                "reviewedFigures": [], "fullResolutionPages": [1], "unresolved": []})
            with patch.object(journal, "ROOT", root), patch.object(journal, "qualify"):
                result = journal.freeze(output, output / "review.json")
                self.assertEqual(result["pdfSha256"], journal.sha(output / name))
                self.assertEqual((Path(result["frozenEdition"]) / name).read_bytes(),
                                 (output / name).read_bytes())
                with self.assertRaises(FileExistsError):
                    journal.freeze(output, output / "review.json")

    def test_continuation_inputs_and_pdf_names_cannot_escape_the_book(self):
        for value in ("../outside.pdf", "C:\\outside.pdf", ".agent-context.pdf", "book.html"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                journal.pdf_name({"pdfName": value})
        with tempfile.TemporaryDirectory(dir=journal.ROOT / "book") as temporary:
            root = Path(temporary)
            source = root / "manifest.json"
            source.write_text(json.dumps({"content": "../outside.json"}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "content must be inside book"):
                journal.prepare(root / "candidate", source)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaisesRegex(ValueError, "manifests must be inside book"):
                journal.prepare(root / "candidate", root / "manifest.json")

    def test_explicit_image_allowlist_rejects_escape_and_private_input(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for path in ("../outside.png", ".agent-context/a.png", ".env.png", "audio.wav"):
                with self.subTest(path=path), self.assertRaises(ValueError):
                    journal.checked_image(root, path)
            image = root / ".local" / "qualification" / "run" / "face.png"
            image.parent.mkdir(parents=True)
            Image.new("RGB", (4, 4), "red").save(image)
            self.assertEqual(journal.checked_image(root, "run/face.png"), image)

    def test_gif_sampling_uses_encoded_timeline_and_rejects_past_end(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "motion.gif"
            red, blue = Image.new("RGB", (3, 3), "red"), Image.new("RGB", (3, 3), "blue")
            red.save(path, save_all=True, append_images=[blue], duration=[70, 130], loop=0)
            before = path.read_bytes()
            image, record = journal.sample_image(path, 70)
            self.assertEqual(image.getpixel((1, 1)), (0, 0, 255, 255))
            self.assertEqual(record, {"requestedMs": 70, "frame": 1,
                                     "frameStartMs": 70, "durationMs": 130})
            self.assertEqual(path.read_bytes(), before)
            for request in (None, -1, 200):
                with self.subTest(request=request), self.assertRaises(ValueError):
                    journal.sample_image(path, request)

    def test_png_does_not_silently_accept_gif_sample_time(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "still.png"
            Image.new("RGBA", (5, 6), (0, 120, 255, 80)).save(path)
            image, record = journal.sample_image(path)
            self.assertEqual(image.getpixel((0, 0)), (0, 120, 255, 80))
            self.assertIsNone(record)
            with self.assertRaises(ValueError):
                journal.sample_image(path, 0)

    def test_long_source_tokens_wrap_without_shrinking_or_disappearing(self):
        value = "a " + "b" * 23 + " c"
        lines = journal.wrapped(value, 8, len)
        self.assertTrue(all(len(line) <= 8 for line in lines))
        self.assertEqual("".join(lines).replace(" ", ""), value.replace(" ", ""))
        with self.assertRaises(ValueError):
            journal.wrapped("word", 0.1, len)

    def test_embedding_gate_rejects_restricted_and_no_subset_fonts(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "font.ttf"
            for flags in (0, 2, 0x100, 0x200):
                data = bytearray(38)
                struct.pack_into(">H", data, 4, 1)
                struct.pack_into(">4sIII", data, 12, b"OS/2", 0, 28, 10)
                struct.pack_into(">H", data, 36, flags)
                path.write_bytes(data)
                if flags:
                    with self.assertRaises(ValueError):
                        journal.embedding_flags(path)
                else:
                    self.assertEqual(journal.embedding_flags(path), 0)

    def test_native_pdf_copies_actual_ascii_not_font_cmap_aliases(self):
        with tempfile.TemporaryDirectory() as temporary:
            fonts = journal.fonts_for(journal.load(journal.INPUT))
            book = journal.JournalPDF(fonts, [], Path(temporary))
            book.page_new("Test", "test")
            text = "Source notebook - docs/product-brief.md; exact spaces."
            book.text(text, 48, 100, 499)
            book.text(text, 48, 150, 499, role="mono")
            book.restore_unicode()
            book.doc.subset_fonts()
            with fitz.open(stream=book.doc.tobytes(), filetype="pdf") as restored:
                self.assertEqual(restored[0].get_text().count(text), 2)
            book.doc.close()

    def test_native_overlap_guard_distinguishes_columns_from_collisions(self):
        title = {"bbox": (40, 100, 400, 130), "text": "Title"}
        column = {"bbox": (450, 100, 500, 130), "text": "Date"}
        subtitle = {"bbox": (40, 125, 400, 140), "text": "Subtitle"}
        journal.check_text_overlap([title, column], 1)
        with self.assertRaisesRegex(ValueError, "overlaps"):
            journal.check_text_overlap([title, subtitle], 1)


if __name__ == "__main__":
    unittest.main()
