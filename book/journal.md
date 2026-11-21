# Verona - living development journal

This dated continuation keeps small changes readable between rendered editions.
The existing M1, native-head and local-voice PDFs remain frozen at their stated
source cutoffs. This page is authored source, not a newly rendered PDF or a
claim that those editions include later work. Newest entry first.

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
