# Engineering-book production contract

## Current deliverable

The canonical foundation manuscript is docs/README.md plus the ordered chapters
in manifest.json. The product brief and tracking guide are maintainer references,
not automatically included chapters. No renderer, PDF, cover or frozen edition
has been built. Do not describe this preparation as a completed book.

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

PDF production, visual approval, packaging and publication are separate future
gates. Preparing the manuscript does not install a toolchain, authorize uploads,
start a watcher or deploy a website.
