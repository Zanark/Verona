# Verona

Verona turns a text sentence into local speech and a synchronized animated face
made of connected points and edges. The Windows prototype works on CPU, with
installed English voices and explicit expression controls. Accurate human
articulation is the goal, **not an established result**. Recording import and a
voiced personal assistant remain future work.

## Run the prototype

This checkout is already prepared:

```powershell
.\Verona.cmd
```

Keep its terminal open. In the browser, type a sentence, click **Generate face**,
then **Play**. Try the greeting, P/B/M, F/V and vowel example buttons.
Hazel is the default when installed; David and Zira remain selectable. The head
is the matching **Claire female mesh**, with optional original procedural hair.
Open **Edit voice** for pitch, speed, warmth/bass, brightness/treble and emphasis;
**Reset voice** restores Hazel/default settings. **Preview voice** prepares a
voice-only sample: press its audio Play control to hear it without generating
face motion. Generate face applies those settings to both speech and animation.
Pitch is a Windows-engine request, not a calibrated acoustic semitone shift.
Neutral/happy/sad/surprised are separate explicit expression inputs.
Play/Pause and the timeline follow the actual audio clock; Restart rewinds and
pauses. Turn, zoom, volume and point/edge toggles are available.

Press **Ctrl+C in the terminal** to stop. No service is installed. Closing only
the browser does not stop Python. Reopening requires the full local URL printed
by the terminal, including its private `#` session part; a new server has a new
URL. Do not share that URL.

Inputs are limited to 280 characters and 25 seconds of padded speech. Generation
is offline/precomputed, not streaming. Browser speech/motion stays in RAM;
reload clears the page; the server retains only its latest successful clip and
one latest synthesized voice sample. Exact-repeat clips and expression-only
speech are reused. Stopping clears both. No microphone, camera, cloud TTS or CDN is used.
The application does not deliberately save a transcript; normal browser history
may retain the local session URL.

**Limits:** full SDK contact/smoothing corrections and independent teeth,
tongue and eye-joint animation are not implemented. Functional playback and
contrasting speech inputs have been exercised in Edge; testing was muted.
Correct lip contacts, expressive quality and human listening acceptance remain
unqualified. This is a working neural-skin prototype, not SDK parity.

**Performance:** warm startup avoids native-scene parsing, and repeating the
latest request skips speech/inference. Motion payloads are about 37% smaller
than the original Mark head without lowering 30-fps articulation. Claire has a
larger neural network: a new line can take longer than the old Mark prototype.
[Chapter 07](docs/chapters/07-hazel-claire-and-performance.md) records measured
latencies and that tradeoff, rather than claiming every operation got faster.

## Fresh-clone setup

Requires Windows, Python (qualified here on 3.13), an installed English desktop
System.Speech voice, and a current WebGL2-capable browser (qualified in Edge).
Review [third-party terms](THIRD_PARTY.md) before downloading model/sample data.

```powershell
python -m venv .local\cpu-env
.\.local\cpu-env\Scripts\python.exe -m pip install -r requirements-cpu.txt
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_claire_model
.\Verona.cmd
```

Only setup/downloads need internet; runtime never downloads missing assets.
Pinned Claire model/topology files total about 337 MB, plus isolated dependencies.
No extra TTS model, CUDA, PyTorch or npm install is needed. Startup verifies
assets and prepares geometry; explicit setup errors appear in the terminal.

## Engineering and research

- [Engineering book and reading paths](docs/README.md)
- [Product brief](docs/product-brief.md)
- [Speech-to-face research and recommendation](docs/chapters/04-speech-driven-face-research.md)
- [Pinned primary-source register](docs/research/speech-face-sources.md)
- [Verified local CPU experiment and commands](docs/chapters/05-local-cpu-feasibility.md)
- [Text-to-speech and native-mesh clip generation](docs/chapters/06-text-to-face-prototype.md)
- [Hazel voice editing, Claire and measured performance](docs/chapters/07-hazel-claire-and-performance.md)
- [Workstream index](TODO/00_INDEX.todo)
- [Contributor contract](AGENTS.md)
- [Private project board](https://github.com/users/Zanark/projects/15)

KardboardCode-VTuber's face-mesh pipeline has been reviewed as prior art only.
Verona is a different application; neither its avatar renderer nor its stack is
selected for reuse.

The research recommends a deformable 3D face with audio-clocked playback.
The owner selected free/local operation on this AMD machine. The official
Audio2Face SDK requires NVIDIA hardware, but a custom ONNX CPU experiment now
first executed the Mark v2.3 network and reconstructed native skin vertices locally.
Installed Windows voices now produce real local speech and complete learned
Claire v2.3.1 skin clips using matching native-derived topology. A loopback-only browser
renders those clips with audio-clocked interpolation. Full SDK postprocessing
and articulation acceptance remain separate from this functional qualification.

## Generate a text clip

```powershell
.\.local\cpu-env\Scripts\python.exe -m verona.generate --text "Hey, how are you?" --pitch 2 --rate 1 --bass 2 --output .local\my-first-clip
```

Use a new output directory. This writes audio, complete motion and mesh data;
it is an explicit export command, not the browser launcher. No extra TTS model
or Python package is required.
See [chapter 07](docs/chapters/07-hazel-claire-and-performance.md) and
[third-party terms](THIRD_PARTY.md).

## Run focused checks

Using the prepared local environment:

```powershell
.\.local\cpu-env\Scripts\python.exe -m unittest discover -s tests -q
```

The original Mark numerical probe remains a historical optional diagnostic,
not the current Claire application. Fresh clones need its separate assets:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_cpu_model
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu
```

This prints CPU inference timings and output/geometry dimensions, and saves
`.local\cpu-probe.json`. It does **not** open a face window or play speech.
To analyze a local mono 16 kHz, 16-bit PCM WAV of at most ten seconds:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu --wav ".local\line.wav"
```

For fresh-clone setup and limitations, see [chapter 05](docs/chapters/05-local-cpu-feasibility.md).
