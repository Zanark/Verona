# Engineering-book production contract

## Current deliverable

The vr-87/88 [living-journal entry](journal.md) supersedes two defaults:
mouth transparency is now creation-time opt-in, and Akari's upper lashes fit
the actual eye opening instead of reusing Elara's contour. Corrected local
GIFs include eye/lip close-ups. Frozen editions remain unchanged.

The vr-86 [living-journal entry](journal.md) follows the illustrated
[anime-woman research](../docs/research/claire-anime-woman.md) into the original
Akari candidate: coordinated same-topology skin, layered eyes, bound lashes/
brows, swept bob, continuous symmetric lipstick and a three-GIF local review.
Research was committed before implementation. This is a separate review study,
not a production installation or a newly rendered/frozen book edition.

The vr-85 [living-journal entry](journal.md) adds Elara-only raised brows and
upper lashes, exact original-geometry preservation and unchanged other-head
media in the existing local GLB review. It does not update a frozen edition.

The [living development journal](journal.md) now records vr-69's floating-zoom
and vr-70's separate internal ear/hair corrections, including actual owned-window
images, retained failures and their scope. Its vr-71 entry adds tool-owned idle
gestures, speech/inspection ownership and six-head qualification; vr-72 records
the private all-action GIF report, and vr-73 adds measured idle warm sleep and
quick opacity controls. This dated source continuation is not another
rendered edition. All frozen PDFs and their source cutoffs below stay unchanged.
The vr-79 entry explains the transparent purple-haired/pink-lipped identity,
Audiowide wordmark, alpha-preserving icon generation and isolated qualification.
The vr-80 entry adds Mark's quiff/side part, the rejected helmet fit, native
upper-skull fitting and independently decoded actual-model README previews.
The vr-81 entry covers native lip paint, transparent mouth compositing, Rowan's
eyelid relief and half-strength emotions, including retained failures and the
distinction between technical qualification and owner visual acceptance.
The vr-82 entry adds six supplied-GLB review candidates, preserved native versus
Claire topology, bounded exact attachment, fitting-only neck closure and a
six-GIF local comparison. Source licensing and unresolved visual/rigging
limitations remain explicit; it is not a new edition or manager installation.
The vr-84 entry corrects neutral lip erasure, separates outer-lip tracking
from folded inner rims, records rejected seals and explains the wide-opening
gate. The separate six-GLB report is refreshed without changing its geometry;
the original report backup and frozen editions remain intact.
The vr-83 entry refreshes the original twelve-GIF catalog without changing
identities, documents archived-motion derivation and exact gender labels,
and records the separate settings-preserving owned-head reopen.

The latest separate continuation is **Finding Different Voices**, anchored to
implementation `d2585f3`:
`book\editions\Verona-Local-Voices-Journal-v1\Verona-Local-Voices-Journal.pdf`.
Its 24 pages, two dated entries and two occurrences of one actual qualification
image cover the offline-voice decision, controls and corrected full-worker-tree
memory measurement. Source is `local-voices\manifest.json` plus
`local-voices\journal.json`; the same explicit-manifest build command applies.
All 24 layouts, both figure occurrences and full-resolution pages 5/6/7 were
agent-reviewed. Native checks, isolated offline reader (24 pages/2 images/6 links),
nine production tests and a 24-page portable rebuild pass. No owner listening/
visual approval or PDF byte-identical rebuild claim. Frozen PDF SHA-256:
`2cdfbb9b06939594ede36f8ac8ca797ae6c1bb098f0526158aba72aefb8c1138`.
The final all-style allocator run and owned live promotion are later evidence
in the living ledger, not retroactively completed events at the source cutoff.
Prior M1v2 and native-head PDFs remain untouched; no PDF upload.

The journal now also has a separate **post-M1 continuation**, not a silently
rewritten first milestone:
`book\editions\Verona-Post-M1-Native-Heads-Journal-v1\Verona-Post-M1-Native-Heads-Journal.pdf`.
Its31pages, six dated entries and13figure occurrences cover Claire's local
export, withdrawal, resource ownership, blinks and actual native-head parity.
The source cutoff is `cab23cc`; later release closeout is deliberately separate.
The frozen M1v2 below remains unchanged. Both are local ignored editions.

Continuation sources are `post-m1\manifest.json` and `post-m1\journal.json`.
The same bounded builder accepts an explicit in-book manifest and contained
PDF filename; without it, the historical M1 manifest remains the default:

```powershell
python book\build_journal.py --manifest book\post-m1\manifest.json --output book\output\post-m1-next
```

Final review covers all31pages and13allowlisted figures, representative
full-resolution text/plate pages, native PDF checks and an isolated offline
reader with31pages/13images/10valid navigation links and no overflow or external
page requests. First preparation retains the unsupported eight-image-plate
failure; figures are split into explicit four-image plates. A wrapped cover
badge was corrected. A focused regression also prevents freeze from returning
the last copied receipt's hash instead of the selected PDF's hash.
Nine journal-tool tests pass. This is agent review, not owner approval.

Frozen PDF SHA-256:
`a0e20dd0b773ddc51b8afc67e3aee080f07237f838aca4d5a2e057318fa58dd5`.
Frozen checksums and a Git-free 31-page portable rebuild pass with identical
prepared figure hashes; this does not promise byte-identical regenerated PDFs.

The canonical engineering manuscript is docs/README.md plus the ordered chapters
in manifest.json. It remains a living manuscript, not a fully rendered engineering
textbook. The product brief and tracking guide are maintainer references, not
automatically included chapters.

A separate **Milestone 1 development journal** is complete as a local edition:
`book\editions\Verona-M1-Development-Journal-v2\Verona-M1-Development-Journal.pdf`.
Its **83 pages, 31 dated entries and 105 figure occurrences** trace 18-21 November
2026 through research, experiments, corrections and v0.1.0. Warm-paper typography,
dated gutters, timelines and evidence plates make this an authored journal, not
a raw ledger export. `reading.html` beside it opens offline; click an image for
its retained full-resolution PNG. These ignored local files are not on GitHub.

**Owner-requested withdrawal (vr-55):** v2 removes four depictions of the rejected
armored character and labels its historical entry withdrawn. The old v1/candidate
PDFs, readers, four copied figures and robot-bearing review sheets are explicitly
deleted, rather than preserving unwanted images inside an otherwise frozen book.
Other journal content and historical audit receipts are retained. The v1 folder
is now an incomplete, withdrawn record, not a usable edition or valid checksum
inventory. This explicit deletion is an exception to ordinary edition preservation.

The journal's historical cutoff is
`c953ae7a078673f1cc423401a887b437ea25cb91`; the immutable release source remains
`f892d423f923bdd043ebe6aab7647f0993679251`. Commit author times are shown in IST,
not inferred capture times. Old screenshots are historical evidence, not fresh
runtime qualification. All-variant sideways cheekiness, independent listening
and accurate phonetics remain unaccepted or undelivered as stated in the book.

## Reproducing the M1 journal

`milestone-1\manifest.json` and `milestone-1\journal.json` explicitly allowlist
18 historical text references and individual PNGs/timed GIF samples. They do
not broaden the engineering manifest or scan arbitrary `.local` content.
`build_journal.py` reads historical references through the pinned Git revision,
leaves original images unchanged and creates full-canvas PNG derivatives.
No application, inference, speech synthesis, camera or microphone is started.

The book has its own exact dependencies: PyMuPDF 1.28.0 and Pillow 12.2.0 in
`requirements-journal.txt`. They were already installed for this edition; no
packages were installed. `python` below means an interpreter with these exact
versions. If setup is needed, use a separate book environment, not the app's
CPU environment or a sibling project's dependencies. Windows Georgia/Consolas
must be locally installed. Font embedding/subsetting flags are checked; only
document subsets, not font files, are embedded. See ../THIRD_PARTY.md for the
tool-license boundary; embedding flags are not a new rights grant.

From the repository root, choose a **new** candidate directory:

```powershell
python -m unittest discover -s book\tests -q
python book\build_journal.py --output book\output\m1-journal-next
```

For source-image review before rendering, use `--prepare` first and `--render`
after reviewing the same prepared directory. The combined command above runs
both. Preparation emits labelled source sheets; rendering writes native PDF,
offline HTML, `edition.json`, exact expected text and qualification receipts.
Native qualification reopens the PDF and checks exact authored text, page
bounds, intersecting text spans, minimum type size, links and bookmarks:

```powershell
python book\build_journal.py --qualify --output book\output\m1-journal-next
```

Inspect every page's actual render and every selected figure; additionally
inspect representative individual pages at native resolution. Automated bounds,
hashes or contact-sheet creation alone do not establish this review. Dense
historical contact sheets are overviews, not readable transcriptions of every
internal UI label. The offline reader supplies full-image access.

Freeze only after writing an honest review JSON naming the exact `pdfSha256`,
all actually `layoutReviewedPages`, all `reviewedFigures`, representative
`fullResolutionPages` and an empty `unresolved` list. The v2 review also records
the actual isolated headless Edge reader check: 83 pages, 105 decoded images,
35 valid local navigation links, no detected overflow or external page requests.
This is agent review, not owner approval.

```powershell
python book\build_journal.py --freeze book\output\m1-journal-next\manual-review.json --output book\output\m1-journal-next
```

The target derives from `editionId`. **Never overwrite an edition**: a new edition needs
a new identifier and new candidate. The freeze copies only explicit deliverables,
prepared inputs/assets, review/qualification, builder and requirements; records
their SHA-256 inventory; and refuses an existing edition directory.
The portable copied builder can rebuild from those frozen inputs without Git
or the original `.local` captures:

```powershell
python book\editions\Verona-M1-Development-Journal-v2\build_journal.py --from-edition book\editions\Verona-M1-Development-Journal-v2 --output book\output\m1-journal-portable-next
```

The original v1 portability check used a PATH without Git; it is historical,
not a repeated v2 qualification. V2 retains all 105 remaining figure bytes
identically, with a fresh all-page layout review and reader check. Byte-for-byte
PDF reproducibility is not claimed. The v2 PDF SHA-256 is
`fcccc6449e8c0fc230f9f49e1c8531ba594116727016690b74cc2352d0b53721`.

Missing inputs, incompatible versions/fonts, invalid samples, overflow and
changed frozen inputs fail explicitly. Ctrl+C cancels the local build; partial
output is not an edition. Preserve failed receipts, retry in a new directory
and never silently reuse a partial frozen target. Ordinary builds leave originals
and prior editions untouched; the explicit vr-55 withdrawal is documented above. The HTML has no script/network dependency, is fixed-page
rather than mobile-reflowing, and needs its sibling assets directory.

## Authoring-to-edition path

1. Update affected canonical chapters with each implemented workstream.
2. Review exact source citations and diagram meanings. Maintain stable chapter,
   figure and exercise identifiers where those structures exist.
3. Select a portable local HTML/PDF toolchain when a rendered edition is
   requested. Declare/lock its own dependencies; do not borrow another project's
   node_modules, virtual environment or private build assets.
4. Assemble only manifest sources; reject missing inputs, unresolved citations,
   broken internal links and missing assets. Render editable diagrams locally.
5. Produce reading HTML and native PDF, with a second pagination pass if needed
   for accurate TOC and page maps.
6. Inspect actual PDF text, native page count, bookmarks/links, all-direction
   clipping, figures, tables, code wrapping and readable final-scale typography.
   A successful build or contact sheet alone is not full editorial review.
7. Freeze a distinct versioned edition with source/asset hashes, tool versions,
   source revision, chapter ranges and output hashes. Preserve older editions.

Use readable professional reference-book typography and original/cleared cover
assets without publisher logos, copied artwork or implied endorsement. Do not
pad content to a page quota. Only public-safe reviewed source enters any
published edition; private continuity is never an implicit input.

## Boundary

The journal is delivered locally; owner visual approval, upload, release-asset
changes and deployment remain separate gates. Its local production does not
publish the engineering manuscript, move the v0.1.0 tag, install a toolchain,
start a watcher or authorize any upload.
