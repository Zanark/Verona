# 05 - The neural face model runs locally on CPU

**Status: implemented and numerically verified CPU experiment, not a face player
or speech-accuracy qualification.** Workstream: `vr-06`. Date: 2026-11-18 IST.

This chapter preserves the numerical-feasibility milestone.
[Chapter 06](06-text-to-face-prototype.md) advances to actual local synthesized
speech and complete native-derived motion clips; those results are separate.
The [vr-51 visual follow-up](#actual-mark-visual-follow-up-vr-51) below now
shows the original Mark assets in a review-only GIF report. It does not replace
the current Claire-family application or retroactively qualify this first probe.

## The decision and the important distinction

After the [research handoff](04-speech-driven-face-research.md), the owner chose:
**"Keep everything free and local on this AMD machine."** This excludes paid
SDKs, cloud inference and recording uploads from the prototype route.

The official reviewed Audio2Face SDK remains CUDA/TensorRT-specific. However,
its Mark v2.3 model repository also publishes a standard ONNX network and the
PCA/conditioning assets. Those are different things: a CUDA SDK requirement does
not prove that its underlying network cannot execute through another runtime.

We tested that distinction rather than assuming either outcome. **The pinned
Mark network actually executed with only ONNX Runtime's CPU provider here.**
The first 272 predicted coefficients also reconstructed finite native skin
geometry through the released PCA basis. No NVIDIA GPU, CUDA, DirectML, PyTorch,
paid service or remote inference was used.

This supersedes the earlier *unverified CPU portability* state for this narrow
network/reconstruction path. It does **not** make the official SDK CPU-compatible
or establish parity with its complete animated output.

## Exact source contracts

Model repository:
[`nvidia/Audio2Face-3D-v2.3-Mark`](https://huggingface.co/nvidia/Audio2Face-3D-v2.3-Mark/tree/5451728e07378df93b04523279e134a9993ae71b),
revision `5451728e07378df93b04523279e134a9993ae71b`.
Its [network metadata](https://huggingface.co/nvidia/Audio2Face-3D-v2.3-Mark/blob/5451728e07378df93b04523279e134a9993ae71b/network_info.json)
and [model configuration](https://huggingface.co/nvidia/Audio2Face-3D-v2.3-Mark/blob/5451728e07378df93b04523279e134a9993ae71b/model_config.json)
declare the following contracts:

| Item | Contract used by the experiment |
|---|---|
| Audio | 16 kHz mono floating-point samples, 8,320-sample window, target offset 4,160. |
| Input strength | 1.3, applied to the window samples. |
| Neutral identity condition | `g2a_neutral`, frame 33 of that shot. |
| Network inputs | `input`: `[batch,1,8320]`; `emotion`: `[batch,1,26]`, float32. |
| Emotion ordering | 16 implicit values followed by ten zero explicit emotion controls. |
| Network output | `result`: `[batch,1,301]`, float32. |
| Output regions | 272 skin PCA coefficients, ten tongue coefficients, 15 jaw values, four eye values. |
| Skin reconstruction | Basis `[272,61520,3]`, neutral `[61520,3]`; signed coefficients, not normalized viseme weights. |

These are supported both by loaded tensor/NPZ inspection and the pinned SDK:

- [`executor_regression_core.cpp:41-49,188-201`](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/audio2face-core/executor_regression_core.cpp#L41-L49):
  audio accumulator read with input strength, negative initial window offset
  and rational sample/frame stride.
- [`emotion.cpp:65-135`](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/audio2face-core/emotion.cpp#L65-L135):
  `EmotionDatabase` loads named shot starts/sizes and indexes `start + frame`.
- [`model_regression.cpp:104-125`](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/audio2face-core/model_regression.cpp#L104-L125):
  implicit values precede explicit controls in each conditioning vector.
- [`model_shared.cpp:37-61`](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/audio2face-core/model_shared.cpp#L37-L61):
  skin starts at offset zero, then tongue, jaw and eyes.
- [`parse_helper.cpp:146-205`](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/source/audio2face-core/parse_helper.cpp#L146-L205):
  PCA matrices, neutral skin/tongue, lip/eye correction data and jaw data.
- [`animator.h`, `IAnimatorPcaReconstruction`](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/audio2face-sdk/include/audio2face/animator.h):
  coefficients reconstruct vertex **deltas**; neutral is a separate shape.

The simple numerical reconstruction is:

```text
skin = neutral_skin + skin_coefficients @ flattened_skin_basis
```

It intentionally does not pretend to reproduce the SDK's later postprocessing,
smoothing, strength/contact corrections or other articulators.

## Implemented tools

[`scripts/fetch_cpu_model.py`](../../scripts/fetch_cpu_model.py) fetches exactly
three public files from the pinned revision into ignored
`.local\models\mark-v2.3`. File sizes and SHA-256 values come from the public
model repository's LFS metadata and are hardcoded in `ASSETS`.

The fetcher streams to a unique temporary file, rejects oversized/truncated or
hash-mismatched downloads, then publishes the verified asset. Existing files are
verified and reused; a corrupt existing file is rejected rather than overwritten.
It writes a local receipt with the model revision, license URL and asset hashes.
It does not read or forward the GitHub PAT.

[`scripts/probe_cpu.py`](../../scripts/probe_cpu.py) is an offline numerical
probe. It rechecks all asset hashes, loads NPZ data with `allow_pickle=False`,
uses only `CPUExecutionProvider`, limits inference to two threads and inter-op
execution to one, and processes one frame at a time.

It assembles the actual implicit condition rather than substituting an all-zero
identity vector. Frames use rational sample positions without accumulated
rounded-stride drift, preserving original audio zero and padding context at both
ends. Outputs must be finite and have the expected shapes.

The default input is explicitly **one second of synthetic silence followed by
a 220 Hz tone, not speech**. An optional local WAV must be mono, 16 kHz, 16-bit
PCM and at most ten seconds. Unsupported audio is rejected, not silently
downmixed, trimmed or resampled. The program performs no network request and
starts no server, playback, camera or microphone.

The report is `.local\cpu-probe.json`. It records the analyzed PCM hash rather
than exporting an input pathname or transcript. It is local and Git-ignored.

### Reproduction on this Windows checkout

The environment already exists from this experiment. For a fresh checkout:

```powershell
python -m venv .local\cpu-env
.\.local\cpu-env\Scripts\python.exe -m pip install -r requirements-cpu.txt
.\.local\cpu-env\Scripts\python.exe scripts\fetch_cpu_model.py
```

Only the setup/fetch commands need internet. Model use is governed by the
[NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/),
not the SDK's MIT license. No third-party weights are committed or redistributed.
The model card permits commercial/non-commercial use subject to those terms;
no claim of universal asset or distribution clearance follows.

Run the bounded experiment or analyze a permitted local WAV:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu --wav ".local\line.wav"
```

Check the focused implementation:

```powershell
.\.local\cpu-env\Scripts\python.exe -m unittest discover -s tests -q
.\.local\cpu-env\Scripts\python.exe -m pip check
```

Do not install these packages into a sibling project's environment or global
Python. The two-thread limit is per owned process, not a machine reservation
or measured peak-memory guarantee. No persistent process remains running.

## Actual measured result

Receipt time: `2026-11-17T22:42:23.422678+00:00`
(`2026-11-18T04:12:23.422678+05:30`).
Python 3.13.14, NumPy 2.3.5, ONNX Runtime 1.23.2, CPU provider only.
Hardware inventory is the Ryzen 7 PRO 7840U / Radeon 780M machine described in
chapter 04; the Radeon was not used for inference.

| Measurement | Observed value |
|---|---|
| Input | One synthetic second, silence then tone. |
| Frame count / output | 30 frames, `[30,301]`, all finite. |
| Reconstructed skin | One frame, `[61520,3]`, all finite. |
| Session initialization | 0.241 seconds. |
| Network calls, total | 0.613 seconds. |
| Network frame median / maximum | 20.26 ms / 24.39 ms. |
| One skin PCA reconstruction | 6.56 ms. |
| Maximum coefficient change from first frame | 1.3486, demonstrating input/context-dependent numerical output, not phonetic correctness. |

These are one short run on a shared machine, not a stable latency benchmark.
Network timing excludes asset verification/loading, window construction, geometry
loading, reconstruction except the separately timed sample, rig postprocessing,
rendering and playback. The 260 ms half-window context also remains; 20 ms compute
is **not** 20 ms response latency. Do not extrapolate this into an end-to-end
real-time guarantee.

Nine focused checks passed. They cover corrupt/cached asset behavior, bad-download
cleanup, original-zero/tail padding, rational stride, shot/frame conditioning,
PCA delta-plus-neutral reconstruction and explicit rejection of stereo input.
Dependency consistency also passed. None is a human lip-sync acceptance test.

## What this unlocks, and what it does not

The immediate free/local candidate is now **Mark v2.3 through custom CPU ONNX**,
ahead of speculative UniTalker setup for the next implementation investigation.
This is a narrower, evidence-driven recommendation, not an assertion that
Audio2Face is globally the most accurate model.

The remaining first-face work is substantial and explicit:

1. Compare decoded geometry/conditioning/postprocess against the SDK's defined
   behavior; implement the necessary skin/contact and jaw/tongue pieces.
2. Obtain a permitted, matching connectivity/rig contract. These three numerical
   assets do not themselves provide a ready displayed connected face.
3. Generate a cached clip from real speech and implement audio-clocked
   vertices/edges playback with deterministic pause, seek and restart.
4. Run chapter 04's contrasting articulation/silence/expression cases and inspect
   the actual performance. Require owner review before calling it accurate.

No recording has yet been supplied or processed. No face window, audible speech,
expressions, SDK parity or end-to-end animation has been demonstrated. A
successful CPU tensor probe must not be presented as the finished Verona app.

## Actual Mark visual follow-up (vr-51)

The owner later asked what the already installed Mark model actually looks like.
Open `.local\qualification\mark-model-01\review.html` in the prepared checkout:
twelve GIFs show the raw rest head turning, neutral speech and all ten native
single emotion controls. Each frame pairs gray shaded skin with cyan triangle
wireframe over exactly the same geometry and camera. This is a separate NVIDIA
identity, not Claire recoloring, the Claire-derived Male-SharpJawline sculpt or
the MPFB head. All six manager variants and existing heads remain unchanged.

[`mark_model_study.py:prepare`](../../scripts/mark_model_study.py) verifies the
three pinned model hashes and matching native scene before loading numerical
data. `read_mesh` never executes Maya/MEL, references or plug-ins. Native scene
skin and NPZ mean are not byte-identical: maximum/median per-index Euclidean
distances are 0.475990/0.036112 cm in this run. Compatibility gates retain the
existing 1.1/0.08 cm bounds; the displayed mean and 272-component basis both
come from Mark's NPZ, with the scene supplying connectivity only.

`native_control_mesh` inverts one native subdivision, retaining 15,375 actual
animated vertex indices and 30,746 triangles instead of reconstructing all
61,520 dense skin vertices for display. This is an explicit preview-resolution
trade-off, not identity fitting or arbitrary remeshing. Static cosmetic eyes
use Mark's two choroid bounds. The generic
`mpfb-renderer.mjs:createStudyRenderer` supplies preview lighting/wire/optics,
not MPFB geometry, original Mark materials, hair or animated eye joints.

The fixed synthetic greeting is "Hey, how are you?", 2.75 seconds from the
installed Microsoft Hazel Desktop voice. Mark predicts motion, not that voice.
The existing rational-window CPU path generates 83 poses per clip, using
`g2a_neutral` frame33, input strength1.3 and either zero explicit emotion or
one of ten channels at0.60. All 913 outputs are finite `[1,1,301]` values;
only the first272 skin coefficients are reconstructed. No Claire basis,
procedural lip motion or neutral-relative2x/4x gain is applied. Mark cheekiness
therefore does not include vr-49's proposed extra sideways Claire lip pull.

[`mark_model_study.cjs`](../../scripts/mark_model_study.cjs) uses a hidden,
sandboxed Electron window and direct deterministic canvas PNGs. Approximately
12-fps samples preserve complete clip durations; the rest turntable uses48frames.
Both shaded/wire regions must contain substantial actual geometry pixels.
`encode` uses the already installed report-only Pillow12.2.0, leaves CPU
dependencies untouched and decodes every encoded GIF. All411 rendered samples
match their palette-converted decoded timeline, with moving pixels, looping
and exact centisecond duration. This checks encoded content, not human lip-sync.

`--review` qualifies all twelve actual960x552images, paused/non-autoplay audio,
1280/390px layouts and visible missing-image errors. Sampled model contact
sheet and both reader screenshots were inspected; not every animated frame
was independently visually reviewed. The normal browser report was opened.
The WAV is optional and separate from unsynchronized silent GIF loops.

Run the bounded stages from the repository root, using a fresh absolute output
directory for each attempt:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.mark_model_study prepare --output .local\qualification\mark-model-02
$output = (Resolve-Path .local\qualification\mark-model-02).Path
$env:TEMP = "$output\tmp"; $env:TMP = "$output\tmp"
$env:LOCALAPPDATA = "$output\appdata"; $env:APPDATA = "$output\roaming"
$capture = Start-Process .\desktop\node_modules\electron\dist\electron.exe -Wait -PassThru -ArgumentList @(
  'scripts\mark_model_study.cjs', "--output=$output", "--user-data-dir=$output\capture-profile")
if ($capture.ExitCode -ne 0) { throw 'Inspect capture-error.json; retain the failed run.' }
python -m scripts.mark_model_study encode --output $output
# Repeat the Electron command with --review and a distinct reader-profile.
```

PowerShell must wait for this GUI executable; a direct invocation can return
before its capture receipt exists. An initial wrapper made that premature
check; the same owned renderer completed successfully and was awaited, not
restarted. No duplicate inference or capture was needed. Preparation/encoding
failures raise and record stage errors; keep failed receipts and choose a new
run rather than overwriting evidence. Existing completed runs are rejected.
No live server, head, profile or device is used; only immutable pinned inputs
are shared. Closing the report leaves current heads untouched; reopening its
HTML requires no running generator. Missing media visibly fails rather than
looking like an empty successful gallery.

The full SDK's skin contact/smoothing, independently animated teeth, tongue,
jaw and eyes remain omitted. This report is not human phonetic/anatomical/
identity acceptance, official CPU SDK support or a real-time generation
benchmark. Weights remain NVIDIA Open Model License; the native sample is
separately MIT. Neither is copied into source or the report. Generated review
media remains local/ignored; no model integration, book edition, release or
deployment follows from this report.
