# Verona - living development journal

This dated continuation keeps small changes readable between rendered editions.
The existing M1, native-head and local-voice PDFs remain frozen at their stated
source cutoffs. This page is authored source, not a newly rendered PDF or a
claim that those editions include later work. Newest entry first.

## 2026-11-21 - Put every idle action in a GIF report (vr-72)

The owner next asked to see all fifteen animations, not just read their names.
A separate invisible, unfocused native head sampled each complete action in
Surface and FaceMesh, with the same clock, phase and mirror direction.
The live head kept running with every setting unchanged. No speech, desktop
capture or new model download was needed.

The local report contains fifteen labelled paired GIFs, a short description
for each action and a clickable index. It starts with still posters and plays
one selected GIF at a time; Pause restores the poster. This avoids fifteen
simultaneous animations simply to browse a report. Everything loads from local
files, without remote scripts, fonts or images.

The 814 source captures become 407 encoded frames. Every decoded GIF timeline
matches its quantized source, including half-second neutral holds at both
ends. Switching from full-frame disposal to retaining/delta encoding reduces
the GIF set from about 58 MB to 19 MB without changing those decoded timelines.
These are deliberately resized, color-quantized 10-fps previews, not live
frame-rate measurements or a claim that the stylized sneeze is anatomical.

All fifteen GIFs decode in the local sandboxed browser. The paired contact
sheet, several decoded phases of sneeze/nod/stretch and wide/narrow report
layouts were inspected. The first hidden-window review had stale painted
snapshots despite correct DOM checks; its replacement waits for actual size
and paint in an invisible, unfocused owned window. Both attempts remain.
Only public-safe documentation/tracking is pushed: the report and its GIFs
remain local under `.local\reports\idle-animations`, not a new public gallery
or rewritten PDF edition.

## 2026-11-21 - Let the face wait without asking the chat (vr-71)

The owner asked for fifteen different occasional gestures, including a sneeze,
but made the ownership boundary explicit: the tool should choose and time
them, not the conversation. Research supported restraint and variation, not
the claim that random movement is automatically natural. The resulting catalog
mixes small lip, cheek, nose and brow movements with nods, scans, stretches,
an eye squeeze, a silent yawn and a silent sneeze.

One local timeout waits 12-28 seconds, then a weighted draw avoids the last four
actions. The conspicuous yawn and sneeze have longer cooldowns. A finite smooth
trajectory supplies one pose to the existing renderer and animation loop;
waiting adds no loop. Every model uses the same calibrated cosmetic layer,
without loading another model, rebuilding mesh buffers or asking a chat.

Speech and interaction take priority. A useful edge case emerged during the
real agent checks: cancelled speech retains a paused clip, but idle gestures
must not animate a mouth frozen halfway through a word. Terminal agent output
now uses the existing neutral buffers without deleting the clip or altering
its audio time. Manual replay returns to inspection ownership, and an
unfinished paused manual face/voice clip blocks idle until cleared.

The first exact-pixel checks failed on a few wireframe channels. Repeating an
unchanged neutral frame also varied, so calling that a gesture-restoration bug
would have been premature. Final qualification samples 65 unchanged frames per
view, demands exact filled-Surface pixels, and checks other restored channels
against their own measured neutral range. This preserves the failed receipts
and does not invent an explanation for the line-readback variation. A second
fixture correction samples the actual nod pulse, not its quiet inter-pulse gap.

The final native run covers 360 action/view cases across six heads, four views
and fifteen actions. Gestures allocate/upload no geometry and make no fetches;
six isolated 0.9-second waiting samples add zero frames or requests. A real
unprompted action starts and finishes. Actual face/voice playback, cancellation,
manual inspection, typing/held controls, the second hairstyle and disabling
idle life also pass. Compact real captures were inspected, but neither a
pixel difference nor a still image proves anatomical naturalness or owner
approval. The sneeze/yawn remain silent stylized cues.

The stable head stayed untouched until qualification. Only this chat's idle
head was then replaced, preserving its manager and every freshly read setting,
with Idle life enabled. Existing model GIFs, frozen PDFs and release assets
are unchanged. [Chapter11](../docs/chapters/11-autonomous-idle-life.md) contains
the catalog, mechanisms, controls, research and exact qualification limits.

## 2026-11-21 - A jaw mask should not cut the hair (vr-70)

The next image showed a cut near the ear, inside the enlarged window. This was
a different failure: the jaw parabola kept rising toward the sides of the head,
removing both native ear geometry and neighboring hair. More window space
could not bring those discarded pieces back.

The shared CPU/shader skin boundary now has a ceiling below the lateral ear
band, while retaining the inner jaw curve and the same Visible neck control.
The first candidate recovered the ear but still sheared the ends of the hair.
That exposed the second mistake: a jaw mask is not a hairstyle boundary.
Hair now retains its entire selected geometry, and the combined fit includes
its real tips. Skin still loses the lower neck and shoulders.

![The same native pose before and after the ear/hair correction](../docs/media/ear-hair-crop.png)

*Owned native captures, identical140% pose/colors/default neck, composited over
an authored background. Left: old internal cut. Right: intact ear and complete
waves, without restoring shoulders or shrinking away the problem.*

This keeps one selected hairstyle, not more loaded models. It removes duplicate
hair-crop indices and avoids rebuilding skin when hair changes, but draws more
hair:17,840 rather than11,353 triangles in the measured default case. That
tradeoff buys the missing strands; it is not a claimed performance speedup.

The original native mask loses1,278 protected witness samples. The final native
run has zero missing among44,124 samples across16 opposite pitch/yaw, material
and hairstyle combinations, plus exact full/cropped entire-hair alpha. The
existing48 zoom/view/style cases and six focused browser scenarios also pass.
Filled skin restores exactly; depth changes preserve speech and balance nine
created/deleted crop buffers. The before/after pair and eight shaded poses were
reviewed, not accepted on the owner's behalf.

Failed capped-only and contour-readback receipts remain. The full browser run
also encounters an iris-artwork assertion that fails identically on unchanged
delivered source; focused framing checks do not claim that unrelated gate.
The current head stayed protected during candidate work. After qualification,
only this chat's idle head was replaced; all freshly saved controls and colors
were restored and its manager stayed running. Frozen PDF editions and the
separate mouth-shading observation are unchanged.

## 2026-11-21 - Give an enlarged head a larger window (vr-69)

The owner showed the hair ending in straight cuts at 140% zoom. This was not a
missing part of Claire's model: the face grew inside a window that stayed
480x600. Making the head smaller would hide the symptom while defeating zoom.

The correction grows the native window with the requested head size, keeping
its center when possible. The renderer divides out that extra viewport growth
so 140% really means 140%, not a second accidental magnification. Cursor
following and the floating menu use the same coordinates.

![Same owned Claire window at 100% and 140%](../docs/media/overlay-zoom-140.png)

*Two actual native web-content captures at their correct relative pixel sizes.
The authored solid background makes the transparent margins readable without
capturing other applications. Both show the same turned pose and waves.*

There is a physical limit: an enlarged window must fit the current monitor.
The control now shows that actual limit instead of promising a percentage the
screen cannot contain. Fit returns to 100%; a smaller zoom keeps the base
window. The new native bounds change only on input, mode or display changes,
not every animation frame. A bigger canvas still costs more pixels; there is
no claim that enlarging the face is free.

The final isolated native run, `overlay-zoom-03`, exercises 48 combinations of
presentation, hairstyle, pose and 100/140/190% zoom. Clear edges survive, rapid
requests settle to their latest value, an open menu stays open and the same
audio clock advances through enlargement. Focused host cases also cover a
small negative-origin monitor and a screen-limited maximum.

The first full run reached its final desktop-composition screenshot and
correctly refused it because the corners did not match the owned background
fixture. That failed receipt remains, and no unsafe screenshot was saved.
The final zoom-only run deliberately captures only the app's own web contents;
it does not relabel the composition gate as passed.

The shared correction covers the native viewport path used by every head.
It is not a new six-head visual certification, a promise for arbitrary manual
rotations or human acceptance. Existing frozen editions, optional voices,
model ownership and the audio pipeline are unchanged.

After isolated qualification, only this chat's idle head was replaced. Its
freshly saved voice, colors, makeup, cursor/blink settings and 120% zoom were
read back unchanged. The shared manager stayed running, no speech replayed and
the replacement confirmed the screen-fitting 190% maximum on this display.
