# Idle life: varied gestures, not another intelligence (vr-71)

Research and design recorded 2026-11-21. This is an authored synthesis, not
motion capture, a clinical model, FACS certification or human acceptance.
The owner's requirement is fifteen distinct occasional actions, including a
sneeze, chosen by Verona itself only while otherwise idle.

## 1. Behavioral evidence and its boundary

Lee, Badler and Badler's **Eyes Alive** (SIGGRAPH 2002,
[original paper](https://dl.acm.org/doi/10.1145/566570.566629))
compares stationary, unconstrained random and statistically modeled eye
movements. The indexed original-paper text reports that random eye motion
looked unstable, while the modeled version appeared more natural. This is
evidence against randomizing every frame, not validation of Verona's timing.
The paper concerns gaze, not a measured distribution of sneezes or yawns.

Gonzales, Kalamkar, Joerg and Grubert's **Behavioral and Symbolic Fillers**
(2025, [full author version](https://arxiv.org/html/2508.11781v1), sections1-2)
studies24 people in a VR interview task. Behavioral fillers improved several
perception measures; the authors also warn about irritating repetition and
used nine different animations. Their condition combined gestures and a vocal
filler. It does **not** show that any silent idle action improves naturalness,
that fifteen is optimal, or that its response-delay setting transfers here.
Verona deliberately does not pretend an idle animation means it is thinking.

The [Paul Ekman Group's public FACS introduction](https://www.paulekman.com/facial-action-coding-system/)
describes visible movements as components and explicitly distinguishes coding
from interpreting emotion. This supports separating brows, lips, cheeks and
head pose. We do not reproduce the paid manual, claim certified action units,
infer feelings, or label a geometric field an anatomical muscle simulation.

USC ICT's [SmartBody](https://smartbody.ict.usc.edu/) demonstrates the
architectural separation between behavior descriptions and real-time
realization across gaze, speech and nonverbal channels. It is prior art, not a
dependency or code source. A large C++ behavior engine is unnecessary for
fifteen fixed, interruptible gestures in Verona's existing WebGL renderer.

## 2. Timing and ownership

[MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
documents one-shot callbacks and elapsed-time animation. The
[W3C cooperative scheduling guidance](https://w3c.github.io/requestidlecallback/)
specifically discourages callbacks that keep firing without useful work.
Consequently one local timeout starts an action, the existing RAF draws only
its finite motion, then rendering sleeps again. `requestIdleCallback` is not
an animation clock and is not introduced.

[Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
documents visibility events and background timer throttling. Cancel on hide;
do not accumulate overdue actions or infer invisibility from keyboard focus.
[Reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
identifies nonessential animation as something users may need removed.
Default idle life off for that preference, permit an explicit per-head choice,
and keep natural blinking independently controllable.

Selected design: a fresh12-28second wait after each action or interruption,
weighted local choice excluding the last four actions, and longer cooldowns
for conspicuous sneeze/yawn gestures. These numbers are authored product
defaults, **not measured human frequencies**. Selection uses browser randomness,
not an LLM, server call, audio analysis, prompt or session-side scheduler.

## 3. Fifteen deliberately different actions

| Action | Identifying motion, not an emotion diagnosis |
|---|---|
| Soft smile | Both mouth corners lift, settle and release |
| Crooked smirk | One corner pulls; small glance in eyes-only mode |
| Curious brow | One eyebrow lifts independently |
| Brow furrow | Inner brows lower and draw inward |
| Nose scrunch | Nose/upper-lip area lifts and compresses |
| Lip press | Upper/lower lip region compresses toward its center |
| Lip purse | Mouth narrows and projects forward |
| Cheek puff | Both cheek regions expand outward/forward |
| Jaw loosen | Lower face shifts gently side to side |
| Silent yawn | Slow lower-face opening, narrowed eyes and upward tilt |
| Silent sneeze | Anticipation, eye closure, short forward dip and recovery |
| Look around | Left/right head scan; eye-leading in eyes-only mode |
| Double nod | Two diminishing pitch pulses |
| Neck stretch | Slow side roll, hold, opposite side and return |
| Eye squeeze | Deliberate sustained lid/cheek squeeze, unlike a brief blink |

These are fifteen different spatial/temporal composites, not fifteen random
speeds of one animation. Mirroring some actions supplies variation without
inflating the count. The sneeze/yawn are silent **stylized cues**: no respiratory
simulation, sound synthesis, teeth, tongue, saliva, contact rig or diagnostic
meaning. Cosmetic fields cannot promise believable anatomy for every pose.

## 4. Fit to the actual renderer

`verona/web/app.js:FaceRenderer.draw` already owns speech frames, calibrated
eye/mouth anchors, rigid tracking and the only RAF. `blinking.mjs` already owns
an autonomous cancellable blink clock. Reuse these boundaries: bounded
model-aware vertex offsets on skin, existing eyelid closure, and a small rigid
pose on the complete selected head. Keep speech inference and audio unchanged.

Facial fields add arithmetic while a gesture is active; a uniform-zero branch
skips them otherwise. Rigid transforms include eyes and selected hair.
No new weights, adapter, topology, animated-normal storage, neural request,
voice sample, clip cache or per-frame full-mesh traversal is justified.
Normals remain cosmetic approximations, as with existing cheekiness/blinking.

Speech generation/agent lock, face or preview playback, seeking, paused clip
inspection and direct input take priority. User control events cancel rather
than blending an unwanted gesture into speech. Passive cursor following is
not itself perpetual interaction: the head can still follow while idle, and
Head mode keeps its irises centered. Reload forgets unsaved choices; there is
no scheduler process or persisted activity history.

## 5. Qualification plan and remaining uncertainty

Deterministic tests must establish all fifteen reachable distinct trajectories,
zero endpoints, bounds, no recent repeats, cooldowns, cancellation, stale-frame
handling and one waiting timer without a RAF. Actual native/browser rendering
must establish visible motion on all six models/four views, resource stability,
speech preemption and no animation-originated network/inference.

Inspect compact actual-render contact sheets rather than claiming numerical
differences prove recognizable gestures. Measure waiting and active rendering
separately on this shared machine. No scientific naturalness, independent
listening, respiratory accuracy, universal frame-rate or owner approval follows
from these checks. Implementation/results are recorded separately in
[chapter11](../chapters/11-autonomous-idle-life.md), including final six-model
qualification and the unchanged-neutral wireframe readback variation.
