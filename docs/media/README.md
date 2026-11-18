# Prototype media receipt

These are actual Edge/WebGL2 captures of Verona's `vr-10` presentation, not
mockups or copies of the owner's reference images. The synthetic sentence is
"Hey, how are you?" using Microsoft Zira Desktop, pitch request +8 st, rate -2,
bass +6 dB and treble -3 dB. Emphasis is the unchanged application default
`none`; it was not visible in the owner's preferred-settings screenshot.
Application/reset defaults remain Hazel.

| File | Content |
|---|---|
| `overview.png` | Actual interface and generated speech state, 1280 x 1100 |
| `voice-controls.png` | Cropped actual voice controls, 350 x 580 |
| `turned.png` | Three-quarter facial contours and original hair |
| `skin-only.png` | Same generated facial skin with hair disabled |
| `speaking.gif` | Forty sampled timeline frames, 640 x 485, 3.30 s |
| `turntable.gif` | Twenty-four original view-control samples, 640 x 485, 1.92 s |

GIFs are silent, repeating presentation previews: the 3.295-second generated
speech timeline is sampled at 12 fps and rounded to GIF centiseconds. They are
not 60-fps playback recordings, live inference demonstrations or independent
listening/phonetic acceptance. The turntable changes view yaw, not head motion
predicted from speech. See the [display measurements](../chapters/08-facial-definition-and-fluidity.md).

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

Local diagnostic receipts remain ignored under `.local\qualification\face-release-final`
and `face-browser-final`. The neighboring generated provenance file records
published file hashes and exact renderer source hashes, not private session data.
[Third-party terms](../../THIRD_PARTY.md) cover the underlying native geometry;
the supplied reference images and voice binaries are not distributed.
