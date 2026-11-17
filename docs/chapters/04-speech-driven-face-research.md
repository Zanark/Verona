# 04 - From speech to a moving wireframe face

**Status: research and proposed architecture, not implemented Verona behavior.**
Research date: 2026-11-18. Workstream: `vr-05`.
Exact repository commits, implementation paths, line ranges and primary documents
are in the [source register](../research/speech-face-sources.md).

**Later qualification:** the owner selected free/local AMD operation.
[Chapter 05](05-local-cpu-feasibility.md) now demonstrates a custom Mark v2.3
ONNX CPU inference/PCA path. The original SDK restriction below remains true;
the research-stage CPU uncertainty and candidate priority are superseded by
that measured result, not by a claim of full animation/accuracy qualification.

The owner wants a sentence or voice recording to become an animated face made
of connected points and edges. The face should actually articulate the voice,
including lips/jaw and expressions; visual polish is secondary. A prerecorded
line is sufficient initially. A voiced conversational assistant is the future
direction, not something needed to demonstrate the first speaking face.

## Executive conclusion

**Use a real audio-to-facial-motion backend, a deformable 3D face and
audio-clocked playback. Do not build the core around volume-driven jaw opening,
letter-by-letter animation or camera face tracking.** The recommendation is
architectural; there is no evidence-based universal winner before candidates
are tested on the same recordings and target rig.

For an integrated full-face quality reference, shortlist **NVIDIA
Audio2Face-3D**, comparing regression v2.3 and diffusion v3.0 rather than assuming
the newer network wins. For a controllable research alternative, shortlist
**UniTalker-B**. For a high-quality local-CPU commercial route, evaluate
**Speech Graphics SG Com**. These are candidates, not three dependencies to
install together. [R02, R04, P01, D06-D08]

There is a consequential feasibility choice:

| Route | Recommendation | Remaining gate |
|---|---|---|
| NVIDIA GPU available | First quality trial: A2F regression and diffusion, initially direct generated geometry rather than a retargeted avatar. | Actual GPU access, exact model/asset permissions and same-audio evaluation. No cloud resource or upload is assumed. |
| Current AMD machine, free/local | First neural feasibility investigation: UniTalker-B CPU adaptation, with FaceFormer as a simpler older comparator. Precompute short clips; do not require live inference. | CPU portability/performance and asset permissions are unverified. Stock UniTalker demo is CUDA-specific. |
| Current machine, commercial SDK acceptable | Evaluate SG Com before dismissing CPU full-face animation. | SDK access, price/terms, character setup and actual quality test; published CPU/50 ms figures are vendor measurements. |
| Guaranteed-small engineering baseline | Transcript + phoneme alignment + coarticulated viseme rig, or Rhubarb for coarse cues. | A useful timing/renderer control, **not** an equivalent claim of natural full-face accuracy. |

For future text-generated replies, retain the option to consume timing directly
from TTS. Azure Speech's viseme/3D events and HeadTTS's timestamped Kokoro path
can avoid estimating generated speech timing a second time. Neither directly
analyzes an arbitrary uploaded human recording. [D04, R10]

**Do not silently replace the accuracy requirement with the easiest CPU demo.**
Resolve the hardware/service/license route before a consequential implementation
commitment. No accuracy percentage, runtime speed or final backend is established
by this research.

## 1. Structural survey: what problem are we solving?

### Tracking is the reverse direction

The [KardboardCode reference](03-face-mesh-reference.md) describes camera image
to landmarks/measurements. It observes an already-moving face. Verona instead
needs audio to articulation to geometry to display. MediaPipe connectivity or
an outline renderer cannot generate the missing motion by itself. This distinction
comes from the reviewed tracking adapter and the audio-input model contracts.
**Confidence: high.** [Chapter 03, D01-D02, R04 `UniTalker.forward`]

A phoneme is a speech sound category; a viseme groups sounds with similar
visible articulation. Neither corresponds one-to-one with letters. Several
sounds can share a visible closure while differing acoustically. A face rig
then turns a viseme or control vector into actual vertex/joint positions.
Rhubarb's `getShapeSets` demonstrates this explicitly: P/B share a closure rule,
M uses a closed shape, and F/V use another shared shape.
**Confidence: high.** [R06 `animationRules.cpp:75-175`]

### Four separable accuracy problems

1. **Content:** did the estimator preserve the actual pronunciation, including
   reductions, accents and non-dictionary words?
2. **Articulation:** are the lip contacts, rounding, jaw and tongue/teeth
   relationships plausible for those sounds and their context?
3. **Timing:** are anticipatory gestures, closures/releases and transitions in
   the right places relative to the audio?
4. **Presentation:** does synchronization survive buffering, playback, seeking,
   rendering stalls and output-device latency?

This decomposition is Verona's proposed evaluation model, not an existing test
result. It is motivated by the separately treated phoneme/lip losses, geometry
solve, coarticulation and synchronization contracts in P01, R06 and D07.
**Confidence: high in the need for separate gates; thresholds remain proposed.**

Expressions add a fifth problem rather than replacing these four. Audio constrains
articulation but does not uniquely reveal gaze, exact head pose, an intended
smile, listening behavior or the speaker's internal emotional state. EMOTE treats
speech and emotion as separable factors; A2F explicitly documents upper-face,
semantic-context and idle/listening limitations. A neutral versus happy performance
of the same words is a legitimate control choice, not necessarily an inference
error. **Confidence: high.** [P03 abstract/introduction, P01 sections 4 and 7]

### Alternatives screened

| Candidate | What the reviewed evidence establishes | Why it is / is not the initial core |
|---|---|---|
| A2F v2.3/v3.0 | Audio-conditioned skin/tongue/jaw/eye motion, emotion controls, postprocess and blendshape solve. | Strong integrated full-face reference; supported SDK is NVIDIA-specific. [P01, R02] |
| UniTalker | Shared audio/temporal model with dataset-specific vertex/parameter heads. | Serious research candidate with broader training domains; stock demo/assets need qualification. [R04, P02] |
| FaceFormer | Wav2Vec2 features and autoregressive neutral-template vertex prediction. | Useful older comparator and possible CPU experiment, not presumed equivalent to newer/full-face systems. [R05] |
| CodeTalker | Two-stage discrete motion-prior approach; documented CUDA/older dependency stack. | Research comparator, not an easier current-machine installation. Inference code not traced. [R11] |
| EMOTE | Explicit emotion editing with speech/lip-reading and temporal-prior supervision. | Important design evidence for expression separation; deployment/assets not qualified. [P03] |
| ProbTalk3D / X | Probabilistic emotional motion; main README describes a separate prosody branch. | Main code license is CC BY-NC 4.0; CUDA documented. X branch not reviewed. [R12] |
| SGX / SG Com / FaceFX | Production audio-to-rig curves; SG Com documents CPU streaming and engine/player split. | Serious commercial alternatives, not open-code drop-ins or independently ranked winners. [D06-D09] |
| Rhubarb | Six basic and three optional cartoon mouth cues from recorded audio. | Deterministic coarse baseline; not a full anatomical face model. [R06] |
| HeadAudio | Local MFCC/prototype classifier to 15 Oculus visemes. | Easy browser integration, but documented accuracy limits and smoothing make it unsuitable as the unqualified accuracy-first answer. [R09] |
| TalkingHead | Three.js/WebGL avatar rendering, morph/rig and speech APIs. | Integration prior art, not proof that its word-derived visemes match recorded phonemes. [R08] |
| Azure Speech / HeadTTS | Generated audio with timed visemes or model-derived durations. | Especially relevant for future generated replies; distinct from recorded-audio inference. [D04, R10] |
| WhisperX / MFA | Transcription/alignment support, not facial geometry. | Optional text/audit or baseline components; do not mistake word/character timestamps for phone timing. [R07, D05] |

These are source-grounded shortlist judgments, not a systematic claim to have
examined every 2026 publication. Photorealistic talking-video systems are not
selected merely for convincing demos: the required output contract here is
controllable 3D vertices or rig parameters, not just synthesized pixels.

## 2. Data-flow investigation: actual implementation paths

### A2F SDK: audio and emotion accumulate before execution

The reviewed `sample-a2f-executor/main.cpp` reads 16 kHz audio, creates either
a regression or diffusion geometry bundle, accumulates an explicit default
emotion and audio, closes those accumulators and executes while tracks are
ready. Results arrive through a callback. Its `main` selects a CUDA device.
The demonstration counts frames; it does not display a face or serialize a
Verona-ready clip. **Confidence: high.** [R02 `readAudio`,
`AddDefaultEmotion`, `RunExecutorOffline`, `main`]

At the underlying inference boundary, `InferenceEngine` creates a TensorRT
runtime/engine/context, and `InferenceEngine::Run` enqueues work on a CUDA stream.
This is positive implementation evidence of a CUDA/TensorRT path, not merely
an inference from the NVIDIA brand. **Confidence: high.**
[R02 `inference_engine.cpp:234-245,503-506`]

The paper distinguishes two representations:

- v2.3 regression consumes a 0.52-second audio context and predicts one compressed
  pose per inference. Sliding the window generates a sequence. Its training-only
  auxiliary phoneme head improves articulation but is removed for inference:
  an external transcript/ASR stage is not inherently required.
- v3.0 diffusion predicts raw motion sequences. The streaming description uses
  a 1-second input window and retains the central 0.5-second animation block,
  advancing by 0.5 seconds and carrying recurrent state. Do not confuse the
  raw 30-frame prediction mentioned in the performance discussion with 30
  retained output frames per streaming block.

**Confidence: high, paper/source contract, not measured latency.**
[P01 sections 4.1-4.2 and 7; R03 `InferenceEngine.run` streaming truncation]

These contexts are not advertised end-to-end response times. Retaining a central
segment implies future audio context relative to at least part of the output;
actual start buffering, block availability, processing and device delay must be
measured separately. Large FPS numbers do not remove lookahead.
**Confidence: high about the distinction; Verona latency unknown.** [P01 Fig. 7,
R03 `infer_diffusion.py:270-375`, D07]

The full-face output is initially tied to a trained identity. The optional
blendshape solve fits a target basis with bounds, regularization and semantic
constraints; it is another transformation that can lose information. Consequently,
the first quality comparison should inspect generated geometry before blaming
or trusting retargeted weights. Tongue supervision also needs qualification:
the paper describes animator-generated tongue data rather than direct tongue
motion capture. **Confidence: high.** [P01 sections 3, 5 and 6]

### The apparent Python CPU escape hatch is not ready-made

`runners/run_inference.py` explicitly raises `NotImplementedError` for regression
inference. Its diffusion branch calls `infer_diffusion.run`. That engine loads
training artifacts onto CUDA, moves input/conditioning to CUDA, and selects
`CUDAExecutionProvider` in the reviewed ONNX streaming branch.
**Confidence: high.** [R03 runner:24-55; engine:67-196,207-227]

The umbrella README's CPU-fallback claim is therefore **not qualified by the
reviewed runnable paths**. This does not prove a future/custom CPU port impossible.
It means we must not tell the owner that official pretrained regression already
runs here by selecting `device="cpu"`. ONNX availability alone is also not a
tested CPU backend; preprocessing, state, operators, postprocess and assets
still need a complete path. **Confidence: high for present evidence; portability
unknown.** [R01-R03, D01-D02]

### UniTalker: shared features, topology-specific reconstruction

`main/demo.py` loads a checkpoint, templates and speaker condition; initializes
`UniTalker`; and explicitly transfers the model, tensors and geometry-conversion
module to CUDA. It loads audio at 16 kHz, divides long inputs into 25-second
pieces with five-second overlap and blends overlapping outputs. BIWI uses 25 FPS;
other demo heads use 30 FPS. This is an offline demonstration, not an established
low-latency streaming API. **Confidence: high.** [R04 `main`,
`split_long_audio`, `merge_out_list`]

The configured base path is:

```text
audio samples
  -> WavLM feature extractor / feature projection / encoder / interpolation
  -> temporal decoder with learned identity embedding
  -> annotation-specific output head
  -> optional PCA reconstruction
  -> neutral template addition
  -> representation-specific vertex conversion
  -> stored animation
```

`UniTalker.forward` chooses the sequence length from audio duration/FPS when no
target motion is supplied. `PCALayer.decode` reconstructs from registered PCA
buffers. Some heads already predict vertices; others predict 51/52 weights or
413 FLAME-related parameters. `UniTalkerLoss.get_vertices` dispatches the conversion.
Thus, "supports multiple topologies" is not "any arbitrary new mesh works with
the checkpoint." A new representation needs appropriate assets/head/training
or retargeting. **Confidence: high.** [R04 `models/wavlm.py`,
`UniTalkerDecoderTCN.forward`, `UniTalker.forward`, `PCALayer.decode`,
`dataset_config`, `UniTalkerLoss.get_vertices`]

The neural components are PyTorch operations, making a bounded CPU adaptation
a reasonable **engineering hypothesis** for offline short lines. But the stock
demo's `.cuda()` calls, asset initialization and external checkpoint format
must be addressed and profiled; no CPU performance or success was observed.
Optional PyTorch3D rendering need not dictate the eventual viewer.
**Confidence: medium for portability hypothesis; high for documented stock
constraints.** [R04 implementation and README]

### FaceFormer: device flag is not CPU qualification

`demo.py:test_model` exposes `args.device` and moves the network, template and
audio there. However, checkpoint loading uses `torch.load` without an explicit
CPU `map_location`, and the demo imports its older rendering dependencies.
`Faceformer.predict` encodes audio then autoregressively decodes frame motion,
adds the neutral template and saves vertices. This is a plausible fallback
experiment, not a verified installation or a streaming model merely because
its output is animated. **Confidence: high for source behavior; CPU feasibility
not established.** [R05 `test_model:21-60`, `predict:137-167`]

### Alignment is not automatically a phone tier

WhisperX's reviewed `align` builds tokens from transcript characters, obtains
CTC emissions, backtracks a trellis, assigns character times and aggregates them
into words. Unalignable words may be interpolated; failed paths retain original
segment timing with warnings. Default output is not an independently measured
IPA/ARPAbet phone timeline. The letters in "thought" are not separate pronounced
phones merely because character timestamps exist.
**Confidence: high.** [R07 `load_align_model:111-147`, `align:194-432`]

For the explicit phone-timing baseline, MFA is a better conceptual fit: existing
audio plus a correct transcript, pronunciation dictionary and acoustic model,
then word/phone alignment exports. Model/dialect choice, unknown words and
transcript errors remain important. Pin an actual release before implementation:
the reviewed latest documentation includes newer commands and future migration
notes, so it is not an immutable executable recipe.
**Confidence: high for documented contract; relative accuracy on Verona inputs
unknown.** [D05]

### Rhubarb: useful speech rules, deliberately coarse output

The CLI calls `animateWaveFile` and exports timed shapes. Selected recognizer code
extracts aligned phones; `mouthAnimation.cpp:animate` builds shape rules, rough
animation, timing optimization, pauses and tweens. `getShapeSets` includes
explicit anticipatory plosive closure, shared sound classes and duration-based
rules. This is more principled than raw amplitude animation, but still six to
nine cartoon shapes, not a generated anatomical full face. Full glue/export
qualification was not performed. **Confidence: high for the reviewed stages.**
[R06]

### HeadAudio: why fast local lip-sync is not enough here

`HeadWorklet.process` forwards mono audio to `Processor.process`. That processor
downsamples, computes MFCC features/deltas, applies VAD and calls
`Classifier.predict`. The classifier computes Mahalanobis distances to Gaussian
prototypes and votes over six predictions. The node's `_onmessage` applies a
default 120 ms minimum hold and `update` ramps weights over a default 100 ms.
This is an actual learned/prototype speech-feature classifier, not just volume.
**Confidence: high.** [R09 implementations]

However, short articulations can be affected by those hold/ramp decisions
(inference, not a measured error rate). The README explicitly warns that VAD and
prediction accuracy are far from optimal, especially at low SNR, and describes
training the supplied model on four synthetic voices. Its suggested 50-100 ms
audio delay is not proof of total timing accuracy after classification/holds.
Do not install this as the final accuracy answer just because it works entirely
in a browser. **Confidence: high for documented caveats; medium for the inferred
short-phone risk.** [R09 README, classifier and node]

### TTS-native timing: a separate, valuable future path

HeadTTS's `LanguageBase.generate` creates phonemes, viseme mappings and index
metadata. `worker-tts.mjs:process` invokes the timestamped model for both
`waveform` and `durations`; `updateTimestamps` converts cumulative token-duration
frames to milliseconds, applies silence shifts and updates word/viseme timing.
This is not uniformly distributing letters over a sentence. Its documented
default timing frame rate is 40 Hz, and the README warns of first-load/memory
cost and slower WASM fallback. **Confidence: high.** [R10]

Azure Speech's synthesized-speech events offer 22 viseme IDs and, for supported
voices/locales, 60 FPS batches of 55 animation values with frame indices. Those
55 values are not automatically an ARKit-52 vector. Similarly, HeadTTS's Oculus
visemes are not the same basis as UniTalker's every 51/52-dimensional head.
Adapters require named schemas, ranges, time units and actual target shapes.
**Confidence: high.** [D04, R04 `dataset_config`, R10 metadata]

TalkingHead's `speakAudio` illustrates a subtle integration risk: without
provided visemes, it derives timing within words; with them, it still constructs
its own overlapping morph envelopes. `playAudio` schedules sound with Web Audio
but offsets animation against an animation clock. Rendering/scheduling is a
separate qualification concern, even when upstream phoneme durations are good.
**Confidence: high.** [R08 `speakAudio:3106-3220`, `playAudio:3227-3305`]

## 3. Integration and dependency investigation

### Actual local feasibility

Read-only hardware inventory reported Ryzen 7 PRO 7840U (8 cores/16 logical
processors), AMD Radeon 780M and approximately 23.7 GiB usable RAM. Free RAM was
approximately 3.4 GiB at the observation, a transient shared-machine snapshot.
No NVIDIA GPU was listed. This is not a CPU benchmark, dedicated-VRAM
measurement, WebGPU capability test or proof of any model's peak memory use.
**Confidence: high for the observed inventory, not inference performance.**

The reviewed SDK requires an NVIDIA CUDA GPU, CUDA >=12.8/<13, TensorRT
>=10.13/<11 and an older supported Python range. The training-framework
README requires Linux/WSL2, Docker and a CUDA GPU; its Python path does not
remove that requirement. Do not install those stacks expecting the Radeon
to become CUDA-compatible. **Confidence: high.** [R02-R03 prerequisites]

Conversely, do not claim that all full-face inference requires NVIDIA hardware.
SG Com documents CPU operation, including example AMD-console measurements,
with Engine/Player separation and 50 ms vendor-reported processing latency.
That is evidence of a commercial CPU route, not a license grant, an independent
quality benchmark or a measured number for this laptop. [D06-D08]

### Code licenses are not model/asset licenses

| Component | Established from reviewed source | What remains to check |
|---|---|---|
| A2F SDK / training code | MIT / Apache-2.0 respectively. | Dependencies and exact distribution contents. |
| A2F face weights | NVIDIA Open Model License; commercial use/derivatives allowed subject to its conditions. | Exact release notices, redistribution and component terms. |
| Audio2Emotion / sample training data | Collection labels them separately: A2F-only use / evaluation-only sample data. | Exact chosen model/data terms; never infer permission from SDK MIT. |
| UniTalker / FaceFormer / CodeTalker code | Apache-2.0 / MIT / MIT. | Externally hosted weights, PCA, neutral meshes, blendshape bases and dataset/model rights. |
| ProbTalk3D main | CC BY-NC 4.0. | Commercial permission if ever needed; separate FLAME/other assets. |
| Rhubarb | MIT plus separate permissive dependency notices. | Ship applicable notices when distributing functionality. |
| HeadAudio / HeadTTS / TalkingHead | MIT code; timestamped Kokoro card declares Apache-2.0. | Exact model/voice/rig releases and transitive notices. |
| SG Com / SGX / FaceFX / Azure | Products/services, not an MIT inference grant. | Acquisition, SDK/service terms, usage costs, privacy and allowed distribution. |

**Confidence: high for the stated source text; this is an engineering permission
checklist, not legal clearance.** [R01-R12 licenses/READMEs, D01-D04,D08,D10]

Do not accept gated terms on the owner's behalf, obtain accounts, buy capacity,
send recordings remotely or redistribute third-party assets merely because a
candidate is promising. No such action occurred during research.

### Proposed minimal architecture

Use a small backend-neutral boundary, not a generic plugin platform:

```text
recorded audio --------------------------> facial-motion backend --+
optional corrected transcript ----------> alignment/audit ---------|
future text -> TTS -> audio + timing -------------------------------+
                                                                  |
                          validated timestamped animation clip <---+
                                      |
                           audio-clocked rig/geometry player
                                      |
                        visible vertices + edges + mouth diagnostics
```

A **Three.js/WebGL viewer with Web Audio playback** is the recommended lightweight
presentation stack, not an adopted dependency yet. TalkingHead is useful API
prior art, but Verona does not need its full-body character behavior, rig
assumptions or TTS service defaults merely to display a mesh. [R08]

For the first neural trial, use a single model's native topology and direct
vertex stream if permitted. This isolates prediction from retargeting errors.
When a named blendshape rig is required, use a rig with suitable mouth targets,
jaw behavior and clearly versioned mappings. Rendering an existing trained
face as points/wireframe does not require photorealistic materials.
These are **proposals**, motivated by P01's identity-specific output/solve.

The clip contract should record:

- Audio identity, sample rate/count, duration and analysis-to-original timing
  mapping. Preserve original leading silence; resampling/trim offsets cannot vanish.
- Model/version, settings, rig/topology/basis identity and coordinate conventions.
- Strictly increasing timestamps in seconds, relative to the original audio.
- Exactly one motion representation initially: named weights with a declared
  valid domain, or vertex frames with immutable connectivity and vertex order.
- Explicit completion/error status. Alignment/interpolation confidence and
  provenance are separate from geometrical validity; no success-shaped fallback.

Do not constrain arbitrary model coefficients to [0,1] without a declared schema:
some pose/latent coordinates are signed. Do not interpolate a discrete viseme
ID numerically as though it were a physical coordinate.

### The maths that the viewer can actually use

For a delta-blendshape rig with neutral vertices `V0` and target offsets `DeltaVi`,
the basic deformation is:

```text
V(t) = V0 + sum_i wi(t) * DeltaVi
```

This is the standard formulation used in A2F's solve discussion, not a
speech-to-motion estimator by itself. Jaw joints, teeth/tongue geometry,
corrective shapes and collision/contact handling need the chosen rig's
actual convention. Applying both a baked jaw displacement and an extra jaw
rotation can double-transform the mouth. [P01 section 6]

For a hand-authored viseme baseline, smooth overlapping influence envelopes
can blend neighboring poses; their onset, peak, release and dominance should
depend on speech/context rather than a fixed sine wave. Lip closure and F/V
contact need explicit constraints. A heavy low-pass filter may hide jitter
while also erasing a brief closure: smoothness alone is not correctness.
These are **design proposals/inferences**, motivated by P01 lip-distance losses
and R06's contextual closure/tween rules, not a claim that arbitrary envelopes
will match a person.

Keep expression controls separate enough that a smile cannot override a required
bilabial closure. This may need region masks or rig-specific corrective rules,
and must be tested rather than asserted. EMOTE's central finding is precisely
that emotion deformation and speech articulation can conflict. [P03]

### One master time domain

At a constant playback rate, a proposed clip lookup is:

```text
t_clip = seek_offset + (t_audio_output - t_scheduled_start) * playback_rate
```

Store rate-change anchors if variable speed is later added. Drive vertex/weight
interpolation from the audio position, not `setInterval` ticks or a count of
rendered frames. Rendering may skip frames; audio must not accumulate corresponding
drift. Seek/restart must reconstruct pose/state, not replay stale callbacks.

Web Audio's output timestamp maps audio context position to an estimated output
device/performance-clock position. Prefer that distinction when aligning the
display, but still measure real output behavior: browser scheduling timestamps
are not a guarantee of speaker acoustics or display presentation. [D11]

Offline clips can precompute motion before playback. Future streaming needs an
explicit bounded prebuffer/lookahead, sequence IDs, cancellation/interruption,
missing-chunk behavior and coordinated audio delay. Keep inference runtime,
lookahead, network time, queue delay and audio/display delay separately visible.
SG Com's engine/player contract provides an instructive reference, not a number
to transplant into another backend. [D07, P01 Fig. 7]

## 4. Tradeoffs and accuracy qualification

### What the published numbers do and do not establish

UniTalker reports benchmark lip-error reductions and broader multi-domain
training in its paper. A2F reports very high output FPS on an RTX 4090, separate
memory figures and a quality suite including a 3D landmark/audio SyncNet,
bilabial closure and expressiveness measures. These are not a controlled
head-to-head comparison, and neither is a local Ryzen/Radeon benchmark.
**Confidence: high.** [P02 abstract/dataset table, P01 section 7]

An especially important implementation detail: UniTalker's
`VerticesLoss.mouth_metric` and `BlendShapeLoss.mouth_metric` compute both
mean maximum **squared** lip-vertex distance and its square-root version.
Numbers labeled "LVE" cannot be compared safely without units, scaling,
mouth mask, topology, alignment and the exact reduction definition.
**Confidence: high.** [R04 `loss/loss.py:166-241`, `dataset_config`]

A2F's paper says expert subjective assessments remain its main quality
evaluation, with automated scores used for sanity/reference. Its bilabial
score checks the minimum lip gap inside estimated phone intervals; this alone
cannot prove the closure happened at the ideal instant or that the whole
utterance is natural. A face held closed can look good to an isolated closure
test while failing every vowel. **Confidence: high for paper definition;
the failure example is a metric-design inference.** [P01 section 7]

Do not use a generic 2D photographic SyncNet score as automatic proof for a
wireframe. A2F's described 3D landmark-based evaluator is a different contract.
LVE also needs compatible registered reference geometry. Forced-aligned phones
are useful audit evidence, not ground-truth observed facial motion.
**Confidence: high about representation/reference requirements.**
[P01 section 7, R04 metric code, R07, D05]

### Proposed qualification corpus

No recording has been provided. The following are proposed test inputs, not
recorded/generated or evaluated clips:

| Case | Example / variation | What to inspect |
|---|---|---|
| Requested greeting | "Hey, how are you?" | Natural timing, rounded-to-open transitions, phrase ending. |
| Bilabial closures | "Maybe Bob packed a map." | P/B/M lip contact, anticipatory closure and release. |
| Labiodentals | "Five very vivid flowers." | Lower-lip/upper-teeth relationship rather than generic jaw movement. |
| Rounding versus spreading | "We see two blue boots." | Distinguishable sustained vowel shapes and transitions. |
| Contextual variation | "See me" versus "Sue me" | Same M with neighboring spread/rounded context. |
| Speed and reductions | Slow/normal/fast versions of the same line. | Coarticulation, short consonants, no minimum-hold swallowing. |
| Silence/noise | Leading/trailing silence, mid-line pause, non-speech sound. | No false speech, preserved timing, explicit unsupported input. |
| Expression controls | Same line neutral/happy/concerned. | Expression distinguishable without losing required articulation. |
| Generalization | More than one voice/accent; intended languages separately. | Avoid tuning the result to one clean synthetic demonstration. |
| Player behavior | Repeated play, pause/resume, seek, end/restart, render stall. | No clock drift, stale events, frozen mouth or state leakage. |

The greeting alone lacks enough contrasting articulations to qualify the
accuracy requirement. Start with it for existence, not completion of quality.
This is a test-design judgment, not a linguistic claim that one model cannot
animate that sentence.

### Separate infrastructure, geometry and perceptual gates

**Clip validity:** finite values, schema-appropriate domains, correct vertex
counts/order/connectivity, monotonic times, audio coverage and explicit offsets.
Reject wrong-rig/wrong-audio combinations. These checks do not prove articulation.

**Geometry:** inspect front and slight oblique/side views, especially closures,
F/V contact, lower lip/jaw motion, lip inversion and penetrations. Normalize gap
measures to declared rig units/scale. Wireframe points can obscure which lip
surface actually contacts; allow a diagnostic surface/contour view without
changing the intended wireframe presentation.

**Timing:** compare annotated visible events and waveform/playhead, not just a
subjective "seems synced." Record median/high-percentile offset, accumulated
drift, missed closures and false closures separately. Proposed engineering aim:
animation sampling within one displayed frame of the selected audio timestamp;
that is an infrastructure aim, **not** a universal perceptual tolerance or
currently achieved end-to-end result.

**Perception:** have the owner review actual clips, including changed voices and
speeds, with side-by-side/hidden-label comparisons where feasible. Report
articulation accuracy separately from pleasant expressiveness. The assistant
must not claim to have heard or visually accepted a clip it has not inspected.

**Reproducibility:** retain the permitted input identity, exact model/assets,
settings, output clip and review notes. For stochastic output, record seeds and
settings so seeking/replay uses the same cached performance.

Do not assign arbitrary 95%/99% "accuracy" or accept solely by a single automated
score. Establish thresholds after a small real-reference pilot and state which
ground truth, representation and error each number measures.

### What cannot be promised

Audio alone does not identify a unique real face trajectory; emotional acting,
head/gaze behavior and some articulators are underdetermined. An audio-driven
model generates a plausible conditioned performance, not a recovered measurement
of the speaker. If the eventual requirement becomes exact personal motion
reproduction, synchronized reference video/3D capture and appropriate permission
would be a different input/qualification requirement. Nothing here activates a
camera or microphone. [P01 limitations, P03]

## 5. Synthesis: the first useful Verona slice

Think of Verona as **a speech-performance generator feeding an audio-clocked
deformable face player**. The renderer makes the points and edges visible; the
model or aligned articulatory rig supplies the motion. The meaningful quality
work lies in those motion/timing contracts, not in making the wireframe prettier.

What this mental model hides is important: each model has its own topology or
coefficient basis; retargeting can break contacts; smoothing can destroy consonants;
and natural expression is neither uniquely recoverable from audio nor safely
added as an unrestricted smile overlay. None of those issues disappears by
calling the output "face mesh."

### Recommended bounded first experiment

1. Resolve the backend route from the executive table: available NVIDIA GPU,
   strictly current-machine CPU research, or licensed commercial CPU SDK.
   Do not acquire infrastructure or accept terms implicitly.
2. Choose one permitted clean prerecorded line and its transcript, initially
   the requested greeting. Analyze offline. For text-only input, explicitly
   synthesize audio through a selected TTS path rather than invent timing.
3. Produce a complete cached motion clip on one permitted native geometry/rig.
   Render connected edges and points; play the actual audio against a shared
   clock. Provide play/pause/restart and frame inspection.
4. Add the short contrasting articulation/silence cases before judging accuracy.
   Retain explicit failures rather than silently switching to amplitude animation.
5. Add a small, explicit expression control and verify it does not break speech.
   Only then consider a backend change, custom retargeting or streaming.

**Non-goals:** chatbot/LLM integration, microphone/camera capture, voice cloning,
photorealistic rendering, virtual camera, production deployment, custom model
training and broad avatar format support. These are proposed slice exclusions,
not permanent product restrictions.

### Decision record and confidence

| Finding / recommendation | Confidence | Meaning |
|---|---|---|
| Audio-driven motion, not camera tracking, is the core task. | High | Direct requirements and input/output contracts. |
| A2F is a strong integrated full-face quality-reference candidate. | High for capability; medium for recommendation | Not a proven universal quality winner or current-machine runtime. |
| Official reviewed A2F inference paths are not a ready AMD/CPU solution. | High | CUDA/TensorRT source, requirements and regression-runner failure. |
| UniTalker-B merits a bounded free/local CPU feasibility spike. | Medium | Source-based portability hypothesis; no inference/permission clearance. |
| SG Com is a real CPU commercial alternative worth considering. | High for documented CPU path; quality unqualified | Vendor contracts/measurements, not local or independent evidence. |
| TTS-native duration/viseme events are valuable for future replies. | High | Traced/documented timing output; not arbitrary-audio analysis. |
| Rhubarb/HeadAudio are controls/fast prototypes, not established accuracy substitutes. | High for representation/caveats | No measured head-to-head ranking. |
| Backend-neutral clips and an audio-output master clock are the right seam. | Medium-high | Architectural recommendation supported by incompatible model/time contracts. |

### Running knowledge map

**Explored:** camera/audio direction distinction; A2F SDK execution boundary and
Python runner; UniTalker model/head/PCA/data flow; FaceFormer prediction;
WhisperX alignment granularity; Rhubarb rules; HeadAudio classification/holds;
HeadTTS duration flow; TalkingHead audio integration; model/license separation;
commercial CPU documentation; accuracy/presentation qualification design.

**Partially explored:** A2F internal executor/postprocess implementation,
Rhubarb audio glue/export, optional research-model branches, commercial rig
setup, exact downloadable neural asset permissions and language coverage.
These gaps are explicit and do not establish runtime readiness.

**Unexplored/not executed:** any model inference; CPU/WebGPU/Radeon acceleration;
user-recording processing; rig creation/import; visual/audio quality review;
local latency/memory benchmark; renderer implementation; live assistant.

**Key surprises:** the umbrella CPU-fallback claim is not supported by the
reviewed NVIDIA execution paths; regression inference is unimplemented in the
Python runner; WhisperX character alignment is not a ready phone tier; two
different reductions can both be reported as lip error; and good TTS timing
can still be distorted downstream by animation envelopes/clocks.

**Open choices:** available compute, local versus optional remote processing,
commercial budget, exact voices/languages/accents and permitted target rig.
Resolve these as actual choices, not invented owner preferences.

Research completion means this evidence and decision framework are available.
It does **not** mean a face has animated, a model is installed, a stack is
adopted, the owner has approved a prototype, or accuracy has been achieved.
