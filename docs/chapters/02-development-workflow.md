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
