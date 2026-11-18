# 06 - From plain text to a local speaking-face clip

**Status:** the offline text/audio/motion path is implemented and exercised on
real synthesized speech. The interactive player is the next part of `vr-07`;
visual and human articulation acceptance are not implied. Date: 2026-11-18 IST.

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

## Remaining prototype and accuracy gates

The next slice is the loopback-only browser player with text input, visible
vertices/edges, explicit errors and audio-clocked play/pause/restart/seek.
There is no pre-existing Verona face app to restart or replace. Tests must use
an agent-owned disposable browser profile, not the user's active browser.

The current skin path does not implement full SDK skin/contact/smoothing
postprocessing, independent denture/tongue motion or eye-joint/gaze animation.
The lower-jaw region moves through the skin PCA, but that is not an implemented
independent teeth rig. Full mouth-contact accuracy, expressive quality,
other languages/voices and human acceptance remain separate qualification.
Do not silently substitute amplitude-only animation or call these gates passed
because numerical output changes.
