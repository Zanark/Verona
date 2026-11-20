# Female identity: geometry, motion and review gates

Research date: 2026-11-20. Source baseline: `b3c3632`. This is a research and
sculpt-study contract, **not an implemented Gender selector or accepted female
model**. Confidence below applies to the stated evidence, not visual quality.

## Current decision after owner review

Latest direction (vr-44): the owner explicitly resumes the actual MPFB model
and requests the reverse transfer of Claire's speech/expressions/fluidity.
`VeronaMpfb.cmd` now drives the original native topology with real4x source
trajectories and bounded51-control native fitting. Raw nearest-surface output
tore lips; extrapolated native weights folded brows. Both failures are retained.
The final0..1 rig bounds preserve coherent native shapes at the expense of
unsupported Claire detail. This is not a lossless expression copy, authored
emotion recipes, identity approval or production Gender integration.
Actual eleven-state GIF/sound report:
`.local\qualification\mpfb-speaking-06\review.html`.
[Mechanism and limits](../chapters/09-verona-character-and-waves.md#reverse-transfer-onto-the-actual-mpfb-head-vr-44).

Previous correction (vr-43): the owner sees no meaningful difference in vr-42.
Replace its conservative front-shell approach, not the owner's judgment, with
whole-head section correspondence plus actual reference-triangle surface
registration. `claire_structural_fit.py:fit_model` supplies the new complete-pose
map; `claire_surface_fit.py:refine_surface` samples its facial residual into a
generation-time lattice. Speech, all original points and4x inputs remain.
The new report is `.local\qualification\claire-structure-07\review.html`;
neither this candidate nor the separate MPFB head has identity/contact approval.
[Mechanism and evidence](../chapters/09-verona-character-and-waves.md#whole-head-structural-refit-after-visual-rejection-vr-43).

Previous direction (vr-42): the owner prefers Claire's expressions, observes that
the native MPFB report does not speak, and asks to use its head as a structural
reference for **Claire with 4x emotions**. Preserve both existing candidates.
`scripts/claire_reference_study.py` fits a bounded smooth complete-pose map
over Claire's original topology/inference; it does not pretend the MPFB pose
recipes are a learned speech system. [Mechanism and limits](../chapters/09-verona-character-and-waves.md#reference-shaped-claire-with-its-own-neural-speech-vr-42).

Earlier, the owner rejects the same-topology candidate as female, preserves it as
**Male-SharpJawline**, and explicitly authorizes trying the recorded MPFB
implementation, with the completed report opened directly in Edge. This
supersedes the original no-download gate below for the bounded local study.
The maintained helper is now `scripts/male_sharp_jawline.py`; old qualification
artifacts/source pin retain their original names and contents.

The distinct candidate is now authored using pinned portable Blender4.5.16
and MPFB2.0.18 plus rights-inspected native faceunits01, outside production.
See [chapter09's mechanism and limits](../chapters/09-verona-character-and-waves.md#owner-review-male-sharpjawline-then-a-different-mpfb-head).
Local report: `.local\qualification\mpfb-head-03\review.html`.
It shows actual new geometry and explicitly authored native-control pose GIFs,
**not** transferred Claire speech/emotion clips. Neither the production
Gender/voice selector nor semantic/contact/phonetic accuracy is accepted.

## Original decision after research - superseded after review

The owner chooses **existing assets/tools only, a limited same-topology sculpt
investigation first**. Keep the current app unchanged for comparison. Record a
distinct MakeHuman/MPFB-authored female head as a later TODO **after review**;
this is not permission to download/install that toolset or its assets now.
The old Meshy/Realistic candidate and vr-16..19 remain parked.

The eventual requested Gender control has Male/Female choices. Everything
currently implemented belongs under Male, with a male default voice and optional
override. Female must have visibly distinct geometry and its own appropriate
default voice, also overridable. These are authored character profiles, not an
anatomical classifier or an assertion about real people's gender.

## Iteration 1 - Separate identity from presentation

**HIGH:** `FaceEngine.__init__` (`verona/engine.py:68-91`) loads pinned Claire
skin/PCA data, selects 15,375 original indices and calls `verona_rest_shape`.
`verona/appearance.py:11-34` changes rest coordinates through spatial masks;
it does not train a new identity. Calling the old appearance Male must not
change the actual model provenance reported as Claire v2.3.1.

**HIGH:** `frontFaceTopology` (`verona/web/presentations.mjs:26-118`) selects
the front surface, contracts connected native edges at lower detail and returns
all unique triangle edges. Native detail still displays triangulation
diagonals. `native_control_mesh`/`claire_topology` (`verona/mesh.py`) retain
native control connectivity separately. UniformPolygons is a fragment pattern,
not quad retopology.

**MEDIUM, visual interpretation:** the supplied examples emphasize an oval
silhouette, tapered lower face, less square chin, refined nose/lips and facial
edge loops. They are artistic direction, not calibrated dimensions, licensed
meshes or proof of a deformation rig. Quad-style lines may improve the intended
look, but cannot substitute for changed geometry. No universal female facial
ratio follows from these examples.

Next: trace how those coordinates become speech and where identity changes
could invalidate the existing motion.

## Iteration 2 - Motion and contact are separate evidence

**HIGH:** `expression_condition` and `FaceEngine.generate`
(`verona/engine.py:38-49,159-218`) keep 16 implicit conditioning values, set
one of ten explicit channels and reconstruct skin positions from 140 PCA
coefficients. The expressive path uses identical audio windows for
`N + gain * (E - N)`, with gain 2 or 4. Neutral has no amplified difference.
It is learned speech/emotion interaction, not ten independent anatomical masks.

**HIGH:** `_predict` (`verona/engine.py:147-157`) validates 169 outputs but
returns only the first 140 skin values. Independent tongue, jaw-anchor and eye
outputs are not consumed. Static eyes come from `claire_eyes`
(`verona/appearance.py:37-61`). Existing metadata explicitly omits SDK
skin/contact/smoothing and independent teeth/tongue/eye joints.

**HIGH:** replacing only the rest shape computes `S(rest) + B*c(t)`, not
`S(rest + B*c(t))`. That is the existing styling mechanism, not a general
deformation transfer. A changed lip rest gap can remain changed through a
learned closure; relocated eyelids can disagree with static eyeballs.
Conversely, an identical smooth spatial map applied to each complete animated
pose preserves equality of coincident points. Discretized triangles,
quantization and interpolation still require checks; this is not a collision
guarantee.

**HIGH:** the pinned [Claire network metadata][F01] names amazement, anger,
cheekiness, disgust, fear, grief, joy, outofbreath, pain and sadness. Preserving
these inputs is feasible; preserving their perceived meaning on a changed face
is a different acceptance gate. The existing all-ten GIFs and numerical tests
are not a complete human-emotion taxonomy or a guarantee of accuracy.

Next: distinguish a usable authoring asset from a drop-in neural model.

## Iteration 3 - Candidate and license contracts

| Route | Verified primary-source capability | Coupling and disposition |
|---|---|---|
| Current Claire + authored same-topology study | Existing pinned geometry, PCA, CPU inference and ten emotion inputs; no download needed [F01,F02] | Selected first by owner. A new sculpt, not a new trained model; must earn visual approval. |
| MakeHuman/MPFB head | Parametric character/nose/brow controls, targets as vertex displacements, rig/shape-key workflows [F03-F06] | Recommended distinct-identity follow-up. Different topology requires registration and transfer; no indexed Claire-delta assignment. |
| MPFB faceunits01/visemes02 | ARKit-style units and 15 Meta/Oculus-style visemes, separate asset packs [F07,F08] | Useful authoring/corrective targets, **not** a ten-emotion Claire adapter. Exact archive contents/licenses have not been inspected. |
| FLAME | Learned identity space, jaw/neck/eyeballs, expressions and pose correctives; gendered viewer/add-on options [F09,F10] | Credible alternative, but new topology/parameter semantics and fitting work. Not selected. |
| Blender Surface Deform | Binds another surface's motion; target validity constraints and distance-related artifacts are documented [F11] | Authoring experiment, not automatic facial contact or expression correctness. |
| Blender Mesh Deform | Closed cage deformation, potentially expensive binding and memory use [F12] | Possible coarse identity authoring; not a new per-frame runtime dependency. |
| Deformation-gradient transfer | Marker-guided correspondences, different connectivity, prefactored linear solve [F13] | Sound offline-transfer basis; implementation, solver licensing and local quality/performance remain unqualified. |
| Retrain a speech network | NVIDIA supplies a separate training framework [F02] | Not necessary just to change a character head; no suitable new performance dataset, training run or AMD qualification established. |

**HIGH, license distinction:** the community license page [F04] says core
MakeHuman/MPFB assets are CC0; MPFB code is GPL and MakeHuman code AGPL.
Exported character geometry and authoring-tool code are different deliverables.
Do not assume arbitrary community packs or an uninspected archive have the core
license. Export provenance, included rights files and exact versions/hashes
must be recorded before future use or redistribution.

**HIGH, important correction:** FLAME is not simply "noncommercial only."
Its official license page [F10] distinguishes older academic models from
**FLAME 2023 Open**, with CC BY 4.0 attribution/change-notice terms and additional
published usage wording. The add-on README broadly says CC BY, while that
license page explicitly lists the FLAME 2020 add-on in the academic scope.
Do not resolve this by guessing: establish the exact downloaded version,
included license and applicability before use. The download-page request
redirected to login. No account, acceptance or download was performed.

**HIGH:** MPFB's lip-sync guide [F06] uses a separate third-party Lip Sync
extension. It even documents Blender 5.x compatibility caveats. That extension
is unnecessary if Verona retains its current speech estimator. Fifteen visemes,
ARKit face units, FLAME expression coefficients and ten Claire emotion inputs
are not interchangeable arrays.

**HIGH:** the pinned SDK guide [F14] describes a **CPU blendshape solve**
downstream of geometry, but its inference/executor architecture is CUDA/
TensorRT-oriented. The umbrella repository's CPU-fallback prose [F02] is not
proof that the full SDK is usable here. Verona's own existing ONNX CPU path
is the qualified route, not a claim of SDK parity.

Next: turn these integration boundaries into a low-latency, failure-explicit
profile design rather than a cosmetic selector.

## Iteration 4 - Integration design and failure modes

The following is **proposed, not implemented**.

**HIGH, current coupling:** `State`/`Handler.do_GET`/`Handler.do_POST`
(`verona/server.py:39-52,154-178,249-280`) hold one engine and latest RAM
clip/sample. Speech cache identity includes text, voice and voice settings;
clip identity adds expression/strength/gain, but no character identity.
`FaceRenderer.setDetail` (`verona/web/app.js:566-590`) derives front topology
from the rest geometry. Eye centers and material masks are Claire-coordinate
constants (`app.js:162,223,277,299`); hair and crop masks also need review if
eyes/head coordinates change.

**HIGH, current voice coupling:** both `speech.SCRIPT`
(`verona/speech.py:36-42`) and `agent_speech.WORKER_SCRIPT`
(`verona/agent_speech.py:25-33`) enumerate name/culture but omit VoiceInfo.Gender.
`preferred_voice` currently selects Hazel. `Handler.do_GET`, UI startup/reset
(`app.js:1152-1158,1402-1420`) and `AgentBridge.command`
(`agent_host.py:91-112`) all depend on that default. The ordinary and warm
speech paths must change together. Microsoft documents actual voice-gender
metadata [F15]; do not infer it from names or pitch.

**HIGH, local enumeration only:** David Desktop reports Male and Hazel Desktop
Female in a fresh System.Speech enumeration. No synthesis/playback/listening
experiment is inferred from that read. These can be initial profile defaults;
other machines must re-enumerate. A missing matching voice needs a visible
choice/error, not silent cross-profile substitution or an automatic download.

Design:

1. Keep the current geometry/views/materials/robot under Male, byte-preserving
   their existing rendering/motion. Keep truthful Claire source provenance.
2. Female is a separately versioned accepted sculpt/asset and deformation map,
   not a hairstyle, label or pitch switch. Qualify it without hair/cosmetics.
3. Keep identity independent of presentation. Preserve all old view settings.
   Do not generate a differently gendered robot or modify its armor implicitly.
4. Include identity/sculpt/transfer version in motion cache identity and clip
   metadata. Speech-only cache can reuse identical voice/settings/waveform.
   Same-sized meshes are not enough to validate a clip's identity.
5. Disable profile switching during preparation/agent playback; no extra queue
   or mid-utterance voice replacement. A deliberate idle profile change clears
   incompatible clip/preview state and rebuilds only required resources.
6. Store user voice overrides per profile in RAM, with explicit reset to that
   profile default. A voice override must not change geometry selection.
7. Carry explicit profile selection through agent CLI, fingerprint, push
   message and acknowledgements; preserve current request-ID/no-replay rules.
   Voice-only respects the selected voice profile without neural face work.
8. Bake any fixed transfer offline where feasible. For a fixed linear map A,
   precompute transformed mean and `A*B`; do not run registration, nearest
   neighbors or Blender per animation frame. A nonlinear map cannot simply
   be called a linear basis transfer; qualify its runtime or baked approximation.
9. Keep missing/corrupt assets, bounds failures, cancellation, stale requests,
   WebGL loss and shutdown explicit. No female-to-male fallback disguised as
   success. Restart clears RAM choices/speech; no automatic asset fetch.

**MEDIUM, engineering recommendation:** use a feature-gated study first,
neutral approval second, speech/all-ten transfer third, selector integration
last. This limits wasted integration when the owner rejects the base identity.
It also protects the stable app while the reference interpretation changes.

Next: define what evidence would justify proceeding and what it cannot prove.

## Iteration 5 - Synthesis and review contract

Think of the system as **voice -> speech motion -> character geometry ->
presentation**. A new female identity changes the third part, not necessarily
the neural speech model. Fast playback comes from keeping expensive authoring/
registration outside the audio-clocked renderer.

What that hides: correspondence, lip/eyelid contacts, eye placement and large
expression extrapolation can all fail even when there are ten working sliders.
Naming a character Female does not establish that the owner reads the shape
that way; numerical topology checks do not replace their review.

1. **HIGH:** preserve existing Male appearance and truthful Claire provenance;
   investigate actual coordinates, not only hair or lines (engine/appearance).
2. **HIGH:** qualify neutral front, both profiles and three-quarter views at
   matched scale, hair off, same lighting/edges. Reject a study the owner does
   not find suitably feminine; do not relabel an unapproved mesh as accurate.
3. **HIGH:** include neutral plus all ten single emotion controls, typical/max
   strength and both 2x/4x settings in eventual motion qualification. Inspect
   speech closures/rounding/F-V, jaw extremes and eyelid/eye intersection.
   Distinct hashes and finite vertices establish only technical behavior.
4. **HIGH:** compare same audio/conditions/times, retain failure receipts,
   measure coordinate bounds/nondegeneracy and actual browser appearance.
   Keep identity/proportion comparisons separate from quad-wire styling.
5. **MEDIUM:** a smooth same-topology pose map is the lowest-dependency study
   worth trying now. It cannot provide missing anatomy, facial loops or
   independent teeth/tongue controls. If rejected, progress to the recorded
   distinct MPFB head only after review/authorization.
6. **HIGH:** no new "all emotions accurate/complete" or universal frame-rate
   claim follows from this research. Independent human/phonetic acceptance
   remains open, including on the preserved Male baseline.

### Running knowledge map

**Explored:** current rest/PCA/eye/presentation path; normal/warm voice defaults;
cache/agent coupling; MPFB target/rig/viseme documentation; exact FLAME license
distinction; Blender transfer caveats; fixed-transfer performance design.

**Partially explored:** same-topology sculpt appearance/contact envelope (bounded
local study completed below, owner/contact acceptance open); distinct asset
licensing (core policy read, packs uninspected);
native SDK fitting implementation (guide read, not integrated/benchmarked).

**Unexplored:** any downloaded MPFB/FLAME package; new-head registration and
correctives; local Blender binding; new neural training; independent audition/
phonetic scoring; owner acceptance of any new shape.

**Open decisions:** accept/revise/reject the existing-assets study; whether to
authorize the separate MPFB experiment after review. No hidden download/install
or resumption of the parked static avatar follows.

## Existing-assets study - implemented, not accepted

`sculpt_positions` (`scripts/male_sharp_jawline.py`, originally
`female_sculpt_study.py`) is an offline helper,
not imported by the application. Study revision `lower-face-study-1` maps
complete poses with `x' = s(y)*x`, `y' = y + lift(y)` and
`z' = z + h(x,y)`. It tapers the lower jaw/chin and shifts cheek/nose/lip
planes. Smooth masks vanish exactly above y=146cm, leaving the upper face,
static eye geometry and hair unchanged. A finite Float32-bounds error is
explicit; inputs are not modified.

The map uses the original face's vertex IDs, triangles and speech motion.
It is **not** a new trained female identity, a facial landmark classifier,
deformation-gradient fitting or independent muscle/viseme solving. It cannot
replace missing upper-face proportions or the reference images' authored quad
loops. Preserving static eyes also deliberately limits eye-size/placement and
brow changes. Qualitative agent review: the lower face visibly tapers, but
the result still strongly resembles the current character. This is not a
convincing distinct female identity claim or a recommendation to ship it as one.

The isolated comparison uses the unchanged production renderer, hidden/muted
sandboxed Electron, separate profile/capability/RAM/cache/synthesis and one
latest clip. Test-only server instrumentation exposes a renderer reference,
allowing exact baseline front topology and camera fit to be pinned; no
application source or production defaults are changed. Follow/pin are off.
Cancellation/shutdown uses the existing stop event and exact owned process;
profiles and server are removed/stopped in `finally`. Failure receipts stay.
Restart starts from existing defaults, not a secretly installed female option.

Initial run `female-sculpt-01` generated neutral plus all ten controls with
identical source audio/motions, 913 frames per variant at max emotion strength
0.6/4x (neutral retains its normal gain). Rest offset max0.9634cm, animated
max0.9891cm. All positions packed finitely; 28,071,089 valid source triangle/
frame comparisons found no new float-space collapse or reversal of normal
hemisphere under the map. These are bounded diagnostics, **not** proof of
contact, self-intersection safety, post-quantization triangle validity,
phonetic correctness, expression meaning or real-time performance.

Agent review caught that identical UI camera values still allowed per-mesh
auto-fit/recentering, moving unchanged eyes on screen. Run01 is retained but
superseded for exact proportion comparisons; final matched-fit recapture
must pin baseline fit **and** front topology, not merely set the same zoom.
Its first encoding invocation also found the existing System.Drawing helper
needs installed Windows PowerShell5.1, not PowerShell7's assembly references;
no dependency was installed. Both limitations are recorded rather than hidden.

Final `.local\qualification\female-sculpt-02\review.html` contains the exact
baseline-fit/topology recapture: front, both three-quarter and +/-90-degree
rest views, a paired 30.25-second overview and eleven individually collapsed
single-emotion GIF slices. The 363-frame1280x736 overview is29,121,889bytes,
SHA256 `5f27fe4768f6a76230106a8e8f6acbff538ccf9b2b3aca713102e8acba9727bd`.
Independent decoding checks every frame's size/delay and every pixel's
thresholded alpha: 277unique frames, zero ghost pixels. Agent inspected the
final rest front/profile/three-quarter and one decoded sample of each state on
light/dark backgrounds, not every frame or independent listening.
Capture02 rechecks all22clips/913frames per variant, original audio/motion
hash equality, finite packing and float-space geometry diagnostics. Original
run01 remains available with its explicit camera-review limitation. Captured
speech stays in RAM; no audio/transcript file or model copy is retained.

The three focused mapping tests and full53-case Python suite pass. This does
not add Gender controls, change either speech worker's metadata/defaults,
modify the current README gallery, train a model or authorize MPFB downloads.
Owner review determines whether to revise/reject the study or authorize the
separately recorded distinct-head experiment.

## Primary sources and access limits

All external items below were read as documentation, not executed or installed.
Pinned NVIDIA sources retain the existing approved revisions. Other web pages
are dated research references, not immutable downloaded-asset receipts.

| ID | Source and reviewed evidence |
|---|---|
| F01 | [Claire network_info.json][F01]: exact ten channels, 140/10 skin/tongue PCA sizes, 15 jaw/4 eye outputs, 16 kHz audio. |
| F02 | [Audio2Face collection][F02]: separate model, training, SDK and plugin roles/licenses; umbrella CPU prose not implementation proof. |
| F03 | [MPFB getting started][F03]: Blender >=4.2, standalone from MakeHuman, authoring controls, separate system assets. |
| F04 | [MakeHuman/MPFB license][F04]: core asset CC0 versus GPL/AGPL code. Not a legal opinion or uninspected-pack clearance. |
| F05 | [Targets and blendshapes][F05]: vertex displacements, shape keys and composite phenotype controls. |
| F06 | [MPFB lip sync][F06]: separate extension, required viseme pack, 15 shapes, faceunits loading and compatibility caveat. |
| F07 | [Faceunits01][F07]: contributed ARKit-style targets; archive not fetched. |
| F08 | [Visemes02][F08]: contributed Meta/Oculus-style targets; archive not fetched. |
| F09 | [FLAME project][F09]: learned identity/expression/articulation, gendered viewer and 2023 Open release distinction. |
| F10 | [FLAME license][F10]: separate academic and 2023 Open terms; reconcile exact add-on/model version before use. |
| F11 | [Surface Deform][F11]: binding constraints, interpolation and distance artifacts. |
| F12 | [Mesh Deform][F12]: closed cage, expensive binding/memory and deformation artifacts. |
| F13 | [Sumner/Popovic 2004][F13]: correspondence and deformation-gradient solve; not a ready licensed Verona implementation. |
| F14 | [Pinned SDK guide][F14]: geometry/PCA, separate postprocessing and CPU versus GPU blendshape solving. |
| F15 | [VoiceInfo.Gender][F15]: actual installed-voice metadata. |
| F16 | [Blender shape keys][F16]: relative/absolute keys, facial usage and extrapolation. |
| F17 | [MPFB rig selection][F17]: body rig choices do not establish facial emotion coverage. |
| F18 | [MPFB proxies][F18]: alternate topology/refitting and asset-specific dependencies. |

Two guessed MPFB documentation URLs returned 404; the real documentation index
resolved F06/F17. Old Omniverse character-transfer/blendshape URLs redirected to
generic ACE marketing: not treated as transfer instructions or AMD evidence.
FLAME add-on README and official license wording differ in scope as explained
above. No search-result snippet alone is used to establish a candidate's license.

[F01]: https://huggingface.co/nvidia/Audio2Face-3D-v2.3.1-Claire/blob/a46eafb067adfdd7cc8f5c7941586b309004561c/network_info.json
[F02]: https://github.com/NVIDIA/Audio2Face-3D/blob/4d61b6b81ad7b5108512ea0eab10d8712ea4a236/README.md
[F03]: https://static.makehumancommunity.org/mpfb/docs/getting_started.html
[F04]: https://static.makehumancommunity.org/about/license.html
[F05]: https://static.makehumancommunity.org/mpfb/docs/assets/concept_targets.html
[F06]: https://static.makehumancommunity.org/mpfb/docs/lipsync.html
[F07]: https://static.makehumancommunity.org/assets/assetpacks/faceunits01.html
[F08]: https://static.makehumancommunity.org/assets/assetpacks/visemes02.html
[F09]: https://flame.is.tue.mpg.de/
[F10]: https://flame.is.tue.mpg.de/modellicense.html
[F11]: https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html
[F12]: https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/mesh_deform.html
[F13]: https://people.csail.mit.edu/sumner/research/deftransfer/
[F14]: https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/1ca0f02535ed774f5dbcd724a31cd486368dc783/docs/README.md
[F15]: https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.voiceinfo.gender?view=netframework-4.8.1
[F16]: https://docs.blender.org/manual/en/latest/animation/shape_keys/introduction.html
[F17]: https://static.makehumancommunity.org/mpfb/docs/characters/rig.html
[F18]: https://static.makehumancommunity.org/mpfb/docs/assets/concept_proxymeshes.html
