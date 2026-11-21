# Claire-only Blender export

The owner withdrew both the procedural armored character and the separate
Blender study in **vr-55**. Their generators, mixed workshops and previews are
removed. Do not restore them from historical Git/release material.

The original verified **Claire.glb** is preserved under
`C:\devdesk\homedesk\Verona\.local\exports\claire-only-01`.
Use Blender **File > Import > glTF 2.0**, then Save As your own `.blend`.
The local `index.html` retains Claire-only front/profile/three-quarter,
wire and teaching-region pictures. Region colors annotate one continuous skin;
they are not anatomically calibrated separate muscles.

| Object | Meaning |
|---|---|
| `Claire_Skin_PCA140` | Face, jaw, neck and bust; 15,375 vertices / 30,746 triangles |
| `Claire_Eyeball.L/R` | Separate static eye whites |
| `Claire_StaticIris.L/R`, `Claire_StaticPupil.L/R` | Cosmetic reference discs, not learned eye joints |
| `Claire_Waves_STATIC` | Separate original hair; hide it while authoring a new silhouette |

The skin retains Basis plus **140 named numeric PCA targets**. They are learned
modes, not semantic visemes/emotions; zero is the default and slider limits are
not anatomical qualification. There is no armature, speech/audio, full eye-joint
system, independent teeth/tongue rig or automatic Verona reimport in this GLB.
Changing/remeshing native vertices can invalidate motion correspondence.

`scripts/claire_blender_export.py::to_blender` maps source centimeters to meters:
`0.01 * (x,-z,y-147.52305)`, Blender Z-up/front -Y. GLB is standard Y-up;
Blender's importer performs the axis conversion. Anatomical `.L` is +X,
viewer-right in a front view. `source-map.json` retains the native-index map,
pinned input identities and transforms; `ASSET-RIGHTS.md` retains model terms.
Never execute the downloaded Maya scene.

## Reproduce without touching live heads

Use the installed Blender 4.5.16 LTS in a process-owned lane: background,
factory startup, disabled autoexec, two threads, `--python-exit-code 1`.
Set process-local `BLENDER_USER_CONFIG`, `BLENDER_USER_SCRIPTS`,
`BLENDER_USER_DATAFILES`, `APPDATA`, `TEMP` and `TMP` to disposable owned paths;
bound `OPENBLAS_NUM_THREADS`/`OMP_NUM_THREADS` to 2. Do not borrow the owner's
profile, restart Verona, install tools or download assets.

Pass `--python scripts\claire_blender_export.py`, then after Blender's `--`:

```text
--output .local\exports\<new-name>             build Claire.glb and Claire.blend
--output .local\exports\<existing-name> --verify   fresh-factory GLB reimport
```

Await the Windows GUI-subsystem process and check its actual exit code.
Build refuses an existing output directory. Failed/missing pinned inputs,
changed topology, external GLB resources, unexpected geometry or lost native
shape coordinates fail explicitly. Cancellation can leave partial files;
retain the error receipt and retry a new directory, not an apparent success.
Verification writes `roundtrip.json`; preserve a prior receipt before rerunning.
It checks all 141 native key-coordinate arrays, not human likeness or speech.
Local export does not publish assets, authorize redistribution or change the app.
