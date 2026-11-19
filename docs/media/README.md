# Prototype media receipt

## Current vr-26 GIF-first gallery

The current README embeds **23 GIFs and one interface PNG**, all showing the
actual prototype at runtime source `f1aea4d24b2a0c40eef08ce1240ad6f1ecd3348e`.
`gallery-provenance.json` lists all 24 media hashes, 15 captured runtime-source
hashes, exact frame delays/dimensions and each sequence's meaning. Source hashes
identify working-tree bytes; normalized equality against the source commit
accounts explicitly for Windows CRLF/LF. No runtime source changed for capture.

| Files | Meaning |
|---|---|
| `gallery-hair-{claire,pixie,bob,angled,straight,curls,ponytail,twins,bun,double,braid}.gif` | Every actual selector option, 32 frames/3.20s each, manual yaw from front to both profiles; full bust, color/makeup, 80% zoom |
| `gallery-speaking.gif` | Hazel defaults saying synthetic "Hey, how are you?"; 33 timeline samples/2.75s |
| `gallery-view-{claire,facemesh,facedot,uniform}.gif` | Four presentations of the same paused speech pose; 24 manual-yaw frames/2.88s each |
| `gallery-pattern-{facedot,uniform}.gif` | Eight discrete density/gap states/4.40s each; not an exact sample count |
| `gallery-cursor-{eyes,head}.gif` | 24 sampled responses/2.88s each to synthetic pointer positions in the owned browser; system cursor unchanged |
| `gallery-jawline.gif` | Six discrete neck-depth states/3.30s |
| `gallery-zoom.gif` | Eight discrete browser zoom states/3.20s; native buttons share this control; high zoom can clip |
| `gallery-overlay-controls.gif` | Two actual Electron states/2.60s, collapsed/expanded tab; transparent pixels flattened to black, not desktop dragging/OS-blur footage |
| `gallery-overview.png` | Actual current browser interface with generated synthetic greeting |

Browser GIFs are 640x664 after proportional resampling; the native-control GIF
is 640x800. All repeat silently. Hair uses 10 sampled frames/second, speech
12, view/cursor sequences approximately 8.33; discrete-state animations use
longer holds. The onscreen 30/60fps label describes the **app**, not GIF timing.
These are not real-time performance recordings, listening/phonetic acceptance,
hair physics, photorealistic strands or approved likeness.

All 561 encoded frames across 23 GIFs were independently decoded with Windows
System.Drawing; frame counts, timings, dimensions and nonconstant pixels matched.
Decoded front/left/right samples of every hairstyle and representative samples
of every feature GIF were visually inspected. This is sample review, not a
claim that every frame was visually examined or the owner approved the result.
The existing local shared-palette quantizer uses 256 colors, no downloaded
encoder. The gallery's media total is approximately 39.7 MB: deliberately
GIF-heavy, with possible loading delay on slow connections.

Capture used the existing isolated Edge owner, disposable profile, separate
capability/RAM server, numeric cache and synthesis workspace, then stopped and
removed all owned processes/profiles. No active Verona runtime existed before
capture. Shared CPU/GPU/compositor resources were used sequentially, not driven
through another application. Native states reuse the final qualified
`hair-controls-native-06` captures of the same exact runtime; no native relaunch.
No device activation, supplied reference image, private speech, address bar,
capability, model asset or unrelated application's pixels are published.

The first capture clipped the bun at full-bust 100% zoom; it is retained privately
and excluded. Final all-style captures explicitly use 80% zoom. An attempted
inline layout override was blocked by the application's existing style CSP:
the public receipt records the effective built-in layout and measured PNG
dimensions, not the unfulfilled request. A raw-source equality guard initially
hit Windows CRLF/LF; normalized source equality and exact captured-byte hashes
are recorded separately. No capture gate or runtime security policy was weakened.
All older media and receipts below remain unchanged historical snapshots.

## Historical vr-15 color study

The prototype.2 README used `reference-*.png` and two `reference-*.gif` captures.
`reference-provenance.json` records 13 exact runtime-source hashes, all 9 media
hashes, browser/native receipts, actual pixel sizes and capture voice settings.
These show the real procedural 3D head, **not the supplied character sheet**.
The sheet is not redistributed. The result is a stylized appearance study,
not a photorealistic reconstruction or accepted likeness/expressions.

The neutral image is actual rest geometry; the turned image/turntable change
view orientation. Browser speech captures use synthetic "Hey, how are you?",
Zira/pitch request+8st/rate-2/bass+6dB/treble-3dB/emphasisnone. Native captures
use Hazel/default settings. The native overlay is actual composition over the
owned RGB(37,103,71) fixture; no other app is captured.

New GIFs have 40/24 frames, 640x493, 3.30s/1.92s. They use the existing local
shared-palette quantizer and were independently decoded; representative
speech/turn samples and all public PNGs were visually inspected. They are
silent 12-fps timeline/view samples, not 60fps recordings or listening acceptance.
The browser/native owners stopped and removed their disposable profiles.
Prior snapshots below remain unchanged, with their original provenance.

## Historical vr-12 presentation

These are actual Edge/WebGL2 captures of Verona's `vr-12` presentation, not
mockups or copies of the owner's reference images. The synthetic sentence is
"Hey, how are you?" using Microsoft Zira Desktop, pitch request +8 st, rate -2,
bass +6 dB and treble -3 dB. Emphasis is the unchanged application default
`none`; it was not visible in the owner's preferred-settings screenshot.
Application/reset defaults remain Hazel.

| File | Content |
|---|---|
| `overview.png` | Actual interface and generated speech state, 1280 x 1100 |
| `voice-controls.png` | Cropped actual voice controls, 350 x 590 |
| `turned.png` | Three-quarter cool polygon face and original layered waves, 843 x 650 |
| `skin-only.png` | Same generated skin with hair disabled and native edges enabled |
| `shaded.png` | Optional warm shaded view of the same revised geometry, 843 x 650 |
| `speaking.gif` | Forty sampled timeline frames, 640 x 493, 3.30 s |
| `turntable.gif` | Twenty-four original view-control samples, 640 x 493, 1.92 s |

GIFs are silent, repeating presentation previews: the 3.295-second generated
speech timeline is sampled at 12 fps and rounded to GIF centiseconds. They are
not 60-fps playback recordings, live inference demonstrations or independent
listening/phonetic acceptance. The turntable changes view yaw, not head motion
predicted from speech. See the [display measurements](../chapters/09-verona-character-and-waves.md).
These seven files and `provenance.json` preserve the vr-12 capture snapshot.
They are not recaptured desktop evidence; source hashes refer to that snapshot.
The first source prerelease's older appearance remains at its immutable tag.
The default restores the owner's referenced translucent-looking polygon
treatment; it is a shaded surface with blended contours, not an X-ray renderer.

Capture used the existing bounded test browser owner with a disposable profile,
independent RAM/capability/port, private numeric cache and private synthesis work.
No browser address bar, capability URL, private input, raw recording or model
file is published. Only this synthetic demonstration was exported.
The owned server/browser/profile were stopped/removed afterward.

Original PNGs were resized with Windows System.Drawing; an original shared
256-color median-cut palette avoids the default GIF encoder's noisy dithering.
Single-frame GIF data was assembled with per-frame local palettes, explicit
timing and infinite looping. Windows' independent decoder verified 40/24 frames;
first/middle/last decoded samples and actual PNGs were inspected. The first
default-dithered encoding was rejected; an encoder compilation/reference mismatch
was resolved using installed Windows .NET Framework, without package installation.

Local diagnostic receipts remain ignored under
`.local\qualification\polygon-media-01` and `polygon-correction-03`;
earlier captures are retained privately. The neighboring provenance file records
published file hashes and exact renderer source hashes, not private session data.
[Third-party terms](../../THIRD_PARTY.md) cover the underlying native geometry;
the supplied reference images and voice binaries are not distributed.

## Desktop captures

`desktop-controls.png` and `desktop-overlay.png` show the real native desktop
host. The latter is Windows composition over an owned solid green fixture,
not another application's contents or a simulated transparency checkerboard.
The synthetic greeting uses the Hazel default with unchanged default settings.
`desktop-provenance.json` separately records exact desktop source/image hashes.
These are screenshots, not a playback recording or independent listening test.

## Optional head and neck

`head-neck-overlay.png` shows vr-14's actual native shoulder-free framing over
the same owned green fixture, not a postprocessed cutout or another app.
The synthetic greeting uses Hazel and unchanged default voice settings.
`head-neck-provenance.json` identifies the exact captured runtime source,
native draw counts and final qualification. The original vr-12 and vr-13
captures/receipts above remain unchanged historical snapshots. Full bust is
still the default; this image demonstrates the separately selected option.
