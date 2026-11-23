# 10 - A transparent desktop without a second speech system

## Opaque mouths by default; transparency belongs to head creation (vr-87)

The owner withdraws wide-mouth transparency as the default. This is separate
from the transparent *desktop window*: normal heads retain the original
opaque mouth surface, without adding a black cavity. `session_config.appearance`
strictly validates default-false `mouth_transparency`. `SessionManager.create`,
the manager API, `agent.main` create/host CLI and `agent_host.host` forward the
confirmed creation policy as `mouthTransparency`; non-boolean values fail.

The unchecked **Mouth transparency** creation checkbox opts in for that head
only. Successful creation resets it off; failure retains the unsubmitted
choice. The selected-head status is immutable. A live settings attempt is
rejected, so changing policy requires closing/recreating the head rather than
silently mutating it during speech. Omitted metadata remains default-off,
including an older manager creating a newly sourced host.

`FaceRenderer.clearMouth` selects the transparent pass only when the policy is
true **and** measured extra opening is at least 0.65 cm. Rowan's near-closed
opaque lip seal remains independent. No extra storage, speech processing or
per-frame geometry upload is introduced. Loss/cancellation/restart retain
the existing head lifecycle; recreation without explicit opt-in resets off.
Review capture also defaults off and requires explicit candidate metadata to
enable its existing wide cutout.

Qualification uses a detached source worktree, synthetic API fixtures,
archived native motion, hidden isolated browser profiles and no live head.
The manager DOM verifies unchecked/default omission, explicit opt-in/reset and
read-only status. Real WebGL covers six heads, both policy lanes, four views,
three yaw angles and rest/speech/yawn, plus blink closure: 480 matrix checks.
Actual pass dispatch and opaque-to-transparent wide-mouth pixels are checked.
Two initial fixtures rejected a single neutral wire-edge raster difference;
the corrected fixture checks actual erase dispatch instead of treating that
one pixel as policy execution. Both failed receipts remain. Tests are not
human visual/listening approval.

After qualification and the corrected Akari review, the requested session
recreation confirms that **Verona is the only head**. Its old host and owned
manager close before exact qualified source promotion; the lightweight manager
restarts because its already-imported API cannot learn the new creation field
from static-file changes. The replacement uses Onyx's existing `male-sharp`
ID, explicitly false transparency and all 37 preserved compatible controls,
including zoom/colors/performance policy. Live readiness, served-source hashes
and the native window identity are verified without speech replay.

**Coordinated idle eyes (vr-75):** cursor-head mode still centers its cursor
gaze, but authored idle eye movement now works in either cursor mode.
Look-around scans horizontally/vertically; unilateral lids share skin and
optical clipping. [Chapter11](11-autonomous-idle-life.md) documents thirty
actions, the five eye additions, ten composites and bounded local yawn/sneeze
sound. Speech/interaction removes those temporary contributions without
changing the user's cursor preferences.

**Idle warm sleep (vr-73, creation policy corrected in vr-74):** choose the
unchecked **Performance-only head** option at creation, never a live toggle.
Normal heads retain their usual behavior. The floating menu contains
**Normal opacity**, plus a badge only for performance-only heads.
Only the canvas fades, not its controls.
The trusted `sleep` command pauses the existing native cursor timer without
changing the user's follow choice. [Chapter11](11-autonomous-idle-life.md#let-a-silent-head-sleep-vr-73)
explains state/ownership; [chapter07](07-hazel-claire-and-performance.md#measured-idle-performance-mode-vr-73)
records actual CPU/memory measurements and their limits.

**Native parity update (vr-65/66):** the catalog now has six choices again
because actual **Mark**, not the withdrawn character, joins the five retained
heads. Native MPFB and Mark publish the full shared player's controls through
`attachSessionControls`; manager/agent updates remain one available control
at a time. Presentation changes may change which framing/detail controls are
available, so callers must wait for the confirmed snapshot before the next
dependent edit. Model selection remains creation-time only. Mark selects its
own neural engine before asset loading; see chapter07. Both native heads use
the same crop/zoom/cursor/appearance path described in chapter09.

**Post-M1 additions (vr-58/59):** [chapter09](09-verona-character-and-waves.md#occasional-blinks-without-another-model-vr-58)
explains the shared idle/speech blink clock, lifecycle cancellation and local
eyelid shader. Both controllers share their existing RAF rather than adding a
second playback clock. Natural blinking is a live checkbox, not another model.
The same chapter documents the original native icon, Windows AppUserModelID
and same-origin browser/manager branding. Source-launched window branding is
distinct from rewriting `electron.exe` or packaging a release.

**Current vr-55 boundary:** the owner withdrew the armored character and Blender
study after M1. Five named variants and four human views remain. Older six-model
qualification below describes its original revision, not today's selector.
No live manager/head is restarted to apply source work.

**vr-57 resource update:** [chapter07](07-hazel-claire-and-performance.md#selected-head-resource-ownership-vr-57)
audits this manager/head/browser chain. The manager no longer imports the
numerical engine; heads keep one required Claire model and only their chosen
adapter. Inactive GPU topology, hidden hair and unlit CPU motion/normal storage
are released rather than kept for every presentation. Speech ownership, the
eight-head safety cap, conditional cursor polling and parent watches remain
unchanged. Measured memory savings are not a concurrent-head capacity promise.

## Freezing a functional milestone without changing a live workspace (vr-52)

M1/v0.1.0 packages the existing runtime, not a new inference or UI implementation.
`SessionManager.create`, `prepare_variant` and the production browser renderers
remain byte-identical to source `d7897633ea0994817a2c3008e60a9fe2ab90df6c`.
The release manifest checks these source hashes, records exact qualification
provenance and inventories the source archive. The ZIP/manifest checksums are
verified again after downloading the published assets. A Git tag alone would
not demonstrate that an uploaded archive contained those reviewed bytes.

Six sequential hidden sandboxed renderers generated one synthetic Hazel greeting
through real CPU engines and isolated caches/speech roots. No user head,
profile, capability or audio clock was reused. The actual Mark excerpts remain
a separate native-identity report, not another manager choice; the current
MPFB disclosure GIF reuses the actual WebGL/DOM qualification, not an invented
OS-drag recording. The older hero and feature loops keep their own provenance.
An initial manager screenshot exposed stale first-paint content despite ready
DOM metadata; it was rejected. The accepted screenshot waits for connection,
fonts and two animation frames before capturing the completed composition.

This release reruns CPU regressions, but reuses the earlier vr-50 browser/native
qualification for unchanged runtime. Neither muted renders nor GIF sample
equality establish independent listening, phonetic accuracy or owner acceptance
of experimental faces. The [release notes](../releases/v0.1.0.md) describe
failures, cancellation, RAM loss, explicit restart and separate-checkout recovery.
Packaging never bundles model weights, captured speech or private continuity.
Publication is distinct from deployment, live-window reload and book rendering.

## One manager, independently owned heads (vr-45)

The owner now requests one GUI for every variant and separate simultaneous
heads for separate opted-in chats. `Verona.cmd` and `VeronaDesktop.cmd` both
select `verona.manager.main`. The following older single-window sections
describe the preserved underlying shell, not the current normal entrypoint.

`SessionManager.create` starts a named `verona.agent host` subprocess with one
selected model and validated five-feature appearance. Each process owns its
FaceEngine, persistent Windows speech worker, latest clip/sample, cancellation
identity, loopback capability and disposable native profile/cache/synthesis
directory. There is no shared mutable clip or background narration hook.
`verona.variants.prepare_variant` reuses the authored reference/MPFB adapters;
the preserved Male-SharpJawline applies its sculpt to rest and every complete
speech pose before existing quantization. It is not a new learned identity.

The manager's capability-protected API discovers private named descriptors
and returns bounded status/confirmed appearance, not capability tokens or
transcripts. Up to eight owned heads may be live; listing inspects at most64
records with eight bounded workers. These are defensive limits, not qualified
concurrency guarantees. Every additional head incurs CPU, RAM and Chromium
cost; speech generation remains precomputed and can contend across sessions.
List responses omit repeated native control schemas; only the selected head
is inspected in detail. This avoids multiplying GUI/CLI response size by the
number of live heads. Hidden manager tabs stop their periodic refresh.

The central GUI does not iframe head pages or weaken `frame-ancestors 'none'`.
`session-controls.mjs:attachSessionControls` describes actual supported native
inputs. Settings travel through the existing authenticated native socket and
isolated Electron preload; the renderer validates a patch before dispatching
the original input event. Disabled controls stay unavailable. DOM disabled/
hidden changes and generation locks report updated metadata. Revision-tagged
acknowledgements distinguish requested appearance from confirmed appearance;
a rejected/timed-out update is an error, not silently reported as applied.
Only one setting is changed per transaction. Text is submitted separately,
cleared from the manager after acceptance and never included in status.

Managed windows immediately select the transparent head presentation, hide the
return-to-separate-controls button and retain their session/model name inside
the collapsible floating menu.
Initial placement uses bounded slots so the first two heads do not start
stacked on a sufficiently wide display. Native drag/zoom remain available.
Each model exposes its own real controls; native MPFB does not pretend to
support Claire's hair rig, gaze or every presentation.
Changing models means close/recreate, not a hidden live identity substitution.

### Editable versus read-only manager settings (vr-47)

`manager.js:showControls` partitions each actual control snapshot into two
sections. **Editable now** contains enabled native inputs on a ready head.
**Read-only settings** always includes the session name and head variant with
explicit **Set at creation** copy, followed by currently disabled native
inputs. These latter inputs say **Currently unavailable**, not creation-only:
presentation, model capability and speech activity can affect availability.
Changing the session name or model still requires a new head; this UI does not
add rename, live model replacement or new creation-time options.

Controls move between the two grids when readiness or disabled metadata changes.
The render signature includes head identity/model/readiness as well as schema;
a focus-preservation guard applies only to the same head and unchanged
availability. A newly disabled control or a different selected head must not
retain stale editable inputs just because an old input has focus.
Unavailable inputs have no change listener; editable inputs still forward the
original single-setting transaction and surface request errors. Empty editable
state is explicit. No controls are dropped, synthesized as model features or
enabled merely to fill the first section.

`tests/test_manager_controls.cjs` runs real manager HTML/CSS/JavaScript with
deterministic API fixtures in a disposable Electron profile, not a real head.
Its `control-groups-02/controls-report.json` covers immutable identity labels,
temporary disabled controls, focused readiness changes, bidirectional mode
regrouping, actual settings events, same-schema head selection and narrow
section layout. The selected-controls screenshot is inspected for the two
sections, not claimed as owner acceptance or new native/model qualification.
Existing owner pages/heads are not reloaded; refresh the manager page to load
this UI without restarting its backend or heads.

### Operating instructions as an installable skill (vr-48)

The owner's vr-94 refresh reconciles the authored project file, canonical
library copy and installed personal copy. The older two copies had missed
Mark's four-style defaults and Rowan's effective gain; the refreshed text also
documents `create`/`host --mouth-transparency`, its immutable default-false
manager boolean and the independent wide-opening gate. Reading/installing the
skill still does not activate narration or restart existing heads.

The six actual CLI model IDs are distinguished from review aliases and the
seven separate GLB/anime study candidates. Akari's toon shader belongs to the
isolated study renderer, not a production model or live settings option.
Current source behavior is tied to vr-87/88 plus the vr-92 study correction,
not retroactively attributed to the older v0.3.1 release. Exact-copy hashes
and actual local skill discovery verify delivery, not adoption by every
already-open host. Missing prerequisites still fail explicitly.

`.github/skills/verona/SKILL.md` is a self-contained operating contract for a
compatible local agent, not a second application. It documents the current
CLI and protected settings route, ownership/lifecycle, all six variants,
the creation-time versus temporary-availability distinction, measured warm/
cold behavior and explicit performance/accuracy limits. Personal installation
copies this one file; the skill includes no models, credentials or runtime
startup hook. A remote agent still needs actual local command execution.
The owner's library receives an exact copy under `skills/verona/SKILL.md`,
not a second implementation or a dependency bundle; Verona remains the source.
An explicit full-path read prompt works independently of a host's skill-list
refresh. Documented Copilot installation/reload commands are not assumed to be
Agency commands.

The owner's identity requirement is perceptual, not merely hexadecimal.
Agents choose vivid, clearly different hue families across all five features,
inventory all active/starting heads, account for original/null colors and
confirm appearance again after creation or customization. Examples are not
reserved palette slots. Arbitrary RGB values remain available; the application
does not silently ban colors or force a finite palette. Model shape, voice and
hidden hair are not substitutes for a clearly contrasting visible mesh.

There is deliberately no claim that instructions make `list`/`create` atomic.
For concurrently created cooperating agents, stable name ordering resolves
conflicting proposals; only the losing agent's own colors may change.
Already-existing/unknown-owner heads and explicit user choices take precedence.
Three attempts bound reconciliation; unresolved/unknown or visually unverified
colors must be reported honestly rather than called distinct. This is a
documented cooperation policy, not a reservation service, lock, background
watcher, universal vision guarantee or capacity proof for40colored features.
The skill preserves normal cancellation, exact process ownership and private
capability boundaries; installation itself must never activate speech/devices.

### Default-on per-head topmost control (vr-46)

New managed heads start pinned. `desktop/main.cjs` retains its existing
per-window `pinned` state and trusted `pin` command; overlay mode applies
`setAlwaysOnTop(overlay && pinned, "pop-up-menu")`. There is no global policy.
`app.js` initializes the named Claire checkbox consistently instead of
overriding it off. `session-controls.mjs:attachSessionControls` moves that same
input, with its original native listener intact, into the existing collapsible
`overlay-options` menu, alongside the session/model label. Both disappear when
that menu is collapsed; neither is a permanently visible corner badge.
For MPFB, which lacks the input, it creates the equivalent checked checkbox
and reuses the same privileged command. MPFB also lacks Claire's floating
toolbar, so a native HTML `details`/`summary` menu supplies the same collapsed
presentation without another window or speech implementation.
There is only one pin control per
head, exposed through the existing native-input schema as `pin-overlay`.
The menu's checkbox and selected-session manager setting therefore dispatch
the same input event. Neither regenerates geometry/speech nor owns an audio
clock; pinning remains available during speech and from the manager even while
the menu is closed. Hidden menu ancestry is deliberately not treated as an
unavailable pin setting; genuinely disabled inputs remain disabled.

The checkbox is default-on at each new host start, not a persistent preference.
It affects only that native window, not any other session or browser window.
Normal Windows topmost semantics apply: secure desktops, exclusive fullscreen
and precedence over other topmost windows are not guaranteed. Existing owner
heads are not reloaded/restarted to pick up a source update. Native command
errors still use the renderer's explicit failure path.

`tests/test_session_controls.cjs` runs the actual common module in isolated
Electron DOMs using the real Claire toolbar/CSS and MPFB CSS. Its
`topmost-controls-02/controls-report.json` confirms default checked state,
hidden pin/name when collapsed, expansion/re-collapse, one reused Claire
listener and both direct/menu and closed-menu manager input dispatch.
`tests.run_topmost_smoke` creates two disposable real Claire/MPFB heads:
`topmost-native-02/topmost-report.json` checks their exact owned Windows
`WS_EX_TOPMOST` flags, manager off/on, unchanged other-head pinning and owned
shutdown/descriptor cleanup. Six targeted session and five Node bridge/player
cases pass. This is native-state/DOM qualification, not human visual acceptance.

Stop names one request and affects only that head. Closing a head removes its
owned descriptor/profile and clears its speech RAM. Manager Exit/console Ctrl+C
closes only manager-created heads; external CLI hosts stay independent unless
explicitly selected for Close. Closing the manager browser tab is not Exit.
`lifecycle.parent_lifetime` retains a Windows process handle, not a PID-only
poll vulnerable to reuse; loss of that exact manager requests owned shutdown,
including during cold preparation. The desktop wait is bounded so it notices
that signal. No other application's process is signalled.
Restart is explicit; unsaved controls and colors are not restored preferences.
Stale descriptor/account/resource failures remain visible rather than starting
an unnoticed replacement. Existing reports, user profiles and sibling apps
are outside this ownership boundary.

### Qualification and costs

`tests.run_session_smoke` and `tests/session_smoke.cjs` exercise the real GUI
and native hosts using disposable profiles/data and muted synthetic speech.
`named-heads-06/session-report.json` records actual focused native-control and
color Apply edits, simultaneous Claire/MPFB playback, request-owned Stop,
all six real model paths, CLI create/configure/list/stdin voice-only/close,
external-host survival and cleanup after abrupt manager death. All owned
hosts/descriptors stop. Seventy-three CPU tests and nine focused Node cases
cover the supporting protocol/player behavior. Passing is not listening,
identity or human-expression acceptance.

Cold ready times in that run span7.3-12.5seconds; native MPFB is12.510seconds,
Claire7.724seconds. A separate ready-time resource snapshot records seven
processes per head tree: summed working sets about738MiB Claire/864MiB MPFB,
private bytes about585/659MiB. These are not peak measurements; summed working
sets can double-count shared pages. Eight live heads are not qualified.
Warm-host voice-only synthesis to native playing acknowledgement measures
0.910seconds once; total4.212seconds includes playback. Do not equate that
with latency of new animated speech or an end-to-end guarantee.

The owner's old MPFB console hang was stopped by its verified process identity.
`tests.run_mpfb_interrupt_smoke` sends real Ctrl+C only to its own disposable
console: the bounded wait catches KeyboardInterrupt, exits0 in0.702seconds and
removes owned native temporary data. Earlier failed fixtures/receipts remain.

## A calmer workspace without a second application (vr-50)

The manager's primary jobs are choosing a head, speaking through it and changing
that head deliberately. `manager.html` now gives these a stable session rail and
a speech-first workspace. Creation explains immutable identity; five independent
colors live in one Appearance disclosure. **Editable now** and **Read-only
settings** remain separate, with temporary unavailability distinguished from
creation-time identity. Exit is secondary, under **Manager options**, because
closing a tab and stopping owned heads are different operations.

The browser Claire player retains its existing renderer and audio element.
`index.html` groups Expression, Look & framing, Pose & cursor and technical
limits with native disclosures. The transport owns Volume and the spoken-text
readback precedes secondary settings. MPFB's standalone page retains its two
inspection views and original controls, but uses the same surface/type/spacing
direction. Its speech card comes first, beside both previews on wide screens;
Expression & turn, Appearance and technical detail are secondary disclosures.
On narrow screens speech precedes the stacked previews. `manager.css`,
`style.css` and `mpfb.css` use restrained opaque
surfaces, readable secondary text, visible field borders and focus outlines.
Identity swatches do not replace written session/model/state labels; arbitrary
five-feature RGB choices remain available.

This is an independently authored application of design principles, not an
imported Material/Fluent component library or a native Liquid Glass claim.
[Material Web theming](https://github.com/material-components/material-web/blob/main/docs/theming/README.md)
separates reusable roles from literal colors;
[Fluent principles](https://fluent2.microsoft.design/design-principles) prioritize
clear, focused content; [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials)
distinguish functional layers from content.
[Nielsen's heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
make status, user control and recovery design requirements, not decorations.
Glass remains limited to floating controls; CSS backdrop blur is not desktop
acrylic. No remote font, UI framework, dependency or decorative animation loop
is added. These sources informed decisions, not certification or pixel copying.

### Draft ownership and asynchronous truth

`manager.js:display` updates keyed session buttons in place instead of replacing
every button on each poll. An unchanged session target therefore keeps keyboard
focus. `rememberDraft` and `choose` retain unsent text, voice-only choice and raw
color edits per head in a page-local Map, including invalid intermediate hex.
Creation has its own draft. This RAM is bounded by the local session inventory,
not a transcript database; an authoritative inventory drops disappeared heads'
drafts, including unselected ones, so name reuse does not inherit retired input.
Reload or closing the tab discards all drafts.

`act` gates repeated in-flight actions and displays pending copy. Speech captures
its selected head and submitted text before awaiting the request. Acceptance
clears only that matching draft, never newer typing or another head's text.
Acceptance still does not mean synthesis/playback completed: the existing actual
head state/audio-ended protocol remains authoritative.

`confirmed` advances a local revision and merges the acknowledged native result.
`refresh` commits a list/inspect snapshot only if that revision is unchanged;
an obsolete in-flight poll requests a fresh serialized refresh rather than
overwriting newly confirmed appearance. This is a client response-order guard,
not distributed locking or an atomic list/configure transaction.
Failed actions keep explicit errors and unapplied drafts. Connection failure
labels the last confirmed state as stale and disables new mutations; successful
empty inventory is distinct from inventory unavailable. An existing exact-job
Stop can still be attempted. Nothing silently recreates a closed head, retries
speech or persists unsent input across restart.

### Fitted floating menus and native MPFB

The collapsed tab is now 34 x 24 CSS pixels, rather than 34 x 20. This follows
the [WCAG 2.2 minimum target](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
dimension without claiming the enhanced 44-pixel target or a complete
accessibility audit. Pin/name remain hidden until expansion; pin stays default-on.
Claire retains its original menu/listeners. MPFB's existing native details menu
adds an OS drag region, explicit Close, Escape with focus return and outside-click
dismissal. Expanded menus wrap/scroll within the viewport. Failures remain visible
even when the rest of the managed MPFB workspace is hidden.

The old MPFB study context explicitly requested opaque WebGL and a fixed dark
clear. `mpfb-renderer.mjs:createStudyRenderer` now accepts an opt-in transparent
context; `mpfb.js` selects it only for managed native heads. Clear becomes zero
alpha, while separate color/alpha blend factors preserve correct optical alpha.
Ordinary browser studies retain opaque rendering. Managed MPFB creates only its
visible wire renderer, not a second hidden shaded renderer. Neural inference,
motion transfer, topology, voice and audio ownership are unchanged. Removing
known hidden work is not a measured percentage speedup.

### Qualification, failed receipts and remaining boundaries

The candidate was prepared in a detached worktree while the root manager kept
serving known-good files. Pinned dependencies/models were read-only inputs;
profiles, app data, synthesis workspace and derived caches were disposable.
No existing manager/head was driven, reloaded or restarted.

`ui-controls-04` records eleven actual-manager-DOM fixture checks, including draft
and response-order races, duplicate submission, focus, stale recovery and
360/560-pixel containment; the common menu fixture covers hidden pin/name,
direct/manager toggles, Escape/outside dismissal and minimum tab dimensions.
`ui-player-layouts-09` checks both player layouts at 1280/640/360 pixels and
actual MPFB WebGL with 359,316 zero-alpha pixels, 9,094 opaque pixels and four
zero-alpha corners. Encoded model/menu pixels are required before screenshot
acceptance; wide/narrow MPFB and collapsed/expanded native images were inspected.
Default wide layouts and expanded narrow settings are separate from scrolled
narrow model captures. `ui-topmost-01` rechecks actual Claire/MPFB readiness and
independent Windows topmost off/on state after the final markup change.
The Claire static layout fixture intentionally omits runtime initialization;
its loading canvas is not a ready-head screenshot.

Earlier player receipts are retained and rejected as visual evidence: initial
capture raised UnknownVizError, subsequent images could be empty/stale despite
DOM checks. The final harness samples actual rendered frames after layout,
copies PNG bytes during the paint callback and checks decoded image content.
An exit code, DOM dimensions or drawing-buffer readback alone did not establish
that the saved screenshot showed the current menu/model.
Runs07/08 additionally exposed a wrong viewport assumption: after moving speech
first, expanded narrow controls correctly push model previews below the fold.
The final fixture retains first-screen controls and separately scrolls the
previews into view before requiring the unchanged encoded mesh-pixel gate.

`ui-live-01/native/desktop-report.json` passes sixteen real native checks:
alpha/composition over an owned backdrop, menu/drag/zoom/pin, same live audio,
view/framing restoration and bounded cadence. Its 1,801-interval sample has
mean 16.659 ms, p95 16.8 ms and maximum 17.0 ms; these are shared-machine RAF
measurements, not GPU completion, scanout or universal 60-fps guarantees.
The focused real-Edge color flow passes six checks, including actual pixels,
invalid-input recovery and unchanged playback/geometry uploads.
`ui-sessions-01` initializes all six actual native model paths, completes muted
speech, exercises selected-head GUI edits, two-head cancellation isolation,
CLI operation, external-host survival and exact-parent-death cleanup.
Seventy-six CPU regressions pass. Muted audio is not independent listening;
fixtures/native qualification are not owner visual approval, anatomical
acceptance, an accessibility certification, a new release or deployment.

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
rotations can still clip. Floating high-zoom window clipping is corrected by
vr-69 below; ordinary browser/Controls zoom retains its original projection.

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
Extreme manual rotation can consume this clearance. Floating zoom now grows
the viewport as described below, rather than consuming the default fit margin.

CSS translucent gradients, a fine highlight, shadow and
`backdrop-filter: blur(14px) saturate(1.35)` provide the glass treatment.
**This is web-content glass, not OS acrylic:** CSS can blur content in Verona's
own layer, not promise blurring unrelated desktop windows through Electron's
transparent background. Genuine background transparency remains unchanged.

Floating zoom buttons reuse the existing range/input event:35-230%,0.1 steps,
Fit1. Controls displays the identical value; Reset orientation also restores1.
This was originally projection-only, allowing large zoom to exceed the canvas.
vr-69 supersedes that floating-window behavior: projection and native bounds
now grow together; prepared audio/time and motion remain unchanged.
Bounds disable the appropriate button. Restart/reload restores1.

`desktop/main.cjs` retains `overlayBounds` in RAM when returning to Controls,
restoring the last moved placement on the next pop-out. It selects the saved
rectangle's available display and clamps the zoom-sized window
inside that work area; monitor removal cannot restore unreachable coordinates.
Restart forgets placement. The existing `-webkit-app-region: drag` moves the
native window; interactive buttons remain `no-drag`. No position/file IPC,
system cursor warping, global hook, speech persistence or profile change.

### Zoom without cutting the head at the window edge (vr-69)

The reported 140% head had a hard cut because `desktop/main.cjs` kept a
480x600 transparent window while `FaceRenderer.draw` enlarged geometry inside
it. Enlarging only the native window would also be wrong: its taller canvas
would magnify the already-zoomed projection again.

`overlayLayout` now grows both dimensions above 100%, preserving the previous
window center where screen bounds permit. At 140%, a normal-size base becomes
672x840. Below 100%, the base viewport stays fixed and the head shrinks.
`resizeOverlay` selects the current monitor work area, reserves 40 pixels of
space and limits zoom to a screen-fitting 5-percentage-point step, never above
230%. Small screens receive a uniformly reduced base first. The actual slider
maximum and confirmed value reflect that limit; monitor changes revalidate it.
Moving back to a bigger screen does not silently re-enlarge a clamped head.

The native mode acknowledgement carries the base reference height and accepted
zoom. The shared renderer compensates by multiplying requested zoom by
`referenceHeight / viewportHeight`; shader projection, cursor inverse mapping
and floating-tab placement all use this same effective zoom. Until enlargement
is acknowledged, rendering stays bounded by the previous accepted zoom.
Old acknowledgements cannot overwrite newer requested input. Reset uses the
same input/IPC path, and a geometry acknowledgement does not close an open menu.
Browser-only and Controls rendering retain their original projection.

![Actual owned native windows at 100% and 140%](../media/overlay-zoom-140.png)

*Same turned Claire, same waves and material, shown at their native relative
pixel sizes over an authored solid background. At 140% the head is genuinely
larger, with transparent clearance around the entire enlarged window.
The images capture Verona's own web contents, not the owner's desktop.*

This is one shared viewport correction for all heads/presentations, not another
model, per-frame geometry fit, native resize timer or audio restart.
Larger windows necessarily draw more pixels and occupy more desktop pointer
area; this is not a GPU-cost reduction or new click-through behavior.
No new files or settings are persisted. Restart forgets placement/zoom as
before. IPC accepts only finite numeric zoom from .35 through 2.3; errors use
the existing visible recovery path rather than silently dropping the request.

Final focused native qualification `overlay-zoom-03` passes ten checks,
including rapid queued zoom input, unchanged open-menu state, audio-clock
advancement while zooming and return to Controls with the same clip/voice/text.
Forty-eight native pixel cases cover four presentations, both hairstyles,
front/turned poses and 100/140/190% on the test display; all retain clear edges
(minimum observed margin 34 pixels). Actual 100/140% images were reviewed.
Host tests additionally exercise centered growth, screen limits and a small
negative-origin monitor. The shared fix is not a new independent six-model
visual qualification, all-rotation fit proof or owner acceptance.

The earlier full run `overlay-zoom-01` passed the zoom pixels but failed its
separate final OS-composition fixture gate; its cause was not established.
The safety check saved no unsafe screenshot; its failure receipt remains.
`--zoom-only` is a separately labelled
scope using owned-window captures, not a bypass or claimed pass of that gate.
The full smoke command retains its desktop-composition assertions.

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
cutY = min(140, 135.7 + 0.1*x*x
           + 3*clamp((-1-z)/7, 0, 1)) - visibleNeck
```

Coordinates are original model-space centimetres, before view fitting or XYZ.
The quadratic side rise follows the inner jaw silhouette; a bounded rear rise
removes the back neck rather than keeping a dangling rear slab. The vr-70
ceiling stops their combined rise below the ears. Skin triangles, contours,
points and unlit depth passes share the same fragment predicate. Hair is not
skin: vr-70 deliberately preserves the complete selected hairstyle instead of
cutting its tips with an anatomical jaw mask.
The shader interpolates its constants from the JS definition rather than
maintaining an unrelated handwritten second profile.

A curved clip needs more care than the old plane. A primitive whose corners
are all clipped can still have a visible interior: its straight edge may cross
above the curve. `trimJawTopology` therefore evaluates a conservative lower
boundary over each primitive's X/Z bounds and its maximum Y. Nearest-to-zero
X minimizes the quadratic; maximum Z minimizes the rear rise. Applying the same
monotone ceiling preserves this lower bound. Only a primitive
proven fully below that bound is removed. A 0.002 cm safety margin covers packed/
float boundary arithmetic; the fragment pass applies the exact visual curve.
Synthetic triangle and edge fixtures explicitly retain those crossing interiors.

`FaceRenderer.setNeckDepth` rebuilds only on input, not playback frames.
Only the latest cropped skin triangle/edge/point buffers survive: three replaced
buffers are deleted. Visible hair uses its existing complete selected buffers,
without duplicate crop indices. Retained original vertex
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

The vr-21 figures below describe the historical uncapped skin-and-hair crop.
For the current bounded skin-only crop, see [vr-70](#preserve-ears-and-complete-hair-vr-70).

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

## Preserve ears and complete hair (vr-70)

The next reported cut was **inside** the window, at the ear and neighboring
hair, not at a viewport edge. The former jaw parabola kept rising with `x*x`.
In the pinned native skin, the abs(X)8..9 cm band includes Y142.27..146 cm;
the old side/rear boundary could rise through it. Enlarging the window again
would not restore geometry removed by CPU indices and fragment discard.

`jawCutHeight` now caps the combined jaw/rear height at140 cm **before**
subtracting Visible neck. The inner profile is unchanged where below that cap:
at X6/Z0/neck0 it is still139.3 cm, and the central default remains134 cm.
This keeps the useful jaw rise without extending it up through lateral ears.
The cap is a bounded presentation rule over the aligned model coordinates,
not learned anatomical segmentation.

The first capped candidate recovered the ear but still visibly sheared the
hair ends. `FaceRenderer.createNeck` therefore now crops **skin only**.
`setFraming` and `setHairStyle` reuse the complete selected hair surface;
the shader exempts hair material1, including its correctly identified unlit
depth pass. `updateFit` includes all visible hair, so Dot/grid fits and the
overlay's cached support points include the retained tips. Skin still loses
its lower neck/shoulders. This intentionally supersedes vr-21's shared
skin-and-hair cut: Visible neck no longer shortens the hairstyle.

![Before and after the internal ear/hair crop correction](../media/ear-hair-crop.png)

*Actual owned native web-content captures at the same140% zoom, pose, colors
and default1.7 cm neck. The authored background shows transparency without
capturing other applications. Left: old ear/side-hair cut. Right: bounded skin
crop with the entire original hairstyle; shoulders remain absent.*

Resource ownership remains selected-only. No extra model, hairstyle cache,
audio owner, animation loop or per-frame geometry scan is added. Three neck
buffers now replace the previous five; changing hair does not rebuild the
independent skin crop. Preserving hair does increase submitted hair triangles:
the measured default Claire case uses17,840 rather than11,353. Skin remains
reduced:25,335 rather than the full30,746 triangles. This is a deliberate visual
correction, not an asserted frame-rate or whole-app memory improvement.
Hidden hair still releases its GPU buffers; the source arrays remain available
for restoration. Full bust restores the complete skin, not another hair copy.
Existing invalid-input/context-loss errors and RAM-only restart semantics apply.

### Focused evidence and boundaries

The isolated `ear-hair-baseline-01` reproduces1,278 missing opaque lateral
skin/hair witnesses across16 matched poses. A capped-only candidate remains a
failed receipt: hair tips are still cut. Final `ear-hair-fixed-02` passes11
native checks, including44,124 projected witness samples with zero missing,
and exact entire-hair alpha equality between full/cropped framing in all16
cases: both materials, both hairstyles, pitch+/-0.4 and yaw+/-0.65 radians.
The existing48 all-presentation/hairstyle/front-and-turned zoom edge cases
also pass. Hair-disabled skin/material/contour/point passes leave zero alpha
below the neck; actual speech retains its source and advances through zoom.
The before/after pair and all eight shaded pose panels were inspected.

`ear-hair-browser-focused-01` passes six browser scenarios: filled-skin crop,
zero lower-region leakage, exact filled-skin Full bust round trip, separate
contour submissions, complete hair submissions, speech continuity, per-view
neck choices and balanced hairstyle resource cycles. Three depth changes
create/delete nine crop buffers. Focused geometry/hairstyle/presentation tests
pass. The new bounded commands use NEW receipt directories:

```powershell
.local\cpu-env\Scripts\python.exe -m tests.run_desktop_smoke --zoom-only --ear-hair --output .local\qualification\ear-hair-next
.local\cpu-env\Scripts\python.exe -m tests.run_browser_smoke --framing-only --output .local\qualification\framing-next
```

Failures are retained, not relabeled: initial browser pixel fixtures exposed
3/5 differing contour-color bytes on skin-only Full bust restoration; their
cause is not established. The final pixel fixture isolates filled skin and
checks contours separately, rather than promising byte-exact contour color.
The broader browser command reaches a separate iris-artwork gate and fails
(six upper spokes versus expected10..14); unchanged delivered `ddbf1ec` fails
the identical assertion. That gate is not weakened or called passed. These
focused runs also do not qualify desktop-composition capture, new cadence
targets, every possible rotation, all six native heads independently, listening
or owner visual acceptance. Tests use disposable profiles/cache/speech output,
stop their owned processes and never drive the active head.

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

## Opt-in agent speech with one warm player (vr-37)

The owner wants selected local Agency/Copilot sessions to speak through Verona,
with performance prioritized. This is an output adapter, not an assistant,
conversation scraper or global narration hook. `VeronaAgent.cmd` calls
`verona.agent.main`; its `host --session NAME` starts an explicitly owned,
dedicated desktop. Lightweight `status`, stdin-driven `say` and ID-targeted
`stop` clients never start, discover or attach to another running desktop.
Normal launches leave the agent endpoint disabled.

### Warm ownership rather than a process per sentence

`agent_host.host` creates one `SpeechWorker`, `State` and `FaceEngine`, then
passes that state into `desktop.run_desktop`. One native window, renderer and
audio clock survive across replies. Agent startup chooses FaceMesh, bright
spokes and 4x; following/pinning start off and `showInactive` avoids deliberate
focus theft. Normal Claire/2x/combined startup and normal autoplay policy remain.
An initial integration mistakenly changed only the View selector before
`syncPresentationControls` restored it from renderer state. Calling
`FaceRenderer.setPresentation` fixes the actual presentation, not just its label;
the final native receipt reads back the resulting controls before readiness.

`agent_speech.SpeechWorker` owns one persistent Windows PowerShell process.
Its fixed System.Speech loop enumerates voices once, receives escaped SSML over
stdin and synthesizes 16-kHz mono 16-bit PCM into a .NET `MemoryStream`, never a
temporary WAV. Bounded base64 replies return over its owned stdout pipe.
`speech.finish_speech` shares existing tone shaping, lead/tail silence, duration
checks and WAV packaging with normal synthesis. One worker lock rejects
overlap; one bounded response slot and a 45-second timeout prevent an unbounded
queue. Worker death, invalid/oversized PCM and missing voices fail explicitly.
No automatic worker/model restart retries an utterance.

The CPU model is still precomputed. Neutral uses one inference pass;
non-neutral emotion also needs the same-audio neutral reference. A warm host
does not make uncached neural motion free. Existing latest-clip and latest-
speech caches are reused, not replaced with a growing transcript/audio cache.
`--voice-only` explicitly calls the existing preview path and plays that audio
without animating the face. The fast path must not be described as lip-sync.

### Capability RPC outside, authenticated native push inside

`agent.private_descriptor` creates a named descriptor exclusively, with a
protected Windows DACL for the current user and System. It holds a per-run port,
capability, PID and instance nonce, not speech. Clients import only standard
library modules; they read bounded UTF-8 stdin and call only 127.0.0.1, with
the exact HTTP origin and capability. `Handler.do_POST` exposes `/api/agent`
only when `State.agent` exists, preserving normal Host/origin/token/body/request-
slot guards. Agent status/wait/cancel dispatch before the generation lock.

The first native implementation attempted Python/Electron stdin/stdout JSONL.
Actual Windows GUI Electron reached stdin EOF immediately, quit, and aborted
its first page navigation. It did not qualify; receipts01-04 remain. The
working transport is `AgentBridge.listen` plus Node's `net` socket: another
ephemeral 127.0.0.1 listener, exactly one owned native connection, capability
authentication before acknowledgements, bounded newline framing and no idle
HTTP polling. Its port and the ready URL travel in the child's allowlisted
environment, removed before renderer children start. Main/preload IPC still
checks the owned sender/main frame/origin; there is no generic execution or
filesystem bridge. Native load errors redact the private ready URL.

`AgentBridge.command` admits one active job. Concurrent calls fail409; no queue
interrupts an existing speaker or accumulates stale replies. The current ID
and payload fingerprint make an identical current-ID retry idempotent, including
after completion; different inputs under that ID fail. Only the latest job is
kept: replaced IDs cannot be waited/cancelled, and there is no durable exactly-
once history. Clients do not retry automatically. Explicitly sending an old ID
as a fresh `say` after replacement is not a safe recovery strategy.

`web/agent-player.mjs:startAgent` receives pushed work, calls the existing
`generate`/`previewVoice`, verifies decoded audio and awaits `play()`. Only the
actual `ended` event acknowledges completed. Decode/output/play rejection,
bounded media waits, invalid acknowledgement or disconnect are failures, not
empty success. A CLI `wait` blocks on a versioned condition only during that
explicit call; there is no background client polling. Disabling following now
also removes its 33-ms native timer; the existing 1-second parent guard remains.

### Cancellation, loss and shutdown

Cancellation targets one current ID, pauses playback after native delivery and
sets its generation event. The server checks before/after synthesis and after
the existing batched inference checkpoints; a cancelled candidate is not
published over the previous successful clip. The UI deliberately does not abort
HTTP generation early and falsely release the host while inference continues.
Synchronous System.Speech must return or reach its worker timeout before that
result can be discarded. The host remains busy until terminal acknowledgement.
Timeout/Ctrl+C request cancellation; neither claims cleanup or playback ended.

Reader/protocol/write failures mark the active job failed and wake waiters.
The current job tracks timestamps/state/fingerprint, not reply text. Text stays
in the existing page/request RAM; audio/motion stay in the existing latest-only
RAM boundary. This does not control the calling shell/agent's own history.
No reconnect replay, microphone, camera, model download or cloud call is added.

Window close/Ctrl+C stops only this host's native process, sets cancellation,
closes its worker/control socket/readers and server, and removes its owned
descriptor/profile. `ExitStack` cleanup continues through another cleanup
failure instead of leaking the remaining owned resources. Descriptor removal
checks the instance nonce; changed ownership fails without deleting that file.
A crash can leave a stale descriptor; restart refuses to overwrite it and
requires explicit ownership inspection/cleanup. Different session names do
not reserve CPU/GPU capacity or authorize interrupting another application.

### Qualification and performance boundary

Before runtime work, process inspection found no existing Verona Python/native
owner. Qualification used synthetic text, its own hidden/muted production
Electron window, RAM, capability, descriptor directory, TEMP/profile and derived
topology cache. Pinned model assets were read-only; user/sibling apps, profiles,
cursor and devices were not driven. No audio files were saved. All owned host,
native and speech PIDs exited; profiles/descriptors were removed.

The actual persistent worker's three RAM-only samples took 0.351/0.033/0.006
seconds to prepare; worker startup was 0.681 seconds. Repeated identical input
returned identical PCM in this bounded sample; that is not an accuracy claim.
Native07 exercised actual `.cmd` clients for new/cached/expressive faces,
voice-only, current-ID no-replay, busy rejection, generation/playback cancellation,
short timeout and clean shutdown. Protected ACL metadata was independently
read back. Native05 had already passed playback but its `Get-Acl` probe failed
because the inherited module could not load; a direct .NET ACL read fixed the
probe without weakening its user/System/protected-DACL assertions.

| Native07 case | Host accepted to reported playback | Completion includes |
|---|---:|---|
| Cold host ready | 6.20 s startup | Model, speech worker, native page |
| First neutral line, 2.68 s audio | 3.13 s | Full CPU motion + playback |
| New neutral line, 5.075 s audio | 5.15 s | Full CPU motion + playback |
| Exact animated repeat | 0.053 s | Cached clip + playback |
| Short Happy line,4x | 4.80 s | Expressive + neutral inference |
| New voice-only line | 0.040 s | No neural motion + playback |

Process startup/exit added approximately 0.37-0.42 seconds to these five speech
cases; voice-only command-to-playback was approximately 0.46 seconds. Do not
advertise 40 ms as end-to-end CLI latency. These samples are not latency
percentiles, physical speaker onset or universal guarantees on shared hardware.

All 50 Python cases and four focused Node audio-lifecycle cases pass, alongside
existing orientation/framing/hair/presentation/robot math. The focused real
Edge flow passes five checks: normal opt-out/defaults, manual Generate without
autoplay, actual-ended Play, exact-repeat cache and manual voice preview.
The full historical browser suite is **not green**: Browser01 hit a one-byte
full-frame round-trip difference; Browser02 stopped at six upper optical spokes
versus the fixture's 10-14 expectation. Serving unchanged HEAD `app.js` reproduced
the exact six-spoke failure in an isolated baseline run. Neither assertion was
weakened and no unrelated optical fix is included. Retained failed receipts
are separate from the passing focused agent/browser qualification.

The vr-36 gallery and three frozen releases remain unchanged. No new edition,
installation, release, deployment, human listening/phonetic acceptance or
universal real-time performance claim follows from these results.
