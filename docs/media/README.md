# Prototype media receipt

## Current vr-15 color study

The README now uses `reference-*.png` and two `reference-*.gif` captures.
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
