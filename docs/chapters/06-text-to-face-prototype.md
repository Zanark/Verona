# 06 - From plain text to a local speaking-face clip

**Historical baseline:** this chapter records the original Mark implementation
at `7c12a34`, including its commands and measurements. The current checkout uses
Claire and application-owned escaped SSML; follow the README and
[chapter 07](07-hazel-claire-and-performance.md) for current setup/contracts.

**Status:** text/audio/motion generation and the interactive browser player are
implemented and functionally exercised on real synthesized speech. Rendered
screenshots were inspected; playback tests were muted. Human articulation/
listening acceptance is not implied. Workstream `vr-07`, 2026-11-18 IST.

## Why this slice is deliberately small

The owner asked for a working text-input prototype, free and local on the
existing AMD machine, without disturbing shared applications. Research already
qualified the Mark ONNX network on CPU. The smallest next step was not another
large model: Windows already has David, Hazel and Zira desktop speech voices.

`verona/speech.py::speech_command` invokes the installed Windows PowerShell
executable with one fixed, reviewed System.Speech program. The sentence, voice
name and private temporary output path travel as JSON on standard input.
They are never interpolated into a command or evaluated as PowerShell/MEL/SSML.
The child receives a small OS-environment allowlist, not GitHub credentials.
No microphone, camera, cloud speech endpoint or voice-cloning model is used.

`synthesize` accepts 1-280 characters and an explicitly installed English voice.
The OS produces mono 16 kHz 16-bit PCM. The clip retains every original sample,
with 0.18 seconds of leading and 0.40 seconds of trailing silence. This gives
visible anticipation and settling room without moving audio independently of
motion. The complete padded clip must fit within 25 seconds; nothing is silently
truncated. The subprocess times out after 45 seconds and its temporary directory
is removed. Inputs outside the contract fail explicitly.

## Matching topology, rather than a plausible neighbor graph

The numerical model assets contain vertices and PCA bases, but no edges.
Inspecting the public blendshape archive's bounded ZIP directory confirmed that
it adds deltas and a mask, not the missing connectivity; it was not downloaded.

The official
[Maya-ACE compatibility guide](https://github.com/NVIDIA/Maya-ACE/blob/f0dc13670952c495450dab1655c94e9056c9d7d9/sample_project/README.md)
explicitly matches `mark_geom_v2_topo1.ma` with v2.3-Mark geometry.
`scripts/fetch_face_mesh.py` pins that repository revision, the 69,497,752-byte
ASCII scene and SHA-256
`6c3f5725978781e3bb079cc50c4fef0e5d4f5373fb271b991ce6eb9298af02df`.
The data stays ignored; [third-party notices](../../THIRD_PARTY.md) separate the
sample's repository license from the model's NVIDIA Open Model License.

**Verona never runs this scene.** `verona/mesh.py::read_mesh` reads only the named
skin node's numerical vertex/edge/polygon attributes. No MEL evaluation, plug-in
loading, external reference resolution or Maya installation occurs. Vertex and
face chunks must be contiguous, counts must match, indices must exist, and
signed polygon edges must form oriented loops. Maya writes the polygon type
only on the first chunk; the parser deliberately accepts subsequent typed-array
continuations and has a regression case for that boundary.

The actual native head has 61,520 vertices, 123,036 edges and 123,036 triangles
after triangulating its original quads. The sample rest positions are **not**
byte-identical to the PCA mean: the median per-index distance is 0.0361 cm and
the largest is 0.4760 cm. Official identity/topology pairing, counts and bounded
per-index distances are checked; a rest-pose difference is not disguised as an
exact-coordinate match. Motion uses the model's own mean/basis, not the sample
rest positions.

### Keeping complete clips lightweight without sewing the lips together

Storing every native vertex for every frame would waste memory. `reduced_mesh`
uses finer spatial cells around the mouth and larger cells elsewhere, but
contracts a pair **only if an original mesh edge joins them inside the same
cell**. Spatially touching upper and lower lips therefore cannot merge merely
because their coordinates are close. Union-find establishes those connected
components; the representative closest to each component centroid remains an
actual original vertex.

Original edges and triangle indices are then remapped through that partition;
self-edges and collapsed triangles are removed. This is a reduced native-derived
wireframe, not the full-resolution mesh or a fabricated proximity graph.
The current result is 10,349 sampled vertices, 24,885 edges and 20,694 triangles.
The same native vertex indices select the PCA basis, so displayed positions are
the learned native skin deformation at those samples.

Positions are centered/scaled once from the native mean and quantized to signed
16-bit integers at 8,192 steps per normalized unit. This avoids the coarse
precision of half-floats around the original 150-cm vertical coordinates.
Out-of-range or non-finite geometry fails rather than wrapping. Connectivity is
32-bit little-endian; one frame contains `vertices * 3 * 2` position bytes.
The mesh payload pads neutral positions to a four-byte boundary before its
Uint32 indices. Metadata carries explicit `edgeOffset`, `triangleOffset` and
`bytes`; currently 62,096, 261,176 and 509,504 respectively. Without padding,
10,349 vertices produce an unaligned typed-array offset. The browser validates
alignment/length rather than interpreting malformed buffers.

## One audio timeline and complete neural motion

`verona/engine.py::FaceEngine` verifies all four data files before parsing,
loads the selected PCA basis once and reuses a strictly CPU-only ONNX session.
The existing probe and application share `scripts/probe_cpu.py::create_cpu_session`:
two inference threads, one inter-op thread and sequential execution.
BLAS/OpenMP thread counts are bounded before numerical imports.

`generate` evaluates every 30-fps frame using the original 16-kHz audio clock:

```text
frame sample = floor(frame * 16000 / 30)
window start = frame sample - 4160
window length = 8320, with zero padding and the pinned 1.3 input strength
skin = model_mean + coefficients[0:272] @ selected_native_PCA_basis
```

The 0.26-second future audio context is used during offline generation, not
added as a playback delay. The clip retains audio zero and uses
`ceil(audio_samples * 30 / 16000)` frames. Packed motion and the original WAV
are separate payloads with PCM/motion hashes and explicit dimensions.

Neutral uses the previously qualified implicit shot/frame. Happy, sad and
surprised are bounded **explicit model inputs** (joy, sadness and amazement),
not inferred emotions or a hand-added jaw/smile overlay. Intensity is 0-0.6.
Expression channels do not constitute human-validated expressive quality.

## Reproduce the backend milestone

The existing local environment needs no new Python packages:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_face_mesh
.\.local\cpu-env\Scripts\python.exe -m verona.generate --text "Hey, how are you?" --output .local\my-first-clip
```

The output directory must be new; existing clips are never overwritten.
It contains `audio.wav`, `motion.bin`, `mesh.bin` and their `clip.json` contract.
This command generates a clip, **not a graphical window**.
The model setup remains in [chapter 05](05-local-cpu-feasibility.md).

### Actual first real-speech result

Microsoft David Desktop generated the greeting. With the explicit padding:
2.745 seconds, 83 neural frames, 5,153,802 motion bytes and a 10,349-point mesh.
Motion generation took 1.894 seconds, excluding voice synthesis/model startup;
median network frame was 20.47 ms. These are one measured run, not a latency
guarantee. Maximum sampled skin change from the first frame was 0.983 cm.
Nineteen focused tests and dependency consistency passed.

The result proves that a real text request can produce local speech data and a
complete time-indexed learned skin clip. It does **not** prove that the greeting
was independently heard, the renderer works, or P/B/M and F/V contacts are correct.
The old synthetic CPU probe remains useful as a separate narrow diagnostic.

## The interactive player: one clock, not two drifting animations

Run `.\Verona.cmd` from the prepared checkout. `verona/__main__.py::main`
constructs the verified engine and installed voice list, binds a new local
server, then opens its ready URL. The launcher installs/downloads nothing.
Type a line, Generate, then Play; generation does not autoplay.

`verona/web/app.js::FaceRenderer` uses native WebGL2 without a renderer package,
CDN, build step or external font. It uploads quantized neutral/motion positions
and original-derived edge/triangle index buffers. Triangles provide a depth
prepass, then visible edges/points draw with depth testing. This is a reduced
native skin, not MediaPipe tracking or a volume-driven substitute.

Every draw derives its frame from `audio.currentTime * 30`, clamps to the clip
range and interpolates its two neighboring neural frames in the vertex shader.
The animation loop does not advance a separate face timer. Pause/resume,
seeking and natural end therefore preserve the original audio offset. Restart
pauses and rewinds to zero; Play restarts an ended clip. Render requests run
during playback or in response to view/seek/resize changes, not continuous
inference. Explicit expression changes require a newly generated clip.

The browser fetches motion and WAV through the authenticated API, checks byte/
mesh contracts and actual decoded audio duration, then enables transport.
Generating clears prior client playback so an error cannot leave old speech
presented as the new sentence. Empty input is rejected before that clearing
step, preserving an otherwise usable clip. Failures are visible and retryable;
graphics-context loss pauses speech and explicitly requires reload.

## Local API, ownership and recovery

`verona/server.py::LocalServer` is a bounded development server, not a production
deployment. It binds **127.0.0.1 only**, normally an OS-selected port, with at
most eight request threads and one nonqueued generation. Host, Origin and
browser fetch-site guards reject other origins. API routes additionally require
a fresh per-process random capability in `X-Verona-Token`; even session metadata
is authenticated. There is no anonymous token/bootstrap endpoint.

The launcher URL carries the capability after `#`, outside HTTP paths and
server request logs. It is not a defense against malicious local software, and
normal browser history may retain the URL. Do not share it. A new process has
a new capability; opening only the bare origin is deliberately insufficient.

Static routes are an exact HTML/JS/CSS allowlist, not a filesystem server.
There is no arbitrary audio/file/command/upload/proxy endpoint. JSON generation
requires the exact four known fields, one bounded Content-Length, no transfer
encoding, an installed English voice and validated expression/text limits.
Bodies exceed neither 8,192 bytes nor the stricter speech contract.
Socket input times out after ten seconds. Busy/oversized/invalid requests fail
explicitly. CSP disallows external resources; camera/microphone/geolocation are
denied. Responses are no-store, same-origin and non-embeddable.

The server retains one successful clip in RAM, replaced on next success;
the browser holds its currently loaded motion and blob WAV. Browser reload
clears the client, not the server. No transcript/automatic export/localStorage
history is implemented; explicit CLI export is a separate persistence action.
Temporary synthesis WAVs are removed. Stopping Python loses its cached clip.

Keep the terminal open while using the app. Ctrl+C sets a cancellation event,
stops accepting requests and joins owned request threads. Inference checks
cancellation between frames; an already-running Windows synthesis step may
take up to its 45-second bound. Closing only the page does not stop Python.
No service, scheduler, firewall/policy/global-package change or device capture
is involved. CPU limits reduce owned load, not a guarantee of zero contention
on this shared machine.

## Actual player qualification and corrected failures

`tests/test_local_server.py` adds six boundary tests to the nineteen existing
focused checks. `tests/run_browser_smoke.py` starts an owned actual model/server
and existing Edge with a disposable profile; `tests/browser_smoke.mjs` drives
CDP through Node's built-in WebSocket. Neither Playwright nor another package
was installed. The user's profile/process is not driven or closed.

Reproduce with installed Edge and Node:

```powershell
.\.local\cpu-env\Scripts\python.exe -m unittest discover -s tests -q
.\.local\cpu-env\Scripts\python.exe -m tests.run_browser_smoke --output .local\qualification\my-new-run
```

Use a new receipt directory; preserve failures. Final run `browser-v3` passes
twelve scenarios: actual neutral WebGL2 drawing; speech/WAV decode; muted
play/pause/resume; seek; restart/end; expression replacement; alternate voices/
P/B/M/vowels; overlong synthesis rejection; injected network failure/recovery;
empty-input preservation; narrow layout; reload. David, Hazel and Zira all
generated clips. Neutral/happy/sad/surprised model inputs were exercised.
At 1.25 seconds the greeting selects frame 38 of 83. Screenshots show connected
skin and differing mouth aperture; that observation is not a contact benchmark.

The final receipt has zero page exceptions/external page requests and exactly
one deliberate inspector-blocked generation request. Its owned browser/server
stopped and disposable profile was removed. The greeting's motion generation
took 4.056 seconds in this run, excluding synthesis/startup; the earlier 1.894
seconds is a separate measurement, not promised interactive speed.

Two earlier harness failures remain preserved: v1 used JavaScript `.click()`,
which is not trusted user activation for browser audio. Tests now dispatch real
CDP pointer input; autoplay protections were not disabled. v2 expected a useful
network `errorText`, but Edge returned an empty string for deliberate blocking.
The harness now records/asserts CDP's actual `blockedReason: "inspector"`.
All v2 functional scenarios had passed; its overall report was correctly failed
until that diagnostic was fixed and a new complete run passed.

## Remaining accuracy gates

The current skin path does not implement full SDK skin/contact/smoothing
postprocessing, independent denture/tongue motion or eye-joint/gaze animation.
The lower-jaw region moves through the skin PCA, but that is not an implemented
independent teeth rig. Full mouth-contact accuracy, expressive quality,
other languages/accents and human acceptance remain separate qualification.
The three local voices produced valid speech/motion payloads, not an independent
listening score. P/B/M, F/V and vowel inputs were exercised, not proven to have
anatomically correct closure/contact at independently established phone times.
Do not silently substitute amplitude-only animation or call these gates passed
because numerical output changes.
