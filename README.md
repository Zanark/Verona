<p align="center">
  <img src="docs/media/gallery-vr36-facemesh-transparent.gif" alt="Verona speaks front-facing with red mechanical irises, explicit expressions and cyan dialogue captions" width="900">
</p>

<details>
<summary><strong>Explore Verona: every head, anime studies and four hairstyles</strong></summary>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/branding/verona-lockup-dark.png">
    <img src="docs/branding/verona-lockup-light.png" alt="Verona: local voice, living faces" width="900">
  </picture>
</p>

# Verona

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

## Six selectable heads

Fresh current-renderer captures: **neutral plus all ten emotions**, four
presentations at matching speech times. Mouths are opaque by default.
Review names below map to the actual model IDs.

### Aster / original Claire · Rowan / native MPFB

<p align="center">
  <img src="docs/media/model-vr93-claire.gif" alt="Aster, original Claire, speaking through neutral and ten emotions in Surface, FaceMesh, FaceDot and UniformPolygons" width="50%"><img src="docs/media/model-vr93-mpfb.gif" alt="Rowan, native MPFB driven by Claire, in the same four views with current reduced effective emotion gain" width="50%">
</p>

`claire` · `mpfb` — original speech face versus native transferred topology.

### Kestrel / actual Mark · Onyx / sharp-jaw Claire sculpt

<p align="center">
  <img src="docs/media/model-vr93-mark.gif" alt="Kestrel, actual Mark network and topology, speaking with its default short textured quiff visible in all four views" width="50%"><img src="docs/media/model-vr93-male-sharp.gif" alt="Onyx, the sharp-jaw Claire sculpt, speaking in all four views" width="50%">
</p>

`mark` · `male-sharp` — Mark uses its own neural model; Onyx preserves Claire motion.

### Vale / strong structural fit · Linden / historical subtle fit

<p align="center">
  <img src="docs/media/model-vr93-reference-structure.gif" alt="Vale, stronger reference-shaped Claire, speaking through every emotion in four presentations" width="50%"><img src="docs/media/model-vr93-reference-shell.gif" alt="Linden, the historical subtle reference-shaped Claire retained for comparison, in four presentations" width="50%">
</p>

`reference-structure` · `reference-shell` — both retain Claire topology and motion.

## Akari / original anime study

**Toon shading is back.** Large teal eyes, attached upper lashes, rose lips and
an original violet bob. Rest, turns, blink and all ten speech emotions.

<p align="center">
  <img src="docs/media/study-vr93-akari.gif" alt="Akari anime study with restored banded skin and hair shading, attached lashes, continuous lipstick and opaque-default mouth" width="100%">
</p>

**Review only, not a selectable head.**
[Design research & illustrated references](docs/research/claire-anime-woman.md) · [How it works](docs/chapters/09-verona-character-and-waves.md)

## Six supplied-GLB studies

Each pair uses one source: **original mesh driven by Claire** on the left,
**Claire reshaped toward that source** on the right. Clay shading exposes the
geometry. These are separate review candidates, **not installed models**.

### Lyra · Elara

<p align="center">
  <img src="docs/media/study-vr93-lyra.gif" alt="Lyra: supplied stylized anime head mesh animated by transferred Claire motion" width="50%"><img src="docs/media/study-vr93-elara.gif" alt="Elara: Claire reshaped toward the anime source with raised eyebrows and tapered upper lashes" width="50%">
</p>

Anime source by [Rodesqa](https://sketchfab.com/rodesqa).

### Mira · Selene

<p align="center">
  <img src="docs/media/study-vr93-mira.gif" alt="Mira: original woman basemesh with Claire-driven deformation" width="50%"><img src="docs/media/study-vr93-selene.gif" alt="Selene: Claire topology reshaped toward the first woman basemesh" width="50%">
</p>

First woman basemesh by [mono](https://sketchfab.com/michela.000).

### Neris · Thalia

<p align="center">
  <img src="docs/media/study-vr93-neris.gif" alt="Neris: original second woman basemesh with Claire-driven deformation" width="50%"><img src="docs/media/study-vr93-thalia.gif" alt="Thalia: Claire topology reshaped toward the second woman basemesh" width="50%">
</p>

Second woman basemesh by [mono](https://sketchfab.com/michela.000).
All three sources: **CC BY 4.0**, modified for alignment/deformation or structural
fitting and common clay rendering. [Exact source links & credits](docs/media/README.md#supplied-glb-source-credits).

## All four hairstyles

### Claire waves · Spiral curls

<p align="center">
  <img src="docs/media/hair-vr93-claire.gif" alt="Original Claire waves shown on current Mark while speaking and turning in Surface and FaceMesh" width="50%"><img src="docs/media/hair-vr93-curls.gif" alt="Spiral curls with all 48 locks shown on current Mark while speaking and turning in Surface and FaceMesh" width="50%">
</p>

### Short textured quiff · Classic side part

<p align="center">
  <img src="docs/media/hair-vr93-quiff.gif" alt="Current Mark short textured quiff while speaking and turning in Surface and FaceMesh" width="50%"><img src="docs/media/hair-vr93-side-part.gif" alt="Current Mark classic side part while speaking and turning in Surface and FaceMesh" width="50%">
</p>

Shared choices, not separate neural models. New Mark heads default to the quiff;
existing heads keep their choices.

## FaceMesh in motion

<p align="center">
  <img src="docs/media/gallery-vr36-facemesh-xyz.gif" alt="FaceMesh talking and rotating through its XYZ orientation range with bright red mechanical irises" width="100%">
</p>

**Small print:** GIFs are silent sampled demonstrations, not live-FPS,
phonetic-accuracy or human-acceptance evidence. Six selectable shapes use two
neural identities; the seven studies remain experimental. Mouth transparency
requires explicit head-creation opt-in and only affects wide openings.
Controls, limits, optional voices and recovery: [prototype guide](docs/prototype-guide.md).

</details>
