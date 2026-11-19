# 08 - Facial definition without sacrificing display fluidity

> Historical presentation baseline: [chapter 09](09-verona-character-and-waves.md)
> supersedes the unmodified rest shape, bob, cold materials and edges-on default.
> Native topology/motion mechanisms below remain; its payload/measurements refer
> to this earlier delivery, not the current wavy-hair presentation.

## Requirement and the failure of the previous view

The owner could not readily distinguish the eyes, nose and mouth in the original
Claire wireframe. They requested a polished female face, supplied reference
images for visual direction, and explicitly prioritized smooth 60-fps playback
while permitting polygon reduction. Those images are not assets or licensed
likenesses: none are copied into the renderer, README or release.

Claire remains the actual female model identity. A brighter line color alone
would not repair contours already damaged by coarse voxel contraction. Chapter
07's 6,545-vertex surface remains a historical delivery, not the current geometry.
The new presentation also does not pretend that more polygons alone establish
beauty, anatomical accuracy or human acceptance.

## Recover native contour flow, not a new identity

`verona.mesh.native_control_mesh` reverses one subdivision layer of the pinned
native quad mesh using connectivity, not a guessed face outline:

1. Validate consecutive triangulated quad fans. The original Maya edge graph is
   bipartite: subdivided edge points are in one class, old vertices and face
   centers in the other.
2. Color the opposite-corner graph to separate old vertices from face centers.
   The pinned face centers have valence three/four; extraordinary five/six-valent
   vertices identify the old-vertex class. Unsupported, disconnected or
   contradictory partitions fail explicitly.
3. Each edge point must connect two retained original vertices. Each face
   center must recover a simple closed polygon. Match polygon winding to the
   incident original oriented normals, then triangulate only for the surface.
   Display lines use the recovered polygon edges, not triangulation diagonals.

The result is 15,375 skin vertices, 30,759 contour edges and 30,746 surface
triangles, versus 61,520 original vertices and 123,036 triangles. This removes
about 75% of the full surface while keeping recognizable eye, nose and lip
loops. No spatial merge can accidentally join two touching but disconnected lips.
`FaceEngine.__init__` validates the pinned result dimensions.

Every retained position and PCA basis row uses its original native index.
`FaceEngine.generate` still reconstructs the original learned motion; there is
no beauty warp, procedural speaking mouth or substitute facial rig. The existing
per-index native/PCA rest guard remains. Numeric cache fingerprint
`claire-native-control-v3` separates this topology from earlier voxel caches;
all source assets are still hash-verified on each startup.

This is deliberately more detail than the previous 6,545-point surface, not a
smaller payload than that surface. An 83-frame clip is now 7,656,750 motion bytes
instead of 3,259,410. The mesh, hair and static eyes total 827,084 bytes. Neither
the old 37%-smaller payload claim nor an unmeasured universal speedup describes
the current version.

## Readable features through lighting and bounded cosmetics

`verona.web.app.js:FaceRenderer` now renders a smoothly shaded surface before
the connected contour overlay. `surfaceNormals` accumulates area-weighted
triangle normals and normalizes them. Two GPU normal-buffer slots cache the
current neighboring neural frames; their normals interpolate with their
positions. Motion replacement invalidates those slots, deletes the old motion
buffer and releases its CPU reference. Temporary normal arrays are not a frame
history cache.

The shader combines a directional key, weaker fill, rim and restrained specular
highlight. Face-oriented translucent lines sit over the depth-writing surface;
the back of the head cannot shine through the nose or lips. Optional diagnostic
points default off, avoiding the earlier bright mouth-region tangle.

Original, identity-specific cosmetic masks use resting coordinates: restrained
brow definition, lip tint and a dark inner-mouth region move with their actual
skin vertices. They do not infer expressions or replace learned deformation.
`verona.appearance.claire_eyes` constructs two static ellipsoids within measured
matching native cornea bounds. The shader adds original iris, pupil and
highlights; normal depth testing leaves the real skin eyelids in front.
These are **static cosmetic eyes**, not gaze prediction, eye-joint animation or
a full eye anatomy implementation. The original procedural bob remains
independently toggleable. No texture, reference image or new model is downloaded.

## Display cadence is not neural generation speed

`animate` continues to use `requestAnimationFrame`; `FaceRenderer.draw` samples
`audio.currentTime * 30`, clamps the neighboring neural frames and interpolates.
On a 60-Hz display, this permits two different displayed positions between
30-Hz model samples. Pausing, seeking and restart still use the same audio clock,
not an accumulated animation timer. Higher display rates are not artificially
limited to 60. Device pixel ratio is capped at two to bound fill cost.

The UI says **30 FPS motion / 60 FPS display target**. This does not claim
60-fps neural inference, streaming synthesis or that a new sentence is ready
within one display frame.

Final isolated Edge run `face-browser-final`, 1280 x 980 CSS viewport:

| Density | Canvas | Sampled intervals | Mean | p95 | Maximum | Intervals over 25 ms |
|---|---|---:|---:|---:|---:|---:|
| 1x | 841 x 635 | 361 | 16.691 ms | 16.8 ms | 16.9 ms | 0 |
| 2x | 1682 x 1270 | 361 | 16.691 ms | 16.8 ms | 16.9 ms | 0 |

Each density recorded 381 actual `gl.clear` submissions during about 6.3 seconds
of looping muted playback. The first 300 ms are excluded from interval statistics,
not from draw counts. The check requires more than 300 intervals, actual draw
submission, mean below 17.55 ms and p95 below 20 ms. This is measured local
headless-Edge qualification on the shared AMD machine, not a guarantee under
arbitrary applications, browsers, refresh rates or hardware. RAF cadence and
draw submission are not a GPU hardware timer or independent display scanout.

The final greeting's complete motion generation took 3.033 s; client readiness
took 3.849 s. These are separate observations, not the 60-fps measurement.
Startup/repeat caches are retained; comparison with Mark remains a tradeoff,
not a blanket claim that Claire generates new lines faster.

## Qualification, ownership and recovery

Thirty-three unit/HTTP checks include native control-loop recovery and outward
winding on an independently constructed subdivided cube, rejection of malformed
quad fans, bounded eye geometry and eye winding. Eighteen real Edge scenarios
cover the new shaded geometry, point/edge/hair toggles, both density cadence
samples, all installed voices, expression changes, transport, preview/reset,
recovery and narrow layout. No page exceptions or nonlocal page requests occurred.
Frontal, turned, hair-off and speaking screenshots were actually inspected.
Playback was muted: listening, phonetic contacts and subjective visual approval
are not inferred from these results.

`tests.run_browser_smoke` now routes numeric topology caching and synthesis work
to its new ignored output directory, in addition to its unique RAM state,
ephemeral loopback port and disposable Edge profile. Model/source files are
read-only inputs; bounded CPU/GPU resources still share the machine. The helper
closes only its owned browser PID, joins its server and removes its profile;
it never drives or restarts the user's browser/app. Failed and historical
receipts are preserved. No production service, package or global setting changes.

Malformed cache recovery, missing assets and lost graphics contexts remain
explicit errors. Reload reconstructs buffers, clears client media and requires
generation again; stopping the server discards its latest RAM speech/clip.
The derived topology cache persists, never speech. Generation cancellation
remains between bounded inference batches. Eyes/hair remain cosmetic static
surfaces; independent teeth, tongue and eye joints and SDK contact/smoothing
remain omitted.

## Visual release boundary

The visual-first [README](../../README.md) uses actual synthetic demo captures
and silent GIFs sampled from the generated timeline, not a new inference-speed
claim. Setup and operating detail live in the [prototype guide](../prototype-guide.md).
The [media receipt](../media/README.md) identifies source/encoding and limits.
The first source prerelease is an explicit GitHub publication, not an installer,
book edition, model bundle, device capture or deployment.
