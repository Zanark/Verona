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
