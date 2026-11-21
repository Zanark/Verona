# Claire to an Optimus-inspired Blender head

The local **vr-54** workshop is an asset-authoring handoff, not a new app model.
The owner rejected the earlier app robot. This separate, original armor study
is a starting point for their own Blender work, not an accepted final likeness.

Open the image-first guide:
`C:\devdesk\homedesk\Verona\.local\exports\claire-optimus-02\guide\index.html`.
The adjacent **Claire-to-Optimus-Visual-Guide.pdf** has 15 landscape pages:
actual annotated anatomy/armor maps, equal-scale registration, front/back/side,
optics, a mechanical jaw comparison, exploded layers and editing/export steps.
Its menu roadmap is explicitly a diagram, not a captured Blender UI.

## Files and first edit

All assets are under `.local\exports\claire-optimus-02` and remain ignored:

| File | Purpose |
|---|---|
| `Claire.glb` | Import the existing styled Claire into Blender |
| `Optimus-inspired.glb` | Import the separate editable mechanical head |
| `Claire-Optimus-Workshop.blend` | Open both assets, named collections, guide mesh, rig and authoring scene |
| `guide\Claire-to-Optimus-Visual-Guide.pdf` | Illustrated placement and modeling guide |
| `source-map.json` | Pinned inputs, native-index map, axes, anchors and armor ownership |
| `build.json`, `roundtrip.json` | Artifact hashes and actual Blender reimport evidence |
| `ASSET-RIGHTS.md` | Underlying model/sample notices |

Use **File > Open** for the workshop, or **File > Import > glTF 2.0** for a GLB.
Save a new `.blend` copy before editing. The workshop opens with armor visible;
toggle `01_CLAIRE_REFERENCE`, `02_OPTIMUS_INSPIRED` and `03_REGION_GUIDE` in the
Outliner. Hide Claire's separate hair when fitting the helmet. Keep both origins
unchanged. Select an armor mesh and enter Edit Mode rather than remeshing Claire.

The figure colors identify approximate teaching regions of **one continuous
skin**, not separate anatomical muscles or calibrated landmark segmentation.
Actual anatomy is also shown in clay and wireframe, without false colors.

## What goes where

| Claire reference zone | Editable armor objects | Motion ownership |
|---|---|---|
| Forehead and skull | `HELMET_01_WrappedCrown`, `HELMET_02_Forehead.*`, crest, temples and tall antennae | `Head` |
| Temples / lateral ears | `EAR_*` concentric housings | `Head` |
| Eye surrounds | `OPTIC_01_DarkSocket.*`, `OPTIC_02_CyanLens.*` | `Head`; no gaze system |
| Brows | `BROW_01_HeavyRidge.L/R` | Independent `Brow.L` / `Brow.R` |
| Nose / bridge | `FACE_03_Bridge` | `Head` |
| Cheeks | `FACE_02_CheekPillar.*`, `VENT_*` | `Head` |
| Lips / mouth opening | `FACE_04_UpperMask` and its seams cover the lip band | `Head`, not soft lips |
| Chin / lower jaw | `JAW_01_LowerFaceplate`, `JAW_02_SideRail.*` | `Jaw` |
| Neck | `NECK_*` core / collar ribs | `Head` in this bounded study |

The new study has **55 separate mesh objects** and four bones. Each armor object's
`rigidBone` custom property and full-weight vertex group identify its owner.
Do not delete/apply its armature modifier or join every part blindly.
`MANUAL_JawInspection_NOT_Speech` is a two-second action: closed at frame 1,
nine-degree jaw opening at frame 25, closed at frame 49, at 24 fps. It is not
speech animation, a voice, a contact simulation or a clearance guarantee.

## Scale, topology and the future runtime boundary

Source Claire uses centimeters, +Y up, +Z forward. Source origin is
`(0,147.52305,0)` cm: eye-height midplane, not the nose or full 3D eye midpoint.
`to_blender` in `scripts/claire_blender_workshop.py` applies
`0.01 * (x,-z,y-147.52305)`: meters, +Z up, front -Y. GLB uses standard Y-up;
Blender's importer performs that conversion. Anatomical `.L` is +X, viewer-right
in a front view. Shared scale/origin aligns the eye and lip bands, not the
entire robot silhouette to human skin.

`prepare_claire` verifies the pinned v2.3.1 data and numerically parses the Maya
scene; **never execute that scene**. It reuses `native_control_mesh` and
`verona_rest_shape`: 15,375 selected native skin vertices, 30,746 triangles,
140 actual PCA shape keys plus Basis. `PCA_000..139` are numeric learned modes,
not named phonemes, visemes or emotions. They start at zero. The exported slider
range is not an anatomically qualified operating range.

Claire has eight mesh objects: skin, two eyeballs, two static irises, two static
pupils and original waves. No Claire armature, full eye joints, independent
teeth/tongue rig, ONNX inference, recordings or shader-identical cosmetics are
inside the GLB. The robot uses separate rigid armor, not copied runtime
`robot.mjs` geometry or an official downloaded character mesh.

Preserve Claire as the motion reference. Destructive remeshing, vertex edits or
interchange can invalidate the saved native-index relationship. A future adapter
must deliberately map speech motion to this mechanical rig and test stability,
collision/clearance and visual quality. **Neither GLB automatically imports
back into Verona or changes its renderer.** Use a new Save As/export name, select
armor plus its armature, export GLB with skinning and optional animation, then
reimport into an empty Blender file.

## Reproduction and isolation

The installed tool is Blender **4.5.16 LTS**, build `3f6797307da5`, under
`.local\tools\blender-4.5.16-windows-x64`. No installation, model download,
neural inference, TTS, browser app or device is needed for this workshop.
The guide reuses the already installed versions in `book\requirements-journal.txt`;
they are document tools, not CPU runtime dependencies.

Run Blender with **background, factory startup, disabled autoexec and two
threads**, using a new `.local\exports\<name>` directory. Set process-local
`BLENDER_USER_CONFIG`, `BLENDER_USER_SCRIPTS`, `BLENDER_USER_DATAFILES`, `APPDATA`,
`TEMP` and `TMP` to disposable owned directories first. Do not use the owner's
profile. Bound `OPENBLAS_NUM_THREADS` and `OMP_NUM_THREADS` to 2 as well.
Cycles renders on CPU with 24 samples; this shares machine resources and is
not a performance guarantee or full operating-system isolation.

The Blender script arguments, after Blender's `--`, are:

```text
--output .local\exports\<new-name>            build both GLBs and the workshop
--output .local\exports\<name> --verify       fresh-factory GLB reimports
--output .local\exports\<name> --preview      four inspection images
--output .local\exports\<name> --render       twelve guide images
```

Invoke `scripts\claire_blender_workshop.py` through Blender's `--python`,
with `--python-exit-code 1`. On Windows use `Start-Process -Wait -PassThru` and
check its exit code, or a bounded Python `subprocess.run`; a direct GUI-subsystem
invocation may return before the job finishes. After successful reimport/render:

```powershell
python scripts\claire_blender_guide.py --output .local\exports\<name>
.\.local\cpu-env\Scripts\python.exe -m unittest discover -s tests -p test_blender_workshop.py -q
```

Build, preview/render directories and the guide refuse overwriting an existing
directory. Missing/changed pinned assets, bad topology, malformed/external-file
GLB dependencies and lost imported motion fail explicitly. Cancellation or an
interrupted process can leave incomplete output; preserve its log/partial files
and restart in a new directory, never mistake mere file presence for completion.
The verifier writes `roundtrip.json`; preserve a prior receipt before rerunning
it. Source assets and owner/sibling processes remain read-only.

## Evidence and limits

Two actual factory imports preserve all 141 Claire key-coordinate arrays with
maximum error **7.45e-9 m**. The imported robot jaw moves **0.01665 m** while the
sampled helmet stays fixed. Blender creates an `Icosphere` bone widget: verification
permits only extras actually referenced as pose-bone custom shapes, not arbitrary
unexpected meshes. Early candidate 01 and its failed checker receipt remain;
candidate 02 also fixes a genuinely occluded static iris and washed guide colors.

Agent review covers all 15 PDF layouts and their 12 render inputs, with detailed
inspection of placement/registration maps and representative geometry views.
That is not owner likeness approval, every-pose collision testing, accurate speech
or runtime qualification. The original model and sample licenses still apply;
before redistribution include their required full agreements/notices and review
character-reference/trademark rights. This local handoff neither publishes the
assets nor modifies the immutable M1 release.
