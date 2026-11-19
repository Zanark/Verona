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
chapter supersedes its unmodified-rest identity, bob, cold materials and
edges-on default. The first source prerelease remains frozen at its earlier
appearance; the main-branch gallery shows this newer design.

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

The default is now **shaded**, with **Edges** and **Points** off. Both diagnostic
toggles remain; enabling Edges reveals the same connected native contours with
a restrained warm overlay. Hair is on by default. This is an intentional
presentation change, not removal of the mesh or silent persistence of settings.
Reload resets view defaults; existing voice defaults remain Hazel.

## Measured cost and qualification

The skin remains 15,375 vertices / 30,759 edges / 30,746 triangles. An 83-frame
clip remains 7,656,750 motion bytes. The complete mesh grows from chapter 08's
827,084 to **1,032,460 bytes**, including the more detailed static hair and eyes.
No new package, model, voice asset or runtime download was introduced.

Final isolated `verona-character-final-03`, 1280 x 980 CSS viewport:

| View | Density | Mean interval | p95 | Maximum | Actual draw submissions |
|---|---:|---:|---:|---:|---:|
| Shaded | 1x | 16.659 ms | 16.8 ms | 17.0 ms | 382 |
| Shaded | 2x | 16.659 ms | 16.8 ms | 16.9 ms | 382 |
| Native edges | 1x | 16.659 ms | 16.8 ms | 17.2 ms | 382 |
| Native edges | 2x | 16.659 ms | 16.8 ms | 16.9 ms | 383 |

Each case has 361 sampled intervals after warmup and zero above 25 ms. The 1x/2x
canvases are 841 x 635 / 1682 x 1270. This qualifies local headless-Edge RAF
cadence and actual draw submission, **not GPU timing, physical display scanout
or a universal 60-fps guarantee**. The unchanged model generates 30-fps motion;
audio-clocked interpolation supplies intermediate display positions.

Thirty-five unit/HTTP checks and 18 real-browser scenarios pass. Added cases
cover bounded rest styling/protected features, generated clips retaining the
styled rest plus known PCA deltas, genuine alternating hair silhouette and
continuous hairline. Actual neutral/speaking/turned/hair-off renders were
inspected; no page exceptions or nonlocal page requests occurred. Playback was
muted, not an independent listening/phonetic or attractiveness acceptance.

## Ownership, failure and delivery

No Verona Python/Node runtime was observed before editing. The candidate uses
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
