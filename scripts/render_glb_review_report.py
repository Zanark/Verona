"""Package actual six-head capture frames into an offline, one-GIF-at-a-time review."""

import argparse
import hashlib
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def render(study_path, capture, sources_path, output):
    study = json.loads((study_path / "study.json").read_text())
    sources = json.loads(sources_path.read_text())
    capture_receipt = json.loads((capture / "receipt.json").read_text())
    if len(study["candidates"]) != 6 or len(capture_receipt["candidates"]) != 6:
        raise ValueError("A complete six-candidate capture is required.")
    output.mkdir(parents=True, exist_ok=False)
    receipts, cards = [], []
    font = ImageFont.truetype("segoeui.ttf", 20)
    for candidate in study["candidates"]:
        frames, digests = [], []
        for index, step in enumerate(candidate["frames"]):
            image = Image.open(capture / candidate["id"] / f"{index:03}.png").convert("RGBA")
            image = Image.alpha_composite(Image.new("RGBA", image.size, "#142331"), image).convert("RGB")
            draw = ImageDraw.Draw(image)
            draw.rectangle((0, 598, 640, 640), fill="#101b29")
            draw.text((18, 607), candidate["name"] + " / " + step["stage"], font=font, fill="#ecf1ff")
            digests.append(hashlib.sha256(image.tobytes()).hexdigest())
            frames.append(image)
        if len(set(digests)) < 30:
            raise ValueError("Capture does not contain enough changing frames.")
        name = candidate["id"]
        frames[0].save(output / (name + ".png"))
        durations = [120 if i % 2 == 0 else 130 for i in range(len(frames))]
        gif_path = output / (name + ".gif")
        frames[0].save(gif_path, save_all=True, append_images=frames[1:], duration=durations,
                       loop=0, disposal=2, optimize=False)
        with Image.open(gif_path) as gif:
            unique, total = set(), 0
            for index in range(gif.n_frames):
                gif.seek(index)
                total += gif.info["duration"]
                unique.add(hashlib.sha256(gif.convert("RGB").tobytes()).hexdigest())
            if len(unique) < 30 or total != 7500:
                raise ValueError("Encoded GIF lost real animation or the expected duration.")
            receipts.append({"id": name, "frames": gif.n_frames, "uniqueFrames": len(unique),
                             "durationMs": total, "bytes": gif_path.stat().st_size,
                             "sha256": hashlib.sha256(gif_path.read_bytes()).hexdigest()})
        native = candidate["method"] == "native"
        method = "Original GLB mesh + Claire motion" if native else "Claire mesh + source structure"
        description = ("Preserves the supplied mesh and neutral shape. Geometric motion attachment; no native facial rig."
                       if native else "65% of the registered source fit over Claire; original Claire skin topology and static cosmetic eyes.")
        notes = {
            "lyra": "Most stylized silhouette. Dense source; local lip/neck creasing remains possible.",
            "elara": "Anime-influenced crown and lower-face proportions, retaining Claire's eye/midface character.",
            "mira": "Fuller lips and longer source face. The closed mouth opens less clearly than Claire's.",
            "selene": "A softer Claire-family hybrid, not a duplicate of the original source mesh.",
            "neris": "More angular nose and a diagonal native neck cut. Neither is silently retopologized.",
            "thalia": "Source-influenced nose, chin and forehead with Claire's underlying facial layout.",
        }[name]
        if candidate.get("eyeDetails"):
            notes += (" Raised arched brows, upper-lid lash bands and three tapered outer lashes per eye "
                      "are added as moving clay geometry. Original skin, eyes and corrected mouth are retained.")
        cards.append(f"""<article id="{name}" class="card">
<div class="eyebrow">{'A / ORIGINAL TOPOLOGY' if native else 'B / CLAIRE TOPOLOGY'}</div>
<h3>{candidate['name']}</h3><p class="method">{method}</p>
<img src="{name}.png" data-poster="{name}.png" data-gif="{name}.gif" alt="{candidate['name']}: clay-shaded actual animated head mesh" width="640" height="640">
<div class="controls"><button type="button" data-play="{name}" aria-pressed="false">Play GIF</button><a href="{name}.gif">Open GIF</a></div>
<p>{description}</p><p class="note">{notes}</p>
<dl><div><dt>Skin vertices</dt><dd>{candidate['skinVertices']:,}</dd></div><div><dt>Triangles</dt><dd>{candidate['triangles']:,}</dd></div>
<div><dt>Static eye vertices</dt><dd>{candidate['staticEyeVertices']:,}</dd></div><div><dt>Peak sampled motion</dt><dd>{candidate['maximumMotionCm']:.2f} cm</dd></div></dl>
</article>""")
    sections = []
    for i, source in enumerate(sources):
        attribution = (f'<a href="{html.escape(source["sourceUrl"])}">{html.escape(source["name"])}</a>'
                       f' by <a href="{html.escape(source["authorUrl"])}">{html.escape(source["author"])}</a>')
        sections.append(f"""<section class="pair"><div class="pair-title"><span>0{i+1}</span><div>
<h2>{['Stylized anime head', 'Woman basemesh / source one', 'Woman basemesh / source two'][i]}</h2>
<p>{attribution} / <a href="{html.escape(source['licenseUrl'])}">CC BY 4.0</a></p></div></div>
<div class="grid">{cards[i*2]}{cards[i*2+1]}</div></section>""")
    page = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verona | Six faces, two methods</title><style>
:root{color-scheme:dark;font:16px/1.6 "Segoe UI Variable","Segoe UI",sans-serif;background:#0b111c;color:#e9edf8}
*{box-sizing:border-box}body{margin:0}main{max-width:1220px;margin:auto;padding:44px 28px 80px}
a{color:#c3b1ff;text-underline-offset:4px}a:hover{color:white}header{padding:42px 0 34px;border-bottom:1px solid #293247}
.eyebrow{font-size:.76rem;font-weight:700;letter-spacing:.16em;color:#d7a2ef}h1{font-size:clamp(2.6rem,6vw,5.4rem);line-height:1.04;letter-spacing:-.055em;max-width:850px;margin:18px 0 24px}
h1 em{font-style:normal;color:#e1a8dd}header p{max-width:850px;color:#b9c3d6;font-size:1.12rem}.tags{display:flex;flex-wrap:wrap;gap:10px}.tags span{border:1px solid #344057;border-radius:30px;padding:5px 13px;font-size:.78rem}
.notice,details{margin-top:24px;padding:20px 24px;border:1px solid #37405b;border-radius:14px;background:#141c2b}.notice strong{color:#efd0ed}
.pair{margin-top:54px}.pair-title{display:flex;gap:20px;align-items:flex-start}.pair-title>span{font-size:2rem;color:#bc96e5}.pair-title h2{margin:0;font-size:1.65rem;letter-spacing:-.02em}.pair-title p{margin:4px 0 24px;color:#aab8cf}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.card{background:#121c2b;border:1px solid #303b51;border-radius:19px;overflow:hidden;padding:24px}
.card h3{font-size:2rem;line-height:1.1;margin:10px 0}.card p{color:#bdc8da}.card .method{font-size:.92rem;color:#d6dcee;min-height:26px}.card img{display:block;width:100%;height:auto;background:#142331;border-radius:12px}
.controls{display:flex;gap:20px;align-items:center;margin-top:18px}button{background:#dcc1fc;color:#201331;border:0;border-radius:9px;padding:10px 18px;font:700 .9rem "Segoe UI",sans-serif;cursor:pointer}button[aria-pressed=true]{background:#e8afd5}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #f8d281;outline-offset:4px}.note{font-size:.9rem;border-left:2px solid #9a7abd;padding-left:13px}
dl{display:grid;grid-template-columns:1fr 1fr;gap:13px;border-top:1px solid #303b51;padding-top:18px;margin-bottom:0}dt{font-size:.76rem;color:#95a6c1}dd{margin:1px 0 0;font-weight:600}
summary{cursor:pointer;font-weight:600}li{margin:8px 0}footer{margin-top:48px;color:#9daec6;font-size:.9rem}#status{min-height:26px;margin-top:15px;color:#c2b0ee}
@media(max-width:720px){main{padding:24px 16px 50px}.grid{grid-template-columns:1fr}.card{padding:18px}header{padding-top:18px}h1{font-size:3.3rem}}
</style></head><body><main><header><div class="eyebrow">VERONA / EXPERIMENTAL HEAD STUDY / 22 NOV 2026</div>
<h1>Three sources.<br><em>Six faces.</em></h1>
<p>Two genuinely different construction methods for each supplied head: move the original mesh with Claire, or reshape Claire toward that head. Choose by name after reviewing the motion, not just the first frame.</p>
<div class="tags"><span>6 ACTUAL ANIMATED GIFS</span><span>7.5 SECONDS EACH / 8 FPS</span><span>SILENT / LOCAL</span><span>REVIEW ONLY</span></div></header>
<div class="notice"><strong>Comparison, not installation.</strong> All six use the same camera, clay material, speech samples and 2x expression setting. No hair, lipstick or original textures hide the geometry.
The three Claire-based hybrids keep a family resemblance; they are not promised to read as six unrelated identities. Elara's eye-detail revision, when present, is explicitly described on her card. Your running Verona head has not been replaced.</div>
<p id="status" role="status" aria-live="polite">Posters shown. Play any candidate; only one GIF runs at a time.</p>
<noscript><p>Animation buttons require JavaScript. Every Open GIF link works directly without it.</p></noscript>
""" + "\n".join(sections) + """
<details><summary>What the loops demonstrate, and what they do not</summary><ul>
<li>Sequence: neutral rest, speech, happy speech, surprised speech, then a rest turn through 90 degrees. Actual captured mesh frames, not generated portraits or still images relabeled as animation.</li>
<li>One matching synthetic Hazel donor is reused. Archived 4x emotion offsets are halved to 2x before fitting. The GIFs have no audio; they do not prove listening, phonetic or human accuracy.</li>
<li>The source assets have no morph targets, skeletons or animation. Original-base motion is geometric triangle attachment, not a newly trained rig. Dense native lips can crease; Mira's closed source mouth has a smaller visible opening.</li>
<li>Claire-base candidates blend 65% of an 80%-strength section registration plus bounded local surface correction. Claire's original skin indices are retained; static cosmetic eye geometry is separate.</li>
<li>UV/normal seams are welded and low open neck loops extended only in temporary fitting geometry. The original-base output retains original vertices and triangles after a uniform eye-frame alignment. Normals are smoothed consistently for display.</li>
<li>Only wide openings (at least 0.65 cm beyond the neutral outer-lip separation) reveal the background through a depth-tested native-rim display mask with a 0.55 cm forward bias. Neutral and near-closed lips keep their original opaque surface. It is not oral retopology or contact correction. No opaque black cavity is added.</li>
<li>All geometry is imported locally. No camera, microphone, cloud inference, asset upload, original-texture transfer, native joint fitting or production manager integration is included.</li>
<li>Names are review labels, not gender assignments. The owner has not selected or accepted any candidate.</li></ul></details>
<details><summary>Attribution, modifications and evidence</summary>
<p>Original assets by Rodesqa and mono are linked beside each pair under Creative Commons Attribution 4.0.
Public Sketchfab metadata and embedded source credits agree. Verona modifications: coordinate alignment, derived fitting surfaces, Claire-driven deformation, structural hybrids, common clay shading and review captures. Original GLBs remain unchanged.</p>
<p><a href="study.json">Geometry and motion provenance</a> / <a href="sources.json">Public source/licensing receipt</a> /
<a href="gif-verification.json">Decoded animation receipts</a></p></details>
<footer>Local review artifact. Existing catalogs and frozen book editions are unchanged. No source GLBs or review media are included in Git commits.</footer></main>
<script>
const status=document.querySelector("#status");
function pauseAll(){document.querySelectorAll(".card").forEach(card=>{const img=card.querySelector("img"),button=card.querySelector("button");img.src=img.dataset.poster;button.setAttribute("aria-pressed","false");button.textContent="Play GIF";});}
document.querySelectorAll("[data-play]").forEach(button=>button.addEventListener("click",()=>{
const active=button.getAttribute("aria-pressed")==="true";pauseAll();
if(active){status.textContent="Paused. Posters shown.";return;}
const card=document.getElementById(button.dataset.play),img=card.querySelector("img");
img.onerror=()=>{img.onerror=null;img.src=img.dataset.poster;button.setAttribute("aria-pressed","false");button.textContent="Play GIF";status.textContent="GIF failed to load. Use Open GIF or check the local report files.";};
img.src=img.dataset.gif;button.setAttribute("aria-pressed","true");button.textContent="Pause GIF";status.textContent="Playing "+card.querySelector("h3").textContent+". All other candidates are paused.";
}));
document.addEventListener("visibilitychange",()=>{if(document.hidden){pauseAll();status.textContent="Paused while the report is hidden.";}});
</script></body></html>"""
    (output / "index.html").write_text(page, encoding="utf-8")
    (output / "study.json").write_text(json.dumps(study, indent=2) + "\n")
    (output / "sources.json").write_text(json.dumps(sources, indent=2) + "\n")
    (output / "gif-verification.json").write_text(json.dumps(receipts, indent=2) + "\n")
    print(json.dumps({"report": str(output / "index.html"), "gifs": len(receipts),
                      "gifBytes": sum(r["bytes"] for r in receipts),
                      "uniqueFrames": [r["uniqueFrames"] for r in receipts]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("study", "capture", "sources", "output"):
        parser.add_argument("--" + flag, type=Path, required=True)
    args = parser.parse_args()
    render(args.study, args.capture, args.sources, args.output)
