# Running the Verona prototype

Verona turns a text sentence into local speech and a synchronized animated face
made of connected points and edges. The Windows prototype works on CPU, with
installed English voices and explicit expression controls. Accurate human
articulation is the goal, **not an established result**. Recording import and a
voiced personal assistant remain future work.

## Run the prototype

This checkout is already prepared:

```powershell
.\VeronaDesktop.cmd
```

In the desktop app, generate and play a sentence, then click **Pop out transparent
head**. The same head becomes a transparent, initially always-on-top window;
speech continues without reloading. Hover its top-left corner for **Move**,
**Controls** or **Close**. Controls restores the full interface. Close exits
the desktop app and its Python server. Keep its terminal open; Ctrl+C also stops
the owned desktop. No startup service is installed.

**Eyes follow cursor** starts enabled on desktop and follows outside the window
without recording input. Disable the checkbox for neutral gaze. X/Y/Z sliders
each cover -180 to +180 degrees; **Reset orientation** zeros them and resets
Zoom, not speech. Adjust orientation/zoom in Controls before popping out.
**Overlay always on top** can be disabled. Transparent regions may intercept
clicks: this version does not provide click-through or manual window resizing.
Pinning uses a qualified above-taskbar Windows level; disable it for normal stacking.
See [desktop mechanisms and limits](chapters/10-desktop-overlay-and-gaze.md).

**Framing: Head and neck** cuts off the shoulders below the throat in desktop,
overlay and browser. **Full bust** restores the original extent and remains the
default. Choose framing in Controls before popping out. Switching is immediate
and preserves speech, voice, gaze, orientation, zoom and material; Reset
orientation leaves it alone, while reload/restart restores Full bust.
It submits fewer skin/hair polygons and calculates fewer animated normals.
Speech-generation cost and full motion storage are unchanged. This is an open
presentation cut, not a newly modeled closed neck or full-body asset.

The previous browser version remains available, without the desktop dependency:

```powershell
.\Verona.cmd
```

Keep its terminal open. In the browser, type a sentence, click **Generate face**,
then **Play**. Try the greeting, P/B/M, F/V and vowel example buttons.
Hazel is the default when installed; David and Zira remain selectable. The head
uses **Verona's original rest styling over Claire motion**, with optional
side-parted espresso waves. The trained model remains Claire, not a new identity.
Open **Edit voice** for pitch, speed, warmth/bass, brightness/treble and emphasis;
**Reset voice** restores Hazel/default settings. **Preview voice** prepares a
voice-only sample: press its audio Play control to hear it without generating
face motion. Generate face applies those settings to both speech and animation.
Pitch is a Windows-engine request, not a calibrated acoustic semitone shift.
Neutral/happy/sad/surprised are separate explicit expression inputs.
Play/Pause and the timeline follow the actual audio clock; Restart rewinds and
pauses. XYZ orientation, zoom, volume and point/edge toggles are available.
Browser cursor following is opt-in and limited to its page; native desktop
transparency/always-on-top are desktop-only.

Press **Ctrl+C in the terminal** to stop. No service is installed. Closing only
the browser does not stop Python. Reopening requires the full local URL printed
by the terminal, including its private `#` session part; a new server has a new
URL. Do not share that URL.

Inputs are limited to 280 characters and 25 seconds of padded speech. Generation
is offline/precomputed, not streaming. Browser speech/motion stays in RAM;
reload clears the page; the server retains only its latest successful clip and
one latest synthesized voice sample. Exact-repeat clips and expression-only
speech are reused. Stopping clears both. No microphone, camera, cloud TTS or CDN is used.
The application does not deliberately save a transcript; normal browser history
may retain the local session URL.

**Limits:** full SDK contact/smoothing corrections and independent teeth,
tongue and eye-joint animation are not implemented. Functional playback and
contrasting speech inputs have been exercised in Edge; testing was muted.
Correct lip contacts, expressive quality and human listening acceptance remain
unqualified. This is a working neural-skin prototype, not SDK parity.

## Select a presentation

**View → Claire** is the preserved initial view. Its separate **Claire material**
selector retains Transparent polygons (default) and Reference color + makeup.
Claire's edge/point/hair choices and framing survive a round-trip to another view.
The current clip, explicit expression, voice, playback clock and XYZ/zoom remain
the same: switching views does not generate, reload, seek or replace audio.

- **FaceMesh:** only the front facial skin and eyes, no ears, neck or hair.
  Triangle edges are visible, without a colored filled surface. **Mesh detail**
  ranges from 1 to 5; 5 preserves native front-face detail. Lower levels contract
  connected edges outside protected lip/lid/nose regions. The displayed counts
  are real submitted triangles/edges, not percentages or a promise of speedup.
  Framing is fixed to Front face only. The open mask rotates in 3D; it does not
  grow a back/ears when turned.
- **FaceDot:** surface dots only, including ears/eyes/neck. An invisible depth
  surface hides points behind the visible skin; no polygons or lines are colored.
- **UniformPolygons:** a rectangular surface-coordinate grid over animated skin,
  including ears/eyes/neck, not a flat screen overlay. Cells curve/stretch over
  anatomy and expressions. This is a grid presentation, not a new quad mesh.

Dot/grid views omit hair and start at Head and neck; each retains its own framing,
with Full bust available. All new views auto-fit their selected extent and use
unlit ink, avoiding unused animated shading normals. Their depth surface still
uses triangles; dots do not make geometry/inference free.
Select the view/detail in Controls before popping out the same transparent
desktop window. Reload/restart restores Claire, Full bust and native detail.
Reset orientation does not reset presentation/detail/framing.
With **Head and neck**, **Visible neck** previews a curved jaw-following cut
live. Set0 for jawline-only or drag towards6cm for more neck; default1.7cm.
Skin and hair share the curve, so there is no straight horizontal neck/hair
chop. Each view remembers its own value until reload. Dot/grid keep a stable
fit while adjusting; use Zoom if desired. Full bust restores the entire original
extent and hides the neck slider. FaceMesh keeps its front-only mask.
**Realistic** names the parked future GLB identity; there is no selectable fake
implementation, automatic rig repair or asset import in this update.

**Claire presentation:** warm smooth shading, sculpted cheek/jaw/bridge contours,
cosmetic brows/liner/rose lips and static hazel eyes define the character.
**Transparent polygons** is the default Claire material, restoring the earlier cool
frosted surface and visible native contours. **Reference color + makeup** is
the optional olive/rosewood/hazel-green study guided by the supplied sheet,
not an exact or photorealistic reconstruction.
Edges/hair are on and points off initially; all remain independent. Switching
Claire material changes immediately, not the clip, voice or playback position.
Hair has actual layered S-wave geometry. These are not
animated eye joints, teeth or a claim of photorealism. Color rendering caps
device pixel density at1.5x; polygon rendering retains a2x cap. This explicitly
trades high-DPI color resolution for a smaller rendering workload.

**Performance:** warm startup avoids native-scene parsing; repeating the latest
request skips speech/inference. The current native-loop surface uses 15,375
vertices, about 75% fewer than the full skin. It preserves more facial detail
than the earlier voxel reduction, so its motion payload is larger, not 37%
smaller. Prepared playback interpolates 30-fps learned motion on the browser's
display clock. Normal/2x-density tests pass the bounded mean/p95 display budget;
historical runs also contain occasional 49-50-ms intervals. The desktop's final
30-second sample measured mean 16.659 ms, p95 16.8 ms and maximum 17.8 ms.
This is not a locked
60-fps or universal hardware guarantee, nor 60-fps neural generation.
[Chapter 09](chapters/09-verona-character-and-waves.md) records the current
styling/geometry; [chapter 10](chapters/10-desktop-overlay-and-gaze.md) records
desktop qualification and retained browser failures. New-line inference remains
precomputed. Restart the server to load a changed backend style; reload alone
does not rebuild an already-running engine. Speech/clip RAM is discarded on stop.

## Fresh-clone setup

Requires Windows, Python (qualified here on 3.13), an installed English desktop
System.Speech voice, and a current WebGL2-capable browser (qualified in Edge).
Review [third-party terms](../THIRD_PARTY.md) before downloading model/sample data.

```powershell
python -m venv .local\cpu-env
.\.local\cpu-env\Scripts\python.exe -m pip install -r requirements-cpu.txt
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_claire_model
.\Verona.cmd
```

Only setup/downloads need internet; runtime never downloads missing assets.
Pinned Claire model/topology files total about 337 MB, plus isolated dependencies.
No extra TTS model, CUDA, PyTorch or npm install is needed. Startup verifies
assets and prepares geometry; explicit setup errors appear in the terminal.

For the optional desktop shell, use existing Node.js >=22.12/npm and explicitly
install its pinned Electron runtime once:

```powershell
.\Setup-VeronaDesktop.cmd
.\VeronaDesktop.cmd
```

Setup uses the configured certificate-verified npm registry/feed, a lockfile,
and Electron's official installer with its supplied artifact checksums.
Dependency install scripts are disabled; only that reviewed installer is run.
This is a larger optional Chromium desktop runtime, not another speech model.
It lives under ignored `desktop\node_modules`; setup caches use ignored `.local`.
No TLS bypass, global package installation or automatic runtime download.
Later launches are local/offline. A fresh checkout needs both the Python/model
setup above and desktop setup; missing prerequisites fail explicitly.

## Engineering and research

- [Engineering book and reading paths](README.md)
- [Product brief](product-brief.md)
- [Speech-to-face research and recommendation](chapters/04-speech-driven-face-research.md)
- [Pinned primary-source register](research/speech-face-sources.md)
- [Verified local CPU experiment and commands](chapters/05-local-cpu-feasibility.md)
- [Text-to-speech and native-mesh clip generation](chapters/06-text-to-face-prototype.md)
- [Hazel voice editing, Claire and measured performance](chapters/07-hazel-claire-and-performance.md)
- [Facial definition and measured display fluidity](chapters/08-facial-definition-and-fluidity.md)
- [Verona character styling and wavy hair](chapters/09-verona-character-and-waves.md)
- [Transparent desktop, cursor gaze and XYZ orientation](chapters/10-desktop-overlay-and-gaze.md)
- [Workstream index](../TODO/00_INDEX.todo)
- [Contributor contract](../AGENTS.md)
- [Private project board](https://github.com/users/Zanark/projects/15)

KardboardCode-VTuber's face-mesh pipeline has been reviewed as prior art only.
Verona is a different application; neither its avatar renderer nor its stack is
selected for reuse.

The research recommends a deformable 3D face with audio-clocked playback.
The owner selected free/local operation on this AMD machine. The official
Audio2Face SDK requires NVIDIA hardware, but a custom ONNX CPU experiment now
first executed the Mark v2.3 network and reconstructed native skin vertices locally.
Installed Windows voices now produce real local speech and complete learned
Claire v2.3.1 skin clips using matching native-derived topology. A loopback-only browser
renders those clips with audio-clocked interpolation. Full SDK postprocessing
and articulation acceptance remain separate from this functional qualification.

## Generate a text clip

```powershell
.\.local\cpu-env\Scripts\python.exe -m verona.generate --text "Hey, how are you?" --pitch 2 --rate 1 --bass 2 --output .local\my-first-clip
```

Use a new output directory. This writes audio, complete motion and mesh data;
it is an explicit export command, not the browser launcher. No extra TTS model
or Python package is required.
See [chapter 07](chapters/07-hazel-claire-and-performance.md) and
[third-party terms](../THIRD_PARTY.md).

## Run focused checks

Using the prepared local environment:

```powershell
.\.local\cpu-env\Scripts\python.exe -m unittest discover -s tests -q
```

The original Mark numerical probe remains a historical optional diagnostic,
not the current Claire application. Fresh clones need its separate assets:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_cpu_model
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu
```

This prints CPU inference timings and output/geometry dimensions, and saves
`.local\cpu-probe.json`. It does **not** open a face window or play speech.
To analyze a local mono 16 kHz, 16-bit PCM WAV of at most ten seconds:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu --wav ".local\line.wav"
```

For fresh-clone setup and limitations, see [chapter 05](chapters/05-local-cpu-feasibility.md).
