# Verona product brief

**Status: research and CPU feasibility complete; text prototype implementation authorized.**
The requirements below summarize the owner's November 18 description. Technology
choices and acceptance thresholds remain proposals until supported and qualified.

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

## Deliberately undecided

Final language/framework, renderer, mesh topology, inference backend, offline
versus optional remote service, target languages/accents and required latency.
The initial example is not a comprehensive pronunciation test.
No actual voice file has been supplied or processed. A bounded CPU inference
environment/probe now exists under vr-06; no face player or deployment exists.

## Research handoff

[Chapter 04](chapters/04-speech-driven-face-research.md) and its
[pinned sources](research/speech-face-sources.md) contain the investigation.
The proposed first slice is offline generation for one permitted prerecorded
line, cached native-geometry animation, wireframe playback and articulation
diagnostics. Add contrasting P/B/M, F/V, vowel and silence cases before accepting
accuracy; the greeting alone is an existence demonstration.

The owner selected **free and local on this AMD machine** after the research
handoff. No paid SDK, cloud inference or private audio upload is part of the
prototype route. Backend selection still needs actual CPU evidence.

Workstream vr-06 first investigates the public A2F Mark ONNX network/PCA assets
as a custom CPU path, not official SDK support. UniTalker remains an alternative.
The [CPU experiment](chapters/05-local-cpu-feasibility.md) now verifies numerical
Mark inference and skin reconstruction on this machine. It uses synthetic
non-speech input; no backend is visually/audio qualified or accepted as accurate.

## Text-first prototype mandate

The owner now requests a runnable prototype from a **given text input string**,
to be developed autonomously while they are away. This narrows the immediate
input to local text-to-speech; recording import and the assistant remain later
slices. Keep components local and small, retain numbered TODOs and book chapters,
and commit/push coherent verified milestones. Do not ask further questions.

The implementation must not disturb shared applications, alter global packages
or system security settings, or fetch an unreviewed application stack. Installed
Windows System.Speech voices are the first qualified TTS candidate; the existing
CPU network/assets are reused. Exact topology correspondence, complete clips,
the visible player and speech/articulation qualification remain vr-07 work.
If a hard blocker survives reasonable alternatives, record detailed evidence
and the exact input or permission the owner must supply.
