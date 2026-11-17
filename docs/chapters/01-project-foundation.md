# 01 - Project foundation and boundaries

## What exists

Verona has a repository foundation, contributor rules, a workstream system,
GitHub tracking and a canonical book manuscript. It does not yet have a product
specification or runnable application. Preparation avoids choosing a framework
before knowing what the software must do.

The first decision is an explicit non-decision: retain the ability to reuse a
face-tracking approach without importing another application's product design.
A landmark detector, an expression interpreter and an avatar renderer solve
different problems. Needing one does not imply needing the others.

## Artifact ownership

README.md is the entry point. TODO/00_INDEX.todo identifies finite workstreams;
their numbered files own tasks, prerequisites and completion criteria.
TODO/04_DEVELOPMENT_LEDGER.todo records actions, effects, reasons and evidence.
docs/chapters owns the explanatory manuscript; book/manifest.json owns edition
input order. The ignored continuity store is private resumption material, never
an automatic book source.

## The first product milestone

After the owner supplies the idea, reconcile docs/product-brief.md into a small
first outcome. Choose the simplest compatible stack, state failure and privacy
boundaries, define the real acceptance path, then create implementation
workstreams. Do not convert an illustrative roadmap into an approved commitment.

## Current limits

There are no Verona runtime performance results, UI screenshots, camera tests,
installers or rendered editions. The face-mesh reading in chapter 03 supplies
mechanism-level prior art, not Verona implementation or target-machine evidence.
