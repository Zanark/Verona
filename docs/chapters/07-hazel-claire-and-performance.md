# 07 - Editable Hazel, matching Claire and measured performance

**Current resource contract:** [vr-57 below](#selected-head-resource-ownership-vr-57)
audits the earlier five-head runtime; [vr-65/66 below](#native-model-selection-and-bounded-transfer-batches-vr-6566)
extend its ownership contract to six choices and four shared views. The vr-08 measurements that
follow remain historical, not current latency or memory promises.

Presentation note: [chapter 08](08-facial-definition-and-fluidity.md) supersedes
this slice's voxel topology and payload measurements with native contour loops,
shading and static cosmetic eyes. This chapter preserves the vr-08 baseline.

Workstream `vr-08`, November 18, 2026. This extends the same local prototype,
not a second application. [Chapter 06](06-text-to-face-prototype.md) preserves
the original Mark baseline. Human listening, expression quality and anatomical
lip-contact acceptance remain open; numerical and muted browser checks do not
establish them.

## What changed, and what did not

The owner requested better performance, Hazel by default with editable voice
characteristics, and a female mesh head with optional hair. Reusing the Mark
coefficients on a reshaped feminine silhouette would break the identity/basis
contract. The current app therefore uses the official matching Claire model,
PCA basis and native topology. This is a genuine identity change, but its larger
network costs more CPU per new line than Mark.

Speech still comes from installed Windows desktop voices. No additional TTS
model, Python dependency, npm package, device capture, cloud endpoint or service
installation was added. Old Mark assets are retained locally for the historical
probe; fresh Claire setup needs only about 337 MB of pinned model/sample data.
The default launcher remains `Verona.cmd`.

## Voice settings are data, not executable markup

[`VoiceSettings`](../../verona/speech.py) validates a small immutable contract:

| Setting | Range | Mechanism |
|---|---|---|
| Pitch | integer -8 to +8 st request | System.Speech prosody |
| Speed | integer -5 to +5 | native `SpeechSynthesizer.Rate` |
| Emphasis | none/reduced/moderate/strong | System.Speech emphasis |
| Warmth/bass | integer -6 to +6 dB | local smooth low-frequency shelf |
| Brightness/treble | integer -6 to +6 dB | local smooth high-frequency shelf |
| Playback volume | 0 to 1 | browser audio gain; no regeneration |

Booleans are not accepted as integers. Unknown fields, nonfinite values,
unsupported emphasis and out-of-range values fail before synthesis. Hazel is
selected by exact installed name; if absent, the UI/CLI explicitly names the
available fallback instead of pretending Hazel exists. Other installed English
voices remain selectable. Reset restores the default voice and neutral settings.

`speech_markup` constructs XML with ElementTree. User text is an escaped XML
text node inside application-owned `speak/prosody/emphasis` elements, never
parsed as tags. A supplied `<audio>` string remains literal text, not a remote
resource. Invalid XML characters are rejected. The fixed PowerShell program
receives generated SSML, native rate, voice and a private temporary path through
JSON stdin. User text still never enters executable PowerShell. No arbitrary
SSML, remote audio, file path or speech-engine installation endpoint exists.

The pitch label deliberately says **request**. Actual engine behavior depends
on the installed voice and is not an acoustically calibrated semitone shifter.
For the permitted synthetic sentence "We see a blue moon.", Hazel produced
these measured results:

| Change from defaults | Padded duration | Estimated median voiced frequency |
|---|---:|---:|
| None | 2.765 s | 186 Hz |
| Pitch +6 request | 2.765 s | 222 Hz |
| Pitch -6 request | 2.765 s | 157 Hz |
| Speed +2 | 2.341 s | 186 Hz |
| Speed -2 | 3.295 s | 186 Hz |
| Strong emphasis | 3.962 s | 208 Hz |

Frequency estimates use bounded autocorrelation windows, not a perceptual
evaluation or proof of exact pitch calibration. Emphasis also changes duration;
it is not the independent neural expression control.

### Tone shaping preserves the waveform's timeline

`shape_tone` operates on the synthesized PCM before the existing leading/
trailing silence. It pads each end with 0.5 seconds of zeros to reduce FFT
wraparound, applies real frequency-domain shelves, inverts the transform and
crops to the original sample count:

```text
low(f)  = 1 / (1 + (f / 300)^4)
high(f) = 1 - 1 / (1 + (f / 2200)^4)
gain(f) = 10 ^ ((bass * low(f) + treble * high(f)) / 20)
```

EQ does not stretch speech or change the audio-clock origin. If its result
exceeds 0.98 peak magnitude, the complete waveform is uniformly reduced before
16-bit conversion, rather than hard-clipped. Zero EQ returns the original PCM.
The final shaped waveform drives **both** neural motion and playback.

`Preview voice` uses the same validated synthesis path without neural inference.
Its native audio control requires an explicit Play action. The prior face clip
is not replaced by a voice-only preview. Preview/face playback pause each other;
editing draft settings invalidates a prepared preview. Generated clip details
retain their actual settings even when the draft controls are later reset.
Generate applies edits to a new complete audio/motion timeline.

## Claire is a matching native model, not a cosmetic retarget

[`fetch_claire_model.py`](../../scripts/fetch_claire_model.py) pins
[`nvidia/Audio2Face-3D-v2.3.1-Claire`](https://huggingface.co/nvidia/Audio2Face-3D-v2.3.1-Claire/tree/a46eafb067adfdd7cc8f5c7941586b309004561c)
at `a46eafb067adfdd7cc8f5c7941586b309004561c`, with exact sizes/SHA-256 for
the network, PCA data and implicit-emotion database. The matching
`claire_geom_v2_topo1.ma` comes from Maya-ACE revision
`f0dc13670952c495450dab1655c94e9056c9d7d9`, whose
[compatibility guide](https://github.com/NVIDIA/Maya-ACE/blob/f0dc13670952c495450dab1655c94e9056c9d7d9/sample_project/README.md)
pairs this topology with v2.3.x-Claire. Model and sample licenses remain
separate; see [third-party notices](../../THIRD_PARTY.md).

The scene is parsed only as numerical native geometry; Maya/MEL is never run.
Claire retains 61,520 original skin vertices, 123,036 edges and 123,036
triangulated faces. Its skin basis has **140 coefficients**, with **169 total**
network predictions; Mark's 272/301 layout is not reused. Conditioning uses
Claire's `cp1_neutral` shot, frame 212 within that shot, and input strength 1.0.
Implicit16/explicit10 emotion channels and rational 16-kHz/30-fps timing remain.

Native rest positions and PCA mean are not identical: median per-index distance
is 0.04936 cm, maximum 0.97871 cm. The matched identity, dimensions and bounds
are checked; no exact-rest-coordinate claim is made. Motion uses Claire's own
mean/basis, not the sample rest positions.

`reduced_mesh` keeps native-edge-connected clustering, so touching disconnected
lip surfaces are not sewn together. Claire's lip sampling region uses its own
coordinates (`abs(x)<4.5`, `138.7<y<141.8`, `z>2.5` cm), not Mark's y-range.
The initial wider region unnecessarily densified the chin; actual screenshots
guided the narrower lip region. Fine/global cells remain 0.15/0.85 cm. The
current skin contains 6,545 samples, 16,073 edges and 13,078 triangles.
This is not a claim that reduced topology preserves every contact detail.

[`appearance.py::claire_hair`](../../verona/appearance.py) creates an original
2,240-point bob with 2,160 strand edges and 4,320 depth triangles. A smooth
front-opening transition keeps the central face/eyes clear while side/back
strands extend lower. Early screenshots exposed scalp intersections and then
overlong front curtains; the shell/opening were corrected, not accepted from
geometry counts alone. Hair is cosmetic/static and independently toggleable,
not a learned deformation, physics simulation or extra downloaded asset.

Hair buffers append to the aligned mesh payload, with their own position/edge/
triangle offsets. The same quantized shader draws them with depth testing.
No per-frame hair positions are transmitted. Current mesh bytes including hair:
407,352; neutral edge offset 39,272; triangle offset 167,856. Each skin frame
contains 39,270 bytes. An 83-frame greeting needs 3,259,410 motion bytes, about
37% less than the original Mark clip, without lowering the neural frame rate.

## Performance: eliminate repeated work, then measure the remaining cost

[`FaceEngine`](../../verona/engine.py) still verifies **all original pinned
assets on every startup**. `claire_topology` caches only derived selected
indices/connectivity/rest-distance evidence under ignored `.local/cache`.
The filename fingerprints asset identities and the reduction algorithm version.
An atomic numeric NPZ uses `allow_pickle=False`; dimensions, dtypes, index bounds,
uniqueness and finite rest bounds are validated on load. A malformed cache fails
explicitly and names the exact file to remove/rebuild; it is not silently ignored.
Neither user text nor speech enters this persistent cache.

Inference and PCA reconstruction use bounded batches of four. Final partial
batches retain all original frames, and cancellation is checked between batches.
Two ORT intra-op threads, one inter-op thread and the existing two-thread BLAS
bound remain; these are per-pool bounds, not a zero-contention promise.
Measured eight-frame Claire batching differed from serial coefficients by at
most `3.815e-6`. Representative alternating trials measured 0.205 s batch-four
versus 0.231 s serial; other runs varied substantially on the shared machine.
Disabling ORT spinning and using one inference thread were slower in the bounded
comparison, so neither change was adopted.

[`State` and `Handler.do_POST`](../../verona/server.py) keep only one latest
successful clip and one latest synthesized speech object:

1. Identical normalized text/voice/settings/expression/strength reuses that
   complete clip, including its identifier, audio and motion.
2. Expression-only changes reuse the matching speech but rerun neural motion.
3. Voice/text/settings changes replace the one speech entry; there is no
   multi-entry history, disk speech cache or automatic export.

Canonical speech-key hashes remain in RAM, not logs. Failed work does not
masquerade as a newly successful clip. The existing single nonqueued generation
slot also protects previews/cache transitions; exact Host/Origin/capability
checks apply to both POST routes. Old four-field requests remain supported;
`voiceSettings` is the only optional added field.

Observed permitted greeting measurements, not latency guarantees:

| Operation | Measured result |
|---|---:|
| Original Mark uncached startup | 3.586 s |
| Initial Claire uncached startup | 3.400 s |
| Claire derived-cache startup, latest three runs | 1.360 / 1.530 / 1.449 s |
| Original Mark new greeting motion | 1.903 s |
| Claire new greeting motion, browser run 03 | 3.596 s |
| Claire new greeting client ready, run 03 | 4.617 s |
| Exact latest repeat client ready, run 03 | 0.036 s |
| Exact repeat server work, run 03 | 0.00019 s |
| Final hair candidate, new greeting client ready, run 04 | 6.807 s |
| Final hair candidate, exact repeat client ready, run 04 | 0.059 s |
| Final candidate new greeting motion, run 04 | 5.580 s |

The tradeoff is explicit: warm startup, repeat work and motion payloads improve;
**new-line inference is slower than the original Mark model**. The UI now
reports actual client-ready time plus server time, not just inference duration.
30-fps neural articulation and audio-clocked interpolation were not reduced to
manufacture a speed claim.

## Verification, failure corrections and operation

Thirty-one focused checks cover escaped SSML/settings, tone length/headroom/spectral
change, Hazel default, derived-cache reuse/corruption, batch-tail reconstruction,
cancellation and bounded HTTP cache/preview transitions. Real installed voices
and waveform effects were also exercised; fixtures alone are not that evidence.

Sixteen passing isolated Edge scenarios in `claire-browser-04` extend all previous transport/error checks with
Hazel selection, hair visibility/turn/toggle, identical repeats, expression-only
speech reuse, preview/edit/reset and generated-settings provenance. The native
audio control exposed embedded `data:image` icons in CDP; the first final network
assertion incorrectly called them external requests. The harness now records
embedded browser images separately and still rejects real nonlocal requests.
Failed receipts remain; they are not counted as passes. Playback is muted,
screenshots are visually inspected, and the owned server/browser/profile are
cleaned up after qualification.

```powershell
.\.local\cpu-env\Scripts\python.exe -m unittest discover -s tests -q
.\.local\cpu-env\Scripts\python.exe -m tests.run_browser_smoke --output .local\qualification\new-claire-run
.\.local\cpu-env\Scripts\python.exe -m verona.generate --text "Hey, how are you?" --pitch 3 --rate 1 --bass 2 --emphasis moderate --output .local\new-claire-export
```

Use new qualification/export directories; prior evidence is preserved.
Fresh setup uses `-m scripts.fetch_claire_model`; runtime downloads nothing.
CLI export deliberately saves audio/motion/mesh/metadata. Browser operation has
no application transcript history or localStorage; temporary synthesis WAVs are
removed. Reload clears the page, stopping Python clears both RAM caches, and
the model-derived geometry cache survives restart. Ctrl+C ownership, loopback
capability boundaries and omitted SDK/contact/teeth/tongue/eye-joint processing
remain as described in chapter 06. No listening or phonetic accuracy acceptance,
book rendering, release, installer or deployment is implied.

## Real chat use: separate head cost from a busy machine (vr-61)

The owner's opted-in chat uses one existing original Claire head, Hazel,
reference color/makeup, original hair and whole-head cursor following. The
first bounded observation leaves that loaded vr-57-era window unchanged:
one-second samples cover twelve idle seconds, one useful animated summary and
eight post-speech seconds. All eight owned process IDs remain the same.
No development capture runs during this window. This is interactive use, not
an isolated off/on benchmark; cursor movement and other applications remain
uncontrolled. The shared manager is outside the measured head tree.

On this 16-logical-processor machine, the tree averages **0.065% of machine
CPU** during the 12.008s idle window and **887.04MiB private committed memory**.
Generation-labelled intervals average 11.73% CPU; playing-labelled intervals
average 2.674%. The uncached animated reply starts at **21.412s** and completes
at **30.220s**, including playback. Both latest-only caches miss. One-second
state labels are observations near transitions, not exact phase attribution.

Private commit peaks at 963.82MiB and averages 940.72MiB over the eight-second
post-speech window. That is not unique physical RAM, GPU memory, a proved leak
or a fully settled steady-state result. Whole-machine CPU is already 42.17%
in the idle lane and 52.31% during generation: attributing that entire load to
Verona would be wrong. The private receipt is
`.local/qualification/live-use-01/receipt.json`; it contains metrics/settings,
not captured conversations, audio or descriptors.

Two **planned**, independently tracked follow-ups result:
[vr-62](../../TODO/62_ANIMATED_REPLY_LATENCY.todo) attributes synthesis,
inference, packing/delivery and player preparation before choosing latency
fixes; [vr-63](../../TODO/63_LIVE_HEAD_MEMORY.todo) attributes the complete
host/voice/Chromium/GPU-helper memory cost before diagnosing avoidable retention.
Neither is an implemented improvement or authority to lower the requested
visual quality, silently switch to voice-only, add a permanent profiler or
retain an unbounded speech cache. Further observations belong at real use
checkpoints, labelled separately from development-test contention.

A separate qualification finding becomes planned
[vr-64](../../TODO/64_NATIVE_SHUTDOWN_DIAGNOSTICS.todo): intermittent native
close delays can postpone resource release. A native MPFB 20-second close gate
failed once and passed unchanged in a separate run; an earlier pre-blink
qualification also retained a close timeout. No causal attribution, larger
timeout or claim of a fixed shutdown bug follows from that passing retry.

## Selected-head resource ownership (vr-57)

November 21, 2026. The owner's question was whether using FaceMesh secretly
loads every available character. It does not. A presentation is not a trained
speech identity: FaceMesh, FaceDot, UniformPolygons and Claire share Claire's
native-index motion. Removing that network/PCA while retaining its animated
lips would remove the speech-motion system, not merely an unused model.

### Following the actual owners

| Boundary | What is actually resident or active |
|---|---|
| `SessionManager` | Catalog strings, owned processes and bounded descriptor/status data; no `FaceEngine`, NumPy or ONNX Runtime import in a fresh manager. |
| `agent_host.host` / `FaceEngine` | One matching Claire network, selected 140-component PCA, conditioning, native display geometry and one local voice worker per explicitly created warm head. |
| `variants.prepare_variant` | Only the chosen adapter. Plain Claire reads no MPFB/reference asset. Reference choices read their fitting reference; MPFB additionally binds native target geometry/controls. Male-SharpJawline maps complete poses. |
| `State` / `Handler.do_POST` | One successful clip and one synthesized sample in RAM; exact-repeat and expression-only reuse remain bounded. One nonqueued generation slot per head. |
| `FaceRenderer` | Shared source/rest geometry plus the selected view's GPU indices; hidden hair has no GPU buffers. No cache of all view/style meshes. |
| MPFB player | Managed heads create only their visible wire renderer; the standalone comparison intentionally has wire and shaded canvases. Wire rendering now allocates/uploads no unused normal buffer. |
| Electron / lifecycle | One isolated compositor/profile per head, event/audio-driven drawing, conditional cursor polling, parent watches and explicit owned cleanup. A different port alone is not isolation. |

`scripts.probe_cpu` imports Mark manifest constants for its separate research
entrypoint, but Claire passes its own pinned `network.onnx` explicitly.
Importing constants does not open Mark weights. The live numerical probe
records exactly one inference-session creation and no optional adapters.
There is deliberately no shared mutable multi-head speech service or model
pool: multiple warm heads still multiply neural, speech and Chromium costs.

### Why the changes help

The manager previously reached `engine` through its reused HTTP server and
loaded numerical/inference DLLs without constructing a face. `server.py` now
keeps its engine annotation type-only and imports generation helpers only in
the face request path. `speech.shape_tone` imports NumPy only when nonzero
shelves need it. Creating a real head still performs the same asset checks and
warms the same engine; failures are not deferred into fake readiness.

`FaceEngine.__init__` needs the full 61,520-vertex PCA temporarily to select its
15,375 display vertices. Its local `basis` reference previously survived until
the constructor returned, overlapping ONNX session construction. Explicitly
releasing that temporary after the contiguous selected copy lowers the startup
peak; it does **not** make the steady-state speech model 100 MiB smaller.
The regression checks source-array lifetime at inference-session creation.

`FaceRenderer.setPresentation`, `setFraming` and `setHairVisible` now release
inactive front/crop/full index buffers, unused optical edge buffers and hidden
hair buffers. Original hairstyle data remains recoverable from the one source
payload, but an unused original GPU hairstyle is not retained beside curls.
Controls, fits and the current clip survive switching; geometry is rebuilt on
selection rather than cached forever. Shader programs, source rest data and
the roughly 1 MB base payload remain shared necessities, not additional models.

Unlit views also retain motion only in the GPU, not a second JavaScript array.
Selecting lit Claire reads that **same current GPU buffer** back once for
animated normals, checks WebGL errors and keeps only two normal slots.
Returning to an unlit view drops the CPU array and those slots. At the maximum
750 frames this removes a retained 69,187,500-byte JavaScript motion reference;
garbage collection is not an immediate RSS reduction guarantee. The explicit
switch back to lit rendering can incur a readback stall. No network request,
speech regeneration, changed sample, lower frame rate or quantization is used.
`clearClip` frees motion and normal buffers; context loss still stops playback
and requires explicit reload. Failed readback is an error, never zero-motion
success. New owned profiles/processes were used; existing owner windows were
not restarted, refreshed or used as test clients.

### Measurements, not universal promises

Two fresh-process samples per side, pinned Python 3.13/CPU assets, two BLAS/OMP
threads, disposable cold derived caches and synthetic 0.4-second PCM:

| Measurement | Before | After |
|---|---:|---:|
| Empty manager private committed memory | 68.69-70.04 MiB | 18.82-18.95 MiB |
| Head startup peak working set | 386.78-387.74 MiB | 288.11-288.46 MiB |
| Head ready working set | 264.28-268.45 MiB | 268.23-271.97 MiB |
| Actual Claire FaceMesh geometry buffers, hair off, after repeated view/hair cycles | 3,055,342 bytes / 23 buffers | 754,894 bytes / 9 buffers |

The last row is a **75.3% reduction in instrumented geometry-buffer allocation**,
not total VRAM, Chromium memory or total system use. Other hair-off views in
the same actual-mesh sweep use 883,666-945,150 buffer bytes. Three identical
sweeps and further hairstyle/crop changes return to the same allocation.
Unlit motion has zero CPU normal slots; lit motion has two, released on return.
The GPU-to-CPU recovered samples match every original quantized element.
No continuing idle draw loop was observed in the bounded fixture interval.

Mesh and neutral/happy motion SHA-256 values match before/after exactly.
Synthetic generation latency varied across runs; no inference-speed or
steady-state head-memory improvement is claimed. These are isolated CPU-engine
measurements, not complete Electron-tree or eight-head capacity measurements.
Long speech still needs a current server clip and GPU motion; non-neutral
expressions still require two inference passes. MPFB binding/native fitting
still adds work. Shorter text, warm reuse and closing unused owned heads remain
the safest operational performance choices.

### Qualification and retained failures

The 82-case CPU suite covers imports, PCA lifetime, generation, cache/error/
cancellation and ownership. Real-asset software-WebGL comparisons retain
byte-identical original pixels in all four Claire views and both native
comparison canvases. They exercise selected-only geometry, repeated
view/hair/crop changes, lazy motion readback, clip cleanup and unchanged
color-only work. The native session lane exercises all five actual variants,
simultaneous independent heads, speech cancellation, CLI control, external
ownership and manager-parent death. Actual hardware-backed browser color/
playback checks and isolated Electron manager/pin/layout fixtures are separate
from software rasterizer comparisons; muted audio is not listening acceptance.

The old full browser harness did **not** pass unmodified in this environment:
its exact crop-restoration gate found 2-5 differing channel bytes, and the same
gate also failed against untouched `4c5a8dd` renderer source. A software retry
passed crop restoration but failed a rasterizer-sensitive iris-spoke count.
Those receipts are retained, not relabelled as passes or fixed by loosening
pixel thresholds. Independent baseline pixel comparison and native/live
playback lanes cover the changed mechanisms. A later native run also timed
out waiting for a structural-reference head to disappear; its owned cleanup
completed. The unchanged close threshold passed all five variants in
`performance-sessions-03`, including the subsequent CLI, external-survival
and parent-death checks. That intermittent timeout's cause is unproven;
the later pass does not erase it or establish universal shutdown reliability.

The older hairstyle test counted newly created buffer identities left alive;
replacing the original buffers correctly changes their identities. It now
checks balanced create/delete ownership and bounded peak additional buffers,
while the newer instrumentation checks exact retained byte counts per view.

Private receipts: `.local\qualification\performance-baseline-01`,
`performance-candidate-01`, `performance-final-01`, `performance-realmesh-01`,
`performance-browser-colors-02`, `performance-electron-01` and the numbered
`performance-sessions-*` runs. Failed full-browser/software/native runs remain
beside them. None is a human expression review, independent audio audition,
universal frame-rate claim, new release or permission to interrupt live heads.

Reproduce the bounded process probe and then compare its static real mesh:

```powershell
.\.local\cpu-env\Scripts\python.exe -m tests.run_performance_probe --output .local\qualification\new-resource-probe
node tests\test_appearance_rendering.mjs --baseline=4c5a8dd --real-mesh=.local\qualification\new-resource-probe\1-engine
```

The process probe writes static model-derived geometry, never speech audio or
transcripts. It cannot establish multi-head capacity or perceptual accuracy.

## Native model selection and bounded transfer batches (vr-65/66)

The lightweight catalog in `verona/session_config.py:MODELS` now separates six
selectable shapes from **two neural identities**. `agent_host.host` chooses
`FaceEngine("mark")` before loading any weights for Mark. Other heads require
Claire; native MPFB additionally loads only its selected transfer/faceunit data.
Catalog strings and imported asset manifests are not resident model weights.
The manager still imports neither NumPy nor ONNX Runtime.

`FaceEngine.__init__` keeps each network paired with its actual assets:

| Neural identity | Skin PCA / network outputs | Implicit conditioning | Audio input strength |
|---|---|---|---|
| Claire v2.3.1 | 140 / 169 | `cp1_neutral`, frame 212 | 1.0 |
| Mark v2.3 | 272 / 301 | `g2a_neutral`, frame 33 | 1.3 |

Both use the CPU provider, four-frame inference batches and their matching
native control topology. Mark does not pass through `verona_rest_shape`.
Its pinned scene supplies numerical skin connectivity and eye bounds; no Maya
scene is executed. As before, the full source PCA array is released after the
selected contiguous copy and before creating the inference session.

`mesh_payload` packs one selected skin, optional procedural hair and cosmetic
eyes into the existing Int16/Uint32 contract. Native Mark and MPFB are uniformly
aligned to the shared eye frame:

```
render position = (native position - native eye midpoint) * eye-span scale
                  + shared eye midpoint
native position = (render position - shared eye midpoint) / eye-span scale
                  + native eye midpoint
```

This similarity preserves shape and relative displacement; it does not warp a
native identity into Claire. The factor/origin/offset are exposed in
`mesh_metadata.renderTransform`. Display-space distances and neck settings are
in the shared rendering scale, not a physical head-size measurement. Packing
adds at most half a quantization step per coordinate.

### Exaggeration after, rather than before, a constrained fit

The historical MPFB path amplified Claire first and projected the result into
native faceunits bounded to 0..1. Saturation could discard the requested gain.
The shared path in `apply_transfer(..., shared=True)` instead maps each small
conditioned batch and its same-audio neutral batch separately. Each projection
retains the bounded 160-step native fit; the final geometry is:

```
native output = fitted neutral + gain * (fitted expression - fitted neutral)
```

Gain remains 2 or 4. **Final exaggerated geometry is no longer constrained to
the native 0..1 rig envelope.** This is a deliberate expressive tradeoff, not
an anatomical/contact guarantee or recovered unsupported motion detail. It
adds a second native fit, not a third neural inference pass. Neutral or
zero-strength clips still need only one prediction/fit per batch.

`FaceEngine.generate` maps at most four source frames at once, packs the native
result directly and checks cancellation before inference, between predictions,
inside native fitting and before packing. It no longer needs the shared MPFB
player's old complete Claire clip plus complete Float32 native trajectories.
Only one successful clip remains in RAM. The legacy report path retains its
original Float32/bounded behavior so old studies do not silently change meaning.
Errors, invalid model selection and out-of-range packing fail explicitly.

The exact-source unit checks cover post-fit rather than pre-fit exaggeration,
unchanged inference-pass count, actual Mark-only asset selection and release
of its full source PCA before ONNX startup. Actual-model/environment results
remain separate from these fixtures and from human accuracy acceptance.

### Actual selected-model resource samples

Two fresh isolated engine processes per choice used twelve synthetic silent
frames, a cold derived-topology cache and the same bounded thread settings.
These are private committed bytes for one CPU process, not physical RAM,
the complete Electron tree or a multi-head capacity result:

| Selected head | Ready private MiB | Final private MiB | Neutral / happy seconds per 12 frames |
|---|---:|---:|---:|
| Claire | 275.03-275.08 | 375.45-375.46 | 0.434-0.476 / 0.843-0.943 |
| Native MPFB | 327.62-332.32 | 387.27-387.34 | 0.603-0.629 / 1.210-1.276 |
| Actual Mark | 223.91-225.92 | 320.12-320.54 | 0.387-0.418 / 0.724-0.764 |

Claire and MPFB load only Claire's network; Mark loads only Mark's network
and no MPFB/reference adapters. The empty manager uses 18.95-19.23 MiB and
imports none of NumPy, ONNX Runtime or the engine. Repeated same-expression
motion hashes match exactly. Two-second idle samples consume zero or
0.015625 process-CPU seconds; that is a bounded sample, not zero lifetime cost.
Startup varies, including Mark's 20.63-second first and 7.07-second second
sample. No causal inference-speed improvement is claimed.

Receipts are `native-parity-perf-01-claire`, `-mpfb` and `-mark` under the
ignored qualification directory. They precede the final one-time native hair
clearance correction, which does not change the selected neural identity.
Do not compare these after-generation lifetime peaks with an older
startup-only peak as though they measured the same interval.

The actual six-model `native-parity-sessions-03` lane passes shared controls,
speech, independent clocks, cancellation, CLI, external ownership, parent-death
cleanup and descriptor removal at the existing gates. Run02 first exercises
all six renderers but later times out waiting for a CLI-created Claire to
become ready; its cleanup also exceeds the existing gate. The cause remains
unproven. A later pass is not a lifecycle fix: vr-64 stays open. New timeout
diagnostics retain named-session startup status rather than silently extending
timeouts. Failed receipts remain alongside passing ones.

Actual Claire/MPFB/Mark software-WebGL checks additionally exercise every
presentation's cheekiness enable/half/zero/off/restored pixels, feature colors,
blinks and bounded geometry ownership. Zero/off restores the underlying
motion, with no new geometry uploads or retained buffer growth. Fixture,
actual-model, silent browser and human listening/accuracy evidence remain
separate.
