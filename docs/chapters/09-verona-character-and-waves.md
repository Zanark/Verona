# 09 - Designing Verona without replacing the speech system

## Two retained hairstyles and mechanical red irises (vr-29)

The owner rejects nine alternatives and retains only **Claire waves (original)**
and **Spiral curls**. This supersedes the inventories in the historical sections
below. `HAIRSTYLES` and `createHairstyle` in `verona/web/hairstyles.mjs` contain
only those identities; the original still comes from the verified native hair.
Removed styles have no registry entries, geometry branches, helper ellipsoids,
prebuilt meshes or gallery GIF files in the current checkout. Retired IDs fail
before generation. Historical Git/release/evidence snapshots are not live
runtime caches and are not rewritten.

Curls increase from24 to48 separately swept locks, not more vertices along the
same24 locks. Each retains40 longitudinal sections/eight sides and the existing
radius/taper. The64x16 scalp plus48 tubes yields16,384 vertices/31,872 triangles.
The focused topology test counts49 connected components: one scalp and48
320-vertex locks, checks packed nondegeneracy/protected facial clearance and
determinism. Selected curls necessarily have more geometry; deleting unrelated
styles does not make this requested increase free. Original/latest-only GPU
ownership, crop cleanup, lazy wire edges and no steady-frame generation remain.

`FaceRenderer.drawPresentation` adds one FaceMesh-only eye-triangle draw through
fragment pass3 in `verona/web/app.js`. After the first soft-dot version, the
owner requests a mechanical optical design inspired by the supplied film
references, explicitly keeping red rather than their blue/cyan. A bright warm-red
core, three concentric emissive rings and24 radial spokes sit over dark iris
gaps, with an exponentially decaying local halo. These are original analytic
shader marks, not extracted reference artwork or added robot-head geometry.
Radial signed distances and angular sectors use screen derivatives to soften
subpixel boundaries. They use existing eye positions, gaze and rest coordinates.
The front-of-eye gate and existing skin/eye/hair depth prepass occlude the glow.
This is an emissive eye-surface treatment, not scene-light emission or a
fullscreen bloom pipeline: no texture targets, new geometry, normal updates
or per-frame allocations. Skin/hair stay in their wire style; Claire/dot/grid
retain their eyes. Turning or cursor aiming uses the same XYZ/gaze transforms.

**Media gate:** the owner wants to inspect the eyes in the app first. No new
snaps/GIFs or redesigned README publication until approval. Existing media
predates these eyes; the remaining curls preview still shows24 locks.
The planned main README will start with a huge transparent front-facing speaking
loop before even its title. A single closed-by-default HTML `details` will
contain everything else, including the separate signed XYZ-turning FaceMesh
animation and only the two retained hairstyle turntables. Standalone GIFs remain centered;
paired hair previews have matching dimensions/angles and natural aspect ratio.
The outer hero directly addresses the reader; the inner loop turns left/right,
up/down, rolls both ways and combines axes. These are authored view rotations,
not head movements inferred from speech.

The owner's fictional horror dialogue expands with surprise/sadness and returns
to a smile. Each phrase is generated through the real local UI/model with an
explicit bounded expression, not an emotion inferred from words or a caption
that pretends the face changed. `verona.engine.EXPRESSIONS` adds **angry** at
channel1; `expression_condition` keeps the existing0-0.6 bound and copied neutral
conditioning. The HTML selector and `verona.generate` CLI expose the same option.
The official [SDK ordering test](https://github.com/NVIDIA/Audio2Face-3D-SDK/blob/main/audio2face-sdk/tests/test_core_parse_helper.cpp)
was read at blob`82d616a763a123da8d5c97f800a6cc64a0f4b674`: amazement0,
anger1, joy6, sadness9. The focused condition test and real inference distinguish
anger from neutral/happy without mutating the neutral vector.

After approval, the planned caption compositor will add the authored phrase below the raw face canvas in
RGB(77,232,219), the mesh ink color, within the **same GIF frames**. Phrase
boundaries follow actual synthesized clip durations rounded to centiseconds;
there is no independently looping HTML subtitle or claimed word-level forced
alignment. Successive explicit-expression clips are an edited presentation,
not continuous one-take speech. No raw speech/motion is published. GIFs are
silent, binary-alpha samples, not listening, realistic-expression, likeness or
phonetic acceptance. The joke does not add face capture or identity theft.

The earlier soft-dot build passed30 browser checks/26 cadence cases and16 native
checks. Browser02 narrowly missed the unchanged mean cadence gate in one case;
Browser03 passed, without relaxing it. These are not measurements of the later
mechanical fragment code. Its separate hidden, sandboxed native in-memory probe
(`mechanical-red-eyes-04`) finds three bright radial bands in both irises,
12/11 visible upper-half spokes, zero rear-facing red pixels, no red in other
views, no new buffers during30 turns and no GL errors. Native eyelids correctly
hide part of the outer ring; an initial full-circle averaging probe incorrectly
expected that occluded portion to remain bright. The corrected probe measures
visible horizontal wedges and the upper arc. No images were captured by these
post-pause probes. The exact added browser ring/spoke regression also executes
in that isolated native probe. Probe03's hidden-window timing attempt timed out;
it supplies no new cadence result and is retained, not counted as a pass.
These facts are technical evidence, not the owner's visual
acceptance, independent listening or a universal performance guarantee.

## Optional monochrome and matching-format hair (vr-28)

The owner wants Claire's added colors optional and the existing hairstyles
available in every view, disabled by default outside Claire. This supersedes
the earlier hair-free-only view restriction below, not the original geometry
or speech identity. **Colors** starts on; **Hair (this view)** starts on for
Claire and off for FaceMesh, FaceDot and UniformPolygons. Each view retains
visibility independently until reload. **Hairstyle (shared)** chooses one of
the same eleven styles for all views and is disabled while hair is off.

`FaceRenderer.constructor`'s fragment shader applies `tint` to Claire's final
lit RGB, including shaded/polygon fills, eye treatment, hair, contours and
diagnostic points. Colors off uses luminance weights0.2126/0.7152/0.0722 and
preserves alpha. It removes hues, not tonal makeup, lighting or geometry.
Colors on restores the original output. Other views keep their existing cyan
ink. These are renderer uniforms, not speech, model or transcript mutations.

`FaceRenderer.drawPresentation` includes enabled hair in both the invisible
triangle depth prepass and the visible style pass. FaceMesh lazily builds all
unique triangle edges with `topologyEdges`, rather than reusing Claire's sparse
hair contours. FaceDot and UniformPolygons send hair triangles through the same
surface-coordinate dot/grid fragment shader as skin, including density/gap.
There is no colored solid hair fill or visible connecting line in dot mode.
Depth hides rear marks; the generated hair remains static relative to the head,
not simulated strands or learned hair motion.

`setHairVisible`, `setHairStyle` and `updateFit` combine the face and visible
hair extents through `presentationFit`. Native face detail and maximum allowed
neck extent define stable fitting supports, so detail/crop sliders do not
reframe repeatedly. FaceMesh retains its front-only skin mask while optional
full hair surrounds it; its detail slider affects only the face. Dot/grid
Head and neck crops hair on the same jaw curve; Full bust retains long styles.
The latest hairstyle owns at most three combined fits (front/full/head-neck),
not a per-slider/per-frame cache. Turning hair off restores the original fit.
Claire's existing style-specific fit stays unchanged.

Presentation transitions defer refitting until the new identity/framing agrees,
and entering FaceMesh explicitly restores full hair after a cropped view.
Only original hair and the latest alternative remain allocated. Replaced
alternative position/normal/triangle/contour/optional-wire buffers are deleted;
original buffers are retained for restoration. Wire buffers are lazy and
hidden hair has no draw passes. Unlit playback still computes no animated
shading normals, allocates no steady-frame geometry and scans no whole mesh
for placement: `placeOverlayTools` reuses bounded directional supports including
enabled hair in all views.

Controls use the existing explicit error surface and transactional hairstyle
construction; failure does not silently choose another style. Reload/restart
discards unsaved visual choices and RAM speech as before. No device activation,
new bridge command, persistence, download, model or dependency is introduced.
The old GIFs remain historical samples of unchanged defaults, not new-feature
captures; releases remain immutable. Qualification and delivery receipts are
recorded with vr-28 separately from user appearance/listening acceptance.

Qualification on the current local AMD environment covers all eleven styles
in all three additional views, front and turned (66 samples), six grayscale
cases and26 live playback cases at1x/2x density, including curls/dense patterns
and monochrome Claire. Maximum per-case mean/p95 was16.660/16.800ms; steady
playback allocated no geometry and unlit views uploaded no animated normals.
Buffer churn peaked at19 watched buffers with only six permitted cache buffers
remaining. Native qualification adds18 front/turned curls/bun/tails combinations
with transparent bounds and tab headroom; selected rendered sheets/captures
were reviewed. These are local muted technical checks, not universal locked
60-fps, independent listening, phonetic accuracy or owner appearance acceptance.

The original hair-toggle fixture restored the checkbox without dispatching
its input event; per-view state correctly exposed that stale fixture. A later
wire byte-hash mismatch was isolated with repeated unchanged-state draws:
one RGB pixel varied by at most five channel levels while fitting uniforms
and coverage stayed identical. Restoration now asserts exact fitting/coverage
and that measured one-pixel wire envelope; dot/grid and Claire color restoration
remain byte-exact. Failed receipts remain. No production workaround was added.
Source `1553ea9cd2cbcf94777b55a0571dacae72d8fcce` is pushed and remotely
verified with all15 changed blobs and Zanark author/committer/trailers.
All51 earlier media blobs and all three existing release identities remain;
there is no new release or deployment. Issue27/original Project item carries
the finite workstream's completion separately from this source publication.

## Gallery correction: layout and genuine alpha (vr-27)

The owner reported a squeezed Long sleek layers preview beside Spiral curls
and requested a centered transparent FaceMesh opening animation. README now
uses equal-width centered cells, identical image widths and natural aspect
ratios. Titles have their own shared rows: at390px, a wrapped longer title
otherwise shifted its image down despite top-aligned cells. The unpaired
Braided crown spans both columns; every standalone GIF is centered.
Existing hair GIFs keep their common yaw sequence and style-specific fit
margins. Equal preview boxes do not promise identical head size or synchronized
independently downloaded GIFs.

Transparency must originate at the renderer, not from removing black pixels.
`FaceRenderer.constructor` in `verona/web/app.js` requests WebGL alpha only
when the real desktop bridge exists. `FaceRenderer.draw` clears alpha to0 in
overlay mode. A hidden owned Electron host therefore captures real transparent
FaceMesh canvas frames after synchronous redraws at synthetic Hazel greeting
timestamps, without a production code/bridge/security change or visible window.
The local GIF encoder reserves transparent index0, thresholds alpha at128 and
uses full-frame disposal2. The format loses partial antialias coverage: it is
binary transparency, not a fully alpha-blended video.

Every one of33 decoded frames matches the original PNG alpha threshold at
every pixel, with correct delays/dimensions,25 distinct frames and no trails.
Four samples were visually inspected on both black and white. Actual GitHub
GFM output with public GitHub CSS in an isolated representative container
qualified equal top-aligned pairs/centered solos at1200/768/390px with preserved
aspect ratios and no overflow; selected rendered screenshots were inspected.
This is not signed-in GitHub chrome, listening or accuracy acceptance.
[The media receipt](../media/README.md) records limits, failures and provenance.
Existing media, prototype.3 and runtime/model/dependencies are unchanged.
Correction source `d80c796dfeab47294528a3f6dac6f91a11a72c4b` is pushed and
read back with all23 GIFs/eleven styles, three centered solo GIFs and the new
transparent hero. All48 previous media/receipt blobs and three immutable
release tags/IDs/bodies/assets remain unchanged; no new release was created.

## Historical visual delivery: all then-available hairstyles (vr-26)

The [main gallery](../../README.md#every-hairstyle-in-motion) now shows every
entry in `HAIRSTYLES` from `verona/web/hairstyles.mjs`: original Claire plus all
ten generated alternatives. Eleven individual 32-frame turntable GIFs expose
front and both profile silhouettes. Full bust/80% zoom retains long hair and
updos; the first full-bust/100% capture clipped the bun and is not published.
This is a capture framing choice, not a runtime/model/fit change.

Twenty-three GIFs also cover the actual speech timeline, four presentations,
pattern controls, two cursor modes, jaw crop, zoom and native collapsed/expanded
controls. [Media provenance](../media/README.md) distinguishes manual view
rotation, sampled speech and discrete control states. Cursor demonstrations
dispatch synthetic pointer positions only in the owned browser; native controls
reuse same-source final qualification captures and flatten transparency to
black. Neither sequence proves physical pointer dragging or OS acrylic blur.

All 561 frames were independently decoded for exact count/timing/dimensions
and changing pixels; representative decoded samples of every sequence were
visually reviewed. That is not every-frame visual review, listening, likeness
or phonetic acceptance. No runtime source, speech model, dependency or asset
changes accompany the gallery. Exact source/media hashes, original failure
receipts, disposable-owner cleanup and publication identity remain separate
from appearance approval. See [prototype.3 notes](../releases/v0.1.0-prototype.3.md).

Gallery source `0ba9669a8c558c0e4944916e5608022c7e5f95d5` is published as
immutable `v0.1.0-prototype.3` (release `451583769`, 2026-11-19T16:05:49Z).
Readback verifies the exact tag/body, GitHub-rendered 24-image/23-GIF README,
all eleven named hairstyles, 24 media blobs and 15 unchanged runtime sources.
Twenty-three historical media blobs and both earlier release bodies/tags/IDs
remain unchanged. This source prerelease includes no installer/model assets.

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

### Adjustable dot/cell density and gaps (vr-25)

The owner next asks to change both the number and spacing of dots/polygons.
`FaceRenderer.patterns` keeps one `[density, gap]` pair for FaceDot and another
for UniformPolygons, initialized to `[1, .6]` and `[1, 0]`. The Controls sliders
select density0.5-3 and gap0-0.8. Switching views restores their separate values;
reload resets them. Claire/FaceMesh hide these controls and keep their original
mechanisms; FaceMesh still exposes protected triangle detail.

The fragment shader uses the rest-space coordinates
`grid = [atan(x,z+4)*12, y*2.7] * density`. Thus increasing density scales both
axes, approximately squaring count per surface area before occlusion/sampling.
Reducing density increases center-to-center spacing. Gap independently shrinks
the visible marks within the same cells: FaceDot uses circular distance from
each cell center with radius `(1-gap)*.36`; the grid insets each rectangular
outline by `gap/2`. Screen derivatives antialias boundaries. Zero grid gap
preserves the original continuous grid calculation.

**This supersedes vr-20's fixed one-native-vertex/one-dot draw in FaceDot.**
Color now comes from patterned triangles with everything outside dots/outlines
discarded, not visible filled polygons. The existing depth-only skin/eye passes
still prevent rear-surface marks leaking through. Pattern coordinates deform
with their source surface instead of sliding across a screen overlay. No new
mesh buffers, point array, denser neural model, quad retopology or extra speech
generation is needed. Changing two uniforms does not increase triangle count;
fragment work and appearance can still depend on zoom, resolution and sampling.
The cylindrical parameterization stretches at anatomy/poles and has a seam;
it is not a mathematically uniform geodesic remeshing. Subpixel marks can soften
or merge. Gap is a fraction of a cell, not a physical-distance guarantee.

### Preserved waves and ten selectable hairstyles (vr-22)

The owner asks for at least ten unique options without replacing the Claire
motion they like. `HAIRSTYLES`, `hairstyle` and `createHairstyle` in
`verona/web/hairstyles.mjs` separate display/fit metadata, validation and geometry.
The original Claire waves remain the default and come from the unchanged,
verified backend mesh. Alternatives are built in the browser only on selection:
no new asset, speech model, download or per-frame hair construction.

| Alternative | Vertices | Triangles |
|---|---:|---:|
| Tapered pixie | 4,608 | 8,832 |
| Rounded bob | 6,400 | 12,288 |
| Asymmetric angled bob | 6,400 | 12,288 |
| Long sleek layers | 6,400 | 12,288 |
| Spiral curls | 8,704 | 16,896 |
| High ponytail | 3,392 | 6,480 |
| Twin tails | 5,760 | 11,040 |
| Coiled top bun | 2,240 | 4,272 |
| Double space buns | 3,456 | 6,624 |
| Braided crown | 4,864 | 9,552 |

A shared continuous ellipsoid cap uses 64 columns and 16 rows. Swept tubes
follow crown-to-tip paths; length/asymmetry/taper produce the short/long cuts.
Curls displace centers helically in X/Z, not just shader stripes. Tails sweep
behind/alongside the head; rippled ellipsoids and coiled sweeps construct buns,
and three interwoven closed paths form the crown braid. Parallel-transport-like
normal projection keeps tube cross-sections continuous rather than flipping
at a reference-axis threshold. Tube winding is outward. Positions are packed
into the existing coordinate/quantization contract; invalid IDs, coordinates,
stationary sweeps and Int16 overflow fail explicitly.

`FaceRenderer.setHairStyle` retains the original four hair GPU buffers plus
only the selected alternative's four buffers (positions, normals, triangles,
contours). It validates/builds the replacement jaw crop before replacing the
active references; a crop-validation failure deletes the candidate hair buffers
and rethrows through the normal error banner, retaining the previous selection.
Old alternative buffers and the latest five crop indices are deleted. Returning
to original waves reuses their exact original geometry, not an approximation.
The registry is a bounded explicit list, not an arbitrary importer or accumulated
per-style GPU cache.

All styles use existing materials, contour toggle and shared rest-space jaw
clipping. Full bust exposes their longer extent; a chosen jaw crop intentionally
removes lower hair too. `updateFit` reserves style-specific room for long hair
and updos; original Claire's fit stays exactly one. Zoom and manual XYZ remain.
Hair-free presentations hide the selector/toggle but retain the chosen style.
Reload resets to original waves; context loss still requires explicit reload.
No async hair request can revive a stale selection; speech/audio ownership is
untouched. Static procedural masses are not realistic strands, collision
simulation, scanned hairstyles or new rigging.

The first geometry test caught curls exceeding the original 17,840-triangle
budget. Reducing longitudinal sections from44 to40 preserves helical geometry
at16,896 triangles. Actual first front/turned galleries also exposed long-hair
clipping and a ponytail passing through the rear scalp. Explicit fit margins
and a farther-rear tail sweep corrected those defects; geometry hashes alone
would not have found them. Human style/beauty approval remains separate.

#### vr-22/25 qualification

The final browser receipt `hair-controls-browser-05` passes28scenarios and
18playback workloads: means16.6587-16.6598ms, maxp9516.9ms, maxinterval17.7ms,
none>25ms. All11 styles produce distinct front and0.8-radian turned images;
actual galleries were inspected. Original pixels restore exactly. Instrumented
style/crop switching peaks at14 new live GPU buffers and ends at0;515created/
520deleted includes deletion of five pre-instrumentation crop buffers.

Thresholded real-pixel connected components increase799->4976 for FaceDot and
616->3797 for separated grid cells at0.5x->1.5x density. These are isolated image
components, not exact global anatomical dot counts. Gap0->80% reduces covered
pixels53588->4310 and55003->8859 respectively. Input changes allocate zero new
mesh buffers and preserve paused audio source/time and separate view settings.
Reload resets original hair/eyes mode/zoom and default dot sampling.

`hair-controls-native-06` passes15checks and actually renders maximum3x density/
80% gap at480x600: each pattern workload has181intervals, means16.659ms,
max16.9ms and zero animated-normal updates. Curls/head-follow's30-second sample
has1801intervals/1831draws, mean16.659ms,p9516.8,max17.3,none>25ms.
Actual native views/hair images were inspected. Focused geometry/pose/crop and
36Python/HTTP checks pass. Earlier Browser03's nine>25ms/max49.9ms intervals
remain historical evidence; a clean final sample is not a universal60fps claim.
All owned processes/profiles close; shared-machine RAF/submission and muted
playback remain distinct from GPU timing, independent listening or owner approval.

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
