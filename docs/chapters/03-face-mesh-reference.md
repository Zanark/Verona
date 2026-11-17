# 03 - Face mesh: read-only KardboardCode reference

**Scope:** source-level understanding of KardboardCode-VTuber, reviewed
2026-11-18 at commit `75e7dd68de6af2a444b62213c28e4bcf9fd5100c`.
The reviewed tracking/CLI source files have no working-tree edits. No source was
copied into Verona, model installed, camera opened or live behavior requalified.
Sibling continuity remains read-only. Source references below are relative to
that repository, not this one.

## First distinguish four different things

The inferred facial landmarks describe a face. Continuous controls summarize
eye/mouth openness and head pose. The face-mesh panel visualizes those estimates
without showing camera pixels. The separate textured cardboard model is an
application-specific renderer. The debug panel is not the avatar's triangle
mesh, a face reconstruction export or a depth sensor.

Verona may need some of these mechanisms, none, or a different inference engine.
That decision waits for its product brief.

## 1. Input and inference ownership

`src/kardboard_vtuber/tracking/mediapipe_tracker.py`,
`MediaPipeFaceTracker`, owns one Face Landmarker configured for one face,
blendshapes and facial transformation matrices. The default model path is
`models/face_landmarker.task`; absence reports an explicit setup error.

`_prepare_frame` only downsizes frames wider than the configured maximum
(default 640), preserving aspect ratio, then converts OpenCV BGR to contiguous
RGB. The processing image and full-resolution output are separate concerns.

Live mode uses `detect_async` and its result callback. Timestamp milliseconds
derive from capture time and are forced strictly increasing even when two
submissions round to the same millisecond. Offline VIDEO mode instead calls
`detect_for_video` synchronously with supplied timestamps. These are different
execution modes behind the same normalized result contract.

The tracker holds only its latest raw and filtered state under a lock.
`snapshot` returns immutable state and counters, not an inference queue.
Submitted-minus-result counts combine pending/dropped work; they do not
identify which frames were dropped or measure full camera-to-display latency.

## 2. Library-neutral face state

`tracking/models.py`, `normalize_face`, converts the first face's landmarks
into an immutable tuple of x/y/z points. Bounds are min/max x/y across those
points; their midpoint and extent produce center, width and height in image
coordinates. The adapter does not enforce a fixed landmark count.

Independent eye openness is `1 - eyeBlinkLeft/Right`; mouth openness is
`jawOpen`, clamped to [0,1]. Nonfinite blendshape scores clamp to zero.
An explicit eye swap handles the selected input convention; anatomical left
must not be guessed from screen position after mirroring.

`HeadPose.from_matrix` requires a 4x4 matrix, takes translation from its last
column and uses OpenCV `RQDecomp3x3` on the upper-left 3x3 for pitch/yaw/roll.
Missing matrices yield an identity pose in this implementation, not a measured
neutral head. Missing blink scores yield open eyes, and missing jaw scores a
closed mouth. Those defaults are important limits if reusing the contract.
Landmark z and pose translation are not calibrated metric scene depth.

`FaceTrackingState.no_face` preserves an explicit detected=false flag and
empty landmarks. Its numerical defaults must never be treated as an observed
centered face.

## 3. Smoothing without losing brief actions

`tracking/filters.py`, `FaceMotionFilter`, applies separate One Euro filters
to landmark coordinates, bounds, expressions and pose. Each scalar filter
low-passes a velocity estimate, increases cutoff with its absolute value and
then low-passes the signal. Slow movement receives more smoothing; rapid
movement receives greater responsiveness.

This is time-based, not a fixed average of N frames. Timestamps must strictly
increase. Tracking loss or a changed landmark count resets the filter bank,
preventing interpolation from an unrelated old acquisition.

For L landmarks, normalization/filtering have O(L) work and retained state.
The tracker retains bounded latest observations rather than O(elapsed frames)
history. Inference cost is separate and not measured by this source review.

Raw state deliberately survives alongside filtered state.
`tracking/eyes.py`, `render_eye_state`, substitutes raw left/right openness
into filtered geometry so short closures are not smoothed away. The CLI's
`FaceActionDetector.update` also consumes raw state.

## 4. Blinks, winks and calibration

`tracking/events.py`, `FaceActionDetector`, turns continuous signals into
debounced face/eye/mouth transitions. Candidate states must persist before
becoming stable. Defaults use 40 ms for eyes, 100 ms for face/mouth and a
500 ms maximum closed-to-open blink duration. Repeated/older timestamps do
not produce duplicate events.

Eye closed and opened thresholds are distinct. A wink also requires the other
eye to be open and a minimum inter-eye difference. Mouth opening/closing uses
separate thresholds, preserving state in the uncertain band. Changing
calibration resets affected channels so an old closure does not manufacture
a blink under new thresholds.

`tracking/eyes.py`, `calibrate_eyes`, requires at least 12 open and 12 closed
observations. It uses conservative sorted sample levels per eye, requires a
separation gap and derives a compatible threshold tuple; overlapping ranges
raise an actionable error. These are model-score calibration rules, not a
medical eye measurement or universal identity/gesture detector.

## 5. What the visible face mesh actually draws

`mediapipe_tracker.py`, `render_face_mesh_panel` and
`_draw_face_mesh_inset`, create a black synthetic diagnostic panel. The panel
converts normalized x/y back through the source width/height, then fits the
face into available space using one scale for both axes. This avoids
distorting a portrait input into the panel's aspect ratio.

For at least 478 landmarks, hand-selected index paths connect the face oval,
eyes, eyebrows, inner/outer lips and nose. Sparse additional points are drawn
every twelfth landmark. It is not a full triangle tessellation; the path
helper closes each selected path. With fewer landmarks the detailed contours
are skipped, although sparse points can still be shown.

`_draw_pose_axis_gizmo` reconstructs X/Y/Z rotations, combines them as
Rz * Ry * Rx and projects three colored axes into the panel. This conveys
orientation, not a calibrated physical camera model. No face yields an
explicit NO FACE diagnostic instead of invented geometry.

## 6. Tracking is not a privacy boundary by itself

`src/kardboard_vtuber/cli.py`, the live processing loop, keeps raw camera
frames separate from brightness-adjusted analysis. In Studio/runtime or
virtual-camera paths it converts render states older than 500 ms, or from the
future relative to the frame, to no-face. This gate is not universally applied
to every standalone CLI mode.

The application selects a black-before-acquisition / copied-last-safe-frame
loss policy for face-only rendering. That policy belongs to output composition,
not to landmark detection. Virtual output is sent before local debug overlays.
Raw face preview is a separate opt-in diagnostic. A detected face does not
prove that every identifying pixel is covered at every pose.

The sibling's continuity records that inferred monocular-depth foreground
restoration was removed after exposing face regions. That historical report
is a warning, not a new experiment here: do not confuse inferred facial z,
segmentation or detection confidence with trustworthy aligned object depth.

## 7. Transfer candidates, not Verona decisions

Potentially reusable ideas are a library-neutral observation contract, bounded
latest-result ownership, monotonic timestamps, separate raw/smoothed consumers,
explicit staleness/loss and synthetic diagnostics. The particular Python,
MediaPipe, OpenCV, calibration thresholds, Qt UI, cardboard renderer, OBS
transport and historical frame rates are not selected Verona requirements.

Before adoption, define required signals, input mirroring, coordinate units,
latency/accuracy budgets, data retention and loss behavior. Then qualify the
actual intended hardware/input conditions, acquisition/reacquisition, timestamp
staleness, brief actions, confidence limits, errors and output privacy.

## Evidence and limits

Direct source read: `tracking/mediapipe_tracker.py`, `models.py`, `filters.py`,
`eyes.py`, `events.py`; live integration `cli.py` lines 430-700; relevant
normalization/debug tests in `tests/test_tracking_models.py` lines 1-220.
The engineering-book overview and face-tracking chapter were read as navigation,
but historical performance tables are not fresh measurements.

One existing chapter still labels a renderer "future" although current source
integrates it. This review follows current source rather than inheriting that
stale diagram label. No tests were run against the sibling, no source changes
were made there and no end-to-end privacy guarantee is claimed.
