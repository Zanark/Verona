# 10 - A transparent desktop without a second speech system

## What changed and why

The owner asked for a local desktop version, a head window with a genuinely
transparent background over other applications, cursor-following eyes and
independent X/Y/Z orientation. This is different from chapter 09's
transparent-looking polygon **material**: the desktop background must actually
reveal another window. The existing face, local Windows voices and CPU model
remain; no assistant, camera, microphone or downloaded character is introduced.

The shell uses **Electron 45.3.1**, exactly pinned in `desktop/package.json`
and its lockfile. Electron's documented frameless transparent windows provide
the native compositor boundary while preserving WebGL2 and HTML audio.
WPF/WebView2 was considered because installed Windows/.NET tools could make a
smaller host. Its standard HWND-hosted control has airspace limitations; a
composition-control alternative would need separate transparency/performance
qualification. We did not assume that transparent HTML makes a native HWND
transparent, or rebuild the working speech player around that uncertainty.

The tradeoff is a larger optional Chromium/Node desktop distribution rather
than a tiny executable. It is installed only by explicit setup, locally under
ignored `desktop/node_modules`; the browser path needs no npm dependency.
This checkout's installed desktop dependency tree measures 388,058,477 bytes
(about 370 MiB); caches are additional and shared-machine totals can differ.
There is no installer, auto-updater, startup task or background service.

## One window, two presentations

`verona.desktop.main` creates one existing `State`/`FaceEngine` and ephemeral
loopback `LocalServer`, then owns one Electron process. The ready capability
URL is passed only in that child's invocation environment and immediately
removed in `desktop/main.cjs` before renderer children start. It is not written
to a config file or exposed as a desktop command-line argument.

The initial native window shows the controls and head. **Pop out transparent
head** changes that same window into an initially 480 x 600 frameless,
always-on-top overlay, clamped to the monitor's work area. It is a mode switch,
not two independent windows: **Controls** returns to the saved control bounds.
The WebContents, WebGL buffers, generated clip, voice controls and audio element
are never recreated, copied, transferred, reloaded or resynchronized.
Consequently, a sentence already playing continues on its one audio clock.

The page's `.overlay` CSS hides the input/transport panels and decorative
background. `FaceRenderer.draw` clears RGBA to zero only in overlay mode; the
desktop WebGL context allows alpha; browser-only mode keeps its opaque context.
Native window background and page background are
transparent too. All three layers matter. Skin and hair remain shaded surfaces,
not X-ray geometry. Blended contour passes use separate RGB/alpha blend factors
so alpha accumulates correctly instead of dimming an opaque face/background.

Hover the overlay's top-left area for **Move**, **Controls** and **Close**.
The Move region uses Electron's native drag-region semantics. Closing the
overlay closes the app; Controls is the non-destructive way back.
The checkbox can turn off always-on-top. Transparent regions may still
intercept mouse clicks; this version does **not** promise click-through.
Pinning explicitly uses Electron's `pop-up-menu` level, documented as above the
Windows taskbar; unpinning/returning to Controls restores normal stacking.
The lower default `floating` level did not reliably establish native topmost
state in qualification, as described below. No privileged window band or
global desktop setting is changed.
The native window is intentionally not manually resizable/maximizable:
Electron documents platform-specific transparent-window resize limitations.
The head's existing Zoom control changes its scale before popping out.

## Cursor gaze without recording the desktop

`desktop/main.cjs` samples `screen.getCursorScreenPoint` every 33 ms while the
owned window is visible and following is enabled. Changed screen coordinates
are converted into that window's logical content coordinates and sent through
the isolated preload. This is coordinate sampling, not an input hook, recording,
camera tracker, screen capture or collection of which other app is active.
Coordinates are not logged or persisted. Desktop gaze starts enabled; the
browser exposes the same checkbox but defaults off and can only follow the
pointer while it is in its page.

`cursorGaze` in `verona/web/orientation.mjs` converts screen coordinates using
the orthographic projection and zoom, transforms them by the transpose of the
head's rotation, subtracts the eye location and bounds the result. The shader
shifts both procedural iris/pupil masks within their existing eye ellipsoids.
It is a constrained cosmetic gaze, not independently learned eye joints,
vergence, blink control or a proof of anatomical eye rotation.

An exponential response with a 75-ms time constant smooths the target.
Cursor changes coalesce into the existing RAF callback rather than adding a
second drawing loop on top of audio playback. At rest, drawing stops once gaze
settles; there is no always-running 60-fps neural inference. Disabling following
returns the gaze to neutral. Large/outside-window coordinates are bounded.

## Exclusive eyes-only and head-follow tracking (vr-23)

**Follow cursor** enables the selected **Cursor mode**. Eyes mode remains the
fresh-load default and shifts only bounded iris masks. Head mode sets those
masks to exactly `[0,0]` and applies bounded rigid pitch/yaw to the complete
rendered model, including skin, hair, eyes, points and surface-grid presentations.
This is not a new neck joint, physical eye rig or audio-predicted head motion.

`cursorHeadAngles` in `orientation.mjs` projects the manual-pose eye midpoint
through the same orthographic zoom/fitting transform as rendering. Cursor
displacement defines a virtual target at normalized depth2; atan2 gives pitch
and yaw, bounded to +/-0.45 and +/-0.65 radians (about26/37 degrees).
`trackedHeadPose` composes `Rfollow * Rmanual`; the X/Y/Z sliders remain offsets
rather than being overwritten by cursor updates. An offset equal to the manual
eye position minus the combined eye position makes that point stationary under
head rotation, avoiding an orbit around the bust center. The vertex shader adds
this rigid offset after rotation; normals use the same combined rotation.
At zero tracking angles the exact manual matrix is reused.

This is bounded procedural screen-space aiming at a virtual target, not a
calibrated 3D cursor direction, vergence or perfect eye alignment under arbitrary
manual rotations. Extreme manual offsets can intentionally look away. Desktop
sampling/IPC and browser page pointer boundaries remain unchanged; no cursor
warp, hook, coordinate history or input-device permission is added.

The same75-ms exponential response settles head angles. Its remaining error
is snapped to the exact target *after* each step when below0.0001 radians.
Browser qualification caught the earlier ordering leaving a0.0000935-radian
residual: scheduling stopped as soon as the post-step error crossed the bound,
before a subsequent frame could snap it. Applying the snap after the step fixes
the cause for both head and iris settling, without weakening the exact-neutral
assertion. `gazeMoving` includes both quantities, maintaining one coalesced RAF.

Switching modes clears the old tracking offsets before drawing. Disable/lost
browser pointer settles to the manual head pose/neutral irises; no audio is
paused, regenerated or sought. Reload restores eyes mode, original hair and
initial following defaults (desktop on/browser off). Reset orientation changes
manual XYZ/zoom only, not the selected tracking mode. Existing graphics-loss
and error recovery remain explicit.

Native images exposed crown/updo clipping under tracked turns despite the
initial automated checks passing. Head mode now uses a fixed0.8 fitting margin
for both shader projection and cursor/pivot math, independent of changing
tracking angles (no automatic zoom breathing). It applies even with Follow
cursor off; selecting eyes mode restores original fitting exactly. Manual
rotations and deliberate high zoom can still clip by design.

## Floating controls, placement and glass tab (vr-24)

The owner requests direct placement/zoom, then asks to collapse the options by
default into a very small translucent frosted-glass tab centered above the head.
`index.html` separates the34x20-pixel `overlay-toggle` from hidden
`overlay-options`. Clicking opens the existing native drag region, zoom-/+,
Fit, Controls and Close; Escape closes and restores toggle focus, and pointer
input outside closes without stealing focus. Every pop-out starts collapsed;
no hover-only discovery, persistent preferences or second native window.
`aria-expanded`, `aria-controls`, labels and focus outlines expose its state.

`FaceRenderer.placeOverlayTools` caches neutral skin/selected-hair support points
only when their resources change. Ninety-eight fixed directions select extreme
vertices, deduplicated to at most98 points; only those points are projected per
draw with the same fit, manual/tracked rotation, pivot offset and zoom as the
head. Sixteen pixels of support-sampling clearance separate the tab from the
estimated silhouette, with horizontal centering over its projected extent.
Viewport clamps keep it reachable after extreme rotations/zoom. This is bounded
rest-surface support sampling, not pixel readback or exact animated silhouette
segmentation. Expanded controls center within the window
and wrap instead of escaping narrow viewports. No geometry scan occurs each
speech frame; the bounded support projection shares the existing draw loop.
The native overlay reserves an additional fixed10% fitting margin so a default
crown at the old top edge leaves room for the tab; browser fitting is unchanged.
Explicit high zoom/manual rotation can consume this clearance.

CSS translucent gradients, a fine highlight, shadow and
`backdrop-filter: blur(14px) saturate(1.35)` provide the glass treatment.
**This is web-content glass, not OS acrylic:** CSS can blur content in Verona's
own layer, not promise blurring unrelated desktop windows through Electron's
transparent background. Genuine background transparency remains unchanged.

Floating zoom buttons reuse the existing range/input event:35-230%,0.1 steps,
Fit1. Controls displays the identical value; Reset orientation also restores1.
Only view projection changes, never window size, prepared audio/time or motion.
Bounds disable the appropriate button. Restart/reload restores1.
Large zoom can intentionally exceed the canvas.

`desktop/main.cjs` retains `overlayBounds` in RAM when returning to Controls,
restoring the last moved placement on the next pop-out. It selects the saved
rectangle's available display and clamps the fixed480x600-or-smaller window
inside that work area; monitor removal cannot restore unreachable coordinates.
Restart forgets placement. The existing `-webkit-app-region: drag` moves the
native window; interactive buttons remain `no-drag`. No position/file IPC,
system cursor warping, global hook, speech persistence or profile change.

### vr-23/24 qualification

`hair-controls-browser-05` verifies both tracking directions/bounds, exact
centered irises, preserved manual values/audio, mode/disable/pointer-loss
settling and fresh-load defaults. Twenty-eight browser scenarios and18cadence
workloads pass. The final overlay-only support-anchor/headroom refinement is
separately qualified in `hair-controls-native-06`, which passes15checks.
The34x20 tab starts collapsed, exposes correct ARIA state, expands, collapses
on Escape/outside input and uses the actual blur style. Inspected default and
expanded captures establish appearance, not merely a computed-style claim.
Tracked curls/bun/twins leave14.8/15.4/15pixels between tab and rendered crown.
Earlier box-corner anchoring left excessive space and default Claire had no
tab clearance; actual images drove sampled support and10% native headroom.

Native fixture-owned placement moves from1420,20 to1340,60 and survives Controls/
pop-out; the native drag region is verified, **not an automated physical drag**.
Direct zoom changes actual alpha coverage, shares Controls state, clamps to
35/230%, disables endpoint buttons and resets100%, without changing source/time.
Thirty seconds of curls/head-follow submit1831draws over1801sampled intervals:
mean16.659ms,p9516.8,max17.3,none>25ms. Maximum3x dot/grid sampling also passes
the native budget with no animated normals. These remain bounded shared-machine
RAF/submission measurements, not GPU/scanout or subjective acceptance.

Retained Native02's initial zoom snapshot read an already-presented backbuffer;
synchronous redraw before readback fixes that harness error. Native03's
guarded fixture capture failed; it saved no screenshot. Exact fixture-bound
placement/readback and richer RGB diagnostics were added without relaxing the
corner safety check. Native05 correctly refused external-cursor qualification
when the real pointer was inside the owned window. The fixture now moves its
own window away once, rather than warping the owner's cursor. Final Native06
passes the unchanged capture/cursor gates. No sibling app/profile or device use.

## Full orientation and the coordinate contract

X tilt, Y turn and Z roll each span -180 to +180 degrees. The controls retain
radians internally; displayed readouts use degrees. `rotationMatrix` constructs
the column-major matrix `Rz * Ry * Rx`, applied equally to positions and normals
in the vertex shader. These are rotations around the normalized model center,
not separately animated neck joints or a perspective camera.

`cursorGaze` uses the inverse of that same orthonormal transform, so turning
the head does not accidentally interpret a screen-right cursor as local-right
in every orientation. Euler controls can have gimbal-lock redundancy near a
90-degree Y rotation; that is a representation limitation, not missing head
orientations. **Reset orientation** zeros all axes and restores Zoom 1 without
changing the voice, material, clip or playback time.

## Historical plane-based lower-neck framing (vr-14)

This section records the original implementation and counts. The jaw-following
vr-21 extension below supersedes its horizontal cut and one-time crop cache.

**Framing: Head and neck** hides the shoulders through a plane at the lower
neck, below the throat. **Full bust** remains the initial/default option and
restores the original extent. This is independent of transparent polygons versus
warm shading, edges, points, hair, gaze, orientation and zoom. It works in both
the browser and native overlay. Choose it in Controls before popping out; it
survives the pop-out/Controls switch without replacing, seeking or pausing audio.
Reload/restart restores Full bust, just like the other unsaved view controls.
Reset orientation does not change framing.

`FaceRenderer.setFraming` uses `trimTopology` in `verona/web/framing.mjs`.
The fixed prototype boundary, `NECK_CUTOFF_Y`, is model-space Y = 134 cm, not a
screen rectangle or a clipping camera. The renderer converts it to the packed
neutral-coordinate system for classification. Whole skin/hair triangles and
edges with no vertices above the plane are excluded from new index buffers.
Crossing primitives remain, with the fragment shader discarding only their
below-plane portion. This combination avoids a jagged vertex-row boundary
without submitting all the hidden shoulders. The same rest-space boundary
applies to skin, hair, contour lines and diagnostic points before any XYZ
rotation, so turning the head does not reveal the shoulders again.

Original vertex IDs, full positions and motion remain intact. The optional
point index buffer and the normal-calculation vertex list include the retained
surface's boundary vertices; below-plane points are discarded too. A new
normal frame accumulates only retained triangles and normalizes only the
retained vertex list. Neutral/static hair normals remain the original normals.
Changing framing invalidates the two normal-frame slots so an already-cached
full normal frame cannot leak into reduced animation, or vice versa.

The actual native draw submissions change as follows:

| Work | Full bust | Head and neck |
|---|---:|---:|
| Skin triangles | 30,746 | 26,285 |
| Hair triangles | 17,840 | 17,232 |
| Skin contour edges | 30,759 | 26,259 |
| Hair contour edges | 2,332 | 2,256 |
| Skin vertices considered for animated normals | 15,375 | 13,195 |

Eyes remain 2,432 triangles. With hair enabled this removes 5,069 triangles
overall (about 9.9%) and about 14.2% of the animated-normal vertex iterations.
This is a work-count reduction, **not an inferred percentage speedup**.
The reduced index buffers are built once on first use and reused. Full-size
position/motion buffers, normal scratch clearing/upload and the CPU neural
model are deliberately unchanged: no second clip, remapping copy or inference
request is introduced. Retaining full geometry plus small derived index buffers
uses additional bounded memory rather than claiming a total-memory reduction.

This is a reversible presentation crop, not destructive body deletion or a new
closed anatomical model. Looking underneath can reveal an open neck boundary;
no cap or shoulder replacement is synthesized. The original full extent remains
available for later framing work. It does not invent a full-body asset or a
future extent slider. Any malformed/empty framing result surfaces through the
existing error banner and leaves the last valid choice; no empty-success render.
Graphics loss/restart, ownership, local-only speech and native trust boundaries
are unchanged.

## Jaw-following cut and live visibility (vr-21)

The owner rejects the horizontal chop and supplies a drawn jaw-shaped boundary.
**Head and neck** now uses a curved rest-space cutoff, with **Visible neck**
from 0 to 6 model centimetres. Zero follows the jaw; increasing the value lowers
the whole curve to reveal more neck. The initial 1.7 cm keeps some neck while
raising both sides. Full bust restores the complete original geometry.
This is a live visual adjustment, not an image-reconstruction or anatomical
segmentation claim. The supplied reference image is not a runtime asset.

`JAW_CROP`, `jawCutHeight` and `trimJawTopology` in `verona/web/framing.mjs`
define the Claire-specific profile:

```text
cutY = 135.7 + 0.1*x*x
       + 3*clamp((-1-z)/7, 0, 1) - visibleNeck
```

Coordinates are original model-space centimetres, before view fitting or XYZ.
The quadratic side rise follows the jaw silhouette; a bounded rear rise removes
the back neck rather than keeping a dangling rear slab. Skin, hair, triangles,
contours, points and unlit depth passes share the same fragment predicate.
The shader interpolates its constants from the JS definition rather than
maintaining an unrelated handwritten second profile.

A curved clip needs more care than the old plane. A primitive whose corners
are all clipped can still have a visible interior: its straight edge may cross
above the curve. `trimJawTopology` therefore evaluates a conservative lower
boundary over each primitive's X/Z bounds and its maximum Y. Nearest-to-zero
X minimizes the quadratic; maximum Z minimizes the rear rise. Only a primitive
proven fully below that bound is removed. A 0.002 cm safety margin covers packed/
float boundary arithmetic; the fragment pass applies the exact visual curve.
Synthetic triangle and edge fixtures explicitly retain those crossing interiors.

`FaceRenderer.setNeckDepth` rebuilds only on input, not playback frames.
Only the latest cropped skin triangle/edge/point buffers and hair triangle/edge
buffers survive: five replaced buffers are deleted. Retained original vertex
IDs still address the full motion, and animated normals use the reduced skin
triangles/vertex list. Skin/static-eye/full-position/motion storage and neural
inference are not reduced or regenerated by this presentation change.

Each presentation retains its own neck value, alongside its own framing.
Claire retains original projection; Dot/grid use a fixed fit encompassing the
maximum neck setting so dragging does not zoom or recenter the face.
FaceMesh remains its separate front-only mask and hides this control.
Switching view/extent or returning from pop-out preserves the prepared audio,
time, expressions, gaze and XYZ. Reload/restart loses unsaved view controls and
restores initial defaults; Reset orientation does not reset the crop.
Malformed/empty crop data fails explicitly and keeps the previous valid cache.
The cut remains an open surface, not a closed/capped replacement anatomical rig.

An initial 8 cm maximum exposed the asset's
existing lower-neck/base seam in an actual native image despite passing
automation. The 6 cm bound intentionally stops earlier; Full bust remains the
explicit route to the untrimmed source, not a promise of newly modeled anatomy.

### Jawline qualification

The final private `jawline-framing-browser-03/browser-report.json` passes
25 scenarios and all 18 existing playback workloads. Default 1.7 cm uses
25,178 skin and 11,353 hair triangles; animated normals consider 12,669 skin
vertices. Original full geometry, full motion and inference remain available.

| Visible neck | Skin triangles | Hair triangles | Colored browser pixels |
|---|---:|---:|---:|
| 0 cm | 23,439 | 10,165 | 116,801 |
| 3 cm | 25,692 | 12,275 | 131,884 |
| 6 cm | 26,517 | 14,345 | 154,432 |

Three live changes create and delete exactly 15 index buffers. Input-handler,
topology-build and draw-submission time is 7.2-12.6 ms in this bounded sample,
not GPU completion or an end-to-end latency claim. Audio source/time remain
unchanged; Claire and Dot restore their separate values. The default removes
77,283 pixels relative to Full bust, with zero upper-region changes, zero
colored pixels below the conservative curve and an exact Full bust round trip.

`jawline-framing-native-02/desktop-report.json` passes 13 checks. Actual colored
native PNGs at 0/1.7/6 cm were inspected: the skin/hair edge curves and the
previous maximum's lower-base seam is absent. Colored pixel areas increase
104,183 / 110,715 / 137,868. At the default, lowest visible GL rows at 30%, 50%
and 70% canvas width are 248 / 168 / 245: both sides rise relative to the chin,
rather than repeating the old horizontal chop.

The native Claire sample has 1,801 intervals and 1,831 draw submissions at
480 x 600: mean 16.659 ms, p95 16.8 ms, maximum 17.3 ms, none over 25 ms.
Each new view has 181 intervals, p95 16.8 ms, maximum at most 17.2 ms and
zero animated-normal updates. These are shared-machine RAF/submission results,
not GPU timers, scanout guarantees or a percentage speedup. The isolated
servers/browser/native processes stopped and disposable profiles were removed.

Browser01's one colored pixel below the curve remains a failed receipt with
unknown cause. Diagnostics did not weaken the assertion; Browser02 passed it.
Before final Browser03, the awaited module import moved before pixel snapshots
to avoid an asynchronous layout/readback gap, without claiming a proven cause.
The original 8 cm Browser02/Native01 receipts remain historical, not final-range
evidence. Focused curved-interior/error fixtures and 36 Python/HTTP checks pass.
Muted playback and image inspection are not listening, owner contour/likeness
approval or perfect articulation. The slider leaves visibility with the owner.

## Local trust, ownership and recovery

The shell admits only its exact loopback origin and same-origin blob audio.
External requests, pop-up windows, redirects, downloads and permission requests
are denied. Renderers keep sandboxing, context isolation, web security and
`nodeIntegration: false`; there is no generic command, filesystem or evaluation
bridge. `preload.cjs` exposes only a narrow desktop-command interface and native
cursor/mode subscriptions. Main-process handlers verify the sender frame and
origin and accept only the defined actions/types. The existing HTTP capability,
origin checks, bounded generation and latest-only speech/clip RAM remain.

Every launch uses an owned disposable profile and in-memory session partition,
not Edge's or another Electron app's profile. Environment inheritance is
allowlisted. Only existing pinned model files and the derived numeric geometry
cache are shared; speech state is a new engine/server per desktop launch.
No user's active instance was present before runtime edits.
CPU, GPU and the desktop compositor remain shared resources, not reserved test
hardware. Native and browser cadence probes run sequentially with bounded
durations; disposable data and separate ports do not eliminate contention.

Closing the native window returns control to Python, which stops the server
and clears RAM. Ctrl+C requests WM_CLOSE only for windows belonging to the exact
owned Electron PID; after a disclosed ten-second timeout it can terminate that
specific process. The native host also checks parent-process liveness once per
second and quits if Python disappears. This is not a permanent PID-identity
guarantee under arbitrary OS process reuse. An in-progress bounded Windows
speech step can still delay final Python shutdown. No broad name-based kill.

Missing desktop dependencies produce an explicit setup command, not an
automatic download or browser fallback disguised as desktop success. Missing
models retain the existing failure. Invalid bridge commands are rejected.
Graphics loss pauses audio, stops gaze scheduling and displays recovery text
in the overlay as well as the controls. Restart discards the clip; returning
to Controls does not. Renderer crashes surface a native error instead of
leaving a silent frozen head. Failed profile cleanup is an error, not success.
Fatal compositor/startup errors display recovery text, log the cause and exit
with code 1, so the Python owner and launch script cannot mistake them for a
normal close. A focused host regression exercises missing/invalid endpoints
and a rejected compositor initialization without opening a native error dialog.

## Qualification and its limits

The native qualification uses its own real Electron windows, private model
cache/synthesis workspace/profile and a solid-color synthetic backdrop.
It never drives another application or warps the owner's system cursor.
Screen capture is restricted to that owned fixture rectangle, with all four
corners checked against the exact fixture color before saving.

The final native receipt is `desktop-overlay-10/desktop-report.json`. Tests cover genuine
zero-alpha background pixels and opaque head pixels, native composition over
the backdrop, cursor gaze while the cursor is outside the overlay, full axis
endpoints, unchanged audio URL/time advance during pop-out, control restoration,
invalid IPC and parent-requested native shutdown. Actual captures are reviewed,
not inferred from a zero process exit. Muted audio is not listening acceptance.

The final 30-second native sample measured 1,801 intervals: mean 16.659 ms,
p95 16.8 ms, maximum 17.8 ms, no intervals over 25 ms and 1,831 actual draw
submissions at 480 x 600. This is a bounded visible-window RAF/submission
measurement, not GPU timing, physical scanout or universal locked 60 fps.
Both final native PNGs were visually inspected and published with separate
[desktop provenance](../media/desktop-provenance.json), preserving the older
vr-12 gallery's original receipt. The actual production entry point
`python -m verona.desktop` was also launched independently: its visible native
window responded, native close returned exit 0 and its observed disposable
profile was removed. All 35 unit/HTTP checks and focused orientation math pass.
The browser regression separately qualifies the retained browser UI and both
materials at normal/2x density. Historical frame-time outliers remain
documented; a newer clean sample does not erase them.
One subsequent 2x shaded-edge browser case failed the mean budget at
17.688 ms (p95 16.9 ms, maximum 83.4 ms). Its cause was not established.
The browser-only context was returned to opaque operation because only the
desktop needs composited alpha; final requalification is recorded in vr-13,
without deleting the failed receipt or claiming this establishes the spike's
cause.

A following opaque-context browser run also failed a later shaded-edge case:
mean 21.179 ms, p95 49.6 ms and maximum 117.6 ms. Shared-machine CPU utilization
was subsequently observed at 70%; this does not establish the failure's cause.
Inspection found avoidable normal-buffer allocation during playback.
`FaceRenderer.normalScratch` now reuses one CPU array, and two preallocated
dynamic GPU normal slots receive `bufferSubData` updates rather than new
`bufferData` storage on each cache miss. The browser regression counts these
calls during all six modes: normal updates must occur without storage allocation.
This removes a concrete source of churn; it is not proof that allocation caused
every historical scheduling spike.

The final `desktop-browser-05` receipt passes all 20 scenarios and six
material/density modes. Mode means range from 16.659 to 17.184 ms, p95 is at
most 16.9 ms, maximum is 66.7 ms and nine intervals exceed 25 ms. All six modes
make zero normal-buffer storage allocations and 185-187 actual updates each.
The bounded mean/p95 budget passes, but the remaining outliers are real; CPU/GPU
storage reuse is not a guarantee of uninterrupted 60-fps browser playback.
The preceding `desktop-browser-04` sample had no intervals over 25 ms; it does
not replace the final receipt or erase the retained failures.

The first native harness incorrectly accepted a clean exit without its required
artifacts: GUI stdin EOF had closed the shell before qualification. Environment
handoff replaced stdin, and the harness now requires its complete named receipt
and native images. A subsequent assertion expected eight checks while only
seven existed; the retained report/images exposed the mismatch. The eighth
case now actually measures native draw cadence. Neither failure was hidden as
successful desktop qualification.
Native runs 07-09 exposed a persistent always-on-top failure despite the page
reporting overlay/pin enabled. Waiting five seconds did not fix it; native
event tracing showed the flag remained false. A separate bounded probe of owned
transparent and opaque fixture windows compared Electron's getter with the
actual Win32 `WS_EX_TOPMOST` bit. Both were false for default/explicit `floating`
and true for `pop-up-menu`. The shell now explicitly requests that documented
level rather than guessing that page mode or a delay establishes native state.
The actual pin checkbox is tested both off and on. These failed receipts and
the probe remain; earlier successful default-level runs do not erase them.

## Framing qualification

vr-14's final native receipt is `head-neck-native-03/desktop-report.json`.
Ten actual checks pass, including zero alpha below the neck in both materials
with points/contours/hair, smaller actual `drawElements` submissions,
uninterrupted audio through framing/pop-out, retained framing on return and
restored full geometry. A rotated native capture was visually inspected after
allowing compositor presentation; the first immediate capture showed an older
axis-test frame, so the harness now waits 150 ms before this capture.
The final 30-second sample has 1,801 intervals, mean 16.659 ms, p95 16.8 ms,
maximum 17.0 ms, no intervals over 25 ms and 1,832 draw submissions.
The preceding native-02 sample passed the same budget but had 15 intervals
over 25 ms and a 50.2-ms maximum. It is retained, not erased by the cleaner run.
The [new overlay capture](../media/head-neck-overlay.png) has its own
[provenance](../media/head-neck-provenance.json); prior media remains historical.

`head-neck-browser-02` passes 22 scenarios and all 12 combinations of framing,
material/edges and 1x/2x density. Six full-view means range from 16.659 to
16.660 ms, p95 at most 16.8 ms, maximum 17.5 ms. The six head/neck cases have
the same rounded mean/p95 range and maximum 17.3 ms. No interval exceeds
25 ms in that bounded run. Each mode performs 185-187 real normal updates and
zero new GPU normal-storage allocations. The first browser run passed framing
behavior but failed a cropped 1x polygon case at mean 18.114 ms, p95 16.9 ms
and maximum 101.8 ms. Its cause is not established; CPU utilization of 52%
observed afterward is not a causal explanation.

The browser verifies an exact pixel round trip to full neutral geometry,
43,592 changed crop pixels, no changes above the boundary and no colored
pixels below it; actual dynamic uploads contain 13,195 nonzero normal vertices.
Focused topology tests cover hidden/crossing/exact-boundary primitives,
preserved original IDs/arrays and explicit invalid/empty results. All 35
Python unit/HTTP checks pass, including the new exact static-module route.
These are functional/target-environment results on shared hardware, not
proof of physical scanout, a percentage speedup, listening or human acceptance.

## Primary implementation references

- `verona/desktop.py`: `main`, `stop_desktop`.
- `desktop/main.cjs`: `start`, native commands, cursor and parent-liveness timers.
- `desktop/preload.cjs`: isolated, allowlisted renderer/native interface.
- `verona/web/app.js`: `FaceRenderer`, `draw`, one RAF loop and desktop mode events.
- `verona/web/orientation.mjs`: `rotationMatrix`, `cursorGaze`,
  `cursorHeadAngles`, `trackedHeadPose`.
- `verona/web/framing.mjs`: `JAW_CROP`, `jawCutHeight`, `trimJawTopology`
  (historical `trimTopology`, `NECK_CUTOFF_Y` retained);
  `FaceRenderer.setFraming`, `surfaceNormals` in `app.js`.
- `tests/run_desktop_smoke.py`, `tests/desktop_smoke.cjs`,
  `tests/capture_desktop.ps1`, `tests/test_orientation.mjs`,
  `tests/test_desktop_host.cjs` and browser smoke.

Framework sources reviewed November 19:
[Electron transparent-window limitations](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles#transparent-windows)
and [Microsoft's WPF/WebView2 composition/airspace notes](https://learn.microsoft.com/en-us/microsoft-edge/webview2/platforms/wpf).
[Electron's native topmost levels](https://www.electronjs.org/docs/latest/api/base-window#winsetalwaysontopflag-level-relativelevel)
document the Windows taskbar distinction.
The live Electron documentation referenced 45.4.1, but the configured verified
package feed actually supplied stable 45.3.1; no unavailable version or
prerelease was silently installed. Direct npm registry TLS failed; the existing
configured HTTPS package feed worked without disabling certificate validation.
Early setup may have used Electron's normal per-user download cache. Current
setup directs its caches under `.local`; no shared cache was deleted.
