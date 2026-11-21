# Running the Verona prototype

Verona turns a text sentence into local speech and a synchronized animated face
made of connected points and edges. The Windows prototype works on CPU, with
installed English voices and explicit expression controls. Accurate human
articulation is the goal, **not an established result**. Recording import and a
voiced personal assistant remain future work.

**Milestone1 / v0.1.0:** [release notes](releases/v0.1.0.md) identify the exact
source distribution, current gallery, setup and remaining qualification limits.
The downloadable source ZIP is not a prepared environment or executable installer.

## Run the prototype

This checkout is already prepared:

```powershell
.\Verona.cmd
```

This is the **one manager GUI**, also opened by `VeronaDesktop.cmd`. Create a
named head, choose any of six models and set its five optional colors.
Selecting its session shows confirmed colors and its actual native controls:
voice, expression, volume and the view/orientation options that model supports.
Use **Speak**, **Stop this speech** and **Close this head** centrally.
The session rail keeps head selection separate from the speech workspace.
Expand **Appearance** for the five colors; **Manager options** contains Exit.
Unsent text, voice-only and raw color edits stay with their selected head while
this page stays open. Reload discards these drafts. A failed connection is
explicitly stale, not a fresh empty list; use Refresh to recover.
The head windows show the face and session identity, not separate settings GUIs.
Models are selected at creation; close/recreate a session to change its model.
Changes, speech and colors are RAM-only. A head may take seconds to prepare;
wait for ready, rather than repeatedly creating it.

Two chats can create independent heads through the same GUI, or:

```powershell
.\VeronaAgent.cmd create --session coding --model claire --hair-color "#442211"
.\VeronaAgent.cmd create --session review --model mpfb --lips-color "#BB4466"
.\VeronaAgent.cmd status --session coding
'A local update.' | .\VeronaAgent.cmd say --session coding
.\VeronaAgent.cmd configure --session coding --eyebrows-color "#776655"
```

`--mesh-color`, `--eyes-color`, `--hair-color`, `--lips-color` and
`--eyebrows-color` accept RGB hex; `default` restores an original feature.
The model IDs are `claire`, `mpfb`, `mark`, `reference-structure`,
`reference-shell` and `male-sharp`. The last is the preserved owner-named
sculpt, now selectable, not a new accepted Female model.
Manager-owned heads share no speech jobs/audio clocks or mutable caches.
CPU/RAM costs grow per head; the safety cap of eight is not an eight-head
performance qualification. Close unused heads. **Exit** closes its owned
heads only; independent `host` sessions remain until explicitly closed.
Closing the browser tab leaves the manager running. Ctrl+C its console also
requests owned cleanup. A managed head watches its original manager's process
handle and closes if that manager exits unexpectedly.

### Optional 28-voice offline pack

The prepared checkout exposes 28 Kokoro English styles in addition to its
three Windows voices. On another machine the Windows count can differ.
Explicit setup, from this checkout, using its existing CPU environment:

```powershell
.\.local\cpu-env\Scripts\python.exe -m pip install -r requirements-local-voices.txt
.\.local\cpu-env\Scripts\python.exe scripts\fetch_local_voices.py
.\.local\cpu-env\Scripts\python.exe scripts\fetch_local_voices.py --verify
```

Setup fetches about 115 MiB of pinned model/style files into
`.local\models\kokoro-v1.0`. Runtime never installs packages, downloads assets
or sends speech text to a service. Restart an owned head normally to refresh
its voice catalog; do not interrupt somebody else's session. Missing optional
setup leaves Windows voices available and displays setup guidance.

New manager-created heads reserve unused voices, preferring Kokoro. Cards show
the current voice; a deliberate manually shared choice is marked. Select
**Voice** in that head's controls, or request an unused startup voice:

```powershell
.\VeronaAgent.cmd create --session review --model mark --voice "Kokoro Michael"
```

The CLI's omitted `say --voice` respects the current native selection. All 28
styles use one lazy CPU model per local-speaking head, not one model per voice.
One child is reused between styles and released on subsequent Windows synthesis
or host close. Several warm neural-speaking heads still multiply memory costs.
Windows remains the lower-setup-cost option; these voices are not instant.

Kokoro supports speed, bass and treble; unsupported pitch/emphasis visibly
reset to 0/none and become unavailable. API attempts to use them fail, rather
than pretending to apply them. Facial expression controls remain separate from
vocal emotion. Keep lines short: the same 280-character/25-second limits and
45-second synthesis bound apply. Stop discards cancelled output but cannot
instantly interrupt synchronous inference. Failures never substitute a voice.
[Research, exact pins, rights and measurements](research/local-voices.md).

### What a head actually loads

FaceMesh is a presentation of the selected head, not another trained model.
Mark selects its own network/PCA before loading; all other choices use Claire's
network, with only their selected adapter. A Claire head does not load Mark.
Only the selected reference/MPFB adapter loads when that variant needs it.
The empty manager now avoids numerical/inference libraries entirely.
Each warm head still owns one substantial CPU engine and one Chromium shell.

Inactive view geometry and hidden hair GPU buffers are released. Unlit views
keep current motion in the GPU without a second JavaScript motion array or
animated-normal slots; switching to lit Claire recovers those same samples
once, with a possible GPU readback pause, and switching back releases them.
Controls/audio/motion quality remain unchanged. The source payload and current
GPU clip remain needed; choosing FaceMesh does not remove all model memory.

[The measured audit](chapters/07-hazel-claire-and-performance.md#selected-head-resource-ownership-vr-57)
separates startup peak, manager private memory, GPU geometry and remaining
costs. Reuse a warm head, keep sentences short and close unused **owned** heads;
voice-only skips inference but is not moving-lip speech. Source updates do not
restart existing windows; apply them on the next normally requested launch.

### Natural blinking and current model previews

All six head choices support **Natural blinking** at rest and during speech.
It is a live checkbox in the manager's actual controls and in each standalone
page. Reduced-motion preference defaults it off; an explicit choice wins for
that page. Hiding the page/loss of the renderer cancels its bounded timer;
resuming waits anew. It adds no neural inference and shares the existing
animation loop. This is procedural cosmetic eyelid motion, not accepted
anatomy or guaranteed visible phases under a severely stalled renderer.

The README gives each selectable head one large silent GIF through all ten
emotions plus neutral. Every head supports **Surface, FaceMesh, FaceDot and
UniformPolygons** over its own geometry. Surface offers transparent polygons or
shaded color/makeup; the internal legacy view ID is still `claire`.
Native MPFB and actual Mark now share neck cut/depth, full-head framing,
XYZ/cursor motion, zoom, colors, both optional procedural hairstyles and blinks.
Hair and makeup are approximate shared decorations, not native hair assets.
[Chapter09](chapters/09-verona-character-and-waves.md)
explains captures, exact source-sample decoding and limitations.

**Exaggeration and cheekiness:** native MPFB fits conditioned and same-audio
neutral motion into bounded faceunits separately, then applies 2x/4x to their
native geometric difference. Final exaggerated geometry is not constrained to
the native 0..1 rig envelope and is not contact-corrected. Mark uses its own
neural conditioning. **Sideways cheekiness** and its strength slider add a
procedural asymmetric lip pull only during cheekiness clips, with no extra
inference or geometry upload. Disable it or set strength zero for model-only
motion. Stopping resets the cue. Single emotions are explicit, not detected
feelings, combinations or human-accepted articulation.

The original cyan/coral logo appears in the manager, README, source-launched
Electron windows and all browser favicons. Existing loaded windows need a
deliberate restart to pick up source changes. The downloaded Electron
executable and existing shell shortcuts are not rewritten.

### Preserved standalone studies and reports

The manager selects all variants; the following legacy study commands are
optional compatibility/research routes, not required for normal use.

**Actual imported MPFB head with speech:** `.\VeronaMpfb.cmd` now starts the
same shared player in a separate capability-protected browser session.
Generate your sentence, then press Play. Its 51 native faceunits are fitted
before neutral-relative 2x/4x geometric exaggeration, as described above.
Stop resets the head; keep the console open and use
Ctrl+C to cancel/stop it and clear speech RAM. Closing the tab alone does not
stop the console. Reload after WebGL loss or an expired session.
The historical bounded-fit GIF/sound report is
`.local\qualification\mpfb-speaking-06\review.html`: real speaking clips for
all ten emotions plus neutral, not the old authored-pose loops.
That older report measured native fitting0.66-0.81seconds per83-frame greeting, total
generation3.91-7.38seconds; binding5.08seconds is not full startup time.
Earlier variants and their reports are preserved. The manager now selects
the native head directly; Claire-family named heads start4x/bright-spokes.

**Optional reference-shaped Claire study:** `.\VeronaReference.cmd` starts a
separate, clearly labelled experimental desktop with Claire speech, **4x**
emotions, FaceMesh and bright spokes. Generate a sentence, then Play. It requires
this checkout's pinned local MPFB study asset; it does not download one. This is
an approximate structural fit over Claire, not the separate MPFB native rig,
an accepted Female mode or a change to the normal app. Close it or Ctrl+C its
terminal to stop its owned server and discard speech.

The current local comparison/sound report is
`.local\qualification\claire-structure-07\review.html`: Play the first video
to hear it, compare the shape-only blink, or expand the individual emotion
GIF/video sections. The new whole-head/actual-surface map measured 0.98-1.15
seconds for the 83-frame greeting; full generation measured 4.43-7.51 seconds
across these states, not instant narration. No geometry fit runs during playback.
The owner rejected the older subtle fit as visually indistinguishable; its
report remains at `.local\qualification\claire-reference-04\review.html`.
`.\VeronaReference.cmd --fit shell` explicitly selects that historical map;
the default, or `--fit structure`, selects the new review candidate.

In the desktop app, generate and play a sentence, then click **Pop out transparent
head**. The same head becomes a transparent, initially always-on-top window;
speech continues without reloading. A tiny collapsed glass **...** tab sits
centered above the head. Click it to reveal **Drag to move** for native placement
and **- / + / Fit** for zoom out, zoom in or reset model zoom.
Escape or clicking elsewhere collapses it; every pop-out starts collapsed.
The translucent glass styling blurs Verona content, not other desktop apps.
The overlay reserves a little framing room above the crown for this tab.
**Controls** restores the full interface. Close exits
the desktop app and its Python server. Keep its terminal open; Ctrl+C also stops
the owned desktop. No startup service is installed.

**Follow cursor** starts enabled on desktop and follows outside the window
without recording input. **Cursor mode** chooses **Eyes follow cursor** (default)
or **Head follows cursor (eyes centered)**. The latter turns the entire model
around its eye midpoint while iris masks stay centered. Head aiming is smoothed
and bounded, not calibrated physical gaze; manual X/Y/Z remain offsets.
Disable following to settle back to the manual pose/neutral irises. In the
browser, leaving the page also settles tracking. Mode changes clear old tracking
offsets; reload restores eyes mode and unsaved controls. X/Y/Z sliders
each cover -180 to +180 degrees; **Reset orientation** zeros them and resets
Zoom, not speech. Zoom covers 35-230%; the floating buttons and Controls share
the same value. Large zoom/manual rotations can intentionally clip the model.
Head mode reserves a fixed 20% framing margin for tracked turns, even while
tracking is disabled; returning to eyes mode restores original fitting.
Moved overlay placement survives Controls/pop-out in RAM, clamped to an
available monitor's work area on return. Restart restores initial placement.
**Overlay always on top** can be disabled. Transparent regions may intercept
clicks: this version does not provide click-through or manual window resizing.
Pinning uses a qualified above-taskbar Windows level; disable it for normal stacking.
See [desktop mechanisms and limits](chapters/10-desktop-overlay-and-gaze.md).

**Framing: Head and neck** cuts off the shoulders below the throat in desktop,
overlay and browser. **Full bust** restores the original extent and remains the
default. Choose framing in Controls before popping out. Switching is immediate
and preserves speech, voice, gaze, orientation, zoom and material; Reset
orientation leaves it alone, while reload/restart restores Full bust.
It submits fewer skin/hair polygons and calculates fewer animated normals.
Speech-generation cost and full motion storage are unchanged. This is an open
presentation cut, not a newly modeled closed neck or full-body asset.

The previous browser version remains available, without the desktop dependency:

```powershell
.\.local\cpu-env\Scripts\python.exe -m verona --open
```

Keep its terminal open. In the browser, type a sentence, click **Generate face**,
then **Play**. Try the greeting, P/B/M, F/V and vowel example buttons.
Hazel is the default when installed; David and Zira remain selectable. The head
uses **Verona's original rest styling over Claire motion**, with optional
side-parted espresso waves. The trained model remains Claire, not a new identity.
Open **Edit voice** for pitch, speed, warmth/bass, brightness/treble and emphasis;
**Reset voice** restores Hazel/default settings. **Preview voice** prepares a
voice-only sample: press its audio Play control to hear it without generating
face motion. Generate face applies those settings to both speech and animation.
Pitch is a Windows-engine request, not a calibrated acoustic semitone shift.
Neutral plus Happy, Sad, Surprised, Angry, Cheekiness, Disgust, Fear, Grief,
Out of breath and Pain are separate explicit inputs, not inferred from text.
Happy maps to model joy, Sad to sadness, Surprised to amazement and Angry to
anger; the remaining names match their model channels. All ten use bounded0-0.6 strength.
Out of breath changes facial conditioning, not the voice or synthesized breaths.
Only one emotion is selectable; mixed-expression inputs are not supported.
**Emotion exaggeration** selects **2x** (unchanged default) or **4x** the
same-audio neutral-relative difference, not all speech motion.4x is100% more
than the previous2x. Neutral and zero strength stay unchanged at either setting.
Uncached non-neutral clips need an additional local inference pass; exact
repeats can still reuse the completed clip. Change strength/expression, then
**Generate face** again. The same amplification reaches every human view.
In FaceMesh, the center
dot now has a hot core/red corona while the outer rings remain dimmed.
**FaceMesh eye glow** offers the current combined look, **Center + bright
spokes** and **Center + bright concentric rings**. Both alternatives retain
the same glowing center/corona, brighten the selected structure from about
170 to243 red peak, and leave the other structure unlit. The comparison GIFs
use **4x** emotions; the app's default remains2x. This is a live render choice: no new
speech or model run. Other views ignore it; returning
to FaceMesh restores the selection. Reload/restart restores the original
2x/combined defaults; no new preference persistence is introduced.

**FaceMesh colors** appears when **View -> FaceMesh** is selected. Click the
**FaceMesh** or **Eyes** swatch to open the browser's built-in color picker,
or enter a 6-digit RGB hex code (`#4F46E5`) or shorthand (`#0FF`). The `#` is
optional; either case is accepted. Picker selection updates the hex field;
valid typed colors update the swatch/live face, normalized when you finish.
Invalid input shows an error and keeps the last valid color until corrected
or reset. Mesh wire, including optional matching hair, and mechanical eye glow
are independent. Glow patterns and eyelid occlusion stay intact; hot centers
retain pale highlights, while black turns off colored optical emission.
Other views keep their original colors.
Live edits preserve the current speech, play position and generated motion:
no synthesis, model run or geometry rebuild. Colors stay in this page's RAM
across view changes and desktop Controls/pop-out. **Reset colors** restores the
original cyan/red appearance without resetting orientation/glow or speech.
Reload/restart also restores defaults; no color preference is saved.
For an agent host, choose colors in its own Controls window; subsequent CLI
speech inherits them. There are no new color flags or global agent settings.

Play/Pause and the timeline follow the actual audio clock; Restart rewinds and
pauses. XYZ orientation, zoom, volume and point/edge toggles are available.
Browser cursor following is opt-in and limited to its page; native desktop
transparency/always-on-top are desktop-only.

Press **Ctrl+C in the terminal** to stop. No service is installed. Closing only
the browser does not stop Python. Reopening requires the full local URL printed
by the terminal, including its private `#` session part; a new server has a new
URL. Do not share that URL.

Inputs are limited to 280 characters and 25 seconds of padded speech. Generation
is offline/precomputed, not streaming. Browser speech/motion stays in RAM;
reload clears the page; the server retains only its latest successful clip and
one latest synthesized voice sample. Exact-repeat clips and expression-only
speech are reused. Stopping clears both. No microphone, camera, cloud TTS or CDN is used.
The application does not deliberately save a transcript; normal browser history
may retain the local session URL.

**Limits:** full SDK contact/smoothing corrections and independent teeth,
tongue and eye-joint animation are not implemented. Functional playback and
contrasting speech inputs have been exercised in Edge; testing was muted.
Correct lip contacts, expressive quality and human listening acceptance remain
unqualified. This is a working neural-skin prototype, not SDK parity.

## Opt-in speech for local agent sessions

For an in-depth installable operating contract, read
[the Verona agent skill](../.github/skills/verona/SKILL.md). It covers setup,
ownership, commands/customization, performance, failures and the owner's
distinct-color policy. Installing that passive skill does not start speech,
replace this checkout's setup or add a runtime color reservation service.

The selected head's settings have two sections: **Editable now** and
**Read-only settings**. Session name and head variant are fixed at creation;
create a new head to change them. Disabled live controls are labeled
**Currently unavailable**, not permanently fixed: changing mode or finishing
speech may make them editable. The sections update from the head's actual
readiness/control metadata. Refresh an already-open manager page to load
updated UI; existing head windows do not need restarting.
Preserved standalone Claire controls are grouped under Expression,
Look & framing and Pose & cursor. Their technical explanation is collapsible;
the existing audio/renderer is reused. Managed MPFB shows just its transparent
wire head and floating menu, not both study previews.

An agent with permission to run local Windows commands can use Verona as its
speech output. This does not install an assistant, scrape conversations or
enable speech for every session. Remote/cloud agents cannot reach this machine's
loopback host unless they actually run commands here.

Prefer **New session** in the manager or the `create` CLI above. For an
independently owned host, keep its terminal open:

```powershell
.\VeronaAgent.cmd host --session work
```

It opens its own native window without focusing it. The model, synthesizer and
renderer stay warm. This host starts in FaceMesh with bright spokes and 4x,
cursor following off and **Always on top** enabled by default. Every managed
head keeps its **Always on top** checkbox and session/model name inside the
collapsible **...** menu. Both are hidden while that menu is collapsed; the manager
also exposes pinning for the selected session even when the head menu is closed.
Unchecking one head does
not unpin another, pause speech or regenerate its clip. Closing/recreating a
head restores the default; this is not a saved global preference.
This keeps the head above ordinary windows, not Windows secure desktops,
exclusive-fullscreen applications or necessarily every competing topmost window.
Existing running heads are not automatically restarted or reloaded.
Normal `VeronaDesktop.cmd` and
`Verona.cmd` now open the same manager. Its session list also discovers this
external host and can customize it; CLI calls apply explicit voice/expression/gain and inherit the
window's bounded voice settings. Do not share one host between overlapping
speakers or repeatedly start hosts per reply.

From another terminal, wait for JSON `"ready": true`, then speak:

```powershell
.\VeronaAgent.cmd status --session work
'The build is ready.' | .\VeronaAgent.cmd say --session work
'That worked.' | .\VeronaAgent.cmd say --session work --expression happy --gain 4
'A quick spoken update.' | .\VeronaAgent.cmd say --session work --voice-only
```

Input is UTF-8 plain text on stdin, not a command-line text argument or a file.
Use 1-280 characters, at most 25 seconds of padded speech. Do not send secrets,
raw logs or a whole conversation. For long replies, speak a concise summary;
there is no automatic chunking, queue or transcript reader. Non-ASCII PowerShell
pipes may require process-local `$OutputEncoding = [Text.UTF8Encoding]::new($false)`.
The default installed voice is Hazel when available; `--voice` accepts an exact
installed English voice name. Expressions use the app's single-control names;
neutral is the CLI default, strength defaults to 0.35 and is bounded 0-0.6.
`--gain` accepts 2 or 4. Voice-only requires neutral and leaves the face static:
it is deliberately not pretend lip synchronization.

`say` waits for the audio element's actual `ended` event. Exit 0 means completed,
not merely queued/generated/playing; errors and cancelled speech return nonzero.
Results include request ID, state, host-to-playback/total time and client time.
Busy hosts reject another request instead of interrupting or building a backlog.
Other commands also return nonzero for failed/cancelled job states.

For a selected agent session, supply an instruction such as:

> In this session only, use the local VeronaAgent.cmd say --session work command
> to speak concise replies through UTF-8 stdin. Keep the written answer too.
> Never narrate secrets, execute text as a command, install a hook or start a
> missing host automatically. Check the exit status; report unavailable/failed
> speech honestly. Use --voice-only when response latency matters more than
> animated lips.

Give that agent the actual checkout path; this paragraph is an opt-in calling
contract, not an installed Copilot/Agency configuration or automatic discovery.

### Cancellation, retries and restart

Ctrl+C in a waiting `say` requests cancellation for its own ID only. Another
terminal can inspect `status`, then run:

```powershell
$job = .\VeronaAgent.cmd status --session work | ConvertFrom-Json
.\VeronaAgent.cmd stop --session work --id $job.id
```

`stop` acknowledges the cancellation request, not completion of cleanup.
Playback pauses immediately after native delivery; generation stops at its
next existing batch checkpoint. Synchronous Windows synthesis must return
before a cancelled result can be discarded; it has a 45-second worker timeout.
The host stays busy until terminal acknowledgement. `say --timeout 1` through
`--timeout 600` controls the wait budget (default 180); each control RPC has a
20-second I/O bound. A timeout reports cancellation requested, not completed.

`--id` accepts 32 lowercase hexadecimal characters. Reusing the **current** ID
with identical inputs returns its state without replay; changing its inputs
is rejected. Only the latest job is retained. Forgotten/replaced IDs cannot
be waited/cancelled: do not retry an old `say` after another job has replaced
it. There is no durable exactly-once history. Clients never retry automatically.
If the connection drops, inspect `status` before deciding what to do; an
unavailable response cannot establish whether speech had started.

Closing this host's window or Ctrl+C in its terminal stops its owned processes.
Restart is explicit, never a recovery replay. The per-run descriptor at
`%LOCALAPPDATA%\Verona\agent\work.json` contains private port/capability/PID
metadata, not speech. Its protected Windows ACL permits the current user and
System only. Never share or print it. Clean shutdown removes it and the
disposable native profile. A hard crash can leave a stale descriptor: verify
that its recorded process really is the old owned Verona host before explicitly
removing that exact file. The host refuses collisions; it does not replace
another session's descriptor or attach to a user's running Verona.
Speech, reply text and motion are not deliberately persisted; one clip and one
latest synthesized sample remain in RAM. Derived topology alone may be cached.
The calling agent/tool or shell may log its own inputs; Verona cannot erase
those histories.

### Measured performance, not an instant-response promise

On this checkout's Ryzen 7 PRO 7840U, hidden/muted native qualification
`agent-cli-07` measured 6.20 seconds cold-to-ready. Once ready, host-accepted to
reported playback start was 0.040 seconds for new voice-only speech,
0.053 seconds for a cached animated repeat, 3.13/5.15 seconds for two new neutral
lines (2.68/5.075 seconds of audio), and 4.80 seconds for a short Happy line.
CLI process startup/exit added approximately 0.37-0.42 seconds in those cases;
voice-only command-to-playback was approximately 0.46 seconds. Completion waits
through the speech itself. These are bounded samples, not percentiles, a
hardware-independent guarantee or audible speaker/listening acceptance.
The 40-ms warm host path must not be presented as the whole CLI latency.

New animated lines still require the complete CPU neural clip before playback;
expressive lines need the extra neutral-reference pass. Choose voice-only for
fast agent narration, animation when that preparation delay is acceptable.
See [chapter10](chapters/10-desktop-overlay-and-gaze.md#opt-in-agent-speech-with-one-warm-player-vr-37)
for protocol, isolation, failures and qualification details.

## Select a presentation

**View → Claire** is the preserved initial view. Its separate **Claire material**
selector retains Transparent polygons (default) and Reference color + makeup.
Claire's edge/point/hair choices and framing survive a round-trip to another view.
The current clip, explicit expression, voice, playback clock and XYZ/zoom remain
the same: switching views does not generate, reload, seek or replace audio.

- **FaceMesh:** only the front facial skin and eyes, no ears, neck or hair.
  Triangle edges are visible, without a colored filled surface. **Mesh detail**
  ranges from 1 to 5; 5 preserves native front-face detail. Lower levels contract
  connected edges outside protected lip/lid/nose regions. The displayed counts
  are real submitted triangles/edges, not percentages or a promise of speedup.
  Framing is fixed to Front face only. The open mask rotates in 3D; it does not
  grow a back/ears when turned. Its red mechanical irises have bright cores,
  three concentric rings, radial spokes, dark gaps and a soft local halo.
  They follow gaze/XYZ and remain depth-occluded; other views keep their own eyes.
  Increase **Zoom** to inspect the fine iris details. No extra eye toggle is needed.
  Their final RGB intensity is now 30% lower, preserving rings/spokes and alpha.
- **FaceDot:** surface-sampled circular dots only, including ears/eyes/neck. An
  invisible depth surface hides rear marks; filled polygons/lines are not visible.
- **UniformPolygons:** a rectangular surface-coordinate grid over animated skin,
  including ears/eyes/neck, not a flat screen overlay. Cells curve/stretch over
  anatomy and expressions. This is a grid presentation, not a new quad mesh.

In FaceDot and UniformPolygons, **Pattern density** scales both surface axes
from 0.5x to 3x: higher means more dots/cells in the same area, roughly proportional
to the square of the multiplier before occlusion/pixel sampling. **Cell gap**
from 0-80% increases empty space around each dot or rectangular cell outline
without changing their centers. Density also changes center-to-center spacing;
gap is a fraction of each cell, not a measurement in physical centimetres.
Each view remembers its own pair until reload (dots: 1x/60%, grid: 1x/0%).
Reset orientation does not reset them. The shader attaches these patterns to
the deforming surface: no neural topology change, additional speech generation,
new GPU mesh buffers or per-frame CPU point construction. FaceDot now uses this
adjustable sampling instead of drawing one dot per original mesh vertex.
Extremely small/dense marks can soften or merge at limited screen resolution;
zoom and display resolution affect what can actually be distinguished.

Dot/grid views start with hair off and at Head and neck; each retains its own framing,
with Full bust available. These three human alternatives auto-fit their selected extent and use
unlit ink, avoiding unused animated shading normals. Their depth surface still
uses triangles; dots do not make geometry/inference free.
Select the view/detail in Controls before popping out the same transparent
desktop window. Reload/restart restores Claire, Full bust and native detail.
Reset orientation does not reset presentation/detail/framing.
With **Head and neck**, **Visible neck** previews a curved jaw-following cut
live. Set0 for jawline-only or drag towards6cm for more neck; default1.7cm.
Skin and hair share the curve, so there is no straight horizontal neck/hair
chop. Each view remembers its own value until reload. Dot/grid keep a stable
fit while adjusting; use Zoom if desired. Full bust restores the entire original
extent and hides the neck slider. FaceMesh keeps its front-only mask.
**Realistic** names the parked future GLB identity; there is no selectable fake
implementation, automatic rig repair or asset import in this update.

**Claire presentation:** warm smooth shading, sculpted cheek/jaw/bridge contours,
cosmetic brows/liner/rose lips and static hazel eyes define the character.
**Transparent polygons** is the default Claire material, restoring the earlier cool
frosted surface and visible native contours. **Reference color + makeup** is
the optional olive/rosewood/hazel-green study guided by the supplied sheet,
not an exact or photorealistic reconstruction.
Edges/hair are on and points off initially; all remain independent. Switching
Claire material changes immediately, not the clip, voice or playback position.
**Colors** starts enabled in Claire. Disable it for neutral grayscale skin,
eyes, cosmetics, edges/points and hair in either material; enable to restore
their hues. Lighting and tonal cosmetic detail remain, not a bare unstyled face.
The option is hidden outside Claire; human alternatives retain cyan ink.
**Hairstyle** selects only **Claire waves (original)** or **Spiral curls**.
Curls have48 independently swept locks, twice the previous24, with unchanged
per-lock detail. The other nine styles and their generators/gallery files are
removed, not hidden or preloaded. Historical Git/release/evidence snapshots
are not runtime resources and are not rewritten.
These are different static geometries, not color presets or hair physics.
Rotate to inspect the curls; Full bust reveals their length, while Head and neck
intentionally clips every style along the same jaw curve. Some styles reserve
more fitting room; Zoom remains available. The Hair checkbox works independently.
Hair starts enabled in Claire and disabled in FaceMesh, FaceDot and
UniformPolygons. Enable **Hair (this view)** in any view, then choose
**Hairstyle (shared)**. Visibility is remembered separately for each view;
one selected style is shared across them. The style selector is disabled while
hair is off. Switching away does not silently enable hair in another view.
Claire retains its shaded/polygon hair; FaceMesh uses real triangle edges,
FaceDot surface dots only, UniformPolygons rectangular grid outlines only.
Dot/grid density and gap apply to hair too. Invisible depth surfaces occlude
rear marks, not a colored solid hair layer behind the pattern.
FaceMesh's face mask still omits ears/neck; optional full hair can extend around
it. Mesh detail changes facial detail only, not the selected hair topology.
Other views use the same jaw-following hair crop with Head and neck; choose Full
bust to retain long hair. Their hair-enabled fit includes the hairstyle extent;
turning hair off restores their original fit. Crop-slider/detail changes keep
that fit stable. High zoom/large rotations can still crop the model.
Selection builds only the latest alternative, deletes its replaced GPU buffers
and never regenerates/seeks speech. Reload resets original waves, Claire colors
and default per-view hair visibility; no preferences are persisted. Invalid
geometry surfaces an error and preserves the previous choice, not a silent fallback.
The original hair has actual layered S-wave geometry. These are not
animated eye joints, teeth or a claim of photorealism. Color rendering caps
device pixel density at1.5x; polygon rendering retains a2x cap. This explicitly
trades high-DPI color resolution for a smaller rendering workload.

**Performance:** warm startup avoids native-scene parsing; repeating the latest
request skips speech/inference. The current native-loop surface uses 15,375
vertices, about 75% fewer than the full skin. It preserves more facial detail
than the earlier voxel reduction, so its motion payload is larger, not 37%
smaller. Prepared playback interpolates 30-fps learned motion on the browser's
display clock. Normal/2x-density tests pass the bounded mean/p95 display budget;
historical runs also contain occasional 49-50-ms intervals. The desktop's final
30-second sample measured mean 16.659 ms, p95 16.8 ms and maximum 17.8 ms.
This is not a locked
60-fps or universal hardware guarantee, nor 60-fps neural generation.
[Chapter 09](chapters/09-verona-character-and-waves.md) records the current
styling/geometry; [chapter 10](chapters/10-desktop-overlay-and-gaze.md) records
desktop qualification and retained browser failures. New-line inference remains
precomputed. Restart the server to load a changed backend style; reload alone
does not rebuild an already-running engine. Speech/clip RAM is discarded on stop.

## Fresh-clone setup

Requires Windows, Python (qualified here on 3.13), an installed English desktop
System.Speech voice, and a current WebGL2-capable browser (qualified in Edge).
Review [third-party terms](../THIRD_PARTY.md) before downloading model/sample data.

```powershell
python -m venv .local\cpu-env
.\.local\cpu-env\Scripts\python.exe -m pip install -r requirements-cpu.txt
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_claire_model
.\.local\cpu-env\Scripts\python.exe -m verona --open
```

Only setup/downloads need internet; runtime never downloads missing assets.
Pinned Claire model/topology files total about 337 MB, plus isolated dependencies.
No extra TTS model, CUDA, PyTorch or npm install is needed. Startup verifies
assets and prepares geometry; explicit setup errors appear in the terminal.

For the manager's native heads, use existing Node.js >=22.12/npm and explicitly
install its pinned Electron runtime once:

```powershell
.\Setup-VeronaDesktop.cmd
.\Verona.cmd
```

Setup uses the configured certificate-verified npm registry/feed, a lockfile,
and Electron's official installer with its supplied artifact checksums.
Dependency install scripts are disabled; only that reviewed installer is run.
This is a larger optional Chromium desktop runtime, not another speech model.
It lives under ignored `desktop\node_modules`; setup caches use ignored `.local`.
No TLS bypass, global package installation or automatic runtime download.
Later launches are local/offline. A fresh checkout needs both the Python/model
setup above and desktop setup; missing prerequisites fail explicitly.

## Engineering and research

- [Engineering book and reading paths](README.md)
- [Product brief](product-brief.md)
- [Speech-to-face research and recommendation](chapters/04-speech-driven-face-research.md)
- [Pinned primary-source register](research/speech-face-sources.md)
- [Verified local CPU experiment and commands](chapters/05-local-cpu-feasibility.md)
- [Text-to-speech and native-mesh clip generation](chapters/06-text-to-face-prototype.md)
- [Hazel voice editing, Claire and measured performance](chapters/07-hazel-claire-and-performance.md)
- [Facial definition and measured display fluidity](chapters/08-facial-definition-and-fluidity.md)
- [Verona character styling and wavy hair](chapters/09-verona-character-and-waves.md)
- [Transparent desktop, cursor gaze and XYZ orientation](chapters/10-desktop-overlay-and-gaze.md)
- [Workstream index](../TODO/00_INDEX.todo)
- [Contributor contract](../AGENTS.md)
- [Private project board](https://github.com/users/Zanark/projects/15)

KardboardCode-VTuber's face-mesh pipeline has been reviewed as prior art only.
Verona is a different application; neither its avatar renderer nor its stack is
selected for reuse.

The research recommends a deformable 3D face with audio-clocked playback.
The owner selected free/local operation on this AMD machine. The official
Audio2Face SDK requires NVIDIA hardware, but a custom ONNX CPU experiment now
first executed the Mark v2.3 network and reconstructed native skin vertices locally.
Installed Windows voices now produce real local speech and complete learned
Claire v2.3.1 skin clips using matching native-derived topology. A loopback-only browser
renders those clips with audio-clocked interpolation. Full SDK postprocessing
and articulation acceptance remain separate from this functional qualification.

## Generate a text clip

```powershell
.\.local\cpu-env\Scripts\python.exe -m verona.generate --text "Hey, how are you?" --pitch 2 --rate 1 --bass 2 --output .local\my-first-clip
```

Use a new output directory. This writes audio, complete motion and mesh data;
it is an explicit export command, not the browser launcher. No extra TTS model
or Python package is required.
See [chapter 07](chapters/07-hazel-claire-and-performance.md) and
[third-party terms](../THIRD_PARTY.md).

## Run focused checks

Using the prepared local environment:

```powershell
.\.local\cpu-env\Scripts\python.exe -m unittest discover -s tests -q
```

The original Mark numerical probe remains a historical optional diagnostic,
not the current Claire application. Fresh clones need its separate assets:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.fetch_cpu_model
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu
```

This prints CPU inference timings and output/geometry dimensions, and saves
`.local\cpu-probe.json`. It does **not** open a face window or play speech.
To analyze a local mono 16 kHz, 16-bit PCM WAV of at most ten seconds:

```powershell
.\.local\cpu-env\Scripts\python.exe -m scripts.probe_cpu --wav ".local\line.wav"
```

For fresh-clone setup and limitations, see [chapter 05](chapters/05-local-cpu-feasibility.md).
