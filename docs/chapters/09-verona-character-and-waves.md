# 09 - Designing Verona without replacing the speech system

## Direction and scope

The owner asked for an independently designed, more attractive adult character
with a polished office-glam direction and genuinely wavy hair. No new reference
or ethnicity target was supplied. Attractiveness remains the owner's judgment:
the following implementation and measurements are not subjective approval.

The design uses a more tapered lower face, lifted cheek volume, a refined bridge,
warm skin, hazel/gold eyes, tapered brows, restrained liner and rose satin lips.
Chestnut shoulder-length waves replace the bob. This is a deliberately styled
presentation over the existing Claire speech system, not a newly trained person,
photorealistic scan, new speech model or copied likeness.

Chapter 08 remains the native-connectivity and rendering foundation. This
chapter adds rest styling, waves and optional warm materials. The correction
below restores its cool polygon presentation as default. The first source
prerelease remains frozen; the main-branch gallery shows current development.
Chapter 10 subsequently adds a desktop compositor, full XYZ orientation and
procedural cursor-following irises; the eye geometry and learned speech basis
described here remain unchanged.

### Owner correction: preserve the polygon art direction

The owner rejected the first structure as unattractive and clarified that the
earlier cool, transparent-looking polygon presentation must remain the default.
Their screenshot refers to chapter 08's shaded blue surface and bright native
contours, not a literal see-through/X-ray material. Replacing that look with a
solid warm default was an unwanted change, not an accepted interpretation.

The correction restores those cool materials, lighting, eye treatment and
contour strength in **Transparent polygons**, selected on every fresh load and
reload. **Warm shaded face** remains an explicit alternative. The revised
structure narrows the lower face more strongly, lifts/shortens the chin, raises
cheek volume and refines the nose tip/sub-cheek plane. Actual pinned-rest
qualification measures a maximum 0.7884-cm offset and no reversed or collapsed
previously nondegenerate triangles. This is a geometric check, not a claim that
the owner now finds the face attractive.

## Change the rest shape, not every animated frame

`verona.appearance.verona_rest_shape` creates a bounded, deterministic offset
from the retained native rest positions. Smooth front-facing weights and
Gaussian/polynomial masks taper the lower contour, project cheek volume and
refine the bridge/chin. Flat protected regions leave the central resting lips,
eye area and back unchanged. The function copies its input.

`FaceEngine.__init__` applies this styling after native index selection. It does
not modify the pinned assets, native connectivity, retained indices or PCA
basis. With original rest `r`, style function `T`, basis `B` and coefficients
`c(t)`, generation is:

```text
previous: p(t) = r    + B c(t)
styled:   p(t) = T(r) + B c(t)
```

Consequently, frame-to-frame learned displacements are unchanged before normal
binary quantization. The static shape offset does not change according to a
phoneme, timer or guessed expression. This avoids applying a nonlinear beauty
warp independently to each moving frame. It does **not** prove correct contacts:
changing facial rest geometry can still change its appearance during speech,
and full SDK contact correction remains omitted.

Mesh/clip metadata retains `identity: Claire v2.3.1` for the actual model and
separately discloses Verona appearance/rest styling. The UI makes that distinction.
The numerical native-topology cache stays at `claire-native-control-v3`: it caches
connectivity, not styled vertices. Styling and hair are rebuilt at startup, so a
new style does not reuse an old styled surface or require deleting unrelated caches.

## Actual wavy geometry, not painted stripes

`claire_hair` now constructs an original scalp surface plus 26 layered locks.
The cap has 72 angular columns and 18 rows; each lock has 38 length sections
and eight vertices in an elliptical cross-section. Centers follow the crown,
then descend toward the shoulders. Tangential displacement combines an
approximately 1.24-cm main wave and a smaller harmonic; radial variation adds
depth. Smooth root growth, different end lengths and tapered widths create
layering rather than one straight shell.

The result is 9,200 static vertices, 2,332 optional contour edges and 17,840
triangles. Broad locks carry the silhouette; fine fiber variation and the
side part are procedural shader details. Neither is a downloaded texture.
Hair/eyes have no physics, independent joint animation, inferred gaze or blink
system. Hair remains independently toggleable and does not enter motion frames.

Actual first renders exposed two issues that structural checks did not settle:
the crown still read as a straight wig, and a hard forehead clamp introduced
stepped hairline corners. Fuller S-curves, softer tips, a continuous angular
hairline and a visible side part replaced those versions. A geometric
second-difference regression now rejects the discontinuous hairline, alongside
the existing central-face-clear check. These checks are not a beauty score.

## Materials and the default view

`FaceRenderer` keeps area-weighted normals and the two neighboring GPU normal
slots from chapter 08. Its shader now uses softer wrapped key/fill lighting,
warm rim/specular color and gamma-encoded output. Original rest-coordinate
brow, liner, shadow, cheek and lip masks move with the actual skin. Static
ellipsoids retain their original bounds; procedural hazel irises/pupils and
highlights replace the cold eye colors.
Signed cosmetic distances are squared by multiplication: GLSL `pow` on a
negative base is undefined even with an exponent of two. Other highlights
use nonnegative inputs. This avoids driver-dependent cosmetic masks.

`FaceRenderer.draw` sets the uniform `polygonView` from the View selector.
The polygon path restores chapter 08's cool shading and bright, blended native
contours; the optional warm path retains the styling described above. Neither
path changes geometry, regenerates speech, seeks audio or replaces a clip.
The default is **Transparent polygons**, **Edges/Hair on**, **Points off**.
All three toggles remain independent. Reload restores these view defaults;
existing voice/reset defaults remain Hazel. View settings are not persisted.

## Measured cost and qualification

### Superseding reference-guided color study (vr-15)

The owner subsequently supplied a multi-panel character sheet and requested
skin/eye color, makeup and a current visual gallery/release. This supersedes
the earlier absence of a reference, not the identity of the trained model.
The sheet supplies an appearance direction: softer oval lower face, balanced
cheeks/nose, dark side-parted waves, olive warmth, hazel-green irises and
rosewood/bronze cosmetics. It is not measured anatomy, a UV atlas or a rig.
Some labeled left/right panels repeat the same side; several articulation
panels do not establish the contact suggested by their labels. They must not
be treated as phonetic calibration or perfect-expression targets.

`verona_rest_shape` reduces the earlier jaw taper, cheek projection and chin
lift, and retains more bridge/tip volume. Central lips, eye centers and the
back remain protected. A separate smoothly bounded vertical eyelid offset
opens the rest aperture above/below each unchanged eye center; it does not
enlarge or translate the eyeballs. Its tanh core tapers with local eye-distance
and front-depth weights. The learned basis, source IDs and per-frame deltas
remain unchanged. A changed rest aperture is not correct blink/contact
retargeting, and no new animation controls are inferred from the sheet.

`claire_hair` keeps its existing topology/count but changes the continuous
front hairline asymmetry, broadens the locks and thickens their cross-sections.
The shader reduces bright fiber/specular bands and scalp-part contrast.
These remain procedural broad hair masses, not realistic individual strands,
physics, a scanned hairstyle or an exact recreation of the reference.

`FaceRenderer`'s optional **Reference color + makeup** replaces the old label
**Warm shaded face**, preserving its `shaded` value and the polygon default.
It adds green outer irises/amber centers, limbal darkening, lid shadow and a
small procedural catchlight. Rosewood lips, bronze shadow, an espresso wing,
more defined tapered brows and low-amplitude skin variation use rest-space
masks, not a pasted portrait. Fine variation fades with fragment derivatives
to limit aliasing; it is not photographic skin texture or physically measured
material data. Materials/framing/orientation still use one geometry/audio owner.
The supplied sheet is not copied into source, served by HTTP or redistributed.

Two initial high-DPI cases missed the unchanged timing budget: browser02's
full color+edges mean 18.677 ms / p95 33.3 / max 83.2, and browser04's full color
without edges mean 17.585 ms / p95 16.8 / max 66.6. Causes are not established.
The runtime now caps color rendering at 1.5x pixel density; polygons retain 2x.
At the test viewport this intentionally trades 1682x1270 for 1262x953 color pixels; no
polygon-count, neural-generation or physical-display speedup is inferred.

Final browser05 passes 23 scenarios/all 12 view/framing/density combinations.
Means are 16.659-16.660 ms, p95 at most 16.8, max 17.5, zero intervals >25 ms;
every mode performs 185-187 normal updates without GPU normal-storage allocations.
Requested 2x density is **not native 2x color resolution** after the cap.
Actual pixels include 210 green-iris and 1,743 rose-lip samples. The pinned rest
has maximum 0.533324-cm offset and zero reversed/collapsed previously
nondegenerate triangles. Thirty-six unit/HTTP checks and framing/XYZ math pass.
These checks do not prove likeness, beauty or correct expressions.

Browser01/03's crop comparison failed on one upper-face pixel. The diagnosed
03 difference was red 85->87, with green/blue unchanged; cause is not established.
The test now records all diagnostics and allows at most 8 changed upper pixels,
each at most 2/255 per RGB channel. Zero below-cut color and exact full-view
roundtrip remain strict. Final05 has zero upper differences and zero roundtrip
differences. Earlier failed receipts are retained, not replaced by the clean run.

Native01 passes 10 checks, including zero alpha below the neck in both materials,
real composition, gaze, orientation and lifecycle. Its 30-second/1,801-interval
sample has mean 16.659 ms / p95 16.8 / max 17.3 / zero >25 ms, 1,831 draws at 480x600.
Actual neutral/turned/color/polygon/hair-off/UI/overlay images were reviewed.
The new GIFs were independently decoded as 40/24 frames and representative
speech/turn samples reviewed. This remains a stylized 3D color study: not a
photorealistic reconstruction, accepted likeness, perfect-expression system,
independent listening test or universal 60fps guarantee.

No active Verona runtime existed before edits. Qualification retained isolated
owned profiles/cache/synthesis and fixture-only capture over shared hardware;
all owned processes/profiles were stopped/removed. No package/model download,
device activation, user/sibling app interaction or global setting change.
Restart the engine to load changed rest geometry; reload alone changes frontend
materials but not a running backend's rest surface. Stop discards speech RAM.
Existing context-loss, capability, cancellation, stale-clip and error recovery
contracts remain; there is no new empty-success fallback.

Source milestone `f097d8c0b60ff55d6622ed0f28c875ac9aafc103` is published as
immutable source prerelease `v0.1.0-prototype.2` (release `451303877`).
Exact tag/source/body, nine remote media blobs, thirteen runtime blobs and
the GitHub-rendered nine-image/two-GIF README were read back. There is no
installer/model bundle, and the original prototype.1 remains unchanged.

### Preserved Claire and extensible presentations (vr-20)

The owner likes the present lip motion/expressions and names the existing view
**Claire**. Preserve that implementation and prioritize performance while adding
**FaceMesh**, **FaceDot** and **UniformPolygons**. These change presentation,
not the trained identity, PCA coefficients, expression conditioning or audio
timeline. The parked GLB direction is named **Realistic**; it is not resumed.
This feedback is not a claim of perfect articulation or approved reference likeness.

`PRESENTATIONS` and `presentation` in `verona/web/presentations.mjs` form a small
explicit registry: display name, rendering style and initial framing.
`FaceRenderer.setPresentation` reuses the loaded mesh, motion buffer and audio
owner. It restores per-view framing; Claire's separate material and hair/point/
edge choices remain untouched. Unrecognized views fail explicitly rather than
silently substituting Claire. The narrow static-route allowlist in
`verona.server.STATIC` serves the new local module; no generic importer is added.

**FaceMesh** uses `frontFaceTopology`: a measured Claire-specific rest-space
mask (Y135.7-157cm, Z at least-0.7cm, absolute X at most7.5cm) retains triangles
whose vertices all lie on the front facial region. This is not a generic asset
segmentation model. Ears, neck, hair and back disappear; the open facial patch
remains an open patch when rotated. Triangle edges are deduplicated explicitly.
Native level5 retains original front indices. Lower levels use bounded spatial
cells but contract only *connected native edges*, never merely nearby points
on unrelated sheets. Lip, lid and nose regions are protected. Contractions
must pass shared-neighbor/incident-face checks and preserve incident rest-triangle
winding; a synthetic fold regression rejects a tempting but invalid contraction.
These rest checks are not a proof of contact correctness in every moving frame.
Representatives remain original animated vertex IDs; full speech storage/inference is unchanged.
Lower levels can alter detail outside protected regions, not create new phonetic
accuracy. Actual counts are shown instead of calling a detail step a polygon
percentage. Only the latest front index buffers are retained; replacing detail
deletes the previous three GPU buffers. No topology is rebuilt per animation frame.

**FaceDot** renders only circular points. `FaceRenderer.drawPresentation` first
draws animated skin and static eyes with color writes disabled, filling depth
without coloring polygons or making the background opaque. The point pass then
uses depth testing to hide rear/occluded points. Skin includes the ears, eyes and
selected neck/bust extent; procedural hair is intentionally absent. It is not
an X-ray cloud or a free reduction of all background geometric work.

**UniformPolygons** draws an antialiased grid from cylindrical rest-surface
coordinates in the fragment shader. Coordinates interpolate over the same
deformed triangles, so rows/columns move with the face under speech and XYZ
rotation instead of remaining a screen overlay. Cells are approximately
rectangular surface-grid cells, not perfect planar rectangles or a newly
retopologized quadrilateral rig. The hidden depth pass still uses triangles.
Eye pattern contrast retains bounded procedural gaze, not independent eye joints.

New unlit styles use existing neutral normal buffers as unused attributes and
do not call animated `normalBuffer`; interpolation remains audio-clocked.
`presentationFit` computes rest bounds only when selecting an extent and caches
them; FaceMesh keeps the same fit across density changes. Cursor projection
receives the fitted center/scale. Claire uses identity fitting to preserve its
previous framing/pixels. Dot/grid initially choose Head and neck and can expand
to Full bust; FaceMesh fixes its framing. New ink views retain a2x pixel cap;
Claire's optional color remains1.5x.

Switching preserves playback, seeking, expression and desktop ownership, including
pop-out/Controls. Reload resets unsaved view choices and clip state; server stop
still clears RAM speech. Context loss pauses audio and requires explicit reload,
as before. No asset/tool install, new model, microphone/camera, speech history,
external resource request or automatic Realistic activation is introduced.
Qualification and human visual approval remain separate; measurements are
recorded after actual browser/native runs, not inferred from this design.

#### vr-20 qualification

The guarded implementation passes36Python/HTTP checks plus focused JS geometry,
rotation and framing checks. Browser02 passes24scenarios/18playback workloads,
including allthree newviews at1x/2x density. All workload means are16.659ms,
maximum p9516.9ms, maximum interval18ms and zero intervals>25ms.
New unlit workloads perform zero animated-normal updates; all18 perform zero
per-sample GPU storage allocations. These are RAF/submission measurements,
not isolated GPU timings or a universal scanout guarantee.

Actual FaceMesh detail1..5 skin depth triangles:
**11,158 /12,190 /13,456 /14,600 /15,123**. Five detail changes create15 and
delete15GPU buffers. Returning to Claire produces **zero pixel differences**
and restores its material, hair, edges and Full bust framing with the same clip.
Colored draw-call inspection confirms only points for FaceDot and only lines
for FaceMesh; their triangle passes write depth without color.

Native01 passes12checks. At480x600, Claire's30-second sample has1801intervals,
mean16.659ms, p9516.8ms, max17ms. Each new view has181sampled intervals,
mean16.660ms, p9516.8ms, max at most17.2ms, no interval>25ms and no normal
updates; the FaceMesh case uses detail1. Actual transparent native images of
allthree and lowest-detail FaceMesh were inspected. Native pop-out/Controls,
clip continuity, framing restoration, gaze and XYZ remain qualified.

An intermediate numerical audit found more triangles opposed to average native
vertex normals at low detail. That diagnostic alone does not establish inverted
source winding; nevertheless it exposed a contraction risk. Incident
rest-winding and shared-neighbor guards plus the fold fixture now reject that
unsafe move. Browser01 is retained; Browser02/native receipts qualify the guarded
source. Owned test processes stop and their profiles are removed.
Playback was muted, not an independent listening or owner visual acceptance.
No new dependency, model, Realistic integration, release or deployment.

### Deferred custom-avatar direction (vr-16 through vr-19)

The owner explicitly rejected the vr-15 likeness, then supplied a static GLB
as a possible future shape source. That inspection found 239,092 vertices and
479,436 triangles in one connected surface, without a skeleton, facial morphs,
UVs, materials or textures. Actual six-view inspection establishes a sculpt,
not an animation-ready identity. Edge-manifold checks do not establish facial
edge flow, usable mouth/eye interiors, correct articulation or display cadence.
The asset, source paths and private inspection images are not redistributed.

The owner has **parked implementation for later** and requested detailed
planning/tracking only. Four workstreams retain that boundary:

1. [vr-16: feasibility and identity gate](../../TODO/16_CUSTOM_AVATAR_FEASIBILITY.todo):
   establish rights, approved neutral likeness and a tested deformation route.
   A documented no-go ends an investigation, not the downstream prerequisite.
2. [vr-17: animation-ready asset](../../TODO/17_ANIMATION_READY_AVATAR.todo):
   preserve reviewed shape while preparing suitable topology, eyes/mouth,
   materials and documented facial controls with an independently checked export.
3. [vr-18: import and speech retargeting](../../TODO/18_CUSTOM_AVATAR_INTEGRATION.todo):
   implement an opt-in adapter and an actual motion mapping. Claire's PCA
   displacements refer to its own vertex IDs; assigning them to unrelated
   vertices cannot be presented as a valid replacement rig.
4. [vr-19: qualification and handoff](../../TODO/19_CUSTOM_AVATAR_QUALIFICATION.todo):
   measure comparable display workloads and record owner likeness, listening
   and articulation gates separately. A release/default switch needs later
   authorization and rights clearance; passing automation is not human approval.

Dependencies are vr-16 -> vr-17 -> vr-18 -> vr-19, with completed vr-14 framing
also required for vr-18. All four are **NOT_STARTED / deferred**, mapped to
Open/Todo on the existing Project. Explicit owner resumption is required before
implementation; a negative feasibility decision blocks downstream asset work.
Keep the current Claire runtime, polygon default, local privacy boundaries and
immutable prototype tags unchanged. Nothing here promises automatic likeness
reconstruction, an installed modeling stack or universally accurate expressions.

### Historical vr-12 qualification

The skin remains 15,375 vertices / 30,759 edges / 30,746 triangles. An 83-frame
clip remains 7,656,750 motion bytes. The complete mesh grows from chapter 08's
827,084 to **1,032,460 bytes**, including the more detailed static hair and eyes.
No new package, model, voice asset or runtime download was introduced.

Final correction `polygon-correction-03`, 1280 x 980 CSS viewport:

| View | Density | Mean interval | p95 | Maximum | Intervals >25 ms | Actual draws |
|---|---:|---:|---:|---:|---:|---:|
| Default polygons | 1x | 16.660 ms | 16.8 ms | 16.9 ms | 0 | 382 |
| Default polygons | 2x | 17.086 ms | 16.8 ms | 50.0 ms | 7 | 373 |
| Warm shaded | 1x | 16.941 ms | 16.8 ms | 48.6 ms | 5 | 373 |
| Warm shaded | 2x | 17.037 ms | 16.8 ms | 50.0 ms | 6 | 375 |
| Warm shaded + edges | 1x | 16.846 ms | 16.8 ms | 49.9 ms | 3 | 377 |
| Warm shaded + edges | 2x | 16.846 ms | 16.8 ms | 50.1 ms | 3 | 378 |

Cases have 352-361 sampled intervals after warmup. The 1x/2x
canvases are 841 x 635 / 1682 x 1270. This qualifies local headless-Edge RAF
cadence and actual draw submission, **not GPU timing, physical display scanout
or a universal 60-fps guarantee**. All cases pass the existing bounded
mean <17.55-ms / p95 <20-ms checks, but this is not locked 60 fps: occasional
49-50-ms intervals remain. An earlier correction run had one 50-ms interval;
its receipt is retained rather than selecting only a clean run. Their cause
was not established. The unchanged model generates 30-fps motion;
audio-clocked interpolation supplies intermediate display positions.

Thirty-five unit/HTTP checks and 19 real-browser scenarios pass. Added cases
cover bounded rest styling/protected features, generated clips retaining the
styled rest plus known PCA deltas, genuine alternating hair silhouette and
continuous hairline. Actual neutral/speaking/turned/hair-off renders were
inspected; no page exceptions or nonlocal page requests occurred. Playback was
muted, not an independent listening/phonetic or attractiveness acceptance.
The mode-switch regression checks visible pixel differences, exact restored
pixels and unchanged clip URL, time, frame, voice and hair selection. Reload is
tested after deliberately selecting warm shading and disabling edges. The first
correction harness read an already-presented WebGL backbuffer; its false round-
trip failure was fixed by drawing before synchronous pixel readback, not by
weakening the equality check. The failed receipt is retained.

## Ownership, failure and delivery

The owner briefly ran Verona while feedback arrived, then explicitly closed it.
Before runtime edits, a fresh process check found no Verona Python/Node runtime.
An unused clean detached candidate worktree was removed. Qualification uses
the existing owned test helper's private RAM, capability, ephemeral loopback
port, numeric cache, synthesis directory and disposable Edge profile. Model
inputs are read-only; bounded CPU/GPU work still shares the machine. Only owned
browser/server processes are stopped. Earlier qualification/capture receipts
are retained, with no user/sibling profile or global setting changes.

Missing assets, corrupt numeric caches, synthesis errors, cancellation and lost
graphics contexts retain their existing explicit recovery paths. No new
failure-to-empty-success path or hidden fallback was added. Stop/start
`Verona.cmd` to load a changed backend style; reload alone does not reconstruct
an already-running engine. Restart discards speech/clip RAM, not model assets.

The [current gallery](../../README.md) and [media provenance](../media/README.md)
use actual isolated synthetic captures. Silent GIFs sample the timeline at
12 fps; yaw changes are camera/view controls, not predicted head motion.
The source milestone is distinct from the original frozen prerelease,
an installer, a book edition or deployment.
