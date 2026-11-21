# Engineering-book production contract

## Current deliverable

The canonical engineering manuscript is docs/README.md plus the ordered chapters
in manifest.json. It remains a living manuscript, not a fully rendered engineering
textbook. The product brief and tracking guide are maintainer references, not
automatically included chapters.

A separate **Milestone 1 development journal** is complete as a local edition:
`book\editions\Verona-M1-Development-Journal-v1\Verona-M1-Development-Journal.pdf`.
Its **84 pages, 31 dated entries and 109 figure occurrences** trace 18-21 November
2026 through research, experiments, corrections and v0.1.0. Warm-paper typography,
dated gutters, timelines and evidence plates make this an authored journal, not
a raw ledger export. `reading.html` beside it opens offline; click an image for
its retained full-resolution PNG. These ignored local files are not on GitHub.

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
`fullResolutionPages` and an empty `unresolved` list. The v1 review also records
the actual isolated headless Edge reader check: 84 pages, 109 decoded images,
35 valid local navigation links, no detected overflow or external page requests.
This is agent review, not owner approval.

```powershell
python book\build_journal.py --freeze book\output\m1-journal-next\manual-review.json --output book\output\m1-journal-next
```

The target derives from `editionId`. **Never overwrite v1**: a new edition needs
a new identifier and new candidate. The freeze copies only explicit deliverables,
prepared inputs/assets, review/qualification, builder and requirements; records
their SHA-256 inventory; and refuses an existing edition directory.
The portable copied builder can rebuild from those frozen inputs without Git
or the original `.local` captures:

```powershell
python book\editions\Verona-M1-Development-Journal-v1\build_journal.py --from-edition book\editions\Verona-M1-Development-Journal-v1 --output book\output\m1-journal-portable-next
```

The actual v1 portability check used a PATH without Git: all 84 rendered page
PNGs and 109 assets matched, and native text/offline HTML were identical.
PDF bytes differed between builds; byte-for-byte PDF reproducibility is not
claimed. The frozen v1 PDF SHA-256 is
`5be1ce931883c9064f8b3e73c47e2cbe076b780703b7a41db3a7b9f806a3aab7`.

Missing inputs, incompatible versions/fonts, invalid samples, overflow and
changed frozen inputs fail explicitly. Ctrl+C cancels the local build; partial
output is not an edition. Preserve failed receipts, retry in a new directory
and never silently reuse a partial frozen target. Originals and prior editions
remain untouched. The HTML has no script/network dependency, is fixed-page
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
