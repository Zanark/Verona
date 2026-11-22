"""Package the isolated Akari study as a separate offline, bounded-GIF review."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont


def render(study_path, capture, output):
    study = json.loads((study_path/"study.json").read_text())
    captures = json.loads((capture/"receipt.json").read_text())["candidates"]
    expected = {"akari", "akari-clay", "claire"}
    if {c["id"] for c in study["candidates"]} != expected or {c["id"] for c in captures} != expected:
        raise ValueError("The complete finished, clay and baseline capture is required.")
    if any(c["frames"] != 260 for c in captures):
        raise ValueError("Incomplete 32.5-second comparison timeline.")
    if any(c.get("mouthTransparency") is not False for c in study["candidates"]):
        raise ValueError("This review requires explicit opaque-default mouth metadata.")
    if any(s["wideCutout"] for c in captures for s in c["openingSamples"]):
        raise ValueError("Opaque-default review contains a transparent mouth pass.")
    output.mkdir()
    font = ImageFont.truetype("segoeui.ttf", 20)
    receipts, cards = [], []
    contact = Image.new("RGB", (1920, 3*270), "#142331")
    contact_draw = ImageDraw.Draw(contact)
    for row, candidate in enumerate(study["candidates"]):
        identity = candidate["id"]
        frames, digests = [], []
        for index, step in enumerate(candidate["frames"]):
            with Image.open(capture/identity/f"{index:03}.png") as source:
                image = Image.alpha_composite(Image.new("RGBA", source.size, "#142331"),
                                               source.convert("RGBA")).convert("RGB")
            draw = ImageDraw.Draw(image)
            draw.rectangle((0, 596, 640, 640), fill="#101b29")
            draw.text((16, 606), identity+" / "+step["label"], font=font, fill="#ecf1ff")
            frames.append(image)
            digests.append(hashlib.sha256(image.tobytes()).hexdigest())
        gif_path = output/f"{identity}.gif"
        durations = [120 if i % 2 == 0 else 130 for i in range(len(frames))]
        # A single shared palette avoids false shimmer on otherwise static geometry.
        palette_sheet = Image.new("RGB", (640*6, 640))
        for n, index in enumerate((0, 4, 12, 55, 95, 155)):
            palette_sheet.paste(frames[index], (n*640, 0))
        palette = palette_sheet.quantize(colors=256)
        quantized = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
        quantized[0].save(gif_path, save_all=True, append_images=quantized[1:],
                         duration=durations, loop=0, disposal=2, optimize=False)
        frames[0].save(output/f"{identity}.png")
        timeline = []
        with Image.open(gif_path) as gif:
            for index in range(gif.n_frames):
                gif.seek(index)
                timeline.append((gif.info["duration"], hashlib.sha256(gif.convert("RGB").tobytes()).hexdigest()))
        # Verify every input sample against its decoded GIF time, including merged rests.
        cursor = elapsed = 0
        decoded_end = timeline[0][0]
        for image, duration in zip(quantized, durations):
            while elapsed >= decoded_end:
                cursor += 1
                decoded_end += timeline[cursor][0]
            if hashlib.sha256(image.convert("RGB").tobytes()).hexdigest() != timeline[cursor][1]:
                raise ValueError(f"{identity}: encoded GIF changed or omitted a source sample.")
            elapsed += duration
        if sum(d for d, _ in timeline) != 32500 or len(set(digests)) < 100:
            raise ValueError("Review animation lost duration or substantive motion.")
        receipts.append({"id": identity, "sourceFrames": len(frames), "encodedFrames": len(timeline),
                         "uniqueSourceFrames": len(set(digests)), "durationMs": elapsed,
                         "allSourceTimesVerified": True, "bytes": gif_path.stat().st_size,
                         "sha256": hashlib.sha256(gif_path.read_bytes()).hexdigest()})
        for column, index in enumerate((0, 4, 7, 10, 12, 33, 99, 165)):
            contact.paste(frames[index].resize((240, 240)), (column*240, row*270))
            contact_draw.text((column*240+5, row*270+245),
                              f"{identity} / {candidate['frames'][index]['label']}", fill="white")
        if identity == "akari":
            measurements = next(c for c in captures if c["id"] == identity)["openingSamples"]
            labels = list(dict.fromkeys(f["label"] for f in candidate["frames"][18:]))
            samples = [(0, "rest")]
            for label in labels:
                indices = [i for i, f in enumerate(candidate["frames"]) if f["label"] == label]
                chosen = max(indices, key=lambda i: measurements[i]["opening"])
                samples.append((chosen, label))
            lips = Image.new("RGB", (1440, 560), "#142331")
            draw = ImageDraw.Draw(lips)
            for i, (index, label) in enumerate(samples):
                xy = ((i % 6)*240, (i//6)*280)
                lips.paste(frames[index].crop((260, 380, 380, 510)).resize((240, 260)), xy)
                draw.text((xy[0]+5, xy[1]+263), label, fill="white")
            lips.save(output/"lip-review.png")
            eyes = Image.new("RGB", (1380, 500), "#142331")
            draw = ImageDraw.Draw(eyes)
            for i, index in enumerate((0, 4, 10, 12, 33, 99)):
                xy = ((i % 3)*460, (i//3)*250)
                eyes.paste(frames[index].crop((205, 265, 435, 340)).resize((460, 150)), xy)
                draw.text((xy[0]+5, xy[1]+160),
                          f"{candidate['frames'][index]['label']} / frame {index}", fill="white")
            eyes.save(output/"eye-review.png")
        description = {
            "akari": "New anime proportions, continuous rose lip color, large teal iris layers, moving brows/lashes and an original violet layered bob. Soft skin lighting; stepped hair shading.",
            "akari-clay": "Identical Akari skin, eye optics and moving detail with neutral clay shading and hair removed. Inspect structure without the finished styling.",
            "claire": "Original Claire skin coordinates and triangles. Shared review eye/iris and brow/lash aids, no hair, identical camera and motion. Not an untouched production screenshot.",
        }[identity]
        cards.append(f"""<article class="card" id="{identity}"><h3>{html.escape(candidate['name'])}</h3>
<img src="{identity}.png" data-poster="{identity}.png" data-gif="{identity}.gif" width="640" height="640" alt="{html.escape(candidate['name'])}">
<div class="controls"><button type="button" data-play="{identity}" aria-pressed="false">Play GIF</button><a href="{identity}.gif">Open GIF</a></div>
<p>{description}</p><p class="metric">{candidate['vertices']:,} vertices / {candidate['triangles']:,} triangles</p></article>""")
    page = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'">
<title>Verona | Akari anime woman</title><style>
:root{color-scheme:dark;font:16px/1.65 "Segoe UI",sans-serif;background:#0b111c;color:#ecedfa}*{box-sizing:border-box}body{margin:0}main{max-width:1450px;margin:auto;padding:45px 28px 80px}
h1{font-size:clamp(3rem,7vw,6.2rem);line-height:1.04;letter-spacing:-.055em;margin:20px 0}h1 em{font-style:normal;color:#cea9ef}h2{font-size:1.8rem}h3{font-size:1.35rem;line-height:1.3;min-height:3.5rem}
header p{max-width:900px;font-size:1.12rem;color:#bac7dc}.eyebrow{letter-spacing:.18em;color:#d4a9eb;font-weight:700;font-size:.8rem}a{color:#d4b8ff}a:hover{color:white}
.notice,details{padding:20px 24px;background:#151e30;border:1px solid #39425d;border-radius:14px;margin:22px 0}.notice strong{color:#efc9ee}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.card{padding:22px;background:#131e2e;border:1px solid #344057;border-radius:18px}.card img{display:block;width:100%;height:auto;border-radius:12px;background:#142331}.card p{color:#bfcbdf}.metric{font-size:.84rem}
.controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:18px}button{background:#d9b8fa;color:#24132f;font:700 .9rem "Segoe UI",sans-serif;border:0;border-radius:9px;padding:11px 17px;cursor:pointer}
button[aria-pressed=true]{background:#eeb7d7}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #f6db94;outline-offset:4px}summary{cursor:pointer;font-weight:700}li{margin:9px 0}
#status{min-height:28px;color:#c5b5e5}footer{margin-top:35px;color:#aab8cf}code{overflow-wrap:anywhere}@media(max-width:980px){.grid{grid-template-columns:1fr}main{max-width:740px}.card h3{min-height:0}}@media(max-width:500px){main{padding:24px 16px}.card{padding:16px}}
</style></head><body><main><header><div class="eyebrow">VERONA / ORIGINAL CLAIRE-BASED ANIME STUDY</div>
<h1>Meet <em>Akari.</em></h1><p>A coordinated anime-woman direction, not a renamed Elara: larger almond orbital geometry, a tapered rounded chin and jaw, softer cheeks, reduced nose projection, teal eye layers, raised brows/lashes and a newly authored violet bob.</p>
<p><a href="../claire-anime-research-20261122/index.html">Read the illustrated research and reference credits</a></p></header>
<div class="notice"><strong>Separate review candidate, not installed or owner-accepted.</strong> This study does not install Akari; the live head is managed separately.
These are real WebGL captures of animated geometry. Each silent GIF lasts 32.5 seconds: rest/turn, deliberate blink, then neutral and all ten archived emotions.
No sound is played, so the 20% sound ceiling is respected.</div>
<h2>Finished face, exposed structure, original skin</h2><p id="status" role="status" aria-live="polite">Posters shown. Play one GIF at a time.</p>
<noscript>Use the Open GIF links; buttons require JavaScript.</noscript><div class="grid">"""+"\n".join(cards)+"""</div>
<h2>Upper lashes attached to the eye rim</h2><p>The earlier reused Elara arc floated above Akari's eyes. The corrected band follows the actual upper skin/sclera intersection, then moves with the supporting eyelid skin.
These actual crops show rest, turn, partial/complete blink and two speech/expression samples. Play the GIF for the complete sequence.</p>
<a href="eye-review.png"><img src="eye-review.png" width="1380" height="500" style="width:100%;height:auto" alt="Corrected Akari upper-lash contact in rendered rest, turn, blink and speech samples"></a>
<h2>Lipstick stays on the animated lip surface</h2><p>The continuous upper/lower guide is mirrored around the native mouth center, with one conservative depth plane rather than independent side clipping.
Rest and the widest sampled mouth in every phrase are shown below. The same rest-space coordinates follow every speech/expression pose; facial motion and perspective are not forcibly mirrored.
The original opaque mouth is retained throughout this review: no transparent cutout or added black cavity.</p>
<a href="lip-review.png"><img src="lip-review.png" width="1440" height="560" style="width:100%;height:auto" alt="Actual lip close-ups: rest, neutral speech and all ten emotions"></a>
<details open><summary>What changed, and how to review it</summary><ul>
<li>Compare Akari's clay head against Claire's original skin: same skin vertex IDs and triangles, with a smooth complete-pose mapping applied to rest and every speech/expression pose. Neck below 132 cm is unchanged.</li>
<li>The deliberate blink shows both partial and complete closure. Skin and attached lashes deform; optical layers are clipped together. This is a cosmetic demonstration, not a learned anime eyelid rig.</li>
<li>After the blink: neutral, angry, cheekiness, disgust, fear, grief, happy, outofbreath, pain, sad and surprised. Each archived synthetic Hazel phrase contributes all 2.75 seconds, sampled at 8 fps. Emotion-minus-neutral is reduced from archived 4x to 2x; neutral speech is retained.</li>
<li>Skin uses soft stylized light; hair uses a simple stepped shade. No imported anime avatar, VRoid sample, Rain geometry/rig or reference-image texture is used.</li>
<li>Continuous symmetric Claire-native lip guides follow the animated surface. Mouth transparency is off throughout these captures, including wide openings. In the app it requires explicit creation-time opt-in; even then only an opening at least 0.65 cm beyond neutral permits the native-rim cutout.</li>
</ul></details><details><summary>Limits, provenance and recovery</summary><ul>
<li>Underlying Claire speech/PCA skin remains inherited. No claim of phonetic accuracy, independent listening, universal female anatomy, exact reference likeness, owner selection or production readiness.</li>
<li>Static eye layers do not provide gaze joints. Hair is original rigid geometry, not strand simulation; extreme angles and expressions still need owner review. Existing eyelid/facial folds remain visible in the honest clay view.</li>
<li>Reports and captures use NEW output directories. Failure leaves explicit receipts or a partial candidate, never replaces an existing report. Retry with a fresh output name. The capture is bounded to five minutes, capability-protected loopback and an exact asset allowlist.</li>
<li>No camera/microphone activation, cloud inference, asset upload or production manager integration. Existing catalogs and frozen book editions are preserved.</li></ul>
<p><a href="study.json">Study and source provenance</a> / <a href="capture-receipt.json">Actual mouth-gate measurements</a> / <a href="gif-verification.json">Decoded GIF verification</a> / <a href="contact.png">Comparison contact sheet</a></p></details>
<footer>Original procedural Verona candidate. Research with credited reference images was authored and committed before implementation. This is a local review, not publication or deployment.</footer></main>
<script>
const status=document.querySelector("#status");
function pauseAll(){document.querySelectorAll(".card").forEach(card=>{const img=card.querySelector("img"),button=card.querySelector("button");img.src=img.dataset.poster;button.setAttribute("aria-pressed","false");button.textContent="Play GIF";});}
document.querySelectorAll("[data-play]").forEach(button=>button.addEventListener("click",()=>{
const active=button.getAttribute("aria-pressed")==="true";pauseAll();
if(active){status.textContent="Paused. Posters shown.";return;}
const card=document.getElementById(button.dataset.play),img=card.querySelector("img");
img.onerror=()=>{img.onerror=null;img.src=img.dataset.poster;button.setAttribute("aria-pressed","false");button.textContent="Play GIF";status.textContent="GIF failed to load; check the local report files or use Open GIF.";};
img.src=img.dataset.gif;button.setAttribute("aria-pressed","true");button.textContent="Pause GIF";status.textContent="Playing "+card.querySelector("h3").textContent+". Other cards are paused.";
}));
document.addEventListener("visibilitychange",()=>{if(document.hidden){pauseAll();status.textContent="Paused while the report is hidden.";}});</script></body></html>"""
    (output/"index.html").write_text(page, encoding="utf-8")
    (output/"study.json").write_text(json.dumps(study, indent=2))
    shutil.copyfile(capture/"receipt.json", output/"capture-receipt.json")
    (output/"gif-verification.json").write_text(json.dumps(receipts, indent=2))
    contact.save(output/"contact.png")
    print(json.dumps({"report": str(output/"index.html"), "gifs": receipts}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("study", "capture", "output"):
        parser.add_argument("--"+flag, required=True, type=Path)
    args = parser.parse_args()
    render(args.study, args.capture, args.output)
