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

## Optional lower-neck framing (vr-14)

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
- `verona/web/orientation.mjs`: `rotationMatrix`, `cursorGaze`.
- `verona/web/framing.mjs`: `trimTopology`, `NECK_CUTOFF_Y`;
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
