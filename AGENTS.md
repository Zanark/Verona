# Verona contributor contract

## Scope and startup

Read this file, README.md, TODO/00_INDEX.todo and the affected chapter before
editing. Hydrate the ignored owned .agent-context store when available.
Read docs/product-brief.md for the received speech-to-wireframe-face idea.
Research is authored; the owner chose free/local AMD operation. A bounded
CPU ONNX/PCA numerical probe exists, not yet a face player. Do not invent its
audience, stack, runtime, camera requirements or deployment plan. KardboardCode-VTuber is
read-only prior art, not a scaffold to copy.

## Development

- Follow the installed development-documentation-manual and its canonical
  support documents. Current user scope takes precedence.
- Define bounded numbered TODO workstreams with all eight required fields:
  Status, Milestone, Dependencies, Purpose, Tasks, Acceptance criteria,
  Completion evidence and Completion log. Keep stable vr-NN IDs.
- Preserve unrelated edits. Use the smallest complete change and appropriate
  focused tests. Reuse existing code only after checking fit, rights and coupling.
- Document normal flow, errors, loss/staleness, cancellation, restart, ownership
  and constraints wherever applicable. Never disguise failure as empty success.
- Update the relevant book chapter, index and causal development ledger with
  each meaningful implementation change. Cite real source files and symbols.
- Distinguish planned, implemented, tested, environment-qualified and accepted.
  No invented performance, learning, visual review or approval claims.
- CPU dependencies are pinned in requirements-cpu.txt and isolated under
  .local/cpu-env. Use its Python with `-m unittest discover -s tests -q`.
  The probe is not an adopted renderer, full animation backend or accuracy proof.

## GitHub and identity

Use only the existing manual credential runner and verify authenticated login
Zanark before GitHub operations. Never inspect, print, search, copy or package
its credential file/value. Do not use ambient CLI auth, SSH credentials,
another account or global credential/identity changes.

Every finite workstream maps to one repository issue and one issue item on
Project 15. See docs/github-tracking.md. Indexes and the perpetual ledger are
excluded. Remote tracking writes do not authorize Git commits, pushes, Actions,
releases or deployment. Commit coherent verified milestones promptly only when
authorized, after verifying both author and committer as Zanark and reviewing
the intended staged diff. Preserve required session/co-author trailers.

## Documentation and book

Canonical chapters live in docs/chapters; docs/README.md is the reading index.
book/manifest.json explicitly orders the book source allowlist. Follow
book/README.md before implementing a render pipeline or producing an edition.
Explain mechanisms and tradeoffs, not just file inventories. Keep algorithms
and design principles identifiable as the implementation grows.

Never include .agent-context, raw conversation, credentials, camera endpoints,
personal calibration, recordings or private sibling material in issues,
published docs or book output. No automatic camera/microphone activation.
Preserve separate raw input, diagnostic and public output boundaries if future
requirements introduce media processing.

## Runtime and delivery

No Verona face application currently exists; only a bounded CPU probe.
Do not launch or disturb sibling apps.
Before runtime work, identify stable-use and development/test lanes, processes,
profiles, mutable data and exclusive resources. Different ports/worktrees alone
are not isolation. Use synthetic fixtures; coordinate unavoidable interruptions.
Publication and deployment always remain distinct explicit actions.
