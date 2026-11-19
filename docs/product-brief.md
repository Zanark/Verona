# Verona product brief

**Status: first text-input prototype implemented and functionally qualified.**
The requirements below summarize the owner's November 18 description. Technology
choices are distinguished below from unqualified perceptual accuracy.
The subsequent vr-08 feedback adds measurable caching/performance work, editable
Hazel as default, and the matching Claire female head with procedural hair.
The owner's November 19 visual feedback adds recognizable shaded features and
native contours, with a 60-fps display target prioritized over polygon count.
Static cosmetic eyes are not independent eye-joint animation.
Later November 19 feedback requests an independently designed attractive adult
office-glam character and genuinely wavy hair, without new reference images.
Chapter 09 adds bounded rest-surface styling, warm shaded materials and layered
waves over the same learned Claire motion; attractiveness remains subjective.
The owner rejected that first sculpt and the solid default: restore their
referenced cool, transparent-looking polygon view as DEFAULT, keep shading an
option, and revise actual facial structure rather than only cosmetics.
The subsequent desktop request adds a genuinely transparent head overlay over
other apps, cursor-following eyes and arbitrary X/Y/Z orientation. Chapter 10
uses an optional local Electron shell around the same renderer/audio session;
this is not camera tracking, an assistant or learned eye-joint animation.

## Confirmed

- Project name: Verona.
- A new application, not a recreation of KardboardCode-VTuber.
- Input is initially one prerecorded spoken line, for example "Hey, how are you?"
  Text-to-speech is also relevant to the longer-term text/assistant scenario.
- Output is an animated face made visibly of connected vertices/points/edges.
  A graphical window is sufficient; a terminal interface is not required.
- Lips, jaw and facial motion should articulate the actual speech in sync, with
  support for facial expressions. This is audio-driven animation, not camera
  tracking, a cardboard avatar or simply opening a mouth with audio volume.
- Prototype priority is accurate articulation and existence, not visual polish.
- Longer-term direction is a conversational personal assistant: user speaks,
  assistant replies with generated voice, and its face animates with that voice.
- The current task explicitly requires extensive deep research BEFORE
  implementation. Consequential compute/service/license choices must be
  resolved without assuming paid capacity, remote uploads or license acceptance.
- Development uses numbered workstreams, evidence, GitHub tracking and a living
  engineering book.
- Authorized GitHub operations use only the Zanark PAT runner.

## Research questions

1. Which models or phoneme/viseme pipelines best fit speech articulation,
   coarticulation, expressions and a wireframe output?
2. Which run on the actual machine, and which require NVIDIA hardware or remote
   inference? What do licenses permit for code, weights, rigs and datasets?
3. How should phonetic timing, speech sound shapes and visible geometry be
   evaluated separately instead of accepting a plausible-looking animation?
4. How can one prerecorded-file prototype preserve a clean path toward streaming
   generated speech without implementing the assistant now?
5. What can and cannot be inferred about expressions and physical facial motion
   from audio alone? Which choices need explicit user control?

## First useful slice and exclusions

The immediate audience is the owner evaluating a local Windows prototype.
Input is now plain text, output is installed-voice speech plus connected native-
derived face geometry. Python/NumPy/ONNX Runtime run the pinned Claire v2.3.1 model on CPU;
standard-library HTTP serves an offline WebGL2/audio player on loopback.
There is no remote-service option in this slice.

The target is installed English desktop voices, at most 280 characters and
25 seconds of padded speech. Exact language/accent coverage, perceptual accuracy
thresholds and streaming latency targets are still undecided. No supplied
personal recording, microphone capture, assistant reasoning, voice cloning,
installer, background service or deployment is included.

Functional acceptance: enter a sentence, generate complete local speech/motion,
play/pause/restart/seek on one audio timeline, change explicit expressions and
recover visibly from errors. Reject oversized/unsupported input without silent
truncation or stale new-text playback. Protect the shared machine and preserve
the local-only resource/privacy contract.

## Research handoff

[Chapter 04](chapters/04-speech-driven-face-research.md) and its
[pinned sources](research/speech-face-sources.md) contain the investigation.
The proposed first slice is offline generation for one permitted prerecorded
line, cached native-geometry animation, wireframe playback and articulation
diagnostics. Add contrasting P/B/M, F/V, vowel and silence cases before accepting
accuracy; the greeting alone is an existence demonstration.

The owner selected **free and local on this AMD machine** after the research
handoff. No paid SDK, cloud inference or private audio upload is part of the
prototype route. The subsequent CPU experiment and text-player qualification
provide evidence for the selected custom Mark path, not official SDK CPU support.

Workstream vr-06 first investigates the public A2F Mark ONNX network/PCA assets
as a custom CPU path, not official SDK support. UniTalker remains an alternative.
The [CPU experiment](chapters/05-local-cpu-feasibility.md) first verified numerical
Mark inference and skin reconstruction on this machine. It uses synthetic
non-speech input; its historical result is not speech/playback qualification.
[Chapter 06](chapters/06-text-to-face-prototype.md) advances to actual speech,
visible connected geometry and muted real-browser playback.
[Chapter 07](chapters/07-hazel-claire-and-performance.md) records the current
Claire identity, bounded voice editing and measured speed/quality tradeoffs.
[Chapter 08](chapters/08-facial-definition-and-fluidity.md) supersedes its
presentation reduction with native quad contours, shaded features and measured
normal/2x-density display cadence.
[Chapter 09](chapters/09-verona-character-and-waves.md) advances the original
character design and hairstyle, with shaded/native-edge cadence measured at
both densities. This changes presentation defaults, not the speech/runtime scope.

## Text-first prototype mandate

The owner now requests a runnable prototype from a **given text input string**,
to be developed autonomously while they are away. This narrows the immediate
input to local text-to-speech; recording import and the assistant remain later
slices. Keep components local and small, retain numbered TODOs and book chapters,
and commit/push coherent verified milestones. Do not ask further questions.

The implementation must not disturb shared applications, alter global packages
or system security settings, or fetch an unreviewed application stack. Installed
Windows System.Speech and existing CPU network/assets are now implemented.
Official matching native topology, complete learned clips, a visible player,
all three installed voices and bounded failure/recovery paths were exercised.
Contrasting P/B/M, F/V and vowel inputs generate clips, but that does not prove
correct contacts. Full SDK postprocessing, independent teeth/tongue/eye motion,
human listening and phonetic/expression acceptance remain unqualified.
If a hard blocker survives reasonable alternatives, record detailed evidence
and the exact input or permission the owner must supply.
