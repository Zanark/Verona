# Verona

Verona will turn speech into a synchronized animated face made of connected
points and edges, with accurate articulation and expression support. The first
target is one prerecorded line; a voiced personal assistant is the future direction.
This repository contains the project foundation, deep technology research and
a working numerical CPU probe and complete local text-to-face clip generator.
The interactive face window is being implemented; it is not delivered yet.

- [Engineering book and reading paths](docs/README.md)
- [Product brief](docs/product-brief.md)
- [Speech-to-face research and recommendation](docs/chapters/04-speech-driven-face-research.md)
- [Pinned primary-source register](docs/research/speech-face-sources.md)
- [Verified local CPU experiment and commands](docs/chapters/05-local-cpu-feasibility.md)
- [Text-to-speech and native-mesh clip generation](docs/chapters/06-text-to-face-prototype.md)
- [Workstream index](TODO/00_INDEX.todo)
- [Contributor contract](AGENTS.md)
- [Private project board](https://github.com/users/Zanark/projects/15)

KardboardCode-VTuber's face-mesh pipeline has been reviewed as prior art only.
Verona is a different application; neither its avatar renderer nor its stack is
selected for reuse.

The research recommends a deformable 3D face with audio-clocked playback.
The owner selected free/local operation on this AMD machine. The official
Audio2Face SDK requires NVIDIA hardware, but a custom ONNX CPU experiment now
executes the Mark v2.3 network and reconstructs native skin vertices locally.
Installed Windows voices now produce real local speech and complete learned
skin clips using matching native-derived topology. The interactive player,
full SDK postprocessing and articulation acceptance are not yet qualified.

## Generate a text clip

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_face_mesh
.\.local\cpu-env\Scripts\python.exe -m verona.generate --text "Hey, how are you?" --output .local\my-first-clip
```

Use a new output directory. This writes audio, complete motion and mesh data;
it does not yet open a player. No extra TTS model or Python package is required.
See [chapter 06](docs/chapters/06-text-to-face-prototype.md) and
[third-party terms](THIRD_PARTY.md).

## Run the current check

From this checkout, using the already-prepared local environment:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu
```

This prints CPU inference timings and output/geometry dimensions, and saves
`.local\cpu-probe.json`. It does **not** open a face window or play speech.
To analyze a local mono 16 kHz, 16-bit PCM WAV of at most ten seconds:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu --wav ".local\line.wav"
```

For fresh-clone setup and limitations, see [chapter 05](docs/chapters/05-local-cpu-feasibility.md).
