<p align="center">
  <img src="docs/media/gallery-vr36-facemesh-transparent.gif" alt="Verona speaks front-facing with red mechanical irises, explicit expressions and cyan dialogue captions" width="900">
</p>

<details>
<summary><strong>Explore Verona: seven faces and four hairstyles</strong></summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/branding/verona-lockup-dark.png">
    <img src="docs/branding/verona-lockup-light.png" alt="Verona: local voice, living faces" width="900">
  </picture>
</p>

# Verona

**[v1.0.0 - First public release](https://github.com/Zanark/Verona/releases/tag/v1.0.0)** · Windows-local source release. [Release notes](docs/releases/v1.0.0.md)

**Type a sentence. Hear a local voice. Give it a face.**

Windows-local speech, CPU neural motion and an animated WebGL face.
No camera, microphone or cloud runtime.

[Setup & controls](docs/prototype-guide.md) · [Agent skill](.github/skills/verona/SKILL.md) · [Engineering book & journals](book/README.md) · [Media provenance](docs/media/README.md)

```powershell
.\Verona.cmd
```

One manager, separate named heads. Six selectable models; Windows voices plus
an explicitly installed optional 28-style Kokoro pack. A fresh checkout needs
[setup](docs/prototype-guide.md), not just this command.

## Meet the heads

**Six selectable combinations, plus Akari's anime preview.**
Neutral and all ten emotions; four shared views. Opaque mouths by default.

### Aster · Rowan

<p align="center">
  <img src="docs/media/model-vr93-claire.gif" alt="Aster, original Claire, speaking through neutral and ten emotions in Surface, FaceMesh, FaceDot and UniformPolygons" width="50%"><img src="docs/media/model-vr93-mpfb.gif" alt="Rowan, native MPFB driven by Claire, in the same four views with current reduced effective emotion gain" width="50%">
</p>

Claire (`claire`) · Native MPFB with Claire motion (`mpfb`).

### Kestrel · Onyx

<p align="center">
  <img src="docs/media/model-vr97-mark.gif" alt="Kestrel, actual Mark network and topology, speaking with the new textured curls fade in all four views" width="50%"><img src="docs/media/model-vr93-male-sharp.gif" alt="Onyx, the sharp-jaw Claire sculpt, speaking in all four views" width="50%">
</p>

Mark (`mark`) · Sharp-jaw Claire sculpt (`male-sharp`).

### Vale · Linden

<p align="center">
  <img src="docs/media/model-vr93-reference-structure.gif" alt="Vale, stronger reference-shaped Claire, speaking through every emotion in four presentations" width="50%"><img src="docs/media/model-vr93-reference-shell.gif" alt="Linden, the historical subtle reference-shaped Claire retained for comparison, in four presentations" width="50%">
</p>

Structural Claire (`reference-structure`) · Subtle Claire (`reference-shell`).

### Akari

Teal eyes, attached lashes, rose lips, violet bob and restored toon shading.

<p align="center">
  <img src="docs/media/study-vr93-akari.gif" alt="Akari anime study with restored banded skin and hair shading, attached lashes, continuous lipstick and opaque-default mouth" width="100%">
</p>

**Anime review, not yet selectable.** [Design & references](docs/research/claire-anime-woman.md).

## Hairstyles

### Women / Onyx — Claire waves · Spiral curls

<p align="center">
  <img src="docs/media/hair-vr97-onyx-waves.gif" alt="Onyx demonstrating women's original Claire waves, speaking and turning in Surface and FaceMesh" width="50%"><img src="docs/media/hair-vr97-onyx-curls.gif" alt="Onyx demonstrating women's 48-lock spiral curls, speaking and turning in Surface and FaceMesh" width="50%">
</p>

### Men / Mark — Textured curls fade · Swept quiff fade

<p align="center">
  <img src="docs/media/hair-vr97-mark-curly-fade.gif" alt="Kestrel, the Mark model, demonstrating textured curls with skin-to-stubble faded sides in Surface and FaceMesh" width="50%"><img src="docs/media/hair-vr97-mark-swept-quiff.gif" alt="Kestrel, the Mark model, demonstrating a swept asymmetric quiff with faded sides in Surface and FaceMesh" width="50%">
</p>

Shared choices, not separate neural models. New Mark heads default to textured curls fade;
existing heads keep their choices.

## FaceMesh in motion

<p align="center">
  <img src="docs/media/gallery-vr36-facemesh-xyz.gif" alt="FaceMesh talking and rotating through its XYZ orientation range with bright red mechanical irises" width="100%">
</p>

**Small print:** GIFs are silent sampled demonstrations, not live-FPS,
phonetic-accuracy or human-acceptance evidence. Six selectable shapes use two
neural identities; Akari remains experimental. Mouth transparency
requires explicit head-creation opt-in and only affects wide openings.
Controls, limits, optional voices and recovery: [prototype guide](docs/prototype-guide.md).

</details>
