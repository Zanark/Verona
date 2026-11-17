# Verona GitHub tracking

Repository: **Zanark/Verona**, private.
Project: [Verona, owner Project 15](https://github.com/users/Zanark/projects/15),
private and linked to this repository.

## Adoption

Local numbered TODO workstreams own reviewed managed descriptions and statuses.
Stable identity is repository plus vr-NN, not title. Each finite workstream has
one issue and one issue-backed Project item; no duplicate draft cards.
TODO/00_INDEX.todo and perpetual TODO/04_DEVELOPMENT_LEDGER.todo are excluded.
Private continuity, credential files, personal media and raw logs are never
tracking inputs.

Issue bodies are managed working-tree projections, not publication receipts.
Their updates can precede a Git commit or push; Git history and verified remote
refs establish source publication independently. No relative source reference
in a body is a promise that the current projection has already been published.
Local preparation does not grant commit or push authority.

## Status mapping

The actual default Project options are Todo, In Progress and Done.
NOT_STARTED maps to open/Todo; IN_PROGRESS to open/In Progress; BLOCKED to
open/Todo with an explicit blocker in the managed body; DONE to
closed/completed/Done. No guessed Backlog/Ready fields are created.

## Identity and conflicts

Use only the canonical development manual's with_github_token.py runner and
verify login Zanark. Never inspect the credential file/value or change global
auth. Scope capability is not authorization for unrelated GitHub operations.

Issue bodies have a stable verona-workstream marker and a bounded managed
section. Preserve comments and text outside it. Before future writes, compare
the recorded managed body, issue state and Project status to a fresh read.
Conflicting local/remote edits block that workstream; do not silently overwrite
human changes or use last-writer-wins timestamps.

Initial durable mappings/baselines are in TODO/github-tracking.json.
After uncertain failures, inspect stable markers and saved item IDs before
retrying creation. Never reset mappings to make duplicates disappear.

## Execution boundary

Initial preparation uses an explicit session-scoped maintainer operation.
There is no installed synchronizer, scheduled job, hook or GitHub Actions
workflow. On later TODO changes, perform explicit read/compare/update/readback
within that task's authority and persist the same IDs and backlinks.
Remote edits do not automatically rewrite local files; board movement is not
two-way synchronization. Automation adoption needs a separately tested design.
