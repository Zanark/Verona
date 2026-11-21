# Distinct offline voices: research and decision (vr-68)

21 November 2026. The requirement is recognizable voices for simultaneous
local sessions, not several pitch settings on Hazel. This comparison selects a
practical implementation for this Windows CPU checkout; it does not establish
an objectively best TTS engine or independently accepted voice quality.

## Candidates and decision

| Candidate | What the primary sources establish | Decision here |
|---|---|---|
| Installed Windows System.Speech | Existing local SAPI voices, native rate/SSML prosody; available voices depend on the machine. This checkout exposes Hazel, David and Zira. | Keep working, lightweight compatibility. Installing OS language/voice packs is not a portable application feature and is not performed. |
| Kokoro-82M through kokoro-onnx | One 82M-parameter model, named speaker styles, CPU ONNX runtime, explicit local model/style paths, speed control and English phonemization. Upstream describes Apache-2.0 weights; the runtime wrapper is MIT. | Select the pinned v1.0 INT8 model and shared style bundle. Adds 28 English styles without 28 neural models, Torch, GPU or a service. |
| Maintained OHF-Voice Piper | Maintained local neural synthesis with multiple separately supplied voices. Current implementation is GPL-3.0; individual voice/model terms require their own review. | Credible alternative, but a separate model/configuration per voice is a less suitable fit for this particular multi-style slice. No comparative speed or quality benchmark was performed. |
| sherpa-onnx Kokoro | Another offline runtime with documented Kokoro speaker/model packages and CPU support. | Viable, but adds a different native runtime/package layout when this project already pins ONNX Runtime. Documentation speaker counts vary by model package: do not infer this checkout's catalog from them. |

This decision favors a working, bounded optional pack over installing global
Windows voices or taking on a new service. Kokoro is **not free of costs**:
first-use model/phonemizer loading, CPU inference, per-warm-head memory and
short/long-utterance quality limitations matter. Upstream voice ratings and
marketing comparisons are not Verona listening tests.

## Exact local slice

`verona/local_voices.py` defines 28 English styles from the actual v1.0 bundle:

- US female-labelled styles: Heart, Bella, Nicole, Sarah, Kore, Aoede, Nova,
  Alloy, Jessica, River and Sky.
- US male-labelled styles: Michael, Fenrir, Puck, Adam, Echo, Eric, Liam,
  Onyx and Santa.
- British female-labelled styles: Emma, Isabella, Alice and Lily.
- British male-labelled styles: George, Fable, Daniel and Lewis.

These are upstream style labels, not inferred real identities or a guarantee
that every pair is equally distinguishable to every listener. Other languages
in the shared upstream bundle are deliberately not exposed. No cloning,
microphone, recording import, cloud inference or facial-emotion-to-vocal-emotion
mapping is added.

`requirements-local-voices.txt` pins the optional Python stack without changing
the existing NumPy/ORT versions. Explicit `scripts/fetch_local_voices.py` setup
downloads only two pinned files over verified HTTPS:

| File | Bytes | SHA-256 |
|---|---:|---|
| kokoro-v1.0.int8.onnx | 92,361,271 | `6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb` |
| voices-v1.0.bin | 28,214,398 | `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d` |

The source is the wrapper's `model-files-v1.0` GitHub release. These hashes were
computed from the explicitly retrieved files; the GitHub asset metadata did
not supply a digest. They pin identity, not an upstream signature or security
certification. Total disk data is 120,575,669 bytes, about 115 MiB, outside Git.
Runtime never downloads missing assets.

## Mechanism and ownership

Catalog enumeration uses standard-library metadata and file-size checks, not
neural imports or model loading. On first actual local synthesis,
`SpeechWorker` starts one private Python child. `LocalSynthesizer` verifies
both complete SHA-256 hashes before creating a CPU-only ORT session with two
intra-op and one inter-op thread, with its CPU memory arena disabled to avoid
retaining inference workspaces after speech. The same model is reused between styles;
the NPZ bundle supplies the requested style rather than loading a different
neural network for each menu entry.

Native 24-kHz mono output is checked for nonempty finite samples and bounded
duration, resampled with SoXR to the existing 16-kHz mono signed-16-bit contract,
then sent through the existing EQ/padding path. That final waveform drives
both motion and playback. Speed maps the existing -5..5 control to 0.5x..2x.
Kokoro has no implemented native pitch/emphasis control: selecting it visibly
resets those controls and disables them; unsupported API combinations fail.
Bass, treble and playback volume remain available.

Windows synthesis releases a prior local child; closing the host releases both
workers. Keeping several local-speaking heads warm still means a model per
head, **not one global model shared by the whole application**. Selecting
another menu entry alone is not immediate eviction: teardown occurs when
Windows synthesis next runs, on local-worker failure or host close.

There is no queue or retry to a different voice. Input/output reads are bounded;
the existing worker timeout is 45 seconds. Cancellation marks and discards an
in-flight result, but does not instantly interrupt synchronous neural inference.
The host's normal shutdown owns worker cleanup. Restart loses unsaved choices,
speech RAM and the warm model. Failed/missing setup is explicit; existing
Windows voices remain usable, not secretly substituted for a failed local job.

The manager serializes creates, inventories current selections and reserves
voices even while its own new head is still starting. New heads choose an
unused Kokoro style before unused Windows voices. A requested occupied voice
or exhausted inventory fails instead of silently duplicating. Unknown/stale
occupancy blocks new allocation until inspected. External owners or later
manual changes are not a distributed lock: manually shared choices are allowed
and visibly marked on manager cards. Omitted CLI speech voice now honors the
head's actual selection instead of resetting it to Hazel.

## Actual technical qualification

The first all-style RAM-only run, `.local/qualification/local-voices-01`,
synthesized the same synthetic line through all 28 exposed styles:
28 nonempty bounded PCM results, 28 different audio hashes, one reused local
child, then successful Windows synthesis and confirmed local-child teardown.
No audio was saved. Padded output lasted 3.908..6.383 seconds. First synthesis
took 8.081 seconds; subsequent median was 5.107 seconds, range
4.127..18.380 seconds. These sequential wall times include IPC/output processing
and run on a shared working machine, not a controlled comparison or real-time
guarantee. Different PCM hashes do not prove perceptual speaker separation.

Native-head, cancellation and regression receipts are recorded in the workstream
after completion. Human listening, preferred-style selection, clean-machine
installation, multilingual quality and an eight-head throughput guarantee
remain separate, unaccepted claims.

Corrected complete-worker-tree probes, not just Windows launcher counters,
measured311.92/444.07MiB private bytes after two styles with the default arena,
versus190.05/189.97MiB with it disabled. The latter first/warm wall times were
17.517/7.119seconds: lower retained memory is not a demonstrated speedup.
The1.5-second idle sample consumed zero process-CPU seconds, and all exact
owned process handles signalled exit after switching to Windows synthesis.
These measurements exclude the rest of the application. The earlier
launcher-only resource receipt is retained and explicitly marked invalid in
scope, not presented as a tiny neural-model footprint.

## Rights are component-specific

The model card identifies the weights as Apache-2.0. `kokoro-onnx` and
`espeakng-loader` wrappers are MIT; the phonemizer/eSpeak components are GPL-3.0
and Python-SoXR is LGPL-2.1-or-later. The optional stack is **not wholly
Apache/MIT**. Preserve upstream license/source obligations for any future binary
distribution; a separate process is not a declaration that copyleft no longer
applies. This change distributes source/setup instructions, not the environment,
model weights or native libraries. See [third-party notices](../../THIRD_PARTY.md).

## Primary sources

Read during selection; external pages can evolve independently of the pins:

- [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/README.md)
  and [voice list/caveats](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).
- [kokoro-onnx source and setup](https://github.com/thewh1teagle/kokoro-onnx),
  [runtime implementation](https://github.com/thewh1teagle/kokoro-onnx/blob/main/src/kokoro_onnx/__init__.py),
  [tokenizer](https://github.com/thewh1teagle/kokoro-onnx/blob/main/src/kokoro_onnx/tokenizer.py)
  and [pinned model release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0).
- [Maintained Piper](https://github.com/OHF-Voice/piper1-gpl).
- [sherpa-onnx Kokoro packages](https://k2-fsa.github.io/sherpa/onnx/tts/pretrained_models/kokoro.html).
- [eSpeak loader license](https://github.com/thewh1teagle/espeakng-loader/blob/main/LICENSE),
  [eSpeak NG GPL](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING).
- Installed pinned distribution licenses: kokoro-onnx 0.6.1 MIT,
  phonemizer 3.6.0 GPL-3.0, Python-SoXR 1.1.0 LGPL-2.1-or-later.
