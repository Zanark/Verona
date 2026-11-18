# 07 - Editable Hazel, matching Claire and measured performance

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
