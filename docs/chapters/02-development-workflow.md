# 02 - Development, evidence and documentation

## One bounded outcome at a time

Start with observable behavior, ownership, failure conditions and exclusions.
Read the affected implementation before changing it. A workstream's acceptance
criteria determine its tests; a convenient proxy is not enough. For example, a
function test cannot establish that an actual GUI control invokes that function.

Preserve working changes and choose coherent independently usable slices.
Once commits are authorized, checkpoint those verified slices rather than
waiting for the entire project or manufacturing per-file activity commits.
Verify both local Git identities; a PAT login does not set commit attribution.

## Workstreams and evidence

Every finite numbered .todo file preserves eight fields:

1. Status: NOT_STARTED, IN_PROGRESS, BLOCKED or DONE.
2. Milestone: the concrete outcome.
3. Dependencies: actual prerequisite IDs, never implicit file ordering.
4. Purpose: why the outcome matters and what it excludes.
5. Tasks: bounded actions with honest progress.
6. Acceptance criteria: observable checks.
7. Completion evidence: actual outputs, commands/results and limitations.
8. Completion log: dated events, including failed attempts or supersession.

Issues and Project items mirror the reviewed workstream, not private session
notes. The index and perpetual ledger are intentionally not feature issues.
See ../github-tracking.md for exact status and ownership policy.

## A causal journal, not a victory list

Record action -> immediate effect -> why -> mechanism -> evidence -> next
consequence. Preserve failed hypotheses when they explain a later choice.
Separate authored content, structural checks, technical behavior, target
qualification, human acceptance and remote delivery.

## The living book

For each real subsystem, explain its problem and location, inputs/outputs,
state owner, normal sequence, failure/cancellation/restart behavior, invariants,
alternatives and verification. Cite exact source paths/symbols and the relevant
revision. Explain algorithms and data structures with examples and complexity
where meaningful; identify design tradeoffs without ceremonial pattern labels.

Use diagrams when they clarify ownership, data flow, timing or lifecycle.
Label every relationship. Preserve editable sources and inspect rendered
figures at final scale when producing an edition. A parsed diagram is not a
visually reviewed figure.

Use beginner and maintainer reading paths. Worked examples and exercises should
teach actual implementation, not inflate a page count. Generated documentation
is not evidence that the owner learned its contents.

## Implementation and delivery remain separate

Use synthetic/disposable test inputs and protect any user-running stable build.
Never silently restart it or share mutable test state. Camera/microphone/GPU
access may conflict even across separate source trees.

Check affected docs, links and code together using existing tooling once it
exists. Install dependencies only when required. Commit, push, publish,
dispatch and deploy are distinct permissions. No scheduler or hosted sync is
enabled by writing this workflow.

## An illustrated M1 journal, not a private-chat export

The owner requested a dated journal after the first functional release.
`book/milestone-1/manifest.json` therefore defines a separate retrospective
allowlist; `book/manifest.json` still orders the engineering manuscript.
`book/milestone-1/journal.json` authors 31 chronological entries with the problem,
mechanism, correction and remaining limit. Dates come from recorded commit
author timestamps in IST, not file modification times or guessed photo dates.

`book/build_journal.py:prepare` pins historical references at c953ae7, selects
individual reviewed local images and samples GIFs on their actual encoded
timelines. Full-canvas PNG derivatives strip container metadata without changing
the originals. This keeps synthetic app evidence separate from raw conversation,
private continuity, profiles, recordings, model binaries and supplied artwork.
`JournalPDF` renders warm-paper pages with dated gutters, evidence plates,
searchable prose and native navigation, with matching offline HTML.

Successful rendering did not establish a good book. Early candidates exposed
an overflowing commit register, a low-contrast cover caption and overlapping
wrapped plate headings. The final implementation changes row capacity/geometry,
not type-size gates, and uses tall gallery columns where nested sheets needed
more space. `check_text_overlap` supplements page-bound checks: text can remain
inside a page while colliding with other text.

Font glyph aliases caused a subtler error: native PDF extraction returned
NBSP/soft-hyphen/Greek-question-mark aliases for authored ASCII. Merely normalizing
the extracted text would hide broken copying/search. `JournalPDF.restore_unicode`
instead maps used glyph IDs back to exact source characters before subsetting,
rejects ambiguous mappings and checks every authored line after reopening the
PDF. The focused regression preserves exact paths, spaces and punctuation.

`qualify` produces native renders and structural receipts; actual visual review
is a separate recorded action. `freeze` requires the exact reviewed PDF hash,
every page/figure and representative native-resolution pages before copying a
distinct edition and SHA-256 inventory. The local v1 has 84 pages/109 figure
occurrences. An isolated headless reader check and a frozen-builder rebuild with
Git absent passed; all rebuilt native page images matched, not the PDF bytes.
No app process or owner head was driven for this work.

An interrupted build leaves partial, non-delivered output; retry in a new named
candidate and preserve failures. Frozen editions are never overwritten.
See ../../book/README.md for exact commands, dependency/font rights and the
portable rebuild boundary. Local delivery, agent review, owner acceptance and
public distribution remain separate; this retrospective does not reopen M1,
alter v0.1.0 assets or certify articulation/listening accuracy.

## Continue an edition without rewriting history (vr-89)

`book/living-face/manifest.json` and `journal.json` extend the earlier offline
voices volume through actual source commit `3d5bc5f`. Thirteen entries use
21-22 November2026 Git author dates in IST, not inferred capture dates.
The47-page **A Face That Keeps Changing** PDF/reader contains13actual figure
occurrences and preserves the earlier usable frozen editions. The delivery
index in `book/README.md` gives its exact identity and review boundary.

The longer acceptance heading exposed a validator defect: line wrapping put
a newline inside a complete native heading, so a literal substring test
reported a missing section. `book/build_journal.py:qualify` now collapses
whitespace only for that section-presence check. Its per-authored-line exact
text, overlap, size, Unicode and page-bound checks remain unchanged.
`test_native_qualification_accepts_wrapped_section_titles` exercises an actual
PDF with the wrapped title. This is not a workaround for missing text.

## Retain evidence deliberately, not every generated byte (vr-90)

The owner requested cleanup only after the journal update. The measured
checkout had30.10GiB; after producing the continuation and its candidates,
the exact cleanup baseline was30.151GiB. Deleting22.142GiB leaves8.009GiB
of logical file data, excluding traversal through junction targets. This is
file-byte accounting, not an NTFS allocation/compression measurement.

The main sources were raw frame sequences, superseded motion/topology
payloads, disposable qualification profiles, duplicated release-source ZIPs,
installed-tool download archives, candidate book renders and15old detached
worktrees. All worktree bases were reachable ancestors. Dirty snapshots were
compared to reachable Git blobs; five unmatched documentation snapshots were
retained privately before removal. Shared model/Electron junction entries
were unlinked without walking their targets. Canonical source and Git history
were not pruned, and no dependency was uninstalled.

Keep model packs, CPUenv, installed Electron/Blender, prepared local effects,
authored native inputs, archived source motion and latest fitted review
geometry. Keep current and historical report directories, source attribution,
all four usable frozen editions with prepared inputs, selected original
figures and compact successful/failed receipts. Explicit selected-image
allowlists take precedence over bulk raw-sequence pruning.

An exact private manifest records56,661deleted files and all15worktrees;
`.local/cleanup-20261122.json` is the compact local receipt. All881retained
asset hashes stay exact;649relative report links and177frozen-edition file
checksums pass afterward. Raw-frame or old-candidate replay may now require
regeneration. A historical receipt is evidence of its recorded run, not a
promise every transient binary/frame still exists. Do not repair missing
raw outputs by silently downloading models, weakening checks or claiming a
fresh visual review. Retained GIFs remain directly reviewable.

No runtime process was stopped, reloaded or launched for cleanup. The earlier
Onyx process IDs were already absent at the pre-delete check; their previous
delivery receipt is not a claim that the head is still running now. New
runtime work must discover current ownership again rather than trusting PIDs.

## Explain technical vocabulary at the point of reading (vr-91)

The living-face v2 manifest explicitly names `book/living-face/appendix.json`.
Its150topics group930aliases into nine friendly subject gardens. Explanations
use simple analogies and real limits; the vocabulary includes foundational
mesh/math/speech concepts as well as current lip/lash and publishing work.
It is a technical concept appendix, not an ordinary-English dictionary or
an attempt to rewrite text embedded in historical images.

`book/build_journal.py:prepare` accepts only an appendix path contained inside
`book`, validates unique IDs and unambiguous aliases, and bundles its content
into portable `journal.json`. `term_matches` is case-insensitive, whole-word,
longest-first and whitespace-aware. After native text/Unicode restoration,
`JournalPDF.link_terms` converts matched character boxes into exact page/Y PDF
annotations and corresponding positioned HTML anchor links. Wrapped phrases
have one rectangle per line, not a huge box over unrelated words.

`outside_rect` subtracts term hotspots from contents navigation rather than
stacking competing links over the same word. Alphabetical index rows target
the canonical definition; definition headings do not need self-links.
Subtle dotted cues show what is clickable. Both formats keep native searchable
text, local-only destinations and no reader script or network dependency.
Use viewer/browser Back after following a term.

The reviewed78-page v2 has2,998term rectangles,150alphabetical links and
32native bookmarks. Fourteen book tests cover matching, ambiguity, wrapped/
repeated exact PDF destinations and navigation subtraction. Native checks
validate every recorded rectangle/target. Isolated Edge actually pointer-clicks
all150definition destinations plus a contents-row term and cover caption,
checks Back, and resolves3,207local links without overflow/external requests.
Two fixture-only selector/assertion defects have retained failure notes.
All78layouts and full-resolution3/26/36/51 are reviewed. A Git-free portable
rebuild preserves the complete appendix/link inventory and selected figures;
201checksum entries across five usable frozen editions remain exact.
These are agent production checks, not owner approval or new face qualification.
