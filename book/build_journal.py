"""Build Verona's explicitly allowlisted, local M1 journal; never start the app."""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import html
import importlib.metadata
import json
from pathlib import Path
import platform
import re
import shutil
import struct
import subprocess

import fitz
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "book" / "milestone-1" / "manifest.json"
REQUIREMENTS = Path(__file__).with_name("requirements-journal.txt")
PDF_NAME = "Verona-M1-Development-Journal.pdf"
IST = timezone(timedelta(hours=5, minutes=30))
PAPER = (0.973, 0.957, 0.918)
INK = (0.102, 0.184, 0.204)
MUTED = (0.31, 0.36, 0.36)
RULE = (0.78, 0.79, 0.74)
ACCENT = (0.67, 0.25, 0.13)
DARK = (0.055, 0.09, 0.13)
WIDTH, HEIGHT = 595.276, 841.89


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=True) + "\n",
                          encoding="utf-8")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def git(*args):
    return subprocess.check_output(
        ["git", "-C", str(ROOT), *args], stderr=subprocess.PIPE)


def checked_image(root, relative):
    value = Path(relative)
    if value.is_absolute() or ".." in value.parts:
        raise ValueError(f"Image path must be relative and contained: {relative}")
    parts = relative.replace("\\", "/").split("/")
    if any(p.startswith(".env") or p == ".agent-context" for p in parts):
        raise ValueError("Private/credential inputs cannot enter the journal.")
    if parts[:2] == ["docs", "media"]:
        allowed = root / "docs" / "media"
        path = root / value
    else:
        allowed = root / ".local" / "qualification"
        path = allowed / value
    if path.suffix.lower() not in (".png", ".gif"):
        raise ValueError(f"Only explicit PNG/GIF image inputs are allowed: {relative}")
    if not path.resolve().is_relative_to(allowed.resolve()):
        raise ValueError(f"Image resolves outside its allowed root: {relative}")
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def sample_image(path, requested_ms=None):
    with Image.open(path) as image:
        if image.format == "GIF":
            if requested_ms is None or requested_ms < 0:
                raise ValueError(f"GIF requires a nonnegative explicit sampleMs: {path}")
            elapsed = 0
            for frame in range(image.n_frames):
                image.seek(frame)
                duration = image.info.get("duration", 0)
                if duration <= 0:
                    raise ValueError(f"GIF frame has no positive duration: {path}/{frame}")
                if elapsed <= requested_ms < elapsed + duration:
                    return image.convert("RGBA"), {
                        "requestedMs": requested_ms, "frame": frame,
                        "frameStartMs": elapsed, "durationMs": duration}
                elapsed += duration
            raise ValueError(f"GIF sample exceeds its timeline: {path}")
        if requested_ms is not None:
            raise ValueError(f"sampleMs is only valid for a GIF: {path}")
        image.load()
        return image.convert("RGBA"), None


def tool_versions():
    versions = {name: importlib.metadata.version(name)
                for name in ("PyMuPDF", "Pillow")}
    for line in REQUIREMENTS.read_text().splitlines():
        if line and not line.startswith("#"):
            name, required = line.split("==")
            if versions.get(name) != required:
                raise RuntimeError(f"{name} must be {required}, found {versions.get(name)}")
    return {"python": platform.python_version(), **versions, "platform": platform.platform()}


def embedding_flags(path):
    data = path.read_bytes()
    tables = struct.unpack_from(">H", data, 4)[0]
    for i in range(tables):
        tag, _, offset, size = struct.unpack_from(">4sIII", data, 12 + i * 16)
        if tag == b"OS/2" and size >= 10:
            flags = struct.unpack_from(">H", data, offset + 8)[0]
            if flags & (0x0002 | 0x0100 | 0x0200):
                raise ValueError(f"Font forbids required embedding/subsetting: {path.name}")
            return flags
    raise ValueError(f"Font has no readable embedding-rights table: {path.name}")


def fonts_for(manifest):
    directory = Path(r"C:\Windows\Fonts")
    result = {}
    for role, filename in manifest["fonts"].items():
        path = directory / filename
        if not path.is_file():
            raise FileNotFoundError(f"Required installed font missing: {path}")
        result[role] = {"path": path, "sha256": sha(path),
                        "fsType": embedding_flags(path), "font": fitz.Font(fontfile=str(path))}
    return result


def wrapped(text, width, measure):
    if width <= 0:
        raise ValueError("Text column width must be positive.")
    lines, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}" if line else word
        if measure(candidate) <= width:
            line = candidate
            continue
        if line:
            lines.append(line)
            line = ""
        while measure(word) > width:
            length = max(i for i in range(1, len(word) + 1)
                         if measure(word[:i]) <= width) if measure(word[0]) <= width else 0
            if not length:
                raise ValueError("A single glyph cannot fit the text column.")
            lines.append(word[:length])
            word = word[length:]
        line = word
    if line:
        lines.append(line)
    return lines


def historical_data(manifest, journal):
    revision = manifest["historicalRevision"]
    references = {}
    for path in manifest["references"]:
        data = git("show", f"{revision}:{path}")
        references[path] = {"sha256": hashlib.sha256(data).hexdigest(),
                             "bytes": len(data)}
    log = git("log", "--reverse", "--format=%H%x1f%aI%x1f%s", revision).decode("utf-8")
    commits = []
    for line in log.splitlines():
        commit, date, title = line.split("\x1f", 2)
        stamp = datetime.fromisoformat(date).astimezone(IST)
        commits.append({"commit": commit, "timestamp": stamp.isoformat(),
                        "date": stamp.strftime("%d %b %Y"),
                        "day": stamp.strftime("%d"), "time": stamp.strftime("%H:%M"),
                        "title": title})
    ids, order = set(), []
    for entry in journal["entries"]:
        if entry["id"] in ids:
            raise ValueError(f"Duplicate journal ID: {entry['id']}")
        ids.add(entry["id"])
        matches = [c for c in commits if c["commit"].startswith(entry["commit"])]
        if len(matches) != 1:
            raise ValueError(f"Journal commit is missing/ambiguous: {entry['commit']}")
        entry["record"] = matches[0]
        order.append(commits.index(matches[0]))
    if order != sorted(order):
        raise ValueError("Journal entries must follow actual commit chronology.")
    index = git("show", f"{revision}:TODO/00_INDEX.todo").decode("utf-8")
    workstreams = []
    for line in index.splitlines():
        if re.match(r"^vr-\d+ \|", line):
            identity, path, status, title = [c.strip() for c in line.split("|", 3)]
            if identity != "vr-04":
                workstreams.append({"id": identity, "path": path,
                                    "status": status, "title": title})
    if not workstreams:
        raise ValueError("Historical workstream register is empty.")
    return {"references": references, "commits": commits, "workstreams": workstreams}


def source_sheets(output, assets):
    font = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 17)
    review = output / "review"
    review.mkdir()
    for offset in range(0, len(assets), 12):
        rows = assets[offset:offset + 12]
        sheet = Image.new("RGB", (1600, 1320), "#e8e4db")
        draw = ImageDraw.Draw(sheet)
        for i, record in enumerate(rows):
            x, y = (i % 4) * 400, (i // 4) * 440
            with Image.open(output / record["asset"]) as original:
                image = original.copy()
            image.thumbnail((388, 359), Image.Resampling.LANCZOS)
            base = Image.new("RGBA", (388, 359), "#111b29")
            base.alpha_composite(image, ((388 - image.width) // 2, (359 - image.height) // 2))
            sheet.paste(base.convert("RGB"), (x + 6, y + 34))
            draw.text((x + 9, y + 6), f"{record['id']}  {record['entry']}", font=font, fill="#192d34")
            source = record["source"].removeprefix(".local/qualification/")
            for j in range(2):
                draw.text((x + 8, y + 397 + j * 19), source[j * 36:(j + 1) * 36],
                          font=font, fill="#192d34")
        sheet.save(review / f"source-{offset // 12 + 1:02}.jpg", quality=94)


def prepare(output):
    if output.exists():
        raise FileExistsError(f"Use a new output directory; preserve previous runs: {output}")
    manifest = load(INPUT)
    journal = load(ROOT / manifest["content"])
    historical = historical_data(manifest, journal)
    tools = tool_versions()
    definitions = [{"entry": "COVER", "path": "docs/media/milestone-v0.1.0-claire.gif",
                    "sampleMs": 1100, "caption": "Actual current Claire production-renderer greeting, M1."}]
    for entry in journal["entries"]:
        for figure in entry["figures"]:
            definitions.append({"entry": entry["id"], **figure})
    paths = [checked_image(ROOT, d["path"]) for d in definitions]
    output.mkdir(parents=True)
    (output / "assets").mkdir()
    assets = []
    for number, (definition, path) in enumerate(zip(definitions, paths), 1):
        identifier = f"F{number:03}"
        image, sample = sample_image(path, definition.get("sampleMs"))
        asset = f"assets/{identifier}.png"
        image.save(output / asset, optimize=True)
        record = {"id": identifier, "entry": definition["entry"],
                  "source": path.relative_to(ROOT).as_posix(), "sourceSha256": sha(path),
                  "asset": asset, "assetSha256": sha(output / asset),
                  "width": image.width, "height": image.height,
                  "caption": definition["caption"], "sample": sample,
                  "derivation": "Full original canvas; PNG decode or explicit GIF-frame extraction. No crop/resize."}
        assets.append(record)
    write(output / "journal.json", journal)
    write(output / "manifest-input.json", manifest)
    write(output / "prepared.json", {"historical": historical, "assets": assets,
          "tools": tools, "inputSha256": sha(INPUT),
          "journalSourceSha256": sha(ROOT / manifest["content"])})
    source_sheets(output, assets)
    return len(assets)


def color(value):
    return "#" + "".join(f"{round(c * 255):02x}" for c in value)


def check_text_overlap(spans, page_number):
    for index, first in enumerate(spans):
        for second in spans[index+1:]:
            overlap = fitz.Rect(first["bbox"]) & fitz.Rect(second["bbox"])
            if not overlap.is_empty and overlap.width > .75 and overlap.height > .75:
                raise ValueError(f"Native text overlaps on page {page_number}: "
                                 f"{first['text']!r} / {second['text']!r}")


class JournalPDF:
    def __init__(self, fonts, assets, output):
        self.fonts, self.assets, self.output = fonts, assets, output
        self.doc = fitz.open()
        self.pages, self.destinations, self.links = [], {}, []
        self.font_refs = {}
        self.used_characters = {role: set() for role in fonts}
        self.page = None

    def page_new(self, title, section, label=None):
        if label and label in self.destinations:
            raise ValueError(f"Duplicate journal destination: {label}")
        self.page = self.doc.new_page(width=WIDTH, height=HEIGHT)
        self.pages.append({"title": title, "section": section, "items": [], "lines": []})
        for role, spec in self.fonts.items():
            reference = self.page.insert_font(fontname=role, fontfile=str(spec["path"]))
            if self.font_refs.setdefault(role, reference) != reference:
                raise ValueError(f"Unexpected duplicate font resource for {role}")
        self.rect((0, 0, WIDTH, HEIGHT), PAPER)
        if label:
            self.destinations[label] = self.doc.page_count
        self.text("VERONA / DEVELOPMENT JOURNAL", 45, 28, 430, 8, "mono", MUTED)
        self.line(45, 49, 550, 49, RULE)
        return self.doc.page_count

    @property
    def items(self):
        return self.pages[self.page.number]["items"]

    def rect(self, box, fill):
        self.page.draw_rect(fitz.Rect(box), color=None, fill=fill)
        x, y, x1, y1 = box
        self.items.append(f'<div class="rect" style="left:{x}pt;top:{y}pt;'
                          f'width:{x1-x}pt;height:{y1-y}pt;background:{color(fill)}"></div>')

    def line(self, x, y, x1, y1, stroke=RULE):
        self.page.draw_line((x, y), (x1, y1), color=stroke, width=.6)
        self.items.append(f'<svg class="vector" viewBox="0 0 {WIDTH} {HEIGHT}">'
                          f'<path d="M{x} {y} L{x1} {y1}" stroke="{color(stroke)}" stroke-width=".6"/></svg>')

    def text(self, value, x, y, width, size=10.7, role="body", ink=INK, bottom=785):
        spec = self.fonts[role]
        lines = wrapped(value, width, lambda s: spec["font"].text_length(s, fontsize=size))
        leading = size * 1.36
        if y + len(lines) * leading > bottom:
            raise ValueError(f"Text overflow p{self.page.number+1}: {value[:75]}")
        for line in lines:
            self.used_characters[role].update(line)
            self.pages[self.page.number]["lines"].append(line)
            self.page.insert_text((x, y + size), line, fontname=role,
                                  fontsize=size, color=ink)
            self.items.append(f'<span class="text {role}" style="left:{x}pt;top:{y}pt;'
                              f'font-size:{size}pt;color:{color(ink)}">{html.escape(line)}</span>')
            y += leading
        return y

    def heading(self, title, kicker=None):
        if kicker:
            self.text(kicker, 48, 71, 500, 9, "mono", ACCENT)
        return self.text(title, 48, 94, 500, 25, "bold")

    def paragraph(self, text, y, x=103, width=444, size=10.7):
        return self.text(text, x, y, width, size) + 9

    def figure(self, record, box, caption_ink=INK):
        x, y, x1, y1 = box
        caption = f"{record['id']} / {record['caption']}"
        if record["sample"]:
            sample = record["sample"]
            caption += f" [GIF {sample['frameStartMs']/1000:.3f}s, frame {sample['frame']}]"
        cap_lines = wrapped(caption, x1-x, lambda s: self.fonts["body"]["font"].text_length(s, fontsize=9))
        cap_height = len(cap_lines) * 12.24 + 6
        height = y1-y-cap_height
        if height < 90:
            raise ValueError(f"Figure/caption cannot fit: {record['id']}")
        self.rect((x, y, x1, y+height), DARK)
        ratio = min((x1-x-8)/record["width"], (height-8)/record["height"])
        iw, ih = ratio*record["width"], ratio*record["height"]
        px, py = x+(x1-x-iw)/2, y+(height-ih)/2
        target = fitz.Rect(px, py, px+iw, py+ih)
        self.page.insert_image(target, filename=str(self.output / record["asset"]))
        self.items.append(f'<a href="{record["asset"]}" aria-label="{record["id"]}: full image">'
                          f'<img alt="{html.escape(record["caption"], quote=True)}" src="{record["asset"]}" '
                          f'style="left:{px}pt;top:{py}pt;width:{iw}pt;height:{ih}pt"></a>')
        self.text(caption, x, y+height+6, x1-x, 9, ink=caption_ink, bottom=y1+1)

    def restore_unicode(self):
        # TTF cmap aliases can otherwise copy ASCII spaces/punctuation as NBSP,
        # soft hyphens or Greek question marks despite looking identical.
        for role, characters in self.used_characters.items():
            mapping = {}
            for character in characters:
                glyph = self.fonts[role]["font"].has_glyph(ord(character))
                if not glyph:
                    raise ValueError(f"Missing glyph in {role}: {character!r}")
                if glyph in mapping and mapping[glyph] != character:
                    raise ValueError(f"Ambiguous source characters share a {role} glyph.")
                mapping[glyph] = character
            lines = ["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
                "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
                "/CMapName /VeronaSourceUnicode def", "/CMapType 2 def",
                "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange"]
            pairs = sorted(mapping.items())
            for offset in range(0, len(pairs), 100):
                group = pairs[offset:offset+100]
                lines.append(f"{len(group)} beginbfchar")
                lines.extend(f"<{glyph:04X}> <{character.encode('utf-16-be').hex().upper()}>"
                             for glyph, character in group)
                lines.append("endbfchar")
            lines.extend(["endcmap", "CMapName currentdict /CMap defineresource pop",
                          "end", "end"])
            reference = self.font_refs[role]
            kind, value = self.doc.xref_get_key(reference, "ToUnicode")
            if kind != "xref":
                raise ValueError(f"Missing PDF Unicode map for {role}")
            self.doc.update_stream(int(value.split()[0]), "\n".join(lines).encode("ascii"))

    def link(self, rect, target):
        self.links.append((self.page.number, fitz.Rect(rect), target))

    def entry(self, entry):
        record = entry["record"]
        self.page_new(entry["title"], "journal", entry["id"])
        self.line(88, 82, 88, 749)
        self.text(record["day"], 43, 82, 42, 30, "bold", ACCENT)
        self.text(record["date"][3:6].upper(), 45, 127, 40, 9, "mono")
        self.text(record["time"], 43, 146, 44, 8, "mono", MUTED)
        self.text("IST", 45, 162, 36, 8, "mono", MUTED)
        self.text(entry["id"], 44, 212, 42, 12, "bold")
        self.text(entry["status"], 103, 78, 444, 8.5, "mono", ACCENT)
        y = self.text(entry["title"], 103, 103, 444, 23, "bold") + 16
        for paragraph in entry["body"]:
            y = self.paragraph(paragraph, y)
        y += 6
        for label, key in (("METHOD", "mechanism"), ("WHAT CHANGED / FAILED", "failure"), ("LIMIT", "boundary")):
            self.line(103, y, 547, y)
            y += 8
            y = self.text(label, 103, y, 444, 8, "mono", ACCENT) + 3
            y = self.text(entry[key], 103, y, 444, 9.4, bottom=735) + 11
        self.text(f"{entry['workstreams']} / chapters {entry['chapter']}", 103, 747, 444, 8, "mono", MUTED)
        self.text(f"Commit {record['commit'][:7]} / {record['timestamp']}", 103, 763, 444, 7.8, "mono", MUTED)
        images = [a for a in self.assets if a["entry"] == entry["id"]]
        if images:
            if len(images) > 2 and all(a["height"] / a["width"] > 2 for a in images):
                for offset in range(0, len(images), 2):
                    self.plate(entry["id"], entry["title"], images[offset:offset+2], tall=True)
            else:
                self.plate(entry["id"], entry["title"], images)
        elif entry.get("flow"):
            self.page_new(f"{entry['id']} / feasibility notebook", "evidence", f"{entry['id']}-flow")
            self.heading("What the first probe established", f"{entry['id']} / RECONSTRUCTED TECHNICAL NOTE")
            for index, step in enumerate(entry["flow"]):
                top = 171 + index * 98
                self.rect((48, top, 547, top+72), (0.916, 0.929, 0.895))
                self.text(f"0{index+1}", 61, top+20, 45, 17, "mono", ACCENT)
                self.text(step, 119, top+23, 410, 15, "bold")
                if index < len(entry["flow"])-1:
                    self.line(297, top+75, 297, top+94, ACCENT)
            self.text("30 frames / 301 outputs / finite reconstructed skin [61,520, 3]",
                      48, 601, 499, 10.1, "mono")
            self.text("Recorded network median: 20.26 ms. One PCA reconstruction: 6.56 ms. These are historical partial timings from chapter 05, not an end-to-end response benchmark.", 48, 642, 499, 10.7)
            self.text("Original diagram authored for this retrospective. The first probe had no graphical face, speech playback or accuracy acceptance.", 48, 727, 499, 9.3, "italic", MUTED)

    def plate(self, identifier, title, images, tall=False):
        self.page_new(f"{identifier} evidence", "evidence", f"{identifier}-plate-{images[0]['id']}")
        heading_end = self.heading(title, f"{identifier} / EVIDENCE PLATE")
        shift = max(0, heading_end-128)
        self.text("Historical captures / not a fresh application qualification", 48, 148+shift, 500, 8.3, "mono", MUTED)
        if len(images) == 1:
            boxes = [(48, 177+shift, 547, 757)]
        elif len(images) == 2 and tall:
            boxes = [(48, 177+shift, 288, 757), (307, 177+shift, 547, 757)]
        elif len(images) == 2:
            boxes = [(48, 177+shift, 547, 454), (48, 473, 547, 757)]
        elif len(images) == 3:
            boxes = [(48, 177+shift, 547, 454), (48, 473, 288, 757), (307, 473, 547, 757)]
        elif len(images) == 4:
            boxes = [(48, 177+shift, 288, 457), (307, 177+shift, 547, 457),
                     (48, 477, 288, 757), (307, 477, 547, 757)]
        else:
            raise ValueError(f"Explicit plate layout needed for {len(images)} images.")
        for record, box in zip(images, boxes):
            self.figure(record, box)
        self.text("Figure IDs resolve to exact source paths, hashes and GIF times in the edition manifest.", 48, 772, 499, 7.5, "mono", MUTED)

    def note_page(self, label, title, paragraphs):
        self.page_new(title, "reference", label)
        y = self.heading(title, "BENCH NOTES / M1") + 21
        for subheading, text in paragraphs:
            y = self.text(subheading, 48, y, 499, 12, "bold") + 8
            y = self.text(text, 48, y, 499, 10.7, bottom=768) + 22

    def finish(self, journal, manifest, historical):
        total = self.doc.page_count
        for index in range(total):
            self.page = self.doc[index]
            self.line(45, 795, 550, 795)
            self.text("M1 / 18-21 NOV 2026 / LOCAL EDITION", 45, 806, 435, 7.7, "mono", MUTED, bottom=835)
            self.text(f"{index+1:02} / {total:02}", 495, 806, 60, 7.7, "mono", MUTED, bottom=835)
        contents = next(i for i, p in enumerate(self.pages) if p["section"] == "contents")
        self.page = self.doc[contents]
        y = 149
        for entry in journal["entries"]:
            date = entry["record"]
            page = self.destinations[entry["id"]]
            self.text(f"{date['day']} {date['date'][3:6]}", 48, y, 55, 8, "mono", MUTED)
            self.text(f"{entry['id']}  {entry['title']}", 110, y, 401, 9.1)
            self.text(str(page), 526, y, 25, 9.1, "mono", ACCENT)
            self.link((45, y-1, 551, y+13), page)
            y += 17
        self.text("The timeline precedes the journal. Bench notes and historical registers follow it.", 48, 703, 499, 8.4, "italic", MUTED)
        y = 728
        for label, title in (("mechanism", "Mechanism"), ("acceptance", "M1 boundary"), ("sources", "Source notebook")):
            destination = self.destinations[label]
            self.text(f"{title} / {destination}", 48, y, 499, 8.8, "mono")
            self.link((45, y, 550, y+13), destination)
            y += 17
        for index, rect, destination in self.links:
            if destination < 1 or destination > total:
                raise ValueError("Invalid native PDF destination.")
            self.doc[index].insert_link({"kind": fitz.LINK_GOTO, "from": rect, "page": destination-1})
            self.pages[index]["items"].append(f'<a class="hotspot" href="#page-{destination}" '
                f'style="left:{rect.x0}pt;top:{rect.y0}pt;width:{rect.width}pt;height:{rect.height}pt" '
                f'aria-label="Go to page {destination}"></a>')
        outline = [[1, "Opening notebook", 2], [1, "Contents", contents+1], [1, "Dated timeline", 4]]
        for entry in journal["entries"]:
            outline.append([1, f"{entry['id']} / {entry['record']['date']} / {entry['title']}",
                            self.destinations[entry["id"]]])
        for label in ("mechanism", "acceptance", "records", "sources", "glossary", "commits", "workstreams"):
            outline.append([1, self.pages[self.destinations[label]-1]["title"], self.destinations[label]])
        self.doc.set_toc(outline)
        self.doc.set_metadata({"title": manifest["title"] + " / M1 Development Journal",
            "author": "Zanark / Copilot", "subject": "Dated, illustrated development retrospective; 18-21 November 2026",
            "keywords": "Verona, M1, development journal, speech, face mesh, local CPU",
            "creator": "Verona book/build_journal.py / PyMuPDF"})
        self.restore_unicode()
        self.doc.subset_fonts()
        self.doc.save(self.output / PDF_NAME, garbage=4, deflate=True)
        self.doc.close()
        articles = []
        for index, page in enumerate(self.pages, 1):
            articles.append(f'<article class="sheet" id="page-{index}" aria-label="Page {index}: '
                            f'{html.escape(page["title"], quote=True)}">{"".join(page["items"])}</article>')
        css = """body{margin:0;background:#d7d4ca;color:#1a2f34;font-family:Georgia,serif}
nav{position:sticky;top:0;z-index:5;background:#192f34;color:#fff;padding:12px 20px;font:14px Consolas,monospace}
nav a{color:#fff;margin-right:20px}.reading-note{max-width:760px;margin:20px auto;padding:0 12px;line-height:1.6}
.sheet{position:relative;width:595.276pt;height:841.89pt;margin:24px auto;box-shadow:0 4px 20px #0003;overflow:hidden}
.text,.rect,img,.hotspot{position:absolute}.text{white-space:pre;line-height:1.36}
.body,.bold,.italic{font-family:Georgia,serif}.bold{font-weight:bold}.italic{font-style:italic}
.mono{font-family:Consolas,monospace}.vector{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.hotspot:hover{outline:1px solid #ac4021}.sheet a img:hover{outline:2px solid #ac4021}
@media print{body{background:white}nav,.reading-note{display:none}.sheet{margin:0;box-shadow:none;break-after:page}
@page{size:A4;margin:0}}"""
        reader = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
        reader += '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' data:; style-src \'unsafe-inline\'; base-uri \'none\'">'
        reader += f'<title>{html.escape(manifest["title"])}</title><style>{css}</style><nav>'
        reader += f'<a href="{PDF_NAME}">Open PDF</a><a href="#page-3">Contents</a><a href="edition.json">Edition manifest</a></nav>'
        reader += '<p class="reading-note">An offline, fixed-page reading companion. Click any image for its full-resolution PNG. '
        reader += 'Use the native PDF for bookmarks and page navigation. Static GIF samples do not animate or play sound. '
        reader += 'This reader makes no network requests and contains no application capability or runtime connection.</p>'
        reader += "".join(articles) + "</html>\n"
        (self.output / "reading.html").write_text(reader, encoding="utf-8")
        write(self.output / "expected-text.json", [p["lines"] for p in self.pages])
        return [{"page": i+1, "title": p["title"], "section": p["section"]}
                for i, p in enumerate(self.pages)]


def render(output):
    if (output / PDF_NAME).exists():
        raise FileExistsError("Preserve the existing PDF; use a new run/from-edition output.")
    prepared = load(output / "prepared.json")
    journal, manifest = load(output / "journal.json"), load(output / "manifest-input.json")
    tools = tool_versions()
    assets, historical = prepared["assets"], prepared["historical"]
    for record in assets:
        path = output / record["asset"]
        if not path.resolve().is_relative_to((output / "assets").resolve()) or sha(path) != record["assetSha256"]:
            raise ValueError(f"Prepared image changed or escaped its root: {record['id']}")
    fonts = fonts_for(manifest)
    book = JournalPDF(fonts, assets, output)
    book.page_new("The first speaking face", "cover", "cover")
    book.text("VERONA", 49, 75, 490, 14, "mono", ACCENT)
    book.text("The first", 46, 118, 503, 47, "bold")
    book.text("speaking face", 46, 183, 503, 47, "bold")
    book.text("A DEVELOPMENT JOURNAL", 49, 263, 493, 12, "mono")
    book.rect((193, 312, 547, 716), DARK)
    book.figure(assets[0], (201, 321, 539, 700), caption_ink=(.78, .84, .84))
    book.text("M1", 49, 335, 130, 53, "bold", ACCENT)
    book.text("18-21", 50, 424, 125, 22, "bold")
    book.text("NOVEMBER", 50, 459, 125, 12, "mono")
    book.text("2026", 50, 481, 125, 22, "bold")
    book.text("Research.\n", 50, 548, 130, 11, "italic")
    book.text("Experiments.", 50, 570, 130, 11, "italic")
    book.text("Corrections.", 50, 592, 130, 11, "italic")
    book.text("A local voice.", 50, 614, 130, 11, "italic")
    book.text("v0.1.0 / functional experimental source milestone", 49, 748, 498, 9, "mono")
    book.note_page("opening", "Open the notebook", [
        ("A journal, not a victory list", journal["editorialNote"]),
        ("The question", "Could a sentence become local speech and a connected animated face, with expressive motion and no paid/cloud inference? The owner prioritized making it exist, then kept correcting the face, controls and interaction. This book follows those changes rather than pretending the final workspace was planned in one step."),
        ("What the dates mean", "Every dated entry is anchored to a real repository commit in Asia/Kolkata, UTC+05:30. A capture may have been produced during qualification before that commit or reused later; captions say when a plate is subsequent documentation. No capture timestamp is inferred from a filesystem modification time."),
        ("What is frozen", f"Release source: {manifest['releaseRevision']}. Historical closeout: {manifest['historicalRevision']}. The edition was authored after that cutoff. Its local publication does not alter the released source/tag/assets."),
        ("Reading the evidence", "Warm paper, dated gutters and bench notes provide the journal structure. Figures are actual reviewed app renders or qualification records. GIFs become explicitly timed stills; this PDF contains no sound, autoplay, private conversations, model weights, supplied reference artwork or runtime credentials.")
    ])
    book.page_new("Contents", "contents", "contents")
    book.heading("Find an entry", "CONTENTS / CLICKABLE IN PDF")
    for days in (("18", "19"), ("20", "21")):
        book.page_new(f"Timeline / {days[0]}-{days[1]} November", "timeline")
        y = book.heading(f"{days[0]}-{days[1]} November 2026", "DATED TIMELINE / COMMIT TIMES, IST") + 25
        current = None
        for entry in journal["entries"]:
            record = entry["record"]
            if record["day"] not in days:
                continue
            if current != record["day"]:
                current = record["day"]
                y += 14
                y = book.text(record["date"].upper(), 48, y, 499, 12, "bold", ACCENT) + 13
            book.text(f"{record['time']}  {entry['id']}", 48, y, 95, 9, "mono", MUTED)
            y = book.text(entry["title"], 155, y, 390, 10.3) + 10
    for entry in journal["entries"]:
        book.entry(entry)
    book.note_page("mechanism", "The mechanism that survived", [
        ("1 / Speech is data", "Validated text and voice settings reach a fixed Windows System.Speech program as JSON. Application-owned escaped markup and bounded local tone shaping produce the same PCM used by inference and playback. No camera, microphone, cloud speech or arbitrary SSML is required."),
        ("2 / Identity is a contract", "The native mean, PCA basis, conditioning and topology must match. Mark and Claire have different output layouts. A native MPFB head needs its own transfer/fitting contract; a convincing filename or a rest-shape warp cannot replace one."),
        ("3 / Motion is complete before playback", "A rational audio-window stride generates 30 Hz poses without cumulative rounded-step drift. PCA reconstructs skin. Explicit structural gain uses N + g(E - N), holding audio and neutral prediction fixed. Native MPFB fitting intentionally loses unsupported motion."),
        ("4 / Audio owns time", "WebGL interpolates neighboring poses from the audio position. Pause, seek, restart and ended handling share that clock. Presentation, color, gaze and XYZ edits do not create a competing speech clock."),
        ("5 / Keep only what has an owner", "One latest clip and latest speech live in RAM; persistent caches hold only derived topology. Every named head owns its profile, private capability and workers. Replacement, cancellation, stale IDs, manager death and external-host survival are explicit states."),
        ("6 / Performance is layered", "Inference timing, PCA, generation, host acknowledgment, browser callback cadence, GPU completion and audible response are different measurements. This journal quotes historical runs at their measured layer, never a universal latency or 60 fps promise.")
    ])
    book.note_page("acceptance", "M1: present, limited, unfinished", [
        ("Delivered at the source milestone", "A local browser/Windows desktop speaking-face workspace, six explicit manager choices, independently owned named heads, editable speech/presentation controls and five free feature colors. The separate default-on topmost option and identity live inside each collapsed menu. Current hair choices are original waves and 48-lock spiral curls."),
        ("Technically exercised on this machine", "The released runtime inherits its qualified browser/native model paths. The M1 packaging work reran 76 CPU regressions and checked fresh renderer media and actual GitHub layouts. This retrospective reuses those receipts; writing the book did not rerun inference, listen to speech or drive the owner's windows."),
        ("Not delivered by declaring M1", "Strong sideways cheekiness remains a matched report rather than all-variant runtime integration. Mark remains a separate raw-model report. The Realistic/GLB branch is parked. The broader MPFB identity/selector acceptance work remains open. Eight is a creation cap, not eight-head performance acceptance."),
        ("Not certified", "Accurate phonetics, anatomical contacts, self-intersection clearance, SDK parity, independent teeth/tongue/eye joints, universal 60 fps, instant new-line response, clean-machine installation and human listening/likeness acceptance. Passing finite geometry or muted playback checks cannot stand in for these."),
        ("Release identity", "v0.1.0 points to f892d423f923bdd043ebe6aab7647f0993679251. The source archive has 302 allowlisted members; its three uploaded assets were downloaded and SHA-256 verified. c953ae7 is a later closeout, not a moved tag. This book is an additional local edition, not a replacement release asset.")
    ])
    book.note_page("records", "How to read the records", [
        ("A figure is a claim with a boundary", "Each F-number maps to an exact source path, source SHA-256, full-canvas PNG derivative hash, dimensions and any GIF frame/timing in edition.json. Frames are sampled from real encoded GIFs; no mouths or expressions were painted. The offline HTML opens every image at its retained full resolution."),
        ("Original and derived", "Original .local captures remain untouched. Edition PNGs strip container metadata and decode the original canvas or the explicitly selected GIF frame; no crop or resize is applied. Dark image mats preserve visibility of transparent wire renders. Multi-state qualification sheets stay sheets, not newly staged app screens."),
        ("What a screenshot cannot prove", "A pose cannot prove its emotional name is recognized, an image cannot prove audible timing, and a screenshot of a passing receipt cannot prove the underlying implementation. The journal pairs images with the causal ledger, chapters, workstream state and revision. Rejected frames remain clearly labeled."),
        ("Privacy and rights", "Only the individual allowlisted app/qualification images enter this local edition. No raw conversation, context store, supplied character sheet, recording, voice file, profile, capability URL, model binary or Maya scene is included. Native model imagery retains upstream rights described in THIRD_PARTY.md; this is not a new rights grant or public upload."),
        ("Typography and tools", "Original Verona journal layout. Locally installed Georgia and Consolas supply text; their document-embedding flags are checked and subsets are embedded, not redistributed as font files. PyMuPDF creates searchable native PDF text, images, links and bookmarks; Pillow decodes the stills. Exact versions/hashes live in the edition manifest. No sibling environment or web font is used.")
    ])
    book.page_new("Source notebook", "reference", "sources")
    y = book.heading("Source notebook", "FROZEN REFERENCES / NOT PRIVATE CONTINUITY") + 20
    for path, record in historical["references"].items():
        y = book.text(path, 48, y, 499, 8.1, "mono") + 2
        y = book.text(f"SHA-256 {record['sha256'][:20]}... / {record['bytes']:,} bytes",
                      48, y, 499, 7.7, "mono", MUTED) + 9
    book.text("Full hashes, page/figure maps and exact commits are retained in edition.json. Historical references are read from the frozen Git revision, not the subsequently updated working tree.", 48, 730, 499, 9)
    book.note_page("glossary", "A small bench glossary", [
        ("PCA / basis / mean", "A compact vector of coefficients weights released displacement directions. Adding those weighted deltas to the matching mean reconstructs skin positions. Coefficients are not normalized viseme weights, and one identity's basis cannot be silently reused as another's."),
        ("Native topology", "The original connectivity and vertex identities that make positions into a surface. Nearby coordinates do not prove that upper and lower lips should connect. The Maya ASCII sample is parsed as numbers, never executed."),
        ("Implicit style and explicit emotion", "The network combines a pinned identity/style condition with ten explicit expression controls. A channel's name is metadata, not human acceptance. Joint conditioning is not generally equivalent to averaging independent outputs."),
        ("Rest-space map / Jacobian", "A deformation field defined around a neutral shape can transform full poses consistently. Its local derivative helps diagnose stretching or folding. Positive sampled local diagnostics do not prove global injectivity or collision-free contacts."),
        ("Capability / lifecycle owner", "A per-run secret guards the loopback API; it must never enter a book. Exact process handles and per-head state identify who may close a native window. A tab closing, a head closing and manager Exit are different events."),
        ("Qualified versus accepted", "A bounded test on a specific machine establishes only what it measured. Owner approval of one proposed appearance does not approve an unseen stronger version, another identity, hearing quality or a wider unimplemented feature.")
    ])
    for offset in range(0, len(historical["commits"]), 14):
        book.page_new("Commit register", "register", "commits" if not offset else None)
        y = book.heading("Commit register", "ORIGINAL AUTHOR TIMESTAMPS / IST") + 21
        for record in historical["commits"][offset:offset+14]:
            book.text(f"{record['timestamp'][:10]} {record['time']}  {record['commit'][:7]}", 48, y, 499, 8, "mono", ACCENT)
            y = book.text(record["title"], 48, y+14, 499, 9, bottom=772) + 13
    for offset in range(0, len(historical["workstreams"]), 10):
        book.page_new("Historical workstream register", "register", "workstreams" if not offset else None)
        y = book.heading("Workstream register", "STATUS AT THE M1 CLOSEOUT / NOT A NEW STATUS UPDATE") + 21
        for row in historical["workstreams"][offset:offset+10]:
            book.text(f"{row['id']} / {row['status']}", 48, y, 499, 8.2, "mono", ACCENT)
            y = book.text(row["title"], 48, y+14, 499, 9, bottom=772) + 13
        book.text("vr-04 is the perpetual ledger, not a finite issue. vr-16..19 are parked; vr-41 remains open. These records are historical, not freshly closed by the journal.", 48, 737, 499, 8.5, "italic", MUTED)
    pages = book.finish(journal, manifest, historical)
    font_receipt = {role: {k: (str(v) if k == "path" else v) for k, v in spec.items() if k != "font"}
                    for role, spec in fonts.items()}
    receipt = {"schemaVersion": 1, "editionId": manifest["editionId"], "status": "candidate-awaiting-review",
        "generatedAt": datetime.now(IST).isoformat(timespec="seconds"),
        "historicalRevision": manifest["historicalRevision"], "releaseRevision": manifest["releaseRevision"],
        "publication": manifest["publication"], "tools": tools, "fonts": font_receipt,
        "builderSha256": sha(Path(__file__)), "requirementsSha256": sha(REQUIREMENTS),
        "preparedSha256": sha(output / "prepared.json"), "journalSha256": sha(output / "journal.json"),
        "expectedTextSha256": sha(output / "expected-text.json"),
        "inputManifestSha256": sha(output / "manifest-input.json"), "assets": assets, "pages": pages,
        "sources": historical["references"], "commits": historical["commits"],
        "workstreams": historical["workstreams"],
        "outputs": {name: {"sha256": sha(output / name), "bytes": (output / name).stat().st_size}
                    for name in (PDF_NAME, "reading.html")}}
    write(output / "edition.json", receipt)
    return qualify(output)


def qualify(output):
    edition = load(output / "edition.json")
    pdf = output / PDF_NAME
    if sha(pdf) != edition["outputs"][PDF_NAME]["sha256"]:
        raise ValueError("PDF bytes differ from the edition manifest.")
    if sha(output / "expected-text.json") != edition["expectedTextSha256"]:
        raise ValueError("Expected text inventory differs from the edition manifest.")
    expected = load(output / "expected-text.json")
    pages_dir = output / "review" / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    with fitz.open(pdf) as doc:
        if doc.page_count != len(edition["pages"]):
            raise ValueError("Native PDF page count differs from the page map.")
        fulltext, page_checks, images = [], [], set()
        for index, page in enumerate(doc):
            text = page.get_text()
            if not text.strip() or "\ufffd" in text:
                raise ValueError(f"Missing/unreadable native text on page {index+1}")
            fulltext.append(text)
            flattened = " ".join(text.splitlines())
            for line in expected[index]:
                if line not in flattened:
                    raise ValueError(f"Native source text changed on page {index+1}: {line}")
            spans = [s for b in page.get_text("dict")["blocks"] if "lines" in b
                     for line in b["lines"] for s in line["spans"]]
            check_text_overlap(spans, index+1)
            for span in spans:
                bounds = fitz.Rect(span["bbox"])
                if not page.rect.contains(bounds):
                    raise ValueError(f"Native text clips outside page {index+1}: {span['text']}")
                if span["size"] < 7.4:
                    raise ValueError(f"Unexpected tiny text on page {index+1}")
            for link in page.get_links():
                if link["kind"] != fitz.LINK_GOTO or not 0 <= link["page"] < doc.page_count:
                    raise ValueError(f"Broken/nonlocal PDF navigation on page {index+1}")
            for image in page.get_images():
                images.add(image[0])
            pixmap = page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3), alpha=False)
            pixmap.save(pages_dir / f"page-{index+1:03}.png")
            page_checks.append({"page": index+1, "nativeCharacters": len(text),
                                "links": len(page.get_links()), "spans": len(spans)})
        if len(doc.get_toc()) != 3 + len(load(output / "journal.json")["entries"]) + 7:
            raise ValueError("Native bookmark inventory is incomplete.")
        if not all(name in "\n".join(fulltext) for name in ("Source notebook", "Commit register", "M1: present")):
            raise ValueError("Expected journal sections are missing from native text.")
        (output / "review" / "native-text.txt").write_text("\n\f\n".join(fulltext), encoding="utf-8")
        for offset in range(0, doc.page_count, 4):
            sheet = Image.new("RGB", (1560, 2232), "#b8b6ad")
            for i, page_index in enumerate(range(offset, min(offset+4, doc.page_count))):
                with Image.open(pages_dir / f"page-{page_index+1:03}.png") as page:
                    sheet.paste(page.convert("RGB"), ((i % 2)*780+3, (i // 2)*1116+3))
            sheet.save(output / "review" / f"pages-{offset+1:03}-{min(offset+4,doc.page_count):03}.jpg", quality=95)
        result = {"nativePages": doc.page_count, "bookmarks": len(doc.get_toc()),
                  "nativeImageObjects": len(images), "figureOccurrences": len(edition["assets"]),
                  "allTextWithinPage": True, "minimumNativeTextPt": 7.4,
                  "searchableText": True, "allPdfLinksLocalAndValid": True,
                  "pages": page_checks, "pdfSha256": sha(pdf),
                  "visualReview": "Not established by these automated checks."}
    write(output / "qualification.json", result)
    return {k: v for k, v in result.items() if k != "pages"}


def freeze(output, review_file):
    edition = load(output / "edition.json")
    review = load(review_file)
    if review["pdfSha256"] != sha(output / PDF_NAME):
        raise ValueError("Visual review does not name this exact PDF.")
    if set(review["layoutReviewedPages"]) != set(range(1, len(edition["pages"])+1)):
        raise ValueError("Visual review does not account for every native page.")
    if set(review["reviewedFigures"]) != {a["id"] for a in edition["assets"]}:
        raise ValueError("Source-image review does not account for every allowlisted figure.")
    if not review["fullResolutionPages"] or review["unresolved"]:
        raise ValueError("Missing full-resolution review or unresolved edition issues.")
    qualify(output)
    target = ROOT / "book" / "editions" / edition["editionId"]
    if target.exists():
        raise FileExistsError(f"Never overwrite a frozen edition: {target}")
    target.mkdir(parents=True)
    names = [PDF_NAME, "reading.html", "journal.json", "manifest-input.json", "expected-text.json",
             "prepared.json", "qualification.json"]
    for name in names:
        shutil.copyfile(output / name, target / name)
    shutil.copytree(output / "assets", target / "assets")
    shutil.copyfile(review_file, target / "review.json")
    shutil.copyfile(Path(__file__), target / "build_journal.py")
    shutil.copyfile(REQUIREMENTS, target / "requirements-journal.txt")
    edition["status"] = "local-edition-reviewed"
    edition["reviewSha256"] = sha(target / "review.json")
    edition["frozenAt"] = datetime.now(IST).isoformat(timespec="seconds")
    write(target / "edition.json", edition)
    checksums = [f"{sha(p)}  {p.relative_to(target).as_posix()}"
                 for p in sorted(target.rglob("*")) if p.is_file()]
    (target / "SHA256SUMS.txt").write_text("\n".join(checksums)+"\n", encoding="utf-8")
    return {"frozenEdition": str(target), "pdfSha256": sha(target / PDF_NAME)}


def copy_prepared(source, output):
    source = source.resolve()
    if output.exists():
        raise FileExistsError("Rebuild output must be a new directory.")
    edition = load(source / "edition.json")
    for name, key in (("journal.json", "journalSha256"),
                      ("manifest-input.json", "inputManifestSha256"),
                      ("prepared.json", "preparedSha256")):
        if sha(source / name) != edition[key]:
            raise ValueError(f"Frozen edition input changed: {name}")
    prepared = load(source / "prepared.json")
    for record in prepared["assets"]:
        path = source / record["asset"]
        if not path.resolve().is_relative_to((source / "assets").resolve()):
            raise ValueError("Frozen image escapes its assets root.")
        if sha(path) != record["assetSha256"]:
            raise ValueError(f"Frozen image changed: {record['id']}")
    output.mkdir(parents=True)
    (output / "assets").mkdir()
    for name in ("journal.json", "manifest-input.json", "prepared.json"):
        shutil.copyfile(source / name, output / name)
    for record in prepared["assets"]:
        shutil.copyfile(source / record["asset"], output / record["asset"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--qualify", action="store_true")
    parser.add_argument("--freeze", type=Path, metavar="REVIEW_JSON")
    parser.add_argument("--from-edition", type=Path, help="Rebuild from frozen inputs without Git or .local captures.")
    args = parser.parse_args()
    output = args.output.resolve()
    allowed = (ROOT / "book" / "output").resolve()
    if not args.from_edition and (not output.is_relative_to(allowed) or output == allowed):
        raise ValueError("Candidate output must be a named directory under book/output.")
    if sum((args.prepare, args.render, args.qualify, bool(args.freeze), bool(args.from_edition))) > 1:
        parser.error("Choose one stage, or omit stage flags for prepare+render.")
    if args.from_edition:
        copy_prepared(args.from_edition, output)
        result = render(output)
    elif args.freeze:
        result = freeze(output, args.freeze)
    elif args.qualify:
        result = qualify(output)
    elif args.render:
        result = render(output)
    elif args.prepare:
        result = {"preparedFigures": prepare(output), "output": str(output)}
    else:
        prepare(output)
        result = render(output)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
