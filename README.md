# Verona

**Type a sentence. Hear a local voice. Watch her speak.**

![Verona's restored transparent-looking polygon face articulating a local greeting](docs/media/speaking.gif)

Windows voices, CPU neural motion, connected native contours. No camera, microphone or cloud runtime.

```powershell
.\VeronaDesktop.cmd
```

**Generate face**, **Play**, then **Pop out transparent head**.
Hover its top-left corner for **Move**, **Controls** or **Close**.
Eyes follow your cursor; X/Y/Z sliders rotate the head freely.
The browser version remains `.\Verona.cmd`.
Fresh checkout? [Setup, controls and limits](docs/prototype-guide.md).
[First source prerelease - earlier appearance](https://github.com/Zanark/Verona/releases/tag/v0.1.0-prototype.1).

## Desktop and transparent overlay

![Actual local Verona desktop controls](docs/media/desktop-controls.png)

![Actual transparent native head composited over an owned green test window](docs/media/desktop-overlay.png)

Always-on-top is optional. Transparent areas may intercept clicks.
Desktop setup: `.\Setup-VeronaDesktop.cmd` once; already prepared in this checkout.

## The prototype

Transparent polygons by default. Revised facial contours and layered waves.

![Actual Verona interface with the female mesh and editable Zira voice](docs/media/overview.png)

## Form and detail

![Turntable of the actual polygon facial mesh with original procedural hair](docs/media/turntable.gif)

| Three-quarter view | Native facial contours, hair off |
|---|---|
| ![Defined eyes, nose and lips in three-quarter view](docs/media/turned.png) | ![The same learned facial skin without hair](docs/media/skin-only.png) |

![Optional warm shaded view of the same revised face and wavy hair](docs/media/shaded.png)

## Shape the voice

<img src="docs/media/voice-controls.png" alt="Zira selected with pitch request +8 st, speed -2, bass +6 dB and treble -3 dB" width="350">

Preview, adjust, generate. Hazel remains the reset default.
**View** switches between **Transparent polygons** (default) and **Warm shaded face**.
**Edges**, **Points** and **Hair** remain independent.

**Early prototype:** procedural cursor gaze, not learned eye joints; articulation accuracy is not accepted.
Playback targets **60-fps display** over 30-fps neural motion, not live generation.
Local measurements include occasional frame-time spikes. GIFs are silent previews.

[Engineering book](docs/README.md) · [Desktop mechanisms and limits](docs/chapters/10-desktop-overlay-and-gaze.md) · [Media provenance](docs/media/README.md) · [Third-party terms](THIRD_PARTY.md)
